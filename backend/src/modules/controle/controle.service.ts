/**
 * Cœur du dispositif : le pointage d'une séance par le contrôleur.
 * Reprend exactement les informations du registre papier (enseignant, matière
 * déroulée, durée de la séance) en y ajoutant les preuves numériques :
 * horodatage serveur, QR de la salle, géolocalisation, signature.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttestationMode,
  MethodeVerification,
  Prisma,
  Role,
  StatutPresence,
  StatutSeance,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { QueryDto } from '../../common/dto';
import { distanceMetres, dureeMinutes, toDateOnly, toMinutes } from '../../common/utils';
import { ParametresService } from '../parametres/parametres.module';
import { AttestationService } from '../attestation/attestation.service';
import { ControleQueryDto, PointageDto, SyncPointagesDto, UpdatePointageDto } from './controle.dto';

const CONTROLE_INCLUDE = {
  controleur: { select: { id: true, nom: true, prenom: true, role: true } },
  enseignantRemplacant: { select: { id: true, nom: true, prenom: true } },
  seance: {
    include: {
      salle: true,
      affectation: {
        include: {
          enseignant: { include: { departement: true } },
          matiere: true,
          promotion: { include: { filiere: true } },
        },
      },
    },
  },
};

@Injectable()
export class ControleService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
    private attestation: AttestationService,
  ) {}

  // ------------------------------------------------------------- consultation

  async liste(query: ControleQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateDebut) dateFilter.gte = toDateOnly(query.dateDebut);
    if (query.dateFin) dateFilter.lte = toDateOnly(query.dateFin);

    const where: Prisma.ControleWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.methode ? { methode: query.methode } : {}),
      ...(query.controleurId ? { controleurId: query.controleurId } : {}),
      seance: {
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        ...(query.salleId ? { salleId: query.salleId } : {}),
        ...(query.enseignantId || query.departementId
          ? {
              affectation: {
                ...(query.enseignantId ? { enseignantId: query.enseignantId } : {}),
                ...(query.departementId
                  ? { enseignant: { departementId: query.departementId } }
                  : {}),
              },
            }
          : {}),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.controle.findMany({
        where,
        include: CONTROLE_INCLUDE,
        orderBy: [{ horodatage: 'desc' }],
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.controle.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async findOne(id: string) {
    const controle = await this.prisma.controle.findUnique({
      where: { id },
      include: CONTROLE_INCLUDE,
    });
    if (!controle) throw new NotFoundException('Contrôle introuvable');
    return controle;
  }

  /** Résout un QR de salle : utilisé par l'écran de scan du contrôleur. */
  async parQrSalle(token: string, date?: string) {
    const salle = await this.prisma.salle.findUnique({ where: { qrToken: token } });
    if (!salle) throw new NotFoundException('QR de salle inconnu');

    const jour = toDateOnly(date ?? new Date());
    const seances = await this.prisma.seance.findMany({
      where: { salleId: salle.id, date: jour },
      include: {
        controle: true,
        affectation: {
          include: { enseignant: true, matiere: true, promotion: true },
        },
      },
      orderBy: { heureDebut: 'asc' },
    });
    return { salle, seances };
  }

  // ---------------------------------------------------------------- pointage

  /**
   * Détermine le statut de présence quand le contrôleur ne l'impose pas :
   * arrivée dans la tolérance = présent, au-delà = retard, absence de l'enseignant
   * après le délai configuré = absent.
   */
  private async statutAutomatique(
    heurePrevue: string,
    heureArrivee?: string,
  ): Promise<StatutPresence> {
    if (!heureArrivee) return StatutPresence.ABSENT;

    const tolerance = await this.parametres.nombre('TOLERANCE_RETARD_MIN', 15);
    const seuilAbsence = await this.parametres.nombre('ABSENCE_APRES_MIN', 30);

    const prevue = toMinutes(heurePrevue) ?? 0;
    const arrivee = toMinutes(heureArrivee) ?? 0;
    const ecart = arrivee - prevue;

    if (ecart <= tolerance) return StatutPresence.PRESENT;
    if (ecart <= seuilAbsence) return StatutPresence.RETARD;
    return StatutPresence.ABSENT;
  }

  private async construireDonnees(dto: PointageDto, user: AuthUser) {
    const seance = await this.prisma.seance.findUnique({
      where: { id: dto.seanceId },
      include: { salle: true, affectation: true },
    });
    if (!seance) throw new NotFoundException('Séance introuvable');
    if (seance.statut === StatutSeance.ANNULEE) {
      throw new BadRequestException('Cette séance a été annulée');
    }

    // --- Preuve 1 : QR affiché dans la salle
    const qrObligatoire = await this.parametres.booleen('QR_OBLIGATOIRE', false);
    let qrValide = false;
    if (dto.qrToken) {
      qrValide = !!seance.salle && seance.salle.qrToken === dto.qrToken;
      if (!qrValide) {
        throw new BadRequestException(
          "Le QR scanné ne correspond pas à la salle prévue pour cette séance",
        );
      }
    } else if (qrObligatoire && !dto.horsLigne) {
      throw new BadRequestException('Le scan du QR de la salle est obligatoire');
    }

    // --- Preuve 2 : géolocalisation du contrôleur
    let distance: number | null = null;
    if (dto.latitude != null && dto.longitude != null && seance.salle?.latitude != null) {
      distance = distanceMetres(
        dto.latitude,
        dto.longitude,
        seance.salle.latitude,
        seance.salle.longitude!,
      );
      const geolocObligatoire = await this.parametres.booleen('GEOLOC_OBLIGATOIRE', false);
      if (geolocObligatoire && distance > (seance.salle.rayonMetres ?? 80)) {
        throw new BadRequestException(
          `Vous êtes à ${distance} m de la salle (rayon autorisé : ${seance.salle.rayonMetres} m)`,
        );
      }
    } else if (
      (await this.parametres.booleen('GEOLOC_OBLIGATOIRE', false)) &&
      !dto.horsLigne &&
      seance.salle?.latitude != null
    ) {
      throw new BadRequestException('La position GPS est obligatoire pour ce pointage');
    }

    const statut =
      dto.statut ?? (await this.statutAutomatique(seance.heureDebut, dto.heureArrivee));
    const present = statut !== StatutPresence.ABSENT && statut !== StatutPresence.EXCUSE;

    // --- Preuve 3 : l'enseignant atteste sa présence devant le contrôleur,
    // sur l'appareil de celui-ci (signature, code personnel ou empreinte)
    const attestation = present
      ? await this.attestation.verifierPreuves(seance.affectation.enseignantId, {
          signatureBase64: dto.signatureBase64,
          codePinEnseignant: dto.codePinEnseignant,
          empreinte: dto.empreinte,
        })
      : { mode: AttestationMode.AUCUNE, valide: false };

    if (
      present &&
      !attestation.valide &&
      (await this.parametres.booleen('ATTESTATION_OBLIGATOIRE', true))
    ) {
      throw new BadRequestException(
        "L'enseignant doit attester sa présence devant vous : signature, code personnel ou empreinte",
      );
    }

    if (
      present &&
      !dto.signatureBase64 &&
      (await this.parametres.booleen('SIGNATURE_OBLIGATOIRE', false))
    ) {
      throw new BadRequestException("La signature manuscrite de l'enseignant est obligatoire");
    }
    if (
      present &&
      dto.effectifPresent == null &&
      (await this.parametres.booleen('EFFECTIF_OBLIGATOIRE', true))
    ) {
      throw new BadRequestException("Le nombre d'étudiants présents est obligatoire");
    }

    // --- Durée effective : réelle si connue, sinon durée planifiée
    let duree = dureeMinutes(dto.heureArrivee, dto.heureFinReelle);
    if (!duree && present) duree = dureeMinutes(seance.heureDebut, seance.heureFin);
    if (!present) duree = 0;

    const methode: MethodeVerification = qrValide
      ? MethodeVerification.QR_SALLE
      : distance != null
        ? MethodeVerification.GEOLOCALISATION
        : dto.signatureBase64
          ? MethodeVerification.SIGNATURE
          : MethodeVerification.MANUEL;

    return {
      seance,
      statut,
      presente: present,
      donnees: {
        seanceId: seance.id,
        controleurId: user.id,
        statut,
        attestation: attestation.mode,
        attestationValide: attestation.valide,
        attestationLe: attestation.valide ? new Date() : null,
        empreinteScore: attestation.score ?? null,
        heureArrivee: dto.heureArrivee ?? null,
        heureFinReelle: dto.heureFinReelle ?? null,
        dureeMinutes: duree,
        effectifPresent: dto.effectifPresent ?? null,
        thematiqueTraitee: dto.thematiqueTraitee ?? null,
        observation: dto.observation ?? null,
        methode,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        distanceMetres: distance,
        signatureBase64: dto.signatureBase64 ?? null,
        qrSalleValide: qrValide,
        enseignantRemplacantId: dto.enseignantRemplacantId ?? null,
        horsLigne: dto.horsLigne ?? false,
        horodatage: dto.horodatage ? new Date(dto.horodatage) : new Date(),
      },
    };
  }

  /** Enregistre (ou corrige) le pointage d'une séance. */
  async pointer(dto: PointageDto, user: AuthUser, ip?: string) {
    const { seance, donnees, presente } = await this.construireDonnees(dto, user);

    const existant = await this.prisma.controle.findUnique({ where: { seanceId: seance.id } });
    if (existant && ![Role.ADMIN, Role.DIRECTION].includes(user.role as any)) {
      if (existant.controleurId !== user.id) {
        throw new ForbiddenException(
          'Cette séance a déjà été contrôlée par un autre agent ; seule la direction peut corriger',
        );
      }
    }

    const controle = await this.prisma.controle.upsert({
      where: { seanceId: seance.id },
      create: donnees,
      update: { ...donnees, controleurId: existant?.controleurId ?? user.id },
      include: CONTROLE_INCLUDE,
    });

    await this.prisma.seance.update({
      where: { id: seance.id },
      data: { statut: presente ? StatutSeance.CONTROLEE : StatutSeance.NON_TENUE },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: existant ? 'POINTAGE_CORRECTION' : 'POINTAGE',
        entite: 'Controle',
        entiteId: controle.id,
        details: `Séance ${seance.id} — ${donnees.statut} (${donnees.dureeMinutes} min)`,
        ip,
      },
    });

    return controle;
  }

  async modifier(id: string, dto: UpdatePointageDto, user: AuthUser, ip?: string) {
    const existant = await this.findOne(id);
    if (
      existant.controleurId !== user.id &&
      ![Role.ADMIN, Role.DIRECTION].includes(user.role as any)
    ) {
      throw new ForbiddenException('Seul l’auteur du contrôle ou la direction peut le corriger');
    }
    return this.pointer({ ...dto, seanceId: existant.seanceId } as PointageDto, user, ip);
  }

  /**
   * Synchronisation des pointages saisis hors connexion (couverture réseau
   * aléatoire dans les amphis). Les échecs individuels n'annulent pas le lot.
   */
  async synchroniser(dto: SyncPointagesDto, user: AuthUser, ip?: string) {
    const resultats: Array<{ seanceId: string; ok: boolean; erreur?: string; id?: string }> = [];

    for (const p of dto.pointages) {
      try {
        const c = await this.pointer({ ...p, horsLigne: true }, user, ip);
        resultats.push({ seanceId: p.seanceId, ok: true, id: c.id });
      } catch (e: any) {
        resultats.push({
          seanceId: p.seanceId,
          ok: false,
          erreur: e?.response?.message ?? e?.message ?? 'Erreur inconnue',
        });
      }
    }

    return {
      recus: dto.pointages.length,
      synchronises: resultats.filter((r) => r.ok).length,
      echecs: resultats.filter((r) => !r.ok),
      resultats,
    };
  }

  async supprimer(id: string, user: AuthUser) {
    const controle = await this.findOne(id);
    await this.prisma.controle.delete({ where: { id } });
    await this.prisma.seance.update({
      where: { id: controle.seanceId },
      data: { statut: StatutSeance.PLANIFIEE },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'POINTAGE_SUPPRESSION',
        entite: 'Controle',
        entiteId: id,
        details: `Séance ${controle.seanceId}`,
      },
    });
    return { id };
  }

  /** Journal d'audit (traçabilité des corrections). */
  async audit(query: QueryDto & { entite?: string }) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const where = query.entite ? { entite: query.entite } : {};
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { nom: true, prenom: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }
}
