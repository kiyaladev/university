import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StatutNotification } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OtpClient, numerique } from './otp.client';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';

const CONCURRENCE_MAX_SMS = 10;
const TAILLE_LOT_PERSISTE_SMS = 50;

/** Une diffusion unitaire : un destinataire, un message, les traces utiles. */
export interface CibleSms {
  telephone: string;
  message: string;
  motif?: string;
  destinataireNom?: string | null;
  etudiantId?: string | null;
  envoyeParId?: string | null;
}

export interface ResultatSms {
  telephone: string;
  ok: boolean;
  erreur?: string;
}

/**
 * Envoi de SMS sortants : la seule porte de sortie vers la passerelle, et
 * l'endroit qui consigne chaque tentative dans `Notification` — que l'envoi
 * réussisse ou non. Le statut reflète l'accusé de réception de la passerelle
 * (SMS mis en file, pas encore remis à l'abonné : la remise effective relève
 * de l'agent Termux de la passerelle).
 */
@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpClient,
  ) {}

  /** Envoie une cible via le même chemin groupé, avec trace préalable. */
  async envoyerUn(cible: CibleSms): Promise<ResultatSms> {
    const diffusion = await this.envoyerPlusieurs([cible]);
    const resultat = diffusion.resultats[0];
    return resultat ?? { telephone: numerique(cible.telephone), ok: false, erreur: t('sms.sendOrLogFailure') };
  }

  /**
   * Diffusion groupée par lots bornés : un destinataire en échec n'empêche
   * jamais les autres et chaque tentative est auditée avant l'appel externe.
   */
  async envoyerPlusieurs(
    cibles: CibleSms[],
  ): Promise<{ total: number; envoyees: number; echouees: number; resultats: ResultatSms[] }> {
    const resultats: ResultatSms[] = [];
    for (let debut = 0; debut < cibles.length; debut += TAILLE_LOT_PERSISTE_SMS) {
      const lot = cibles.slice(debut, debut + TAILLE_LOT_PERSISTE_SMS);
      let notifications: { id: string }[];
      try {
        const lotId = randomUUID();
        notifications = await this.prisma.$transaction(async (tx) => {
          const creees: { id: string }[] = [];
          for (const cible of lot) {
            creees.push(
              await tx.notification.create({
                data: {
                  telephone: numerique(cible.telephone),
                  message: cible.message,
                  motif: cible.motif ?? null,
                  destinataireNom: cible.destinataireNom ?? null,
                  etudiantId: cible.etudiantId ?? null,
                  statut: StatutNotification.EN_ATTENTE,
                  envoyeParId: cible.envoyeParId ?? null,
                  envoyeLe: null,
                  erreur: null,
                },
                select: { id: true },
              }),
            );
          }
          // Un lot manuel n'a pas toujours d'émetteur : la trace reste
          // rattachée à personne plutôt qu'attribuée au premier de la liste.
          const emetteur = lot[0]?.envoyeParId ?? null;
          await journaliser(tx, emetteur ? { id: emetteur } : null, 'SMS_DIFFUSION_DEMANDEE', 'Notification', null, {
            lotId,
            canal: 'SMS',
            statutInitial: StatutNotification.EN_ATTENTE,
            nombreDestinataires: creees.length,
            messagesPresents: lot.filter((cible) => Boolean(cible.message)).length,
          });
          return creees;
        });
      } catch {
        // Aucun appel externe ne part sans trace durable de la demande.
        resultats.push(
          ...lot.map((cible) => ({
            telephone: numerique(cible.telephone),
            ok: false,
            erreur: t('sms.sendOrLogFailure'),
          })),
        );
        continue;
      }

      for (let index = 0; index < lot.length; index += CONCURRENCE_MAX_SMS) {
        const ciblesConcurrentes = lot.slice(index, index + CONCURRENCE_MAX_SMS);
        const notificationsConcurrentes = notifications.slice(index, index + CONCURRENCE_MAX_SMS);
        resultats.push(
          ...(await Promise.all(
            ciblesConcurrentes.map((cible, position) =>
              this.envoyerNotification(cible, notificationsConcurrentes[position].id),
            ),
          )),
        );
      }
    }
    const envoyees = resultats.filter((r) => r.ok).length;
    return {
      total: cibles.length,
      envoyees,
      echouees: cibles.length - envoyees,
      resultats,
    };
  }

  private async envoyerNotification(cible: CibleSms, notificationId: string): Promise<ResultatSms> {
    const telephone = numerique(cible.telephone);
    let reponse: Awaited<ReturnType<OtpClient['envoyerSms']>>;
    try {
      reponse = await this.otp.envoyerSms(telephone, cible.message);
    } catch {
      reponse = { ok: false, raison: t('sms.gatewayUnavailable') };
    }

    const statut = reponse.ok ? StatutNotification.ENVOYE : StatutNotification.ECHOUE;
    const erreur = reponse.ok ? null : (reponse.raison ?? t('sms.unknownFailure'));
    try {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { statut, envoyeLe: reponse.ok ? new Date() : null, erreur },
      });
    } catch {
      // L'intention d'envoi reste visible avec le statut EN_ATTENTE si le
      // fournisseur a répondu mais que la base ne peut enregistrer le retour.
      return { telephone, ok: false, erreur: t('sms.sendOrLogFailure') };
    }

    return { telephone, ok: reponse.ok, ...(erreur ? { erreur } : {}) };
  }
}
