import { AuditQueryDto } from './controle.dto';
/**
 * Cœur du dispositif : le pointage d'une séance par le contrôleur.
 * Reprend exactement les informations du registre papier (enseignant, matière
 * déroulée, durée de la séance) en y ajoutant les preuves numériques :
 * horodatage serveur, QR de la salle, géolocalisation, signature.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttestationMode, MethodeVerification, Prisma, Role, StatutPresence, StatutSeance } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser } from '../../../common/decorators';
import { distanceMetres, dureeMinutes, toDateOnly, toMinutes } from '../../../common/utils';
import { ParametresService } from '../../socle/parametres/parametres.service';
import { PresencePreuvesService, CODE_PREUVE_DEJA_UTILISEE } from '../presence-preuves/presence-preuves.service';
import { ControleQueryDto, PointageDto, SyncPointagesDto, UpdatePointageDto } from './controle.dto';
import { t } from '../../../common/i18n';
import { exigerAnneeOuverte } from '../../../common/annee';
import { paginer, pagine } from '../../../common/pagination';
import { journaliser } from '../../../common/audit';
import { estChefDeDepartement } from '../../../common/perimetre';
import { erreur } from '../../../common/erreur';

/** Rôles qui corrigent le pointage d'une séance déjà consignée. */
const ROLES_CORRECTION: Role[] = [Role.ADMIN, Role.DIRECTION];

const AUDIT_DETAILS_LIBRES_A_MASQUER = new Set([
  'PAIE_CREEE',
  'PAIE_RECALCULEE',
  'PAIE_VALIDEE',
  'PAIE_PAYEE',
  'PAIE_SUPPRIMEE',
  'RESERVATION_CREEE',
  'DEMANDE_DOC_REJETEE',
  'TICKET_OUVERT',
  'ETUDIANT_CREE',
  'INSCRIPTION_CREE',
  'EXAMEN_SCAN_VALIDE',
  'EXAMEN_SCAN_REJETE',
  'PATRIMOINE_REPARATION_DECLAREE',
]);
// Ces actions ont maintenant un format structuré produit par des projections
// minimales. Les anciennes entrées restent masquées car leur texte libre ne
// se parse pas comme un état avant/après.
const AUDIT_DETAILS_STRUCTURES_AUTORISES = new Set([
  'RESERVATION_CREEE',
  'DEMANDE_DOC_REJETEE',
  'TICKET_OUVERT',
  'PATRIMOINE_REPARATION_DECLAREE',
  'PLAGIAT_CONFIRME',
  'PLAGIAT_ACQUITTE',
  'PLAGIAT_SUSPICION_OUVERTE',
  'PLAGIAT_SUSPICION_REEVALUEE',
  'PLAGIAT_INDICE_MAJ',
]);

/**
 * État d'un pointage déjà consigné. Une correction repart de cet état : elle
 * ne change que les champs transmis, et ne rejoue ni les preuves ni les
 * contrôles de saisie.
 */
export interface PointageConsigne {
  seanceId: string;
  statut: StatutPresence;
  heureArrivee: string | null;
  heureFinReelle: string | null;
  effectifPresent: number | null;
  thematiqueTraitee: string | null;
  observation: string | null;
  signatureBase64: string | null;
  attestation: AttestationMode;
  attestationValide: boolean;
  attestationLe: Date | null;
  empreinteScore: number | null;
  methode: MethodeVerification;
  qrSalleValide: boolean;
  latitude: number | null;
  longitude: number | null;
  distanceMetres: number | null;
  enseignantRemplacantId: string | null;
  horsLigne: boolean;
  horodatage: Date;
}

/**
 * Données du pointage qui ne dépendent pas de l'attestation de l'enseignant.
 * Elles sont établies avant la transaction : l'attestation, elle, est vérifiée
 * dans la transaction, avec la consommation de la preuve.
 */
interface BasePointage {
  seance: any;
  statut: StatutPresence;
  presente: boolean;
  duree: number;
  methode: MethodeVerification;
  qrValide: boolean;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  preuveFournie: boolean;
}

/**
 * Le contrôle relu, sans son identifiant client : celui-ci sert à reconnaître
 * le renvoi du même pointage, il ne sort pas de l'API.
 */
