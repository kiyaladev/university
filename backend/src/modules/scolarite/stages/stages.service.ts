/**
 * ### Machine à états des travaux encadrés (PROPOSE → … → SOUTENU)
 *
 * Toute évolution d'état passe par POST /api/travaux-encadres/:id/transition
 * (jamais par la création ni la modification), sauf la soutenance : l'acte
 * « soutenance enregistrée » (POST /api/soutenances) place lui-même le travail
 * en SOUTENU — une défense constatée par le bureau du jury EST l'état terminal.
 *
 * | De            | Vers      | Condition                                                        | Qui            |
 * |---------------|-----------|------------------------------------------------------------------|----------------|
 * | PROPOSE       | VALIDE    | un encadrant est désigné (encadrantId)                           | staff, encadrant|
 * | VALIDE        | EN_COURS  | —                                                                | staff, encadrant |
 * | EN_COURS      | SOUTENU   | rapport rendu ET soutenance enregistrée   (sinon refus expliqué) | staff, encadrant|
 * | PROPOSE/VALIDE/EN_COURS | ABANDONNE | rupture du parcours à tout moment (la soutenance, elle, reste terminale) | staff, encadrant |
 * | ABANDONNE     | PROPOSE   | réactivation d'un dossier abandonné                              | staff |
 * | SOUTENU       | —         | état terminal : aucune transition sortante                      | — |
 *
 * Règles transverses :
 * - jamais de retour en arrière sur la chaîne valorisée (VALIDÉ → PROPOSÉ,
 *   EN_COURS → VALIDÉ… sont refusés) ;
 * - l'enseignant n'agit que sur les travaux qu'il encadre (le sien) ;
 * - chaque transition est tracée dans le journal d'audit, avec la mention de
 *   l'ancien et du nouvel état.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StatutEncadrement, TypeEncadrement } from '@prisma/client';
import { CrudService } from '../../../common/crud.service';
import { AuthUser } from '../../../common/decorators';
import { t } from '../../../common/i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSoutenanceDto,
  CreateTravailDto,
  NoteSoutenanceDto,
  TravailQueryDto,
  UpdateTravailDto,
} from './stages.dto';
import { avantApres, journaliser } from '../../../common/audit';

/** Rôles « administration » : ils voient et pilotent tous les travaux. */
export const ROLES_PILOTES: Role[] = [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE];

export const TRAVAIL_INCLUDE = {
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
  encadrant: { select: { id: true, nom: true, prenom: true } },
  soutenance: {
    include: {
      salle: { select: { id: true, code: true, nom: true } },
      president: { select: { id: true, nom: true, prenom: true } },
    },
  },
} satisfies Prisma.TravailEncadreInclude;

const TRANSITIONS: Partial<Record<StatutEncadrement, StatutEncadrement[]>> = {
  PROPOSE: [StatutEncadrement.VALIDE, StatutEncadrement.ABANDONNE],
  VALIDE: [StatutEncadrement.EN_COURS, StatutEncadrement.ABANDONNE],
  EN_COURS: [StatutEncadrement.SOUTENU, StatutEncadrement.ABANDONNE],
  ABANDONNE: [StatutEncadrement.PROPOSE],
  SOUTENU: [],
};

/**
 * Colonnes lues pour l'état « avant » d'une mutation. Le journal n'a pas
 * besoin du dossier complet : il lui faut les statuts, les dates, les
 * identifiants techniques et les booléens de présence. Les textes du dossier
 * (intitulé, description, entreprise, tuteur, lieu) ne sont jamais selectés
 * pour l'audit — ils n'arrivent donc jamais dans le journal.
 */
const TRAVAIL_AUDIT_SELECT = {
  id: true,
  type: true,
  statut: true,
  etudiantId: true,
  encadrantId: true,
  rapportRendu: true,
  dateDebut: true,
  dateFin: true,
  entreprise: true,
  tuteurEntreprise: true,
} satisfies Prisma.TravailEncadreSelect;

/** Même principe côté soutenance : la note est chiffrée, la mention est un texte. */
const SOUTENANCE_AUDIT_SELECT = {
  id: true,
  travailEncadreId: true,
  date: true,
  salleId: true,
  presidentId: true,
  assesseurs: true,
  note: true,
  mention: true,
} satisfies Prisma.SoutenanceSelect;

/** Le dossier complet, relations comprises : c'est la projection des lectures. */
type TravailComplet = Prisma.TravailEncadreGetPayload<{ include: typeof TRAVAIL_INCLUDE }>;

/** L'état minimal d'un travail : ce que le journal d'audit a besoin de savoir. */
type TravailAudit = Prisma.TravailEncadreGetPayload<{ select: typeof TRAVAIL_AUDIT_SELECT }>;

/**
 * L'état relu par la machine à états : l'audit, plus le seul fait qui compte
 * pour la soutenance — son existence.
 */
type TravailTransition = Prisma.TravailEncadreGetPayload<{
  select: typeof TRAVAIL_AUDIT_SELECT & { soutenance: { select: { id: true } } };
}>;

/** La soutenance relue pour le journal. */
type SoutenanceAudit = Prisma.SoutenanceGetPayload<{ select: typeof SOUTENANCE_AUDIT_SELECT }>;

/**
 * Colonues communes à tous les travaux : l'instantané du journal n'en lit pas
 * d'autres. Le type est structurel pour accepter aussi bien le dossier
 * complet que les projections réduites de l'audit.
 */
type TravailJournalisable = {
  id: string;
  type: TypeEncadrement;
  statut: StatutEncadrement;
  etudiantId: string;
  encadrantId: string | null;
  rapportRendu: boolean;
  dateDebut: Date | null;
  dateFin: Date | null;
  entreprise: string | null;
  tuteurEntreprise: string | null;
};

/** Colonnes communes à toutes les soutenances, pour le même instantané. */
type SoutenanceJournalisable = {
  id: string;
  travailEncadreId: string;
  date: Date;
  salleId: string | null;
  presidentId: string | null;
  assesseurs: string | null;
  note: number | null;
  mention: string | null;
};

/**
 * Payload de création : les champs bruts du modèle, `etudiantId` compris —
 * c'est un scalaire du modèle, pas une relation à créer.
 */
type CreationTravail = Omit<Prisma.TravailEncadreUncheckedCreateInput, 'statut' | 'type'> & {
  type?: TypeEncadrement;
  statut?: StatutEncadrement;
};

/** Les dates du journal sont des ISO : lisibles dans le journal, comparables. */
function isoOuNull(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

@Injectable()
export class StagesService extends CrudService<TravailComplet> {
  constructor(prisma: PrismaService) {
    super(prisma, 'travailEncadre', {
      searchFields: ['intitule', 'description', 'entreprise', 'lieu'],
      orderBy: [{ createdAt: 'desc' }],
      include: TRAVAIL_INCLUDE,
      label: 'Travail encadré',
    });
  }

  // ------------------------------------------------------------------
  // Lecture (avec périmètre par rôle)
  // ------------------------------------------------------------------

  /** Périmètre : l'étudiant ne lit que ses travaux, l'enseignant ses encadrements. */
  async lister(query: TravailQueryDto, user: AuthUser) {
    if (!ROLES_PILOTES.includes(user.role) && user.role !== Role.ETUDIANT && user.role !== Role.ENSEIGNANT) {
      throw new ForbiddenException(t('stages.ce_travail_ne_vous_appartient_pas'));
    }
    const where: Prisma.TravailEncadreWhereInput = {};

    if (query.statut) where.statut = query.statut;
    if (query.type) where.type = query.type;

    if (user.role === Role.ETUDIANT) {
      where.etudiantId = user.etudiantId ?? '—';
    } else if (user.role === Role.ENSEIGNANT) {
      where.encadrantId = user.enseignantId ?? '—';
    } else if (query.encadrantId) {
      where.encadrantId = query.encadrantId;
    }

    if (query.anneeId) {
      const annee = await this.prisma.anneeAcademique.findUnique({
        where: { id: query.anneeId },
      });
      if (!annee) throw new BadRequestException(t('stages.annee_academique_introuvable'));
      const fin = new Date(annee.dateFin);
      fin.setUTCDate(fin.getUTCDate() + 1);
      where.createdAt = { gte: annee.dateDebut, lt: fin };
    }

    return super.lister(query, where);
  }

  /** Détail d'un travail, avec la même garde de périmètre que la liste. */
  async lire(id: string, user: AuthUser) {
    const where: Prisma.TravailEncadreWhereInput = { id };
    if (user.role === Role.ETUDIANT) {
      where.etudiantId = user.etudiantId ?? '—';
    } else if (user.role === Role.ENSEIGNANT) {
      where.encadrantId = user.enseignantId ?? '—';
    } else if (!ROLES_PILOTES.includes(user.role)) {
      throw new NotFoundException(t('stages.ce_travail_ne_vous_appartient_pas'));
    }

    const travail = await this.prisma.travailEncadre.findFirst({
      where,
      include: TRAVAIL_INCLUDE,
    });
    if (!travail) throw new NotFoundException(t('stages.ce_travail_ne_vous_appartient_pas'));
    return travail;
  }

  // ------------------------------------------------------------------
  // Création & modification
  // ------------------------------------------------------------------

  async creer(dto: CreateTravailDto, user: AuthUser) {
    // `etudiantId` est un champ scalaire du modèle mais pas de
    // TravailEncadreCreateInput (relation) : on passe par la variante
    // « unchecked », comme la base CrudService qui crée avec les champs bruts.
    let donnees: CreationTravail = { ...dto };
    if (user.role === Role.ETUDIANT) {
      if (!user.etudiantId) throw new ForbiddenException(t('stages.aucune_fiche_etudiant_rattachee'));
      if (dto.type && !['STAGE', 'RAPPORT'].includes(dto.type)) {
        throw new ForbiddenException(t('stages.un_etudiant_ne_propose_que_des_stages_ou_des_rapports'));
      }
      // Il devient l'étudiant du travail ; la proposition part en PROPOSE et
      // sans encadrant : c'est la scolarité qui attribue l'encadrement.
      donnees = {
        ...dto,
        type: dto.type ?? 'RAPPORT',
        etudiantId: user.etudiantId,
        encadrantId: null,
        statut: StatutEncadrement.PROPOSE,
      };
    } else {
      // Statut initial borné à PROPOSE / VALIDE : la suite appartient à la machine.
      if (donnees.statut && !['PROPOSE', 'VALIDE'].includes(donnees.statut)) {
        throw new BadRequestException(
          t('stages.statut_initial_invalide_donnees_statut_creer_en_propose_puis', {
            'donnees.statut': donnees.statut,
          }),
        );
      }
    }
    // La création et sa trace sont committées ensemble : un dossier
    // enregistré sans journal (ou l'inverse) n'est pas reconstituable.
    return this.prisma.$transaction(async (tx) => {
      const cree = await tx.travailEncadre.create({ data: donnees, include: TRAVAIL_INCLUDE });
      await journaliser(
        tx,
        user,
        'TRAVAIL_ENCADRE_CREE',
        'TravailEncadre',
        cree.id,
        avantApres(null, this.instantaneTravail(cree)),
      );
      return cree;
    });
  }

  /** Modification : la vie du statut passe par /transition, jamais par la PUT. */
  async modifier(id: string, dto: UpdateTravailDto, user: AuthUser) {
    const travail = await super.lire(id);
    this.autoriserPropriete(travail, user);

    if (dto.statut !== undefined && dto.statut !== travail.statut) {
      throw new ForbiddenException(t('stages.le_statut_evolue_par_la_machine_a_etats_post_transition_pas_'));
    }

    // Le statut et le porteur sont écartés : le statut n'évolue que par
    // /transition, et l'étudiant est la clé du périmètre. `encadrantId` était
    // laissé dans `reste`, donc un étudiant pouvait réattribuer son dossier à
    // n'importe quel enseignant puis faire avancer la machine à états seul
    // (PROPOSE → VALIDE → EN_COURS → SOUTENU), l'encadrant n'étant plus
    // partie prenante.
    const { statut: _statut, etudiantId, encadrantId, ...reste } = dto;
    const donnees: Prisma.TravailEncadreUncheckedUpdateInput = { ...reste };
    // Un travail ne change pas de porteur par la PUT : l'étudiant est la clé
    // du périmètre (une erreur de saisie passe par la réaffectation en création).
    if (etudiantId !== undefined && etudiantId !== travail.etudiantId) {
      throw new ForbiddenException(t('stages.le_porteur_d_un_travail_ne_se_change_pas_par_la_put'));
    }
    // Changer d'encadrant relève de l'administration ou de la scolarité.
    if (encadrantId !== undefined && encadrantId !== travail.encadrantId) {
      if (!ROLES_PILOTES.includes(user.role)) {
        throw new ForbiddenException(t('stages.seule_l_administration_peut_changer_l_encadrant_d_un_travail_'));
      }
    }
    if (encadrantId !== undefined) donnees.encadrantId = encadrantId;

    // La modification est journalisée dans la même transaction que l'écriture :
    // un dossier modifié sans trace d'état avant/après, ou une trace sans
    // l'écriture, sont tous deux inexploitables en cas de contestation.
    return this.prisma.$transaction(async (tx) => {
      const avant: TravailAudit | null = await tx.travailEncadre.findUnique({
        where: { id },
        select: TRAVAIL_AUDIT_SELECT,
      });
      if (!avant) throw new NotFoundException(t('stages.ce_travail_ne_vous_appartient_pas'));
      // Périmètre rejoué sur l'état relu : un encadrant qui vient d'être
      // remplacé ne peut pas réécrire le dossier dans la foulée.
      this.autoriserPropriete(avant, user);
      const maj = await tx.travailEncadre.update({ where: { id }, data: donnees, include: TRAVAIL_INCLUDE });
      await journaliser(
        tx,
        user,
        'TRAVAIL_ENCADRE_MODIFIE',
        'TravailEncadre',
        id,
        avantApres(this.instantaneTravail(avant), this.instantaneTravail(maj)),
      );
      return maj;
    });
  }

  /** Suppression : réservée à l'administration, tant que le dossier n'est pas engagé. */
  async supprimer(id: string, user: AuthUser) {
    const travail = await super.lire(id);
    const statutsSupprimables: StatutEncadrement[] = [StatutEncadrement.PROPOSE, StatutEncadrement.VALIDE];
    if (!statutsSupprimables.includes(travail.statut)) {
      throw new BadRequestException(
        t('stages.un_travail_travail_statut_ne_se_supprime_pas_abandonnez_le_o', { 'travail.statut': travail.statut }),
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // L'état avant est relu dans la transaction : après la suppression, le
      // journal est la seule trace qui survit à la ligne.
      const avant: TravailAudit | null = await tx.travailEncadre.findUnique({
        where: { id },
        select: TRAVAIL_AUDIT_SELECT,
      });
      if (!avant) throw new NotFoundException(t('stages.ce_travail_ne_vous_appartient_pas'));
      await tx.travailEncadre.delete({ where: { id } });
      await journaliser(
        tx,
        user,
        'TRAVAIL_ENCADRE_SUPPRIME',
        'TravailEncadre',
        id,
        avantApres(this.instantaneTravail(avant), null),
      );
      return { id };
    });
  }

  // ------------------------------------------------------------------
  // Machine à états
  // ------------------------------------------------------------------

  async transition(id: string, cible: StatutEncadrement, user: AuthUser) {
    const travail = await super.lire(id);
    if (!this.verifierTransition(travail, cible, user)) {
      // Idempotent : revendiquer le même état n'est pas une erreur, c'est un no-op.
      return travail;
    }

    // La prise de l'état se fait par écriture conditionnelle, et les mêmes
    // règles sont rejouées sur l'état relu dans la transaction : la transition
    // est donc toujours décidée sur l'état qu'elle engage réellement. Deux
    // adjudications concurrentes ne peuvent ni faire sauter une étape de la
    // machine, ni laisser un journal mentant sur l'état de départ.
    return this.prisma.$transaction(async (tx) => {
      const avant: TravailTransition | null = await tx.travailEncadre.findUnique({
        where: { id },
        select: { ...TRAVAIL_AUDIT_SELECT, soutenance: { select: { id: true } } },
      });
      if (!avant) throw new NotFoundException(t('stages.ce_travail_ne_vous_appartient_pas'));
      if (!this.verifierTransition(avant, cible, user)) {
        // La cible est déjà atteinte : rien à écrire, donc rien à journaliser.
        return tx.travailEncadre.findUnique({ where: { id }, include: TRAVAIL_INCLUDE });
      }

      const prise = await tx.travailEncadre.updateMany({
        where: { id, statut: avant.statut },
        data: { statut: cible },
      });
      if (prise.count !== 1) {
        throw new ConflictException(t('stages.ce_travail_a_change_d_etat_pendant_la_transition_recharge'));
      }
      const apres = await tx.travailEncadre.findUnique({ where: { id }, include: TRAVAIL_INCLUDE });
      await journaliser(
        tx,
        user,
        `TRAVAIL_${avant.statut}_${cible}`,
        'TravailEncadre',
        id,
        avantApres(this.instantaneTravail(avant), this.instantaneTravail(apres)),
      );
      return apres;
    });
  }

  /**
   * Règles de la machine à états et de périmètre, appliquées à un état relu.
   * Renvoie `false` quand la cible est déjà l'état courant (no-op) : dans ce
   * cas rien n'est écrit et rien n'est journalisé.
   */
  private verifierTransition(
    travail: TravailComplet | TravailTransition,
    cible: StatutEncadrement,
    user: AuthUser,
  ): boolean {
    this.autoriserPropriete(travail, user);
    if (user.role === Role.ENSEIGNANT && !travail.encadrantId) {
      throw new ForbiddenException(t('stages.ce_travail_n_a_pas_d_encadrant'));
    }
    if ((cible as StatutEncadrement) === travail.statut) return false;

    const autorisees = TRANSITIONS[travail.statut] ?? [];
    if (!autorisees.includes(cible)) {
      throw new BadRequestException(
        t('stages.transition_interdite', {
          statut: travail.statut,
          cible,
          autorisees: autorisees.join(', ') || t('stages.aucune_transition_autorisee'),
        }),
      );
    }

    if (cible === StatutEncadrement.VALIDE && !travail.encadrantId) {
      throw new BadRequestException(t('stages.un_encadrant_doit_etre_designe_avant_la_validation_attribuez'));
    }

    if (cible === StatutEncadrement.SOUTENU) {
      if (!travail.rapportRendu) {
        throw new BadRequestException(t('stages.la_soutenance_suppose_le_rapport_rendu'));
      }
      if (!travail.soutenance) {
        throw new BadRequestException(t('stages.aucune_soutenance_enregistree'));
      }
    }

    if (cible === StatutEncadrement.PROPOSE && user.role !== Role.ADMIN) {
      throw new ForbiddenException(t('stages.la_reactivation_d_un_dossier_abandonne_est_reservee_a_l_admi'));
    }
    return true;
  }

  // ------------------------------------------------------------------
  // Soutenances
  // ------------------------------------------------------------------

  /** Enregistrer une soutenance : acte du bureau du jury qui SOUTENU le dossier. */
  async enregistrerSoutenance(dto: CreateSoutenanceDto, user: AuthUser) {
    // Le contrôle (dossier encore EN_COURS, sans soutenance, rapport rendu), la
    // création de la soutenance, le passage en SOUTENU et le journal forment un
    // seul acte : faits vérifiés et écriture entre eux, un dossier ne peut pas
    // se retrouver SOUTENU sans soutenance, ni l'inverse.
    return this.prisma.$transaction(async (tx) => {
      const travail: TravailTransition | null = await tx.travailEncadre.findUnique({
        where: { id: dto.travailEncadreId },
        // Seule l'existence de la soutenance est testée : charger la mention,
        // la note et les assesseurs ici n'était qu'une fuite de vie privée.
        select: { ...TRAVAIL_AUDIT_SELECT, soutenance: { select: { id: true } } },
      });
      if (!travail) throw new BadRequestException(t('stages.travail_introuvable'));
      if (travail.statut === StatutEncadrement.SOUTENU || travail.soutenance) {
        throw new BadRequestException(t('stages.ce_travail_est_deja_soutenu'));
      }
      if (travail.statut === StatutEncadrement.ABANDONNE) {
        throw new BadRequestException(t('stages.ce_travail_est_abandonnee_reactivez_le_avant_de_planifier_un'));
      }
      if (travail.statut !== StatutEncadrement.EN_COURS) {
        throw new BadRequestException(t('stages.ce_dossier_ne_se_soutient_pas', { statut: travail.statut }));
      }
      if (!travail.rapportRendu) {
        throw new BadRequestException(t('stages.le_rapport_doit_etre_rendu_avant_de_planifier_la_soutenance'));
      }

      // La soutenance enregistrée EST l'acte de passage en SOUTENU : on prend
      // l'état avant d'écrire, pour qu'un double enregistrement concurrent ne
      // puisse pas faire passer le dossier deux fois.
      const prise = await tx.travailEncadre.updateMany({
        where: { id: travail.id, statut: travail.statut },
        data: { statut: StatutEncadrement.SOUTENU },
      });
      if (prise.count !== 1) {
        throw new ConflictException(t('stages.ce_travail_a_change_d_etat_pendant_la_transition_recharge'));
      }

      const soutenance = await tx.soutenance.create({
        data: {
          travailEncadreId: dto.travailEncadreId,
          date: new Date(dto.date),
          salleId: dto.salleId,
          presidentId: dto.presidentId,
          assesseurs: dto.assesseurs,
        },
        include: {
          salle: { select: { id: true, code: true, nom: true } },
          president: { select: { id: true, nom: true, prenom: true } },
          travailEncadre: { include: TRAVAIL_INCLUDE },
        },
      });

      const apres: TravailAudit | null = await tx.travailEncadre.findUnique({
        where: { id: travail.id },
        select: TRAVAIL_AUDIT_SELECT,
      });
      await journaliser(
        tx,
        user,
        'SOUTENANCE_CREEE',
        'TravailEncadre',
        travail.id,
        avantApres(
          { ...this.instantaneTravail(travail), soutenance: null },
          { ...this.instantaneTravail(apres), soutenance: this.instantaneSoutenance(soutenance) },
        ),
      );
      return soutenance;
    });
  }

  /** Constat du jury : note et mention (ADMIN / DIRECTION). */
  async noter(id: string, dto: NoteSoutenanceDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant: SoutenanceAudit | null = await tx.soutenance.findUnique({
        where: { id },
        select: SOUTENANCE_AUDIT_SELECT,
      });
      if (!avant) throw new BadRequestException(t('stages.soutenance_introuvable'));
      if (dto.note === undefined && dto.mention === undefined) {
        throw new BadRequestException(t('stages.rien_a_enregistrer_une_note_ou_une_mention_attendue'));
      }
      const maj = await tx.soutenance.update({
        where: { id },
        data: { note: dto.note, mention: dto.mention },
        include: {
          salle: { select: { id: true, code: true, nom: true } },
          president: { select: { id: true, nom: true, prenom: true } },
          travailEncadre: { include: TRAVAIL_INCLUDE },
        },
      });
      // Note chiffrée : elle est journalisée. Mention rédigée : seule sa
      // présence l'est — le texte du jury ne part pas dans le journal.
      await journaliser(
        tx,
        user,
        'SOUTENANCE_NOTEE',
        'Soutenance',
        id,
        avantApres(this.instantaneSoutenance(avant), this.instantaneSoutenance(maj)),
      );
      return maj;
    });
  }

  /** Calendrier des soutenances à venir à 7 jours : j-7 → j+? (registre de la scolarité). */
  async calendrier() {
    const maintenant = new Date();
    const fin = new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.prisma.soutenance.findMany({
      where: { date: { gte: maintenant, lte: fin } },
      orderBy: { date: 'asc' },
      include: {
        salle: { select: { id: true, code: true, nom: true } },
        president: { select: { id: true, nom: true, prenom: true } },
        travailEncadre: { include: TRAVAIL_INCLUDE },
      },
    });
  }

  // ------------------------------------------------------------------
  // Garde partagée
  // ------------------------------------------------------------------

  /** Le travailleur ne touche qu'à son travail ; l'encadrant qu'à ses dossiers. */
  private autoriserPropriete(travail: { etudiantId: string; encadrantId: string | null }, user: AuthUser) {
    if (ROLES_PILOTES.includes(user.role)) return;
    if (user.role === Role.ENSEIGNANT) {
      if (travail.encadrantId !== user.enseignantId) {
        throw new ForbiddenException(t('stages.vous_n_encadrez_pas_ce_travail'));
      }
      return;
    }
    if (user.role === Role.ETUDIANT && travail.etudiantId === user.etudiantId) return;
    throw new ForbiddenException(t('stages.ce_travail_ne_vous_appartient_pas'));
  }

  /** Même garde en lecture pour l'état terminal et la fiche détaillée. */
  private autoriserLecture(travail: { etudiantId: string; encadrantId: string | null }, user: AuthUser) {
    if (ROLES_PILOTES.includes(user.role)) return;
    if (user.role === Role.ENSEIGNANT) {
      if (travail.encadrantId !== user.enseignantId) {
        throw new ForbiddenException(t('stages.vous_n_encadrez_pas_ce_travail'));
      }
      return;
    }
    if (user.role === Role.ETUDIANT && travail.etudiantId === user.etudiantId) return;
    throw new ForbiddenException(t('stages.ce_travail_ne_vous_appartient_pas'));
  }

  // ------------------------------------------------------------------
  // Journal d'audit (avant / après, minimisé)
  // ------------------------------------------------------------------

  /**
   * Instantané d'un travail pour le journal. Il ne retient que ce qui est
   * nécessaire à reconstituer une décision : statuts, dates, identifiants
   * techniques, booléens de présence. L'intitulé du sujet, la description, le
   * rapport, l'entreprise, le tuteur et le lieu sont du texte de dossier
   * confidentiel : ils ne sont jamais recopiés, seulement signalés présents ou
   * absents.
   */
  private instantaneTravail(travail: TravailJournalisable | null) {
    if (!travail) return null;
    return {
      id: travail.id,
      type: travail.type,
      statut: travail.statut,
      etudiantId: travail.etudiantId,
      encadrantId: travail.encadrantId ?? null,
      rapportRendu: Boolean(travail.rapportRendu),
      dateDebut: isoOuNull(travail.dateDebut),
      dateFin: isoOuNull(travail.dateFin),
      entreprisePresente: Boolean(travail.entreprise),
      tuteurEntreprisePresent: Boolean(travail.tuteurEntreprise),
    };
  }

  /**
   * Instantané d'une soutenance. La note est un chiffre : elle est journalisée.
   * La mention et la liste des assesseurs sont des textes rédigés (noms de
   * personnes) : seule leur présence est journalisée.
   */
  private instantaneSoutenance(soutenance: SoutenanceJournalisable | null) {
    if (!soutenance) return null;
    return {
      id: soutenance.id,
      travailEncadreId: soutenance.travailEncadreId,
      date: isoOuNull(soutenance.date),
      salleId: soutenance.salleId ?? null,
      presidentId: soutenance.presidentId ?? null,
      assesseursPresents: Boolean(soutenance.assesseurs),
      note: soutenance.note ?? null,
      mentionPresente: Boolean(soutenance.mention),
    };
  }
}
