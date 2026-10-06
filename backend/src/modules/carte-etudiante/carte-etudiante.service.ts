/**
 * Carte d'étudiant numérique — service métier.
 *
 * La carte relie un étudiant à un jeton QR (`qrToken`) unique : ce jeton est
 * encodé dans le QR imprimé et transporté par l'URL publique de vérification.
 * La révocation (StatutAttestation.REVOQUEE) marque la carte comme nulle :
 * toute tentative de vérification publique renvoie alors « révoquée ».
 *
 * Le NIP est un code personnel à 4 chiffres choisi par l'étudiant : il est
 * stocké haché (bcrypt) comme un mot de passe et ne quitte jamais le serveur.
 * La route de définition est ouverte à l'étudiant propriétaire ; la route de
 * vérification (POST /:id/verifier-nip) reste interne pour les partenaires
 * (contrôle d'identité au resto, accès cité, etc.).
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { I18nContext } from 'nestjs-i18n';
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';
import { Prisma, StatutAttestation } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
import {
  CreateCarteEtudianteDto,
  CarteEtudianteQueryDto,
  DefinirNipDto,
  RevoquerCarteDto,
  UpdateCarteEtudianteDto,
  VerifierCartePubliqueDto,
  VerifierNipDto,
} from './carte-etudiante.dto';
import { documentsCarte, CarteImprimable } from './documents';

const CARTE_INCLUDE = {
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
  creePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.CarteEtudianteInclude;

/** Le NIP haché sert uniquement à la comparaison serveur et ne quitte jamais Prisma. */
const CARTE_OMIT: Prisma.CarteEtudianteOmit = { nip: true };

@Injectable()
export class CarteEtudianteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly jwt: JwtService,
  ) {}

  // ------------------------------------------------------------ consultation

  async liste(query: CarteEtudianteQueryDto) {
    const pageDemandee = Number(query.page ?? 1);
    const tailleDemandee = Number(query.pageSize ?? 50);
    const page = Number.isInteger(pageDemandee) && pageDemandee > 0 ? pageDemandee : 1;
    const pageSize = Number.isInteger(tailleDemandee) && tailleDemandee > 0
      ? Math.min(tailleDemandee, 1000)
      : 50;

    const where: Record<string, unknown> = {
      ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
      ...(query.search
        ? {
            OR: [
              { qrToken: { contains: query.search, mode: 'insensitive' } },
              {
                etudiant: {
                  OR: [
                    { matricule: { contains: query.search, mode: 'insensitive' } },
                    { nom: { contains: query.search, mode: 'insensitive' } },
                    { prenom: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.carteEtudiante.findMany({
        where,
        include: CARTE_INCLUDE,
        omit: CARTE_OMIT,
        orderBy: { dateEmission: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.carteEtudiante.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async trouver(id: string) {
    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { id },
      include: CARTE_INCLUDE,
      omit: CARTE_OMIT,
    });
    if (!carte) throw new NotFoundException(I18nContext.current()!.t('carte-etudiante.carte_introuvable'));
    return carte;
  }

  /** Carte de l'étudiant actuellement connecté (portail). */
  async maCarte(user: AuthUser) {
    if (!user.etudiantId) {
      throw new BadRequestException(I18nContext.current()!.t('carte-etudiante.aucun_profil_etudiant_n_est_lie_a_votre_compte'));
    }
    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { etudiantId: user.etudiantId },
      include: CARTE_INCLUDE,
      omit: CARTE_OMIT,
    });
    if (!carte) {
      throw new NotFoundException(I18nContext.current()!.t('carte-etudiante.aucune_carte_n_a_encore_ete_emise_pour_votre_profil'));
    }
    return carte;
  }

  // ------------------------------------------------------------- émission

  private nouveauQrToken(): string {
    return `UP-CARTE-${randomBytes(12).toString('base64url')}`;
  }

  /** Projection d'audit sans identité étudiante, NIP, QR ni chemin de photo. */
  private instantaneAudit(carte: {
    id: string;
    statut: StatutAttestation;
    active: boolean;
    dateValidite: Date | null;
    photoUrl: string | null;
    nip: string | null;
  }) {
    return {
      id: carte.id,
      statut: carte.statut,
      active: carte.active,
      dateValidite: carte.dateValidite,
      photoPresente: Boolean(carte.photoUrl),
      nipConfigure: Boolean(carte.nip),
    };
  }

  async creer(dto: CreateCarteEtudianteDto, user: AuthUser) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: dto.etudiantId },
    });
    if (!etudiant) throw new NotFoundException(I18nContext.current()!.t('carte-etudiante.etudiant_introuvable'));

    const existante = await this.prisma.carteEtudiante.findUnique({
      where: { etudiantId: dto.etudiantId },
      select: { id: true },
    });
    if (existante) {
      throw new ConflictException(I18nContext.current()!.t('carte-etudiante.cet_etudiant_possede_deja_une_carte_existante_qrtoken_revoqu'));
    }

    const nipHash = dto.nip ? await bcrypt.hash(dto.nip, 10) : null;

    return this.prisma.$transaction(async (tx) => {
      const carte = await tx.carteEtudiante.create({
        data: {
          etudiantId: dto.etudiantId,
          qrToken: this.nouveauQrToken(),
          dateValidite: dto.dateValidite ? new Date(dto.dateValidite) : null,
          photoUrl: dto.photoUrl ?? null,
          nip: nipHash,
          creeParId: user.id,
        },
        include: CARTE_INCLUDE,
        omit: CARTE_OMIT,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CARTE_ETUDIANTE_EMISE',
          entite: 'CarteEtudiante',
          entiteId: carte.id,
          details: JSON.stringify({
            avant: null,
            apres: this.instantaneAudit({ ...carte, nip: nipHash }),
            champsModifies: ['active', 'statut', 'dateValidite', 'photoUrl', 'nip'],
          }),
        },
      });
      return carte;
    });
  }

  async modifier(id: string, dto: UpdateCarteEtudianteDto, user: AuthUser) {
    const nipHash = dto.nip ? await bcrypt.hash(dto.nip, 10) : undefined;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CarteEtudiante" WHERE id = ${id} FOR UPDATE`;
      const actuel = await tx.carteEtudiante.findUnique({ where: { id } });
      if (!actuel) throw new NotFoundException(I18nContext.current()!.t('carte-etudiante.carte_introuvable'));
      if (actuel.statut === StatutAttestation.REVOQUEE) {
        throw new BadRequestException(I18nContext.current()!.t('carte-etudiante.cette_carte_a_ete_revoquee_elle_ne_peut_plus_etre_modifiee'));
      }
      const data = {
        ...(dto.dateValidite !== undefined ? { dateValidite: new Date(dto.dateValidite) } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(nipHash !== undefined ? { nip: nipHash } : {}),
      };
      const miseAJour = await tx.carteEtudiante.update({
        where: { id },
        data,
        include: CARTE_INCLUDE,
        omit: CARTE_OMIT,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CARTE_ETUDIANTE_MODIFIEE',
          entite: 'CarteEtudiante',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(actuel),
            apres: this.instantaneAudit({ ...miseAJour, nip: nipHash ?? actuel.nip }),
            champsModifies: Object.keys(data),
          }),
        },
      });
      return miseAJour;
    });
  }

  async revoquer(id: string, dto: RevoquerCarteDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CarteEtudiante" WHERE id = ${id} FOR UPDATE`;
      const actuel = await tx.carteEtudiante.findUnique({ where: { id } });
      if (!actuel) throw new NotFoundException(I18nContext.current()!.t('carte-etudiante.carte_introuvable'));
      if (actuel.statut === StatutAttestation.REVOQUEE) {
        throw new BadRequestException(I18nContext.current()!.t('carte-etudiante.cette_carte_est_deja_revoquee'));
      }
      const miseAJour = await tx.carteEtudiante.update({
        where: { id },
        data: { statut: StatutAttestation.REVOQUEE, motifRevocation: dto.motif, active: false },
        include: CARTE_INCLUDE,
        omit: CARTE_OMIT,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CARTE_ETUDIANTE_REVOQUEE',
          entite: 'CarteEtudiante',
          entiteId: id,
          details: JSON.stringify({
            avant: this.instantaneAudit(actuel),
            apres: this.instantaneAudit({ ...miseAJour, nip: actuel.nip }),
            motifFourni: Boolean(dto.motif),
            champsModifies: ['statut', 'active', 'motifRevocation'],
          }),
        },
      });
      return miseAJour;
    });
  }

  // --------------------------------------------------------------- NIP

  /**
   * L'étudiant définit (ou change) son NIP : 4 à 6 chiffres. Le contrôle
   * d'identité est porté par le jeton JWT — l'étudiant ne peut définir que
   * le NIP de SA propre carte.
   */
  async definirNip(id: string, dto: DefinirNipDto, user: AuthUser) {
    const nipHash = await bcrypt.hash(dto.nip, 10);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CarteEtudiante" WHERE id = ${id} FOR UPDATE`;
      const actuel = await tx.carteEtudiante.findUnique({ where: { id } });
      if (!actuel) throw new NotFoundException(I18nContext.current()!.t('carte-etudiante.carte_introuvable'));
      if (actuel.statut === StatutAttestation.REVOQUEE) {
        throw new BadRequestException(I18nContext.current()!.t('carte-etudiante.cette_carte_est_revoquee_nip_non_autorise'));
      }
      if (user.role !== 'ETUDIANT' || !user.etudiantId || user.etudiantId !== actuel.etudiantId) {
        throw new BadRequestException(I18nContext.current()!.t('carte-etudiante.vous_ne_pouvez_definir_que_le_nip_de_votre_propre_carte'));
      }
      const miseAJour = await tx.carteEtudiante.update({ where: { id }, data: { nip: nipHash } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CARTE_ETUDIANTE_NIP_MODIFIE',
          entite: 'CarteEtudiante',
          entiteId: id,
          details: JSON.stringify({
            avant: { nipConfigure: Boolean(actuel.nip) },
            apres: { nipConfigure: true },
            champsModifies: ['nip'],
          }),
        },
      });
      return { id: miseAJour.id, nipDefini: true };
    });
  }

  /**
   * Vérification interne du NIP par un partenaire (resto U, cité, contrôle
   * d'identité à distance) : retourne simplement { ok } sans révéler
   * d'information annexe.
   */
  async verifierNip(id: string, dto: VerifierNipDto) {
    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { id },
      select: { nip: true, statut: true, active: true, dateValidite: true },
    });
    if (!carte || carte.statut !== StatutAttestation.EMISE || !carte.active || !carte.nip
      || (carte.dateValidite && carte.dateValidite.getTime() < Date.now())) {
      return { ok: false };
    }
    const ok = await bcrypt.compare(dto.nip, carte.nip);
    return { ok };
  }

  // ------------------------------------------------------- impression A4

  /** URL publique transportée par le QR : la page de vérité. */
  private urlVerification(baseUrl: string, carteId: string, qrToken: string): string {
    const params = new URLSearchParams({ carte: carteId, k: qrToken });
    return `${baseUrl.replace(/\/+$/, '')}/#/verification-carte?${params.toString()}`;
  }

  /**
   * Document A4 imprimable. Ouvert dans un nouvel onglet : l'en-tête
   * Authorization n'y arrive pas, le jeton passe en paramètre d'URL.
   */
  async imprimer(
    id: string,
    token: string | undefined,
    baseUrl: string,
  ): Promise<string> {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException(I18nContext.current()!.t('carte-etudiante.jeton_invalide_ou_expire'));
    }

    const carte = await this.trouver(id);
    const urlVerification = this.urlVerification(baseUrl, carte.id, carte.qrToken);
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    return documentsCarte.documentA4(carte as unknown as CarteImprimable, {
      urlVerification,
      nomEtablissement: etablissement,
    });
  }

  // ---------------------------------------------------- vérification publique

  /**
   * Page publique : le QR amène ici. Chaque appel est journalisé, y compris
   * les échecs : un identifiant inconnu est suspect, un jeton mismatch est
   * une falsification probable.
   */
  async verifier(dto: VerifierCartePubliqueDto, ip?: string) {
    const id = String(dto.carte ?? '').trim();
    const jeton = String(dto.k ?? '').trim();

    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { id },
      select: {
        id: true,
        qrToken: true,
        statut: true,
        active: true,
        dateEmission: true,
        dateValidite: true,
        etudiant: { select: { matricule: true, nom: true, prenom: true } },
      },
    });

    if (!carte) {
      await this.prisma.auditLog.create({
        data: {
          action: 'VERIF_CARTE_ECHEC',
          entite: 'cartes-etudiantes',
          entiteId: id,
          details: `Identifiant inconnu ${id}`,
          ip,
        },
      });
      return {
        valide: false,
        raison: "Aucune carte ne correspond à cet identifiant.",
      };
    }

    const jetonOk = carte.qrToken === jeton;
    const statutOk = carte.statut === StatutAttestation.EMISE && carte.active;
    const expiree = Boolean(carte.dateValidite && new Date(carte.dateValidite).getTime() < Date.now());
    const valide = jetonOk && statutOk && !expiree;

    await this.prisma.auditLog.create({
      data: {
        action: valide ? 'VERIF_CARTE_OK' : 'VERIF_CARTE_ECHEC',
        entite: 'cartes-etudiantes',
        entiteId: carte.id,
        details: valide
          ? `Vérification publique réussie`
          : `Jeton ${jetonOk ? 'OK' : 'invalide'} / statut ${carte.statut} / expiration ${expiree ? 'oui' : 'non'}`,
        ip,
      },
    });

    if (!jetonOk) {
      return {
        valide: false,
        raison:
          "Le code de vérification ne correspond pas à cette carte : le document présenté est peut-être une copie falsifiée.",
      };
    }
    if (!statutOk) {
      return {
        valide: false,
        raison: "Cette carte a été révoquée. Elle n'a plus aucune valeur.",
      };
    }
    if (expiree) {
      return {
        valide: false,
        raison: "La validité de cette carte est expirée : renouvelez-la auprès de la scolarité.",
      };
    }

    return {
      valide: true,
      message: 'Carte authentique',
      carte: {
        identifiant: carte.id,
        etudiant: carte.etudiant
          ? `${carte.etudiant.prenom} ${carte.etudiant.nom} (${carte.etudiant.matricule})`
          : null,
        dateEmission: carte.dateEmission,
        dateValidite: carte.dateValidite,
      },
    };
  }
}
