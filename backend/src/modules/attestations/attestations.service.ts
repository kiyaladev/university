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
import { Prisma, StatutAttestation, TypeAttestation } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
import { documents, AttestationImprimable } from './documents';
import {
  AttestationQueryDto,
  CreateAttestationDto,
  RevoquerAttestationDto,
  UpdateAttestationDto,
  VerifierAttestationDto,
} from './attestations.dto';

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
  annee: true,
  promotion: { include: { filiere: true } },
  inscription: true,
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
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.attestation.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async findOne(id: string) {
    const attestation = await this.prisma.attestation.findUnique({
      where: { id },
      include: ATTESTATION_INCLUDE,
    });
    if (!attestation) throw new NotFoundException('Attestation introuvable');
    return attestation;
  }

  // ------------------------------------------------------------------ émission

  private async anneeRetenue(anneeId?: string) {
    if (anneeId) {
      const annee = await this.prisma.anneeAcademique.findUnique({
        where: { id: anneeId },
      });
      if (!annee) throw new BadRequestException('Année académique introuvable');
      return annee;
    }
    return (
      (await this.prisma.anneeAcademique.findFirst({
        where: { active: true, cloturee: false },
      })) ?? null
    );
  }

  /** Année du numéro : celle de l'année scolaire retenue, sinon l'année civile. */
  private anneeNumero(libelleAnnee?: string): string {
    if (libelleAnnee) {
      const debut = libelleAnnee.split('-')[0]?.trim();
      if (debut && /^\d{4}$/.test(debut)) return debut;
    }
    return String(new Date().getFullYear());
  }

  /**
   * Numéro séquentiel par année : "ATT-YYYY-00005". Le compteur se lit dans la
   * base (il n'y a pas de table de séquence) ; deux émissions simultanées
   * tentent le même numéro, la contrainte @unique départage et la création
   * recommence avec le suivant.
   */
  private async prochainNumero(tx: Prisma.TransactionClient, annee: string): Promise<string> {
    const prefixe = `${PREFIX}${annee}-`;
    const existantes = await tx.attestation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
    const max = existantes.reduce((m, a) => {
      const n = Number(a.numero.slice(prefixe.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefixe}${String(max + 1).padStart(5, '0')}`;
  }

  /** Le jeton encodé dans le QR : aléatoire, unique, impossible à deviner. */
  private nouveauQrToken(): string {
    return `UP-DOC-${randomBytes(12).toString('base64url')}`;
  }

  async creer(dto: CreateAttestationDto, user: AuthUser) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: dto.etudiantId },
    });
    if (!etudiant) throw new NotFoundException('Étudiant introuvable');

    const annee = await this.anneeRetenue(dto.anneeId);
    const anneeNumero = this.anneeNumero(annee?.libelle);

    // Dédoublonnage : une seule attestation émise du même type, même année,
    // pour le même étudiant. La révocation de l'existante rouvre le droit
    // d'en émettre une nouvelle.
    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const attestation = await this.prisma.$transaction(async (tx) => {
          const doublon = await tx.attestation.findFirst({
            where: {
              etudiantId: dto.etudiantId,
              type: dto.type as TypeAttestation,
              anneeId: annee?.id ?? null,
              statut: StatutAttestation.EMISE,
            },
          });
          if (doublon) {
            throw new ConflictException(
              `Une attestation ${doublon.numero} est déjà émise pour cet étudiant sur ce type / cette année : révoquez-la d'abord pour en émettre une nouvelle.`,
            );
          }

          const numero = await this.prochainNumero(tx, anneeNumero);
          return tx.attestation.create({
            data: {
              numero,
              type: dto.type,
              motif: dto.motif ?? null,
              qrToken: this.nouveauQrToken(),
              etudiantId: dto.etudiantId,
              anneeId: annee?.id ?? null,
              promotionId: dto.promotionId ?? null,
              inscriptionId: dto.inscriptionId ?? null,
              emiseParId: user.id,
            },
            include: ATTESTATION_INCLUDE,
          });
        });

        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'ATTESTATION_EMISE',
            entite: 'Attestation',
            entiteId: attestation.id,
            details: `${attestation.numero} — ${attestation.type} (${etudiant.matricule} ${etudiant.nom} ${etudiant.prenom})`,
          },
        });
        return attestation;
      } catch (e: any) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException("Numéro d'attestation temporairement indisponible, réessayez.");
  }

  // ------------------------------------------------------------------ gestion

  async modifier(id: string, dto: UpdateAttestationDto, user: AuthUser) {
    const attestation = await this.findOne(id);
    if (attestation.statut === StatutAttestation.REVOQUEE) {
      throw new BadRequestException(
        'Cette attestation a été révoquée : elle ne peut plus être modifiée.',
      );
    }
    if (dto.type == null && dto.motif == null) {
      throw new BadRequestException('Rien à modifier : renseignez un type ou un motif.');
    }

    const miseAJour = await this.prisma.attestation.update({
      where: { id },
      data: {
        ...(dto.type != null ? { type: dto.type } : {}),
        ...(dto.motif != null ? { motif: dto.motif } : {}),
      },
      include: ATTESTATION_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ATTESTATION_MODIFICATION',
        entite: 'Attestation',
        entiteId: id,
        details: `Type ${attestation.type} → ${miseAJour.type} / motif revu`,
      },
    });
    return miseAJour;
  }

  /** Révocation : la décision inverse de l'émission, la mémoire reste intacte. */
  async revoquer(id: string, dto: RevoquerAttestationDto, user: AuthUser) {
    const attestation = await this.findOne(id);
    if (attestation.statut === StatutAttestation.REVOQUEE) {
      throw new BadRequestException('Cette attestation est déjà révoquée.');
    }

    const miseAJour = await this.prisma.attestation.update({
      where: { id },
      data: {
        statut: StatutAttestation.REVOQUEE,
        motifRevocation: dto.motifRevocation,
        revoqueeLe: new Date(),
        revoqueeParId: user.id,
      },
      include: ATTESTATION_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ATTESTATION_REVOCATION',
        entite: 'Attestation',
        entiteId: id,
        details: `${miseAJour.numero} — motif : ${dto.motifRevocation}`,
      },
    });
    return miseAJour;
  }

  /**
   * Suppression interdite par choix produit : une attestation est un document
   * probant, elle se révoque, jamais elle ne s'efface.
   */
  async supprimerInterdit() {
    throw new ForbiddenException(
      "La suppression d'attestations est interdite : ces documents sont conservés pour leur valeur probante (annales, opposabilité aux tiers). Révoquez l'attestation au lieu de la supprimer.",
    );
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
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    const attestation = await this.prisma.attestation.findUnique({
      where: { id },
      include: ATTESTATION_INCLUDE,
    });
    if (!attestation) throw new NotFoundException('Attestation introuvable');

    const urlVerification = this.urlVerification(baseUrl, attestation.numero, attestation.qrToken);
    const nomEtablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    return documents.documentA4(attestation as unknown as AttestationImprimable, {
      urlVerification,
      nomEtablissement,
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
        annee: true,
        promotion: { include: { filiere: true } },
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
        raison: `Cette attestation a été révoquée le ${attestation.revoqueeLe?.toLocaleDateString('fr-FR') ?? '—'} (motif : ${attestation.motifRevocation ?? 'non précisé'}). Elle n'a plus aucune valeur.`,
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