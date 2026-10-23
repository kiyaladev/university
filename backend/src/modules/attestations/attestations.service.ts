/**
 * Attestations officielles remises par la scolarité, rendues vérifiables par
 * QR code : n'importe qui (employeur, banque, douane) peut prouver en ligne
 * qu'un document existe, est intact et n'a pas été révoqué.
 *
 * Le QR encode uniquement l'URL publique de vérification, qui porte le numéro
 * ET un jeton aléatoire (qrToken) : impossible de reconstruire le jeton depuis
 * le numéro, un document scanné n'a pas de jumeau forgé.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { t } from '../../common/i18n';
import { Prisma, StatutAttestation, TypeAttestation } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { chargerEtablissement } from '../../common/impression';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
import { documents, AttestationImprimable } from './documents';
import { anneeNumero, prochainNumeroTx } from '../../common/numero';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from '../../common/annee';
import {
  AttestationQueryDto,
  CreateAttestationDto,
  RevoquerAttestationDto,
  UpdateAttestationDto,
  VerifierAttestationDto,
} from './attestations.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';

export const ATTESTATION_INCLUDE = {
  etudiant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      sexe: true,
      dateNaissance: true,
      lieuNaissance: true,
    },
  },
  annee: { select: { libelle: true } },
  promotion: { select: { nom: true, filiere: { select: { nom: true } } } },
  inscription: { select: { numero: true } },
  emisePar: { select: { id: true, nom: true, prenom: true } },
  revoqueePar: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { verifications: true } },
} satisfies Prisma.AttestationInclude;

const PREFIX = 'ATT-';

@Injectable()
export class AttestationsService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
    private jwt: JwtService,
  ) {}

  // ------------------------------------------------------------- consultation

  async liste(query: AttestationQueryDto) {
    const pagination = paginer(query);

    const where: Prisma.AttestationWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.anneeId ? { anneeId: query.anneeId } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.search
        ? {
            OR: [
              { numero: { contains: query.search, mode: 'insensitive' } },
              {
                etudiant: {
                  OR: [
                    { nom: { contains: query.search, mode: 'insensitive' } },
                    { prenom: { contains: query.search, mode: 'insensitive' } },
                    { matricule: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.attestation.findMany({
        where,
        include: ATTESTATION_INCLUDE,
        orderBy: [{ emiseLe: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.attestation.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  async findOne(id: string) {
    const attestation = await this.prisma.attestation.findUnique({
      where: { id },
      include: ATTESTATION_INCLUDE,
    });
    if (!attestation) throw new NotFoundException(t('attestations.attestation_introuvable'));
    return attestation;
  }

  // ------------------------------------------------------------------ émission

  private async anneeRetenue(anneeId?: string) {
    if (anneeId) {
      const annee = await this.prisma.anneeAcademique.findUnique({
        where: { id: anneeId },
      });
      if (!annee) throw new BadRequestException(t('attestations.annee_academique_introuvable'));
      if (annee.cloturee) throw new BadRequestException(t('common.academicYearClosed'));
      return annee;
    }
    return (
      (await this.prisma.anneeAcademique.findFirst({
        where: { active: true, cloturee: false },
      })) ?? null
    );
  }

  /**
   * Numéro séquentiel par année : "ATT-YYYY-00005". Le compteur se lit dans la
   * base (il n'y a pas de table de séquence) ; deux émissions simultanées
   * tentent le même numéro, la contrainte @unique départage et la création
   * recommence avec le suivant.
   */
  private async prochainNumero(tx: Prisma.TransactionClient, annee: string): Promise<string> {
    return prochainNumeroTx(tx, 'attestation', 'numero', `${PREFIX}${annee}-`, 5);
  }

  /** Le jeton encodé dans le QR : aléatoire, unique, impossible à deviner. */
  private nouveauQrToken(): string {
    return `UP-DOC-${randomBytes(12).toString('base64url')}`;
  }

  private instantaneAudit(attestation: any) {
    if (!attestation) return null;
    return {
      id: attestation.id,
      numero: attestation.numero,
      type: attestation.type,
      statut: attestation.statut,
      anneeId: attestation.anneeId,
      promotionId: attestation.promotionId,
      inscriptionId: attestation.inscriptionId,
      etudiantId: attestation.etudiantId,
    };
  }

  async creer(dto: CreateAttestationDto, user: AuthUser) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: dto.etudiantId },
    });
    if (!etudiant) throw new NotFoundException(t('attestations.etudiant_introuvable'));

    const inscriptionInitiale = dto.inscriptionId ? await this.prisma.inscription.findUnique({
      where: { id: dto.inscriptionId }, select: { anneeId: true },
    }) : null;
    if (dto.inscriptionId && !inscriptionInitiale) {
      throw new BadRequestException(t('attestations.inscription_introuvable'));
    }
    const annee = await this.anneeRetenue(dto.anneeId ?? inscriptionInitiale?.anneeId);

    // Dédoublonnage : une seule attestation émise du même type, même année,
    // pour le même étudiant. La révocation de l'existante rouvre le droit
    // d'en émettre une nouvelle.
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const attestation = await this.prisma.$transaction(async (tx) => {
          const promotion = dto.promotionId ? await tx.promotion.findUnique({
            where: { id: dto.promotionId },
            select: { id: true, anneeId: true, annee: { select: { libelle: true } } },
          }) : null;
          if (dto.promotionId && !promotion) {
            throw new BadRequestException(t('common.academicPromotionNotFound'));
          }
          if (dto.promotionId && annee?.id) {
            await exigerPromotionMemeAnnee(tx, dto.promotionId, annee.id);
          }
          const anneeIdRetenue = annee?.id ?? promotion?.anneeId ?? null;
          await exigerAnneeOuverte(tx, anneeIdRetenue);
          // Même verrou pour l’émission et le changement de type : le contrôle
          // d’unicité reste vrai quand plusieurs documents du même étudiant changent.
          await tx.$queryRaw`SELECT id FROM "Etudiant" WHERE id = ${dto.etudiantId} FOR UPDATE`;
          let promotionIdRetenue = dto.promotionId ?? null;
          if (dto.inscriptionId) {
            await tx.$queryRaw`SELECT id FROM "Inscription" WHERE id = ${dto.inscriptionId} FOR SHARE`;
            const inscription = await tx.inscription.findUnique({
              where: { id: dto.inscriptionId },
              select: { etudiantId: true, anneeId: true, promotionId: true },
            });
            if (!inscription) throw new BadRequestException(t('attestations.inscription_introuvable'));
            if (inscription.etudiantId !== dto.etudiantId || inscription.anneeId !== anneeIdRetenue
              || (dto.promotionId && inscription.promotionId !== dto.promotionId)) {
              throw new BadRequestException(t('attestations.rattachement_incoherent'));
            }
            promotionIdRetenue = inscription.promotionId;
            await exigerPromotionMemeAnnee(tx, promotionIdRetenue, inscription.anneeId);
          }
          const numeroAnnee = anneeNumero(annee?.libelle ?? promotion?.annee.libelle, 'debut');
          const doublon = await tx.attestation.findFirst({
            where: {
              etudiantId: dto.etudiantId,
              type: dto.type as TypeAttestation,
              anneeId: anneeIdRetenue,
              statut: StatutAttestation.EMISE,
            },
          });
          if (doublon) {
            throw new ConflictException(
              t('attestations.une_attestation_doublon_numero_est_deja_emise_pour_cet_etudi', { numero: doublon.numero }),
            );
          }

          const numero = await this.prochainNumero(tx, numeroAnnee);
          const cree = await tx.attestation.create({
            data: {
              numero,
              type: dto.type,
              motif: dto.motif ?? null,
              qrToken: this.nouveauQrToken(),
              etudiantId: dto.etudiantId,
              anneeId: anneeIdRetenue,
              promotionId: promotionIdRetenue,
              inscriptionId: dto.inscriptionId ?? null,
              emiseParId: user.id,
            },
            include: ATTESTATION_INCLUDE,
          });
          await journaliser(tx, user, 'ATTESTATION_EMISE', 'Attestation', cree.id, { avant: null, apres: this.instantaneAudit(cree) });
          return cree;
        });
        return attestation;
      } catch (e: any) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('attestations.numero_d_attestation_temporairement_indisponible_reessayez'));
  }

  // ------------------------------------------------------------------ gestion

  async modifier(id: string, dto: UpdateAttestationDto, user: AuthUser) {
    const attestation = await this.findOne(id);
    await exigerAnneeOuverte(this.prisma, attestation.anneeId);
    if (attestation.statut === StatutAttestation.REVOQUEE) {
      throw new BadRequestException(t('attestations.cette_attestation_a_ete_revoquee_elle_ne_peut_plus_etre_modi'));
    }
    if (dto.type == null && dto.motif == null) {
      throw new BadRequestException(t('attestations.rien_a_modifier_renseignez_un_type_ou_un_motif'));
    }

    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, attestation.anneeId);
      await tx.$queryRaw`SELECT id FROM "Etudiant" WHERE id = ${attestation.etudiantId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Attestation" WHERE id = ${id} FOR UPDATE`;
      const actuel = await tx.attestation.findUnique({ where: { id }, include: ATTESTATION_INCLUDE });
      if (!actuel) throw new NotFoundException(t('attestations.attestation_introuvable'));
      if (actuel.statut === StatutAttestation.REVOQUEE) {
        throw new BadRequestException(t('attestations.cette_attestation_a_ete_revoquee_elle_ne_peut_plus_etre_modi'));
      }
      if (dto.type != null && dto.type !== actuel.type) {
        const doublon = await tx.attestation.findFirst({
          where: { id: { not: id }, etudiantId: actuel.etudiantId, anneeId: actuel.anneeId,
            type: dto.type, statut: StatutAttestation.EMISE },
        });
        if (doublon) throw new ConflictException(t('attestations.une_attestation_doublon_numero_est_deja_emise_pour_cet_etudi', { numero: doublon.numero }));
      }
      const miseAJour = await tx.attestation.update({
        where: { id },
        data: {
          ...(dto.type != null ? { type: dto.type } : {}),
          ...(dto.motif != null ? { motif: dto.motif } : {}),
        },
        include: ATTESTATION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ATTESTATION_MODIFICATION',
        'Attestation',
        id,
        { avant: this.instantaneAudit(actuel), apres: this.instantaneAudit(miseAJour) },
      );
      return miseAJour;
    });
  }

  /** Révocation : la décision inverse de l'émission, la mémoire reste intacte. */
  async revoquer(id: string, dto: RevoquerAttestationDto, user: AuthUser) {
    // La révocation reste possible après clôture pour invalider un document frauduleux.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Attestation" WHERE id = ${id} FOR UPDATE`;
      const attestation = await tx.attestation.findUnique({ where: { id }, include: ATTESTATION_INCLUDE });
      if (!attestation) throw new NotFoundException(t('attestations.attestation_introuvable'));
      if (attestation.statut === StatutAttestation.REVOQUEE) {
        throw new BadRequestException(t('attestations.cette_attestation_est_deja_revoquee'));
      }
      const miseAJour = await tx.attestation.update({
        where: { id },
        data: {
          statut: StatutAttestation.REVOQUEE,
          motifRevocation: dto.motifRevocation,
          revoqueeLe: new Date(),
          revoqueeParId: user.id,
        },
        include: ATTESTATION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ATTESTATION_REVOCATION',
        'Attestation',
        id,
        { avant: this.instantaneAudit(attestation), apres: this.instantaneAudit(miseAJour) },
      );
      return miseAJour;
    });
  }

  /**
   * Suppression interdite par choix produit : une attestation est un document
   * probant, elle se révoque, jamais elle ne s'efface.
   */
  async supprimerInterdit() {
    throw new ForbiddenException(t('attestations.la_suppression_d_attestations_est_interdite_ces_documents_so'));
  }

  // ------------------------------------------------------------- documentation

  /** Document A4 imprimable, ouvert dans un nouvel onglet : jeton vérifié à la main. */
  async imprimer(
    id: string,
    token: string | undefined,
    baseUrl: string,
    ip?: string,
  ): Promise<string> {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException(t('attestations.jeton_invalide_ou_expire'));
    }

    const attestation = await this.prisma.attestation.findUnique({
      where: { id },
      include: ATTESTATION_INCLUDE,
    });
    if (!attestation) throw new NotFoundException(t('attestations.attestation_introuvable'));

    const urlVerification = this.urlVerification(baseUrl, attestation.numero, attestation.qrToken);
    const etablissement = await chargerEtablissement(this.prisma);
    return documents.documentA4(attestation as unknown as AttestationImprimable, {
      urlVerification,
      etablissement,
    });
  }

  /**
   * L'URL portée par le QR : la page publique lit ?ref= et ?k= pour consulter
   * la vérité sans jamais refaire confiance au porteur du document.
   */
  private urlVerification(baseUrl: string, numero: string, qrToken: string): string {
    const params = new URLSearchParams({ ref: numero, k: qrToken });
    // La SPA utilise un routeur en mode hash : l'URL publique du QR doit
    // porter « /#/ » avant le chemin, sinon le serveur renvoie une 404.
    return `${baseUrl.replace(/\/+$/, '')}/#/verification?${params.toString()}`;
  }

  // --------------------------------------------------------------- vérification

  /**
   * Page publique : le QR amène ici. Chaque appel est journalisé — y compris
   * les échecs, qui sont précisément les tentatives de fraude à garder.
   * Un numéro valide avec un mauvais jeton est aggravant : le document existe,
   * mais le QR est copié ou falsifié.
   */
  async verifier(dto: VerifierAttestationDto, ip?: string) {
    const ref = dto.ref.trim();
    const jeton = dto.k.trim();

    const attestation = await this.prisma.attestation.findUnique({
      where: { numero: ref },
      include: {
        etudiant: {
          select: { nom: true, prenom: true, matricule: true },
        },
        annee: { select: { libelle: true } },
        promotion: { select: { nom: true, filiere: { select: { nom: true } } } },
      },
    });

    // Référence inconnue : le numéro imprimé n'existe pas (document forgé).
    // La table VerificationAttestation exige une attestation : ces échecs-là
    // rejoignent le journal d'audit pour être comptés et surveillés.
    if (!attestation) {
      await this.tracerEchec(ref, ip);
      return {
        valide: false,
        raison:
          "Le numéro indiqué ne correspond à aucune attestation émise. Vérifiez la saisie : un document manuscrit ou un numéro non présent dans le registre est suspect.",
      };
    }

    const jetonOk = attestation.qrToken === jeton;
    const statutOk = attestation.statut === StatutAttestation.EMISE;
    const valide = jetonOk && statutOk;

    const verification = await this.prisma.verificationAttestation.create({
      data: {
        attestationId: attestation.id,
        ip: ip ? String(ip) : null,
        resultat: valide,
      },
    });

    if (!jetonOk) {
      await this.prisma.auditLog.create({
        data: {
          action: 'VERIF_ATTESTATION_ECHEC',
          entite: 'attestations',
          entiteId: ref,
          details: `Jeton mismatch pour ${ref} (fraude probable ?)`,
          ip,
        },
      });
      return {
        valide: false,
        raison:
          "Le code de vérification ne correspond pas à cette attestation : le document présenté est peut-être une copie falsifiée.",
      };
    }

    if (!statutOk) {
      return {
        valide: false,
        raison: `Cette attestation a été révoquée le ${attestation.revoqueeLe?.toLocaleDateString('fr-FR') ?? '—'}. Elle n'a plus aucune valeur.`,
      };
    }

    return {
      valide: true,
      verificationId: verification.id,
      message: 'Attestation authentique',
      attestation: {
        numero: attestation.numero,
        type: attestation.type,
        motif: attestation.motif,
        emiseLe: attestation.emiseLe,
        etudiant: attestation.etudiant,
        annee: attestation.annee?.libelle ?? null,
        promotion: attestation.promotion
          ? `${attestation.promotion.nom} (${attestation.promotion.filiere.nom})`
          : null,
      },
    };
  }

  private async tracerEchec(ref: string, ip?: string) {
    await this.prisma.auditLog.create({
      data: {
        action: 'VERIF_ATTESTATION_ECHEC',
        entite: 'attestations',
        entiteId: ref,
        details: `Numéro inconnu ${ref}`,
        ip,
      },
    });
  }

  /** Journal des scans d'une attestation (direction générale). */
  async verifications(id: string) {
    await this.findOne(id);
    return this.prisma.verificationAttestation.findMany({
      where: { attestationId: id },
      orderBy: { verifieeLe: 'desc' },
      take: 200,
    });
  }
}