function sansIdClient<T extends { idClient?: string | null }>(controle: T): Omit<T, 'idClient'> {
  const { idClient: _idClient, ...reste } = controle;
  return reste;
}

function retirerTexteLibreAudit(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(retirerTexteLibreAudit);
  if (!valeur || typeof valeur !== 'object') return valeur;
  return Object.fromEntries(
    Object.entries(valeur)
      .filter(([cle]) => !['motif', 'retireeMotif', 'commentaire'].includes(cle))
      .map(([cle, contenu]) => [
        cle,
        cle === 'champsModifies' && Array.isArray(contenu)
          ? contenu.filter((champ) => !['motif', 'retireeMotif', 'commentaire'].includes(String(champ)))
          : retirerTexteLibreAudit(contenu),
      ]),
  );
}

function detailsAuditNettoyes(action: string, details: string | null): string | null {
  if (typeof details !== 'string') return details;
  if (action === 'SMS_DIFFUSION_DEMANDEE') {
    try {
      const detail = JSON.parse(details);
      const nombreDestinataires = detail?.nombreDestinataires;
      const messagesPresents = detail?.messagesPresents;
      if (
        !detail ||
        typeof detail !== 'object' ||
        Array.isArray(detail) ||
        typeof detail.lotId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(detail.lotId) ||
        detail.canal !== 'SMS' ||
        detail.statutInitial !== 'EN_ATTENTE' ||
        !Number.isInteger(nombreDestinataires) ||
        nombreDestinataires < 0 ||
        nombreDestinataires > 50 ||
        !Number.isInteger(messagesPresents) ||
        messagesPresents < 0 ||
        messagesPresents > nombreDestinataires
      )
        return '[détails masqués]';
      // Allowlist the batch summary; never expose extra fields added by callers.
      return JSON.stringify({
        lotId: detail.lotId,
        canal: detail.canal,
        statutInitial: detail.statutInitial,
        nombreDestinataires,
        messagesPresents,
      });
    } catch {
      return '[détails masqués]';
    }
  }
  const reclamation = action.startsWith('RECLAMATION_');
  if (AUDIT_DETAILS_LIBRES_A_MASQUER.has(action) || action.startsWith('PLAGIAT_') || reclamation) {
    if (!AUDIT_DETAILS_STRUCTURES_AUTORISES.has(action) && !reclamation) return '[détails masqués]';
    try {
      const structures = JSON.parse(details);
      if (!structures || typeof structures !== 'object' || !('avant' in structures) || !('apres' in structures)) {
        return '[détails masqués]';
      }
      return JSON.stringify(retirerTexteLibreAudit(structures));
    } catch {
      return '[détails masqués]';
    }
  }
  if (
    !['ATTESTATION_EMISE', 'ATTESTATION_MODIFICATION', 'ATTESTATION_REVOCATION', 'ATTRIBUTION_RETIREE'].includes(action)
  ) {
    return details;
  }
  try {
    return JSON.stringify(retirerTexteLibreAudit(JSON.parse(details)));
  } catch {
    return '[détails masqués]';
  }
}

const CONTROLE_INCLUDE = {
  controleur: { select: { id: true, nom: true, prenom: true, role: true } },
  enseignantRemplacant: { select: { id: true, nom: true, prenom: true } },
  seance: {
    include: {
      salle: { select: { id: true, code: true, nom: true } },
      affectation: {
        select: {
          enseignant: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              departement: { select: { id: true, code: true, nom: true } },
            },
          },
          matiere: { select: { id: true, code: true, intitule: true } },
          promotion: { select: { id: true, nom: true, niveau: true } },
        },
      },
    },
  },
};

const CONTROLE_SELECT_RESTREINT = {
  id: true,
  seanceId: true,
  controleurId: true,
  statut: true,
  methode: true,
  horodatage: true,
  heureArrivee: true,
  heureFinReelle: true,
  dureeMinutes: true,
  effectifPresent: true,
  thematiqueTraitee: true,
  attestation: true,
  attestationValide: true,
  qrSalleValide: true,
  horsLigne: true,
  controleur: { select: { id: true, nom: true, prenom: true, role: true } },
  enseignantRemplacant: { select: { id: true, nom: true, prenom: true } },
  seance: {
    select: {
      id: true,
      date: true,
      heureDebut: true,
      heureFin: true,
      type: true,
      statut: true,
      salle: { select: { id: true, code: true, nom: true } },
      affectation: {
        select: {
          enseignant: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              departement: { select: { id: true, code: true, nom: true } },
            },
          },
          matiere: { select: { id: true, code: true, intitule: true } },
          promotion: { select: { id: true, nom: true, niveau: true } },
        },
      },
    },
  },
} satisfies Prisma.ControleSelect;

