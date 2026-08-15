import { Injectable } from '@nestjs/common';
import { StatutNotification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpClient, numerique } from './otp.client';

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

  /** Envoie un SMS puis consigne la Notification, quelle que soit l'issue. */
  async envoyerUn(cible: CibleSms): Promise<ResultatSms> {
    const numero = numerique(cible.telephone);
    const reponse = await this.otp.envoyer(numero, {
      but: cible.motif ?? 'SMS',
      message: cible.message,
    });

    await this.prisma.notification.create({
      data: {
        telephone: numero,
        message: cible.message,
        motif: cible.motif ?? null,
        destinataireNom: cible.destinataireNom ?? null,
        etudiantId: cible.etudiantId ?? null,
        statut: reponse.ok ? StatutNotification.ENVOYEE : StatutNotification.ECHOUE,
        envoyeParId: cible.envoyeParId ?? null,
        envoyeLe: reponse.ok ? new Date() : null,
        erreur: reponse.ok ? null : (reponse.raison ?? 'Échec inconnu'),
      },
    });

    return { telephone: numero, ok: reponse.ok, erreur: reponse.raison };
  }

  /**
   * Diffusion groupée : les envois partent en parallèle (`Promise.allSettled`
   * derrière chaque appel), un destinataire en échec n'empêche jamais les
   * autres ; chaque ligne est consignée avec son propre statut.
   */
  async envoyerPlusieurs(
    cibles: CibleSms[],
  ): Promise<{ total: number; envoyees: number; echouees: number; resultats: ResultatSms[] }> {
    const resultats = await Promise.all(
      cibles.map((cible) =>
        this.envoyerUn(cible).catch((erreur) => ({
          telephone: numerique(cible.telephone),
          ok: false,
          erreur: erreur instanceof Error ? erreur.message : 'Échec inconnu',
        })),
      ),
    );
    const envoyees = resultats.filter((r) => r.ok).length;
    return {
      total: cibles.length,
      envoyees,
      echouees: cibles.length - envoyees,
      resultats,
    };
  }
}