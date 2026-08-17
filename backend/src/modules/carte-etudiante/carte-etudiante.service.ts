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
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';
import { StatutAttestation } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
import {
  CreateCarteEtudianteDto,
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
      photoUrl: true,
    },
  },
  creePar: { select: { id: true, nom: true, prenom: true } },
} as const;

@Injectable()
export class CarteEtudianteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly jwt: JwtService,
  ) {}

  // ------------------------------------------------------------ consultation

  async liste(query: { page?: number; pageSize?: number; all?: string; search?: string; etudiantId?: string }) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

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
        orderBy: { dateEmission: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.carteEtudiante.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async trouver(id: string) {
    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { id },
      include: CARTE_INCLUDE,
    });
    if (!carte) throw new NotFoundException('Carte introuvable');
    return carte;
  }

  /** Carte de l'étudiant actuellement connecté (portail). */
  async maCarte(user: AuthUser) {
    if (!user.etudiantId) {
      throw new BadRequestException("Aucun profil étudiant n'est lié à votre compte.");
    }
    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { etudiantId: user.etudiantId },
      include: CARTE_INCLUDE,
    });
    if (!carte) {
      throw new NotFoundException("Aucune carte n'a encore été émise pour votre profil.");
    }
    return carte;
  }

  // ------------------------------------------------------------- émission

  private nouveauQrToken(): string {
    return `UP-CARTE-${randomBytes(12).toString('base64url')}`;
  }

  async creer(dto: CreateCarteEtudianteDto, user: AuthUser) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: dto.etudiantId },
    });
    if (!etudiant) throw new NotFoundException('Étudiant introuvable');

    const existante = await this.prisma.carteEtudiante.findUnique({
      where: { etudiantId: dto.etudiantId },
    });
    if (existante) {
      throw new ConflictException(
        `Cet étudiant possède déjà une carte (${existante.qrToken}). Révoquez-la d'abord pour en émettre une nouvelle.`,
      );
    }

    const nipHash = dto.nip ? await bcrypt.hash(dto.nip, 10) : null;

    const carte = await this.prisma.carteEtudiante.create({
      data: {
        etudiantId: dto.etudiantId,
        qrToken: this.nouveauQrToken(),
        dateValidite: dto.dateValidite ? new Date(dto.dateValidite) : null,
        photoUrl: dto.photoUrl ?? null,
        nip: nipHash,
        creeParId: user.id,
      },
      include: CARTE_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CARTE_ETUDIANTE_EMISE',
        entite: 'CarteEtudiante',
        entiteId: carte.id,
        details: `${etudiant.matricule} ${etudiant.nom} ${etudiant.prenom}`,
      },
    });

    return carte;
  }

  async modifier(id: string, dto: UpdateCarteEtudianteDto, user: AuthUser) {
    const carte = await this.trouver(id);
    if (carte.statut === StatutAttestation.REVOQUEE) {
      throw new BadRequestException(
        'Cette carte a été révoquée : elle ne peut plus être modifiée.',
      );
    }
    const nipHash = dto.nip ? await bcrypt.hash(dto.nip, 10) : undefined;
    const miseAJour = await this.prisma.carteEtudiante.update({
      where: { id },
      data: {
        ...(dto.dateValidite !== undefined ? { dateValidite: new Date(dto.dateValidite) } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(nipHash !== undefined ? { nip: nipHash } : {}),
      },
      include: CARTE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CARTE_ETUDIANTE_MODIFIEE',
        entite: 'CarteEtudiante',
        entiteId: id,
      },
    });
    return miseAJour;
  }

  async revoquer(id: string, dto: RevoquerCarteDto, user: AuthUser) {
    const carte = await this.trouver(id);
    if (carte.statut === StatutAttestation.REVOQUEE) {
      throw new BadRequestException('Cette carte est déjà révoquée.');
    }
    const miseAJour = await this.prisma.carteEtudiante.update({
      where: { id },
      data: {
        statut: StatutAttestation.REVOQUEE,
        motifRevocation: dto.motif,
        active: false,
      },
      include: CARTE_INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CARTE_ETUDIANTE_REVOQUEE',
        entite: 'CarteEtudiante',
        entiteId: id,
        details: dto.motif,
      },
    });
    return miseAJour;
  }

  // --------------------------------------------------------------- NIP

  /**
   * L'étudiant définit (ou change) son NIP : 4 à 6 chiffres. Le contrôle
   * d'identité est porté par le jeton JWT — l'étudiant ne peut définir que
   * le NIP de SA propre carte.
   */
  async definirNip(id: string, dto: DefinirNipDto, user: AuthUser) {
    const carte = await this.trouver(id);
    if (carte.statut === StatutAttestation.REVOQUEE) {
      throw new BadRequestException('Cette carte est révoquée : NIP non autorisé.');
    }
    if (user.role !== 'ETUDIANT' || !user.etudiantId || user.etudiantId !== carte.etudiantId) {
      throw new BadRequestException('Vous ne pouvez définir que le NIP de votre propre carte.');
    }
    const nipHash = await bcrypt.hash(dto.nip, 10);
    const miseAJour = await this.prisma.carteEtudiante.update({
      where: { id },
      data: { nip: nipHash },
      select: { id: true, nip: false },
    });
    return { id: miseAJour.id, nipDefini: true };
  }

  /**
   * Vérification interne du NIP par un partenaire (resto U, cité, contrôle
   * d'identité à distance) : retourne simplement { ok } sans révéler
   * d'information annexe.
   */
  async verifierNip(id: string, dto: VerifierNipDto) {
    const carte = await this.prisma.carteEtudiante.findUnique({
      where: { id },
      select: { nip: true, statut: true, etudiantId: true },
    });
    if (!carte || carte.statut !== StatutAttestation.EMISE || !carte.nip) {
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
      throw new UnauthorizedException('Jeton invalide ou expiré');
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
      include: {
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
    const valide = jetonOk && statutOk;

    await this.prisma.auditLog.create({
      data: {
        action: valide ? 'VERIF_CARTE_OK' : 'VERIF_CARTE_ECHEC',
        entite: 'cartes-etudiantes',
        entiteId: carte.id,
        details: valide
          ? `Vérification publique réussie`
          : `Jeton ${jetonOk ? 'OK' : 'invalide'} / statut ${carte.statut}`,
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
        raison: `Cette carte a été révoquée${carte.motifRevocation ? ` (motif : ${carte.motifRevocation})` : ''}. Elle n'a plus aucune valeur.`,
      };
    }
    if (carte.dateValidite && new Date(carte.dateValidite) < new Date()) {
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