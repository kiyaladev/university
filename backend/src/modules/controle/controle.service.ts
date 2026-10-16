import { AuditQueryDto } from './controle.dto';
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
import { t } from '../../common/i18n';
import { exigerAnneeOuverte } from '../../common/annee';

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

function retirerTexteLibreAudit(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(retirerTexteLibreAudit);
  if (!valeur || typeof valeur !== 'object') return valeur;
  return Object.fromEntries(Object.entries(valeur)
    .filter(([cle]) => !['motif', 'retireeMotif', 'commentaire'].includes(cle))
    .map(([cle, contenu]) => [
      cle,
      cle === 'champsModifies' && Array.isArray(contenu)
        ? contenu.filter((champ) => !['motif', 'retireeMotif', 'commentaire'].includes(String(champ)))
        : retirerTexteLibreAudit(contenu),
    ]));
}

function detailsAuditNettoyes(action: string, details: unknown): unknown {
  if (typeof details !== 'string') return details;
  if (action === 'SMS_DIFFUSION_DEMANDEE') {
    try {
      const detail = JSON.parse(details);
      const nombreDestinataires = detail?.nombreDestinataires;
      const messagesPresents = detail?.messagesPresents;
      if (
        !detail || typeof detail !== 'object' || Array.isArray(detail)
        || typeof detail.lotId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(detail.lotId)
        || detail.canal !== 'SMS'
        || detail.statutInitial !== 'EN_ATTENTE'
        || !Number.isInteger(nombreDestinataires) || nombreDestinataires < 0 || nombreDestinataires > 50
        || !Number.isInteger(messagesPresents) || messagesPresents < 0 || messagesPresents > nombreDestinataires
      ) return '[détails masqués]';
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
  if (!['ATTESTATION_EMISE', 'ATTESTATION_MODIFICATION', 'ATTESTATION_REVOCATION', 'ATTRIBUTION_RETIREE'].includes(action)) {
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

@Injectable()
export class ControleService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
    private attestation: AttestationService,
  ) {}

  private peutVoirDetails(user?: AuthUser) {
    return !user || new Set<Role>([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE]).has(user.role);
  }

  // ------------------------------------------------------------- consultation

  async liste(query: ControleQueryDto, user: AuthUser) {
    const enseignantId = user.role === Role.ENSEIGNANT ? user.enseignantId ?? '__aucun__' : query.enseignantId;
    const departementId = user.role === Role.CHEF_DEPARTEMENT || (user.role === Role.CONTROLEUR && user.departementId)
      ? user.departementId ?? '__aucun__'
      : query.departementId;
    const controleurId = user.role === Role.CONTROLEUR && !user.departementId ? user.id : query.controleurId;
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));

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
                ...(departementId
                  ? { enseignant: { departementId } }
                  : {}),
              },
            }
          : {}),
      },
    };

    const options = {
      where,
      orderBy: [{ horodatage: 'desc' as const }],
      ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
    };
    const requete = this.peutVoirDetails(user)
      ? this.prisma.controle.findMany({ ...options, include: CONTROLE_INCLUDE })
      : this.prisma.controle.findMany({ ...options, select: CONTROLE_SELECT_RESTREINT });
    const [data, total] = await Promise.all([
      requete,
      this.prisma.controle.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async findOne(id: string, user?: AuthUser) {
    const where: Prisma.ControleWhereInput = {
      id,
      ...(user?.role === Role.ENSEIGNANT
        ? { seance: { affectation: { enseignantId: user.enseignantId ?? '__aucun__' } } }
        : user?.role === Role.CHEF_DEPARTEMENT || (user?.role === Role.CONTROLEUR && user.departementId)
          ? { seance: { affectation: { enseignant: { departementId: user.departementId ?? '__aucun__' } } } }
          : user?.role === Role.CONTROLEUR
            ? { controleurId: user.id }
            : {}),
    };
    const controle = this.peutVoirDetails(user)
      ? await this.prisma.controle.findFirst({ where, include: CONTROLE_INCLUDE })
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
        ...(user.role === Role.CHEF_DEPARTEMENT || (user.role === Role.CONTROLEUR && user.departementId)
          ? { affectation: { enseignant: { departementId: user.departementId ?? '__aucun_departement__' } } }
          : {}),
        ...(user.role === Role.CONTROLEUR && !user.departementId
          ? {
              OR: [
                { controleurAssigneId: user.id },
                { controle: { is: { controleurId: user.id } } },
              ],
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
      include: {
        salle: {
          select: {
            id: true, code: true, nom: true, qrToken: true,
            latitude: true, longitude: true, rayonMetres: true,
          },
        },
        affectation: { include: { enseignant: { select: { id: true, departementId: true } } } },
        controle: { select: { controleurId: true } },
      },
    });
    if (!seance) throw new NotFoundException(t('controle.seance_introuvable'));
    if (
      user.role === Role.CHEF_DEPARTEMENT &&
      seance.affectation.enseignant.departementId !== user.departementId
    ) {
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
    if (seance.statut === StatutSeance.ANNULEE) {
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
    } else if (qrObligatoire && !dto.horsLigne) {
      throw new BadRequestException(t('controle.le_scan_du_qr_de_la_salle_est_obligatoire'));
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
          t('controle.positionHorsRayon', { distance, rayon: seance.salle.rayonMetres }),
        );
      }
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
      throw new BadRequestException(t('controle.l_enseignant_doit_attester_sa_presence_devant_vous_signature'));
    }

    if (
      present &&
      !dto.signatureBase64 &&
      (await this.parametres.booleen('SIGNATURE_OBLIGATOIRE', false))
    ) {
      throw new BadRequestException(t('controle.la_signature_manuscrite_de_l_enseignant_est_obligatoire'));
    }
    if (
      present &&
      dto.effectifPresent == null &&
      (await this.parametres.booleen('EFFECTIF_OBLIGATOIRE', true))
    ) {
      throw new BadRequestException(t('controle.le_nombre_d_etudiants_presents_est_obligatoire'));
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

    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, seance.anneeId);
      const existant = await tx.controle.findUnique({ where: { seanceId: seance.id } });
      if (existant && ![Role.ADMIN, Role.DIRECTION].includes(user.role as any)) {
        if (existant.controleurId !== user.id) {
          throw new ForbiddenException(t('controle.cette_seance_a_deja_ete_controlee_par_un_autre_agent_seule_l'));
        }
      }

      // Pas d'upsert : deux premières saisies concurrentes liraient toutes deux
      // `existant === null` et la seconde écraserait la première, propriétaire
      // compris. La création bute sur l'unicité de `seanceId` ; le perdant est
      // refusé comme toute correction par un autre agent.
      const controle = existant
        ? await tx.controle.update({
            where: { seanceId: seance.id },
            data: { ...donnees, controleurId: existant.controleurId },
            select: CONTROLE_SELECT_RESTREINT,
          })
        : await tx.controle
            .create({ data: donnees, select: CONTROLE_SELECT_RESTREINT })
            .catch((e: unknown) => {
              if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ForbiddenException(t('controle.cette_seance_a_deja_ete_controlee_par_un_autre_agent_seule_l'));
              }
              throw e;
            });

      await tx.seance.update({
        where: { id: seance.id },
        data: { statut: presente ? StatutSeance.CONTROLEE : StatutSeance.NON_TENUE },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: existant ? 'POINTAGE_CORRECTION' : 'POINTAGE',
          entite: 'Controle',
          entiteId: controle.id,
          details: JSON.stringify({
            seanceId: seance.id,
            avant: existant ? this.etatAudit(existant) : null,
            apres: this.etatAudit(controle),
          }),
          ip,
        },
      });
      return controle;
    });
  }

  async modifier(id: string, dto: UpdatePointageDto, user: AuthUser, ip?: string) {
    // `findOne` porte le périmètre enseignant / chef de département ; sans
    // l'utilisateur, la correction d'un pointage appartenait à n'importe quel
    // enseignant ou contrôleur. Le garde-fou `controleurId` ci-dessous
    // suffisait aujourd'hui par accident, pas par conception.
    const existant = await this.findOne(id, user);
    if (
      existant.controleurId !== user.id &&
      ![Role.ADMIN, Role.DIRECTION].includes(user.role as any)
    ) {
      throw new ForbiddenException(t('controle.seul_l_auteur_du_controle_ou_la_direction_peut_le_corriger'));
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
    const controle = await this.prisma.controle.findUnique({ where: { id }, include: CONTROLE_INCLUDE });
    if (!controle) throw new NotFoundException(t('controle.controle_introuvable'));
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, controle.seance.anneeId);
      await tx.controle.delete({ where: { id } });
      await tx.seance.update({
        where: { id: controle.seanceId },
        data: { statut: StatutSeance.PLANIFIEE },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'POINTAGE_SUPPRESSION',
          entite: 'Controle',
          entiteId: id,
          details: JSON.stringify({ seanceId: controle.seanceId, avant: this.etatAudit(controle), apres: null }),
        },
      });
      return { id };
    });
  }

  private etatAudit(controle: any) {
    return Object.fromEntries(['statut', 'heureArrivee', 'heureFinReelle', 'dureeMinutes',
      'effectifPresent', 'thematiqueTraitee', 'methode', 'horsLigne', 'horodatage']
      .map(champ => [champ, controle[champ] ?? null]));
  }

  /** Journal d'audit (traçabilité des corrections). */
  async audit(query: AuditQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
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
      ...(query.acteur ? { user: { OR: [
        { nom: { contains: query.acteur, mode: 'insensitive' as const } },
        { prenom: { contains: query.acteur, mode: 'insensitive' as const } },
      ] } } : {}),
      ...(query.dateDebut || query.dateFin ? { createdAt: {
        ...(query.dateDebut ? { gte: toDateOnly(query.dateDebut) } : {}),
        ...(query.dateFin ? { lte: new Date(toDateOnly(query.dateFin).getTime() + 86_400_000 - 1) } : {}),
      } } : {}),
    };
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
    const nettoye = data.filter((ligne: any) => ligne.action !== 'VOTE_DEPOSE').map((ligne: any) => {
      // L'adresse IP reste réservée à l'exploitation serveur et ne sert pas
      // aux filtres ou aux détails visibles de l'écran Journal.
      const { ip: _ip, ...ligneExposee } = ligne;
      if (ligne.action === 'PATRIMOINE_QR_REGENERE') {
        return { ...ligneExposee, details: t('controle.qrRegenerated') };
      }
      if (typeof ligne.details !== 'string') return ligneExposee;
      if (ligne.action === 'POINTAGE_CORRECTION') {
        try {
          const details = JSON.parse(ligne.details);
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
    return { data: nettoye, total, page, pageSize };
  }
}