/**
 * Colonnes lues pour l'état « avant / après » d'un pointage. La projection
 * restreinte et la projection complète portent toutes deux ces champs.
 */
type EtatControle = {
  statut: StatutPresence;
  heureArrivee: string | null;
  heureFinReelle: string | null;
  dureeMinutes: number;
  effectifPresent: number | null;
  thematiqueTraitee: string | null;
  methode: MethodeVerification;
  horsLigne: boolean;
  horodatage: Date;
};

@Injectable()
export class ControleService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
    private attestation: PresencePreuvesService,
  ) {}

  private peutVoirDetails(user?: AuthUser) {
    return !user || new Set<Role>([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE]).has(user.role);
  }

  // ------------------------------------------------------------- consultation

  async lister(query: ControleQueryDto, user: AuthUser) {
    const enseignantId = user.role === Role.ENSEIGNANT ? (user.enseignantId ?? '__aucun__') : query.enseignantId;
    const departementId =
      estChefDeDepartement(user) || (user.role === Role.CONTROLEUR && user.departementId)
        ? (user.departementId ?? '__aucun__')
        : query.departementId;
    const controleurId = user.role === Role.CONTROLEUR && !user.departementId ? user.id : query.controleurId;
    const pagination = paginer(query);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateDebut) dateFilter.gte = toDateOnly(query.dateDebut);
    if (query.dateFin) dateFilter.lte = toDateOnly(query.dateFin);

    const where: Prisma.ControleWhereInput = {
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.methode ? { methode: query.methode } : {}),
      ...(controleurId ? { controleurId } : {}),
      seance: {
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        ...(query.salleId ? { salleId: query.salleId } : {}),
        ...(enseignantId || departementId
          ? {
              affectation: {
                ...(enseignantId ? { enseignantId } : {}),
                ...(departementId ? { enseignant: { departementId } } : {}),
              },
            }
          : {}),
      },
    };

    const options = {
      where,
      orderBy: [{ horodatage: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.take,
    };
    const requete = this.peutVoirDetails(user)
      ? this.prisma.controle.findMany({ ...options, include: CONTROLE_INCLUDE, omit: { idClient: true } })
      : this.prisma.controle.findMany({ ...options, select: CONTROLE_SELECT_RESTREINT });
    const [data, total] = await Promise.all([requete, this.prisma.controle.count({ where })]);

    return pagine(data, total, pagination);
  }

  async lire(id: string, user?: AuthUser) {
    const where: Prisma.ControleWhereInput = {
      id,
      ...(user?.role === Role.ENSEIGNANT
        ? { seance: { affectation: { enseignantId: user.enseignantId ?? '__aucun__' } } }
        : estChefDeDepartement(user) || (user?.role === Role.CONTROLEUR && user.departementId)
          ? { seance: { affectation: { enseignant: { departementId: user.departementId ?? '__aucun__' } } } }
          : user?.role === Role.CONTROLEUR
            ? { controleurId: user.id }
            : {}),
    };
    const controle = this.peutVoirDetails(user)
      ? await this.prisma.controle.findFirst({ where, include: CONTROLE_INCLUDE, omit: { idClient: true } })
      : await this.prisma.controle.findFirst({ where, select: CONTROLE_SELECT_RESTREINT });
    if (!controle) throw new NotFoundException(t('controle.controle_introuvable'));
    return controle;
  }

  /** Résout un QR de salle : utilisé par l'écran de scan du contrôleur. */
  async parQrSalle(token: string, user: AuthUser) {
    const salle = await this.prisma.salle.findUnique({
      where: { qrToken: token },
      select: { id: true, code: true, nom: true, actif: true },
    });
    if (!salle) throw new NotFoundException(t('controle.qr_de_salle_inconnu'));

    const jour = toDateOnly(new Date());
    const seances = await this.prisma.seance.findMany({
      where: {
        salleId: salle.id,
        date: jour,
        ...(estChefDeDepartement(user) || (user.role === Role.CONTROLEUR && user.departementId)
          ? { affectation: { enseignant: { departementId: user.departementId ?? '__aucun_departement__' } } }
          : {}),
        ...(user.role === Role.CONTROLEUR && !user.departementId
          ? {
              OR: [{ controleurAssigneId: user.id }, { controle: { is: { controleurId: user.id } } }],
            }
          : {}),
      },
      select: {
        id: true,
        date: true,
        heureDebut: true,
        heureFin: true,
        type: true,
        statut: true,
        salle: { select: { id: true, code: true, nom: true } },
        controle: { select: { id: true } },
        affectation: {
          select: {
            enseignant: { select: { id: true, nom: true, prenom: true } },
            matiere: { select: { id: true, code: true, intitule: true } },
            promotion: { select: { id: true, nom: true, niveau: true } },
          },
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
  private async statutAutomatique(heurePrevue: string, heureArrivee?: string): Promise<StatutPresence> {
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

  private async construireDonnees(dto: PointageDto, user: AuthUser, avant?: PointageConsigne) {
    const seance = await this.prisma.seance.findUnique({
      where: { id: dto.seanceId },
      include: {
        salle: {
          select: {
            id: true,
            code: true,
            nom: true,
            qrToken: true,
            latitude: true,
            longitude: true,
            rayonMetres: true,
          },
        },
        affectation: { include: { enseignant: { select: { id: true, departementId: true } } } },
        controle: { select: { controleurId: true } },
      },
    });
    if (!seance) throw new NotFoundException(t('controle.seance_introuvable'));
    if (estChefDeDepartement(user) && seance.affectation.enseignant.departementId !== user.departementId) {
      throw new NotFoundException(t('controle.seance_introuvable'));
    }
    // Même périmètre qu'en consultation et au scan : séance attribuée, déjà
    // pointée par ce contrôleur, ou de son département de rattachement.
    if (
      user.role === Role.CONTROLEUR &&
      seance.controleurAssigneId !== user.id &&
      seance.controle?.controleurId !== user.id &&
      (!user.departementId || seance.affectation.enseignant.departementId !== user.departementId)
    ) {
      throw new NotFoundException(t('controle.seance_introuvable'));
    }
    if (seance.statut === StatutSeance.ANNULE) {
      throw new BadRequestException(t('controle.cette_seance_a_ete_annulee'));
    }

    // --- Preuve 1 : QR affiché dans la salle
    const qrObligatoire = await this.parametres.booleen('QR_OBLIGATOIRE', false);
    let qrValide = false;
    if (dto.qrToken) {
      qrValide = !!seance.salle && seance.salle.qrToken === dto.qrToken;
      if (!qrValide) {
        throw new BadRequestException(t('controle.qrNeCorrespondPasALaSalle'));
      }
    } else if (avant) {
      // Correction : le QR a déjà été lu au moment du pointage, on n'en exige pas
      // un nouveau — les preuves ne se rejouent pas dans une correction.
      qrValide = avant.qrSalleValide;
    } else if (qrObligatoire && !dto.horsLigne) {
      throw new BadRequestException(t('controle.le_scan_du_qr_de_la_salle_est_obligatoire'));
    }

    // --- Preuve 2 : géolocalisation du contrôleur
    const latitude = dto.latitude ?? avant?.latitude ?? null;
    const longitude = dto.longitude ?? avant?.longitude ?? null;
    let distance: number | null = avant?.distanceMetres ?? null;
    if (dto.latitude != null && dto.longitude != null && seance.salle?.latitude != null) {
      distance = distanceMetres(dto.latitude, dto.longitude, seance.salle.latitude, seance.salle.longitude!);
      const geolocObligatoire = await this.parametres.booleen('GEOLOC_OBLIGATOIRE', false);
      if (geolocObligatoire && distance > (seance.salle.rayonMetres ?? 80)) {
        throw new BadRequestException(t('controle.positionHorsRayon', { distance, rayon: seance.salle.rayonMetres }));
      }
    } else if (avant) {
      // Correction : la position relevée au pointage est conservée.
    } else if (
      (await this.parametres.booleen('GEOLOC_OBLIGATOIRE', false)) &&
      !dto.horsLigne &&
      seance.salle?.latitude != null
    ) {
      throw new BadRequestException(t('controle.la_position_gps_est_obligatoire_pour_ce_pointage'));
    }

    // Des horaires réels incohérents ne doivent pas retomber sur la durée
    // planifiée : ils créditeraient toute la séance (et donc la paie).
    if (
      toMinutes(dto.heureArrivee) !== null &&
      toMinutes(dto.heureFinReelle) !== null &&
      dureeMinutes(dto.heureArrivee, dto.heureFinReelle) <= 0
    ) {
      throw new BadRequestException(t('controle.heure_fin_reelle_avant_arrivee'));
    }

    const statut = dto.statut ?? (await this.statutAutomatique(seance.heureDebut, dto.heureArrivee));
    const present = statut !== StatutPresence.ABSENT && statut !== StatutPresence.EXCUSE;

    // --- Preuve 3 : l'enseignant atteste sa présence devant le contrôleur,
    // sur l'appareil de celui-ci (signature, code personnel ou empreinte).
    // La preuve n'est PAS vérifiée ici : une preuve biométrique est consommée
    // quand elle est acceptée, et un pointage refusé ne doit pas la
    // consommer. La vérification part donc dans la transaction du pointage
    // (voir `pointer`).
    const preuveFournie = !!(dto.signatureBase64 || dto.codePinEnseignant || dto.empreinte);

    // --- Durée effective : réelle si connue, sinon durée planifiée
    let duree = dureeMinutes(dto.heureArrivee, dto.heureFinReelle);
    if (!duree && present) duree = dureeMinutes(seance.heureDebut, seance.heureFin);
    if (!present) duree = 0;

    // La méthode de vérification ne change que si la correction apporte une
    // nouvelle preuve ; sinon, on garde celle du pointage d'origine.
    const methode: MethodeVerification =
      avant && !preuveFournie && !dto.qrToken && dto.latitude == null
        ? avant.methode
        : qrValide
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
      duree,
      methode,
      qrValide,
      latitude,
      longitude,
      distance,
      preuveFournie,
    };
  }

  /**
   * Assemble les données du contrôle une fois l'attestation connue.
   *
   * L'attestation est le seul élément qui dépende de la vérification des
   * preuves : elle est calculée dans la transaction du pointage, avec les
   * autres.
   */
  private assemblerDonnees(
    dto: PointageDto,
    user: AuthUser,
    avant: PointageConsigne | undefined,
    base: BasePointage,
    attestation: { mode: AttestationMode; valide: boolean; score?: number | null },
  ) {
    return {
      seanceId: base.seance.id,
      controleurId: user.id,
      statut: base.statut,
      attestation: attestation.mode,
      attestationValide: attestation.valide,
      // Correction sans nouvelle preuve : l'attestation reste datée de son
      // enregistrement, pas du jour de la correction.
      attestationLe: attestation.valide
        ? base.preuveFournie
          ? new Date()
          : (avant?.attestationLe ?? new Date())
        : null,
      empreinteScore: attestation.score ?? null,
      heureArrivee: dto.heureArrivee ?? null,
      heureFinReelle: dto.heureFinReelle ?? null,
      dureeMinutes: base.duree,
      effectifPresent: dto.effectifPresent ?? null,
      thematiqueTraitee: dto.thematiqueTraitee ?? null,
      observation: dto.observation ?? null,
      methode: base.methode,
      latitude: base.latitude,
      longitude: base.longitude,
      distanceMetres: base.distance,
      signatureBase64: dto.signatureBase64 ?? avant?.signatureBase64 ?? null,
      qrSalleValide: base.qrValide,
      enseignantRemplacantId: dto.enseignantRemplacantId ?? null,
      horsLigne: dto.horsLigne ?? false,
      horodatage: dto.horodatage ? new Date(dto.horodatage) : (avant?.horodatage ?? new Date()),
    };
  }

  /**
   * Le pointage a-t-il déjà été consigné sous cet identifiant client ?
   *
   * C'est ce qui distingue le renvoi d'un pointage hors ligne (la réponse
   * s'est perdue) d'une nouvelle saisie : le contrôle existe déjà et porte le
   * même identifiant client. Le renvoi est alors idempotent — le contrôle
   * existant est renvoyé tel quel — au lieu d'être refusé comme un rejeu de
   * preuve.
   */
  async dejaConsigne(seanceId: string, idClient?: string) {
    if (!idClient) return false;
    const controle = await this.prisma.controle.findUnique({ where: { seanceId }, select: { idClient: true } });
    return controle?.idClient === idClient;
  }

  /** Enregistre (ou corrige) le pointage d'une séance. */
  async pointer(dto: PointageDto, user: AuthUser, ip?: string, avant?: PointageConsigne) {
    const base = await this.construireDonnees(dto, user, avant);

    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, base.seance.anneeId);
      const lu = await tx.controle.findUnique({
        where: { seanceId: base.seance.id },
        select: { ...CONTROLE_SELECT_RESTREINT, idClient: true },
      });
      // L'identifiant client ne sort pas du service : il sert seulement à
      // reconnaître le renvoi du même pointage.
      const idClientConsigne = lu?.idClient ?? null;
      const existant = lu ? sansIdClient(lu) : null;
      if (existant && !ROLES_CORRECTION.includes(user.role)) {
        if (existant.controleurId !== user.id) {
          throw new ForbiddenException(t('controle.cette_seance_a_deja_ete_controlee_par_un_autre_agent_seule_l'));
        }
      }

      // Renvoi du même pointage : la réponse s'est perdue, le contrôleur
      // renvoie ce qu'il a déjà envoyé. Le contrôle existe et porte le même
      // identifiant client : c'est le même pointage, pas un rejeu. On le
      // renvoie tel quel (200, idempotent) — la preuve qu'il a consommée n'est
      // pas rejouée, et rien n'est réécrit.
      if (!avant && dto.idClient && idClientConsigne === dto.idClient && existant) {
        return existant;
      }

      // --- Preuve 3 : l'enseignant atteste sa présence devant le contrôleur.
      // La vérification et la consommation de la preuve partent dans la
      // transaction du pointage : un pointage refusé ne consomme pas la
      // preuve, un pointage écrit la consomme.
      const attestation = base.presente
        ? base.preuveFournie
          ? await this.attestation.verifierPreuves(
              base.seance.affectation.enseignantId,
              {
                signatureBase64: dto.signatureBase64,
                codePinEnseignant: dto.codePinEnseignant,
                empreinte: dto.empreinte,
              },
              tx,
            )
          : avant
            ? // Correction : l'enseignant avait déjà attested sa présence, cette
              // attestation reste valable. La redemander l'aurait impossible.
              { mode: avant.attestation, valide: avant.attestationValide, score: avant.empreinteScore }
            : await this.attestation.verifierPreuves(
                base.seance.affectation.enseignantId,
                {
                  signatureBase64: undefined,
                  codePinEnseignant: undefined,
                  empreinte: undefined,
                },
                tx,
              )
        : { mode: AttestationMode.AUCUNE, valide: false };

      // Les contrôles de saisie valent pour un pointage : une correction porte
      // sur des valeurs déjà constatées, elle ne rejoue pas la saisie. Ils
      // sont vérifiés après la preuve : un pointage refusé ici annule la
      // consommation, qui fait partie de la même transaction.
      if (
        base.presente &&
        !avant &&
        !attestation.valide &&
        (await this.parametres.booleen('ATTESTATION_OBLIGATOIRE', true))
      ) {
        throw new BadRequestException(t('controle.l_enseignant_doit_attester_sa_presence_devant_vous_signature'));
      }

      if (
        base.presente &&
        !avant &&
        !dto.signatureBase64 &&
        (await this.parametres.booleen('SIGNATURE_OBLIGATOIRE', false))
      ) {
        throw new BadRequestException(t('controle.la_signature_manuscrite_de_l_enseignant_est_obligatoire'));
      }
      if (
        base.presente &&
        !avant &&
        dto.effectifPresent == null &&
        (await this.parametres.booleen('EFFECTIF_OBLIGATOIRE', true))
      ) {
        throw new BadRequestException(t('controle.le_nombre_d_etudiants_presents_est_obligatoire'));
      }

      const donnees = this.assemblerDonnees(dto, user, avant, base, attestation);

      // Pas d'upsert : deux premières saisies concurrentes liraient toutes deux
      // `existant === null` et la seconde écraserait la première, propriétaire
      // compris. La création bute sur l'unicité de `seanceId` ; le perdant est
      // refusé comme toute correction par un autre agent.
      const controle = existant
        ? await tx.controle.update({
            where: { seanceId: base.seance.id },
            data: { ...donnees, controleurId: existant.controleurId },
            select: CONTROLE_SELECT_RESTREINT,
          })
        : await tx.controle
            .create({
              data: {
                ...donnees,
                // L'identifiant client n'est posé qu'à la création : une
                // correction ne change pas le pointage d'origine.
                ...(dto.idClient ? { idClient: dto.idClient } : {}),
              },
              select: CONTROLE_SELECT_RESTREINT,
            })
            .catch((e: unknown) => {
              if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ForbiddenException(t('controle.cette_seance_a_deja_ete_controlee_par_un_autre_agent_seule_l'));
              }
              throw e;
            });

      await tx.seance.update({
        where: { id: base.seance.id },
        data: { statut: base.presente ? StatutSeance.CONTROLE : StatutSeance.NON_TENUE },
      });

      await journaliser(
        tx,
        user,
        existant ? 'POINTAGE_CORRECTION' : 'POINTAGE',
        'Controle',
        controle.id,
        {
          seanceId: base.seance.id,
          avant: existant ? this.etatAudit(existant) : null,
          apres: this.etatAudit(controle),
        },
        ip,
      );
      return controle;
    });
  }

  async modifier(id: string, dto: UpdatePointageDto, user: AuthUser, ip?: string) {
    // `findOne` porte le périmètre enseignant / chef de département ; sans
    // l'utilisateur, la correction d'un pointage appartenait à n'importe quel
    // enseignant ou contrôleur. Le garde-fou `controleurId` ci-dessous
    // suffisait aujourd'hui par accident, pas par conception.
    const existant = await this.lire(id, user);
    if (existant.controleurId !== user.id && !ROLES_CORRECTION.includes(user.role)) {
      throw new ForbiddenException(t('controle.seul_l_auteur_du_controle_ou_la_direction_peut_le_corriger'));
    }
    // L'état complet est relu : la correction repart de ce qui a été consigné,
    // pas de ce que l'utilisateur voit (un contrôleur n'a pas tous les champs).
    const avant = await this.prisma.controle.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException(t('controle.controle_introuvable'));

    // Une correction ne change que les champs transmis : sans ce rapport avec
    // l'état consigné, le recalcul du pointage remettrait à vide tout champ
    // omis (effectif, attestation, horaires). Les preuves ne sont pas
    // reportées ici : elles restent celles du pointage d'origine.
    const rapport: PointageDto = {
      seanceId: avant.seanceId,
      statut: dto.statut ?? avant.statut,
      heureArrivee: dto.heureArrivee ?? avant.heureArrivee ?? undefined,
      heureFinReelle: dto.heureFinReelle ?? avant.heureFinReelle ?? undefined,
      effectifPresent: dto.effectifPresent ?? avant.effectifPresent ?? undefined,
      thematiqueTraitee: dto.thematiqueTraitee ?? avant.thematiqueTraitee ?? undefined,
      observation: dto.observation ?? avant.observation ?? undefined,
      enseignantRemplacantId: dto.enseignantRemplacantId ?? avant.enseignantRemplacantId ?? undefined,
      horsLigne: dto.horsLigne ?? avant.horsLigne,
      horodatage: dto.horodatage ?? avant.horodatage.toISOString(),
    };
    return this.pointer(rapport, user, ip, avant);
  }

  /**
   * Synchronisation des pointages saisis hors connexion (couverture réseau
   * aléatoire dans les amphis). Les échecs individuels n'annulent pas le lot.
   *
   * Un pointage renvoyé après une réponse perdue est reconnu (identifiant
   * client) et compté comme synchronisé : c'est le même pointage, pas un
   * rejeu. Un échec définitif — une preuve déjà consommée — porte son code :
   * la file du contrôleur le retire au lieu de le réessayer indéfiniment.
   */
  async synchroniser(dto: SyncPointagesDto, user: AuthUser, ip?: string) {
    const resultats: Array<{ seanceId: string; ok: boolean; erreur?: string | string[]; code?: string; id?: string }> = [];

    for (const p of dto.pointages) {
      try {
        const c = await this.pointer({ ...p, horsLigne: true }, user, ip);
        resultats.push({ seanceId: p.seanceId, ok: true, id: c.id });
      } catch (e: unknown) {
        const err = erreur(e);
        resultats.push({
          seanceId: p.seanceId,
          ok: false,
          erreur: err.response?.message ?? err.message ?? 'Erreur inconnue',
          ...(err.code === CODE_PREUVE_DEJA_UTILISEE ? { code: err.code } : {}),
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
    const controle = await this.prisma.controle.findUnique({
      where: { id },
      include: CONTROLE_INCLUDE,
      omit: { idClient: true },
    });
    if (!controle) throw new NotFoundException(t('controle.controle_introuvable'));
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, controle.seance.anneeId);
      await tx.controle.delete({ where: { id } });
      await tx.seance.update({
        where: { id: controle.seanceId },
        data: { statut: StatutSeance.PLANIFIE },
      });
      await journaliser(tx, user, 'POINTAGE_SUPPRESSION', 'Controle', id, {
        seanceId: controle.seanceId,
        avant: this.etatAudit(controle),
        apres: null,
      });
      return { id };
    });
  }

  private etatAudit(controle: EtatControle) {
    const champs = [
      'statut',
      'heureArrivee',
      'heureFinReelle',
      'dureeMinutes',
      'effectifPresent',
      'thematiqueTraitee',
      'methode',
      'horsLigne',
      'horodatage',
    ] as const;
    return Object.fromEntries(champs.map((champ) => [champ, controle[champ] ?? null] as const));
  }

  /** Journal d'audit (traçabilité des corrections). */
  async audit(query: AuditQueryDto) {
    // Le journal ne connaît pas le mode « tout » : la page est bornée à
    // 1 000 lignes, comme partout ailleurs.
    const pagination = paginer({ page: query.page, pageSize: query.pageSize });
    const where = {
      ...(query.entite ? { entite: query.entite } : {}),
      // Les anciennes lignes VOTE_DEPOSE relient le compte de l'électeur au
      // scrutin. Elles restent conservées en base pour l'historique, mais ne
      // sont jamais exposées dans le journal visible, même avec ce filtre.
      ...(query.action === 'VOTE_DEPOSE'
        ? { action: '__ACTION_DE_VOTE_NON_AFFICHABLE__' }
        : query.action
          ? { action: query.action }
          : { action: { not: 'VOTE_DEPOSE' } }),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.acteur
        ? {
            user: {
              OR: [
                { nom: { contains: query.acteur, mode: 'insensitive' as const } },
                { prenom: { contains: query.acteur, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
      ...(query.dateDebut || query.dateFin
        ? {
            createdAt: {
              ...(query.dateDebut ? { gte: toDateOnly(query.dateDebut) } : {}),
              ...(query.dateFin ? { lte: new Date(toDateOnly(query.dateFin).getTime() + 86_400_000 - 1) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { nom: true, prenom: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const nettoye = data
      .filter((ligne) => ligne.action !== 'VOTE_DEPOSE')
      .map((ligne) => {
        // L'adresse IP reste réservée à l'exploitation serveur et ne sert pas
        // aux filtres ou aux détails visibles de l'écran Journal.
        const { ip: _ip, ...ligneExposee } = ligne;
        if (ligne.action === 'PATRIMOINE_QR_REGENERE') {
          return { ...ligneExposee, details: t('controle.qrRegenerated') };
        }
        if (typeof ligne.details !== 'string') return ligneExposee;
        if (ligne.action === 'POINTAGE_CORRECTION') {
          try {
            const details = JSON.parse(ligne.details) as {
              avant?: Record<string, unknown>;
              apres?: Record<string, unknown>;
            };
            for (const instantane of [details.avant, details.apres]) {
              if (instantane && typeof instantane === 'object') delete instantane.observation;
            }
            return { ...ligneExposee, details: JSON.stringify(details) };
          } catch {
            return { ...ligneExposee, details: '[détails masqués]' };
          }
        }
        return { ...ligneExposee, details: detailsAuditNettoyes(ligne.action, ligne.details) };
      });
    return pagine(nettoye, total, pagination);
  }
}
