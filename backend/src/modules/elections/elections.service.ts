/**
 * Plateforme d'élection des délégués et représentants.
 *
 * Le cycle de vie d'une élection est verrouillé par transitions explicites :
 * BROUILLON → OUVERT → CLOS → PROCLAME. Aucune transition arrière n'est
 * admise (sauf ANNULE, qui peut survenir depuis BROUILLON/OUVERT).
 *
 * Le vote applique deux règles :
 *  - un électeur ne peut pas voter deux fois pour le même candidat
 *    (contrainte Prisma @@unique([electionId, candidatId, etudiantId])) ;
 *  - il distribue au plus `nbSieges` voix : la route POST /vote vérifie que
 *    la taille du bulletin reste dans la limite. Au scrutin uninominal
 *    (nbSieges = 1) le bulletin porte donc un seul candidat.
 *
 * Les résultats sont calculables à tout moment, mais la proclamation est
 * un acte officiel qui consomme le scrutin et le rend immuable.
 *
 * Journal d'audit : les mutations de métadonnées (création, modification,
 * ouverture, clôture, proclamation, déclaration et retrait d'un candidat)
 * inscrivent leur état avant et après dans la transaction qui les porte. Les
 * projections y sont volontairement minimales : la structure du scrutin et son
 * calendrier, la position d'une candidature, la présence des champs de texte
 * libre — jamais leur contenu, jamais un décompte de voix, de bulletins ou de
 * participation, jamais l'électeur ni son choix. Le scrutin se lit dans le
 * module ; le journal dit qui l'a configuré, quand, et depuis quel état.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, StatutElection } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { chargerEtablissement } from '../../common/impression';
import { AuthUser } from '../../common/decorators';
import { t } from '../../common/i18n';
import { ParametresService } from '../parametres/parametres.service';
import { CreateCandidatDto, CreateElectionDto, ElectionQueryDto, UpdateElectionDto, VoterDto } from './elections.dto';
import { documentsElection, BulletinElection } from './documents';
import { paginer, pagine } from '../../common/pagination';
import { avantApres, journaliser } from '../../common/audit';

/**
 * Journal d'audit : le détail « transition » est écrit en base et relu par
 * les rapports. Il garde son vocabulaire : une transition inscrite avant la
 * migration reste lisible après, sans réécriture du journal.
 */
const TRANSITION_STATUT: Record<StatutElection, string> = {
  BROUILLON: 'BROUILLON',
  OUVERT: 'OUVERTE',
  CLOS: 'CLOSE',
  PROCLAME: 'PROCLAMEE',
  ANNULE: 'ANNULEE',
};

const ELECTION_INCLUDE = {
  promotion: { include: { filiere: true } },
  departement: true,
  creePar: { select: { id: true, nom: true, prenom: true } },
  candidats: {
    orderBy: { ordre: 'asc' },
    include: {
      etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
      enseignant: { select: { id: true, matricule: true, nom: true, prenom: true } },
    },
  },
  _count: { select: { candidats: true, votes: true } },
} as const;

// Projection utilisée par les électeurs : les identifiants internes et
// matricules des personnes candidates ne sont pas nécessaires au vote.
const CANDIDATS_VOTE_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  photoUrl: true,
  programme: true,
  ordre: true,
} as const;

const ELECTION_VOTE_INCLUDE = {
  promotion: { include: { filiere: true } },
  departement: true,
  creePar: { select: { id: true, nom: true, prenom: true } },
  candidats: {
    orderBy: { ordre: 'asc' },
    select: CANDIDATS_VOTE_SELECT,
  },
  // Les électeurs ne connaissent pas le nombre de bulletins avant clôture.
  _count: { select: { candidats: true } },
} as const;

const ROLES_GESTION: Role[] = [Role.ADMIN, Role.SCOLARITE, Role.DIRECTION];

/** Les dates du journal sont des ISO : lisibles dans le journal, comparables. */
function isoOuNull(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Client accepté par la lecture : la transaction de la mutation, ou la racine. */
type ClientElection = Pick<Prisma.TransactionClient, 'election'>;

@Injectable()
export class ElectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
  ) {}

  // ----------------------------------------------------------- consultation

  async liste(query: ElectionQueryDto, user: AuthUser) {
    const pagination = paginer(query);

    const where: Prisma.ElectionWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.promotionId ? { promotionId: query.promotionId } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
      ...(query.search
        ? {
            OR: [
              { titre: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    // Le portail ne doit jamais permettre d'énumérer les brouillons ou les
    // résultats intermédiaires en choisissant librement le statut du filtre.
    if (!ROLES_GESTION.includes(user.role)) where.statut = StatutElection.PROCLAME;

    const [data, total] = await Promise.all([
      this.prisma.election.findMany({
        where,
        include: ROLES_GESTION.includes(user.role) ? ELECTION_INCLUDE : ELECTION_VOTE_INCLUDE,
        orderBy: { dateOuverture: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.election.count({ where }),
    ]);

    return pagine(data, total, pagination);
  }

  /** Élections ouvertes à l'instant T (vitrine publique / portail étudiant). */
  async actives() {
    const maintenant = new Date();
    return this.prisma.election.findMany({
      where: {
        statut: StatutElection.OUVERT,
        dateOuverture: { lte: maintenant },
        dateCloture: { gt: maintenant },
      },
      include: {
        candidats: {
          orderBy: { ordre: 'asc' },
          select: CANDIDATS_VOTE_SELECT,
        },
      },
      orderBy: { dateCloture: 'asc' },
      take: 1000,
    });
  }

  async trouver(id: string) {
    return this.electionSur(this.prisma, id);
  }

  /**
   * Charge l'élection — 404 compris — sur le client fourni. Les mutations
   * l'appellent depuis leur transaction : l'état que le journal déclare comme
   * « avant » est alors exactement celui que la mutation engage.
   */
  private async electionSur(client: ClientElection, id: string) {
    const election = await client.election.findUnique({
      where: { id },
      include: ELECTION_INCLUDE,
    });
    if (!election) throw new NotFoundException(t('elections.election_introuvable'));
    return election;
  }

  /** Sérialise les transitions, les candidatures et les dépôts sur le même scrutin. */
  private async electionVerrouillee(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM "Election" WHERE id = ${id} FOR UPDATE`;
    return this.electionSur(tx, id);
  }

  /** Détail destiné au vote : scrutin ouvert à l'heure courante ou proclamé. */
  async trouverPour(id: string, user: AuthUser) {
    if (ROLES_GESTION.includes(user.role)) return this.trouver(id);

    const maintenant = new Date();
    const election = await this.prisma.election.findFirst({
      where: {
        id,
        OR: [
          { statut: StatutElection.PROCLAME },
          {
            statut: StatutElection.OUVERT,
            dateOuverture: { lte: maintenant },
            dateCloture: { gt: maintenant },
          },
        ],
      },
      include: ELECTION_VOTE_INCLUDE,
    });
    if (!election) throw new NotFoundException(t('elections.election_introuvable'));
    return election;
  }

  /**
   * Position de l'électeur courant sur cette élection : a-t-il déjà déposé
   * un bulletin ? L'identifiant du scrutin anonymise le vote (un seul token
   * par électeur pour une élection donnée).
   */
  async monVote(electionId: string, user: AuthUser) {
    // On interroge l'électeur, pas l'étudiant : un enseignant, un contrôleur
    // ou un administrateur n'a pas d'`etudiantId` et s'entendait donc répondre
    // « vous n'avez pas voté » même après avoir déposé son bulletin.
    // `etudiantId` reste consulté pour les bulletins antérieurs à la colonne
    // `electeurId`, qui n'en portent pas.
    const scrutin = await this.prisma.voteElection.findFirst({
      where: {
        electionId,
        OR: [{ electeurId: user.id }, ...(user.etudiantId ? [{ etudiantId: user.etudiantId }] : [])],
      },
      orderBy: { horodatage: 'desc' },
      select: { scrutinId: true, horodatage: true },
    });
    if (!scrutin) {
      return { aVote: false, scrutinId: null, dateVote: null };
    }
    return {
      aVote: true,
      scrutinId: scrutin.scrutinId,
      dateVote: scrutin.horodatage,
    };
  }

  // ---------------------------------------------------------------- édition

  async creer(dto: CreateElectionDto, user: AuthUser) {
    if (new Date(dto.dateCloture) <= new Date(dto.dateOuverture)) {
      throw new BadRequestException(t('elections.la_cloture_doit_suivre_l_ouverture'));
    }
    return this.prisma.$transaction(async (tx) => {
      const election = await tx.election.create({
        data: {
          titre: dto.titre,
          type: dto.type,
          promotionId: dto.promotionId ?? null,
          departementId: dto.departementId ?? null,
          description: dto.description ?? null,
          dateOuverture: new Date(dto.dateOuverture),
          dateCloture: new Date(dto.dateCloture),
          nbSieges: dto.nbSieges,
          bulletin: dto.bulletin ?? null,
          creeParId: user.id,
          statut: StatutElection.BROUILLON,
        },
        include: ELECTION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ELECTION_CREEE',
        'Election',
        election.id,
        avantApres(null, this.instantaneElection(election)),
      );
      return election;
    });
  }

  async modifier(id: string, dto: UpdateElectionDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const election = await this.electionVerrouillee(tx, id);
      if (election.statut !== StatutElection.BROUILLON) {
        throw new BadRequestException(t('elections.une_election_publiee_ne_se_modifie_plus_creez_en_une_nouvell'));
      }
      const ouverture = dto.dateOuverture !== undefined ? new Date(dto.dateOuverture) : election.dateOuverture;
      const cloture = dto.dateCloture !== undefined ? new Date(dto.dateCloture) : election.dateCloture;
      if (cloture <= ouverture) {
        throw new BadRequestException(t('elections.la_cloture_doit_suivre_l_ouverture'));
      }
      const miseAJour = await tx.election.update({
        where: { id },
        data: {
          ...(dto.titre !== undefined ? { titre: dto.titre } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.promotionId !== undefined ? { promotionId: dto.promotionId } : {}),
          ...(dto.departementId !== undefined ? { departementId: dto.departementId } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.dateOuverture !== undefined ? { dateOuverture: new Date(dto.dateOuverture) } : {}),
          ...(dto.dateCloture !== undefined ? { dateCloture: new Date(dto.dateCloture) } : {}),
          ...(dto.nbSieges !== undefined ? { nbSieges: dto.nbSieges } : {}),
          ...(dto.bulletin !== undefined ? { bulletin: dto.bulletin } : {}),
        },
        include: ELECTION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ELECTION_MODIFIEE',
        'Election',
        id,
        // Les champs touchés sont nommés, leur contenu ne l'est pas : savoir que
        // le titre a changé suffit à l'audit sans le recopier.
        avantApres(this.instantaneElection(election), this.instantaneElection(miseAJour), {
          champsModifies: Object.keys(dto),
        }),
      );
      return miseAJour;
    });
  }

  async ouvrir(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const election = await this.electionVerrouillee(tx, id);
      if (election.statut !== StatutElection.BROUILLON) {
        throw new BadRequestException(
          t('elections.on_ne_peut_ouvrir_l_election_que_depuis_brouillon', { statut: election.statut }),
        );
      }
      if (election.candidats.length === 0) {
        throw new BadRequestException(t('elections.declarez_au_moins_un_candidat_avant_d_ouvrir_le_scrutin'));
      }
      const miseAJour = await tx.election.update({
        where: { id },
        data: { statut: StatutElection.OUVERT },
        include: ELECTION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ELECTION_OUVERTE',
        'Election',
        id,
        avantApres(this.instantaneElection(election), this.instantaneElection(miseAJour), {
          transition: `${TRANSITION_STATUT[election.statut]}→${TRANSITION_STATUT[StatutElection.OUVERT]}`,
        }),
      );
      return miseAJour;
    });
  }

  async clore(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const election = await this.electionVerrouillee(tx, id);
      if (election.statut !== StatutElection.OUVERT) {
        throw new BadRequestException(
          t('elections.l_etat_de_l_election_est_election_statut_elle_ne_peut_etre_c', {
            'election.statut': election.statut,
          }),
        );
      }
      const miseAJour = await tx.election.update({
        where: { id },
        data: { statut: StatutElection.CLOS },
        include: ELECTION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ELECTION_CLOSE',
        'Election',
        id,
        avantApres(this.instantaneElection(election), this.instantaneElection(miseAJour), {
          transition: `${TRANSITION_STATUT[election.statut]}→${TRANSITION_STATUT[StatutElection.CLOS]}`,
        }),
      );
      return miseAJour;
    });
  }

  async proclamer(id: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const election = await this.electionVerrouillee(tx, id);
      if (election.statut !== StatutElection.CLOS) {
        throw new BadRequestException(
          t('elections.l_etat_de_l_election_est_election_statut_elle_ne_peut_etre_p', {
            'election.statut': election.statut,
          }),
        );
      }
      const miseAJour = await tx.election.update({
        where: { id },
        data: { statut: StatutElection.PROCLAME },
        include: ELECTION_INCLUDE,
      });
      await journaliser(
        tx,
        user,
        'ELECTION_PROCLAMEE',
        'Election',
        id,
        avantApres(this.instantaneElection(election), this.instantaneElection(miseAJour), {
          transition: `${TRANSITION_STATUT[election.statut]}→${TRANSITION_STATUT[StatutElection.PROCLAME]}`,
        }),
      );
      return miseAJour;
    });
  }

  // ----------------------------------------------------------- candidats

  async ajouterCandidat(id: string, dto: CreateCandidatDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const election = await this.electionVerrouillee(tx, id);
      if (election.statut !== StatutElection.BROUILLON) {
        throw new BadRequestException(t('elections.les_candidats_ne_se_declarent_qu_avant_l_ouverture_du_scrutin'));
      }
      const ordre = dto.ordre ?? election.candidats.length;
      const candidat = await tx.candidatElection.create({
        data: {
          electionId: id,
          nom: dto.nom,
          prenom: dto.prenom,
          etudiantId: dto.etudiantId ?? null,
          enseignantId: dto.enseignantId ?? null,
          photoUrl: dto.photoUrl ?? null,
          programme: dto.programme ?? null,
          ordre,
        },
      });
      // Le titre de l'élection disparaît du journal : il ne reste que son
      // identifiant technique, et la candidature réduite à sa position.
      await journaliser(
        tx,
        user,
        'CANDIDAT_AJOUTE',
        'Election',
        candidat.id,
        avantApres(null, this.instantaneCandidat(candidat, id)),
      );
      return candidat;
    });
  }

  async supprimerCandidat(id: string, candidatId: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const election = await this.electionVerrouillee(tx, id);
      if (election.statut !== StatutElection.BROUILLON) {
        throw new BadRequestException(t('elections.les_candidats_ne_se_retirent_qu_avant_l_ouverture'));
      }
      const candidat = await tx.candidatElection.findUnique({
        where: { id: candidatId },
      });
      if (!candidat || candidat.electionId !== id) {
        throw new NotFoundException(t('elections.candidat_introuvable_sur_cette_election'));
      }
      await tx.candidatElection.delete({ where: { id: candidatId } });
      // Après le retrait, le journal est la seule trace qui survit à la ligne :
      // d'où la projection avant, réduite elle aussi à l'essentiel.
      await journaliser(
        tx,
        user,
        'CANDIDAT_RETIRE',
        'Election',
        candidatId,
        avantApres(this.instantaneCandidat(candidat, id), null),
      );
      return { id: candidatId };
    });
  }

  // ------------------------------------------------------------------ vote

  /**
   * Vote : une seule requête par électeur (un électeur peut voter pour
   * plusieurs candidats à concurrence du nombre de sièges). La contrainte
   * unique Prisma garantit l'unicité : si l'utilisateur ré-essaie, une 409
   * est levée.
   */
  async voter(dto: VoterDto, user: AuthUser, ip?: string) {
    const idsChoisis = dto.bulletin.map((b) => b.candidatId);

    /**
     * Un électeur dépose UN bulletin, pas une voix à la fois. La contrainte
     * d'unicité, elle, porte sur le couple (scrutin, candidat, électeur) :
     * elle empêche de voter deux fois pour le même candidat, mais laisserait
     * quelqu'un étaler ses voix sur plusieurs requêtes et dépasser le nombre
     * de sièges. On refuse donc tout second dépôt sur la même élection.
     */
    const scrutinId = randomBytes(8).toString('hex');
    for (let tentative = 0; tentative < 3; tentative++) {
      try {
        await this.prisma.$transaction(
          async (transaction) => {
            const election = await this.electionVerrouillee(transaction, dto.electionId);
            if (election.statut !== StatutElection.OUVERT) {
              throw new BadRequestException(t('elections.le_scrutin_n_est_pas_ouvert'));
            }
            const maintenant = new Date();
            if (election.dateOuverture > maintenant) {
              throw new BadRequestException(t('elections.l_ouverture_du_scrutin_n_est_pas_encore_effective'));
            }
            if (election.dateCloture <= maintenant) {
              throw new BadRequestException(t('elections.le_scrutin_est_clos'));
            }
            if (dto.bulletin.length === 0) {
              throw new BadRequestException(t('elections.bulletin_vide_selectionnez_au_moins_un_candidat'));
            }
            if (dto.bulletin.length > election.nbSieges) {
              throw new BadRequestException(
                t('elections.vous_pouvez_choisir_au_plus_n_candidats', { sieges: election.nbSieges }),
              );
            }
            const doublons = new Set<string>();
            for (const id of idsChoisis) {
              if (doublons.has(id)) {
                throw new BadRequestException(t('elections.le_meme_candidat_ne_peut_pas_etre_choisi_deux_fois'));
              }
              doublons.add(id);
            }

            const candidatsExistants = await transaction.candidatElection.findMany({
              where: { id: { in: idsChoisis }, electionId: dto.electionId },
              select: { id: true },
            });
            if (candidatsExistants.length !== idsChoisis.length) {
              throw new BadRequestException(t('elections.au_moins_un_candidat_n_appartient_pas_a_cette_election'));
            }

            const dejaVote = await transaction.voteElection.findFirst({
              where: {
                electionId: dto.electionId,
                OR: [{ electeurId: user.id }, ...(user.etudiantId ? [{ etudiantId: user.etudiantId }] : [])],
              },
              select: { id: true },
            });
            if (dejaVote)
              throw new ConflictException(t('elections.vous_avez_deja_depose_un_bulletin_pour_cette_election'));
            await transaction.voteElection.createMany({
              data: idsChoisis.map((candidatId) => ({
                electionId: dto.electionId,
                candidatId,
                etudiantId: user.etudiantId ?? null,
                electeurId: user.id,
                scrutinId,
                mode: dto.mode ?? 'WEB',
                ipAppareil: ip ?? null,
              })),
            });
          },
          { isolationLevel: 'Serializable' },
        );
        break;
      } catch (error: any) {
        // Deux bulletins simultanés passent par le même contrôle transactionnel.
        if (error?.code === 'P2034' && tentative < 2) continue;
        if (error?.code === 'P2002' || error?.code === 'P2034') {
          throw new ConflictException(t('elections.vous_avez_deja_depose_un_bulletin_pour_cette_election'));
        }
        throw error;
      }
    }

    return { scrutinId, nbVotes: idsChoisis.length };
  }

  // ------------------------------------------------------------ résultats

  /** Calcul des résultats : nb voix par candidat, taux de participation. */
  async resultats(id: string) {
    const election = await this.prisma.election.findUnique({
      where: { id },
      select: {
        id: true,
        titre: true,
        type: true,
        nbSieges: true,
        statut: true,
        dateOuverture: true,
        dateCloture: true,
      },
    });
    if (!election) throw new NotFoundException(t('elections.election_introuvable'));
    if (election.statut !== StatutElection.CLOS && election.statut !== StatutElection.PROCLAME) {
      throw new NotFoundException(t('elections.election_introuvable'));
    }
    const candidats = await this.prisma.candidatElection.findMany({
      where: { electionId: id },
      orderBy: { ordre: 'asc' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        ordre: true,
        _count: { select: { votes: true } },
      },
    });
    const bulletins = await this.prisma.voteElection.groupBy({
      by: ['scrutinId'],
      where: { electionId: id },
      _count: { scrutinId: true },
    });
    const nbBulletins = bulletins.length;
    const voixTotales = await this.prisma.voteElection.count({ where: { electionId: id } });
    const candidatsElus = [...candidats]
      .sort((a, b) => b._count.votes - a._count.votes)
      .slice(0, election.nbSieges)
      .map((c) => c.id);

    return {
      election: {
        id: election.id,
        titre: election.titre,
        type: election.type,
        nbSieges: election.nbSieges,
        statut: election.statut,
        dateOuverture: election.dateOuverture,
        dateCloture: election.dateCloture,
      },
      participation: {
        nbBulletins,
        voixTotales,
        siegesPourvoir: election.nbSieges,
      },
      candidats: candidats.map((c) => ({
        id: c.id,
        nom: c.nom,
        prenom: c.prenom,
        ordre: c.ordre,
        voix: c._count.votes,
        elu: candidatsElus.includes(c.id),
      })),
    };
  }

  // ---------------------------------------------------------- impression

  private urlBulletin(baseUrl: string, electionId: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/#/elections/${electionId}`;
  }

  async imprimerBulletin(id: string, baseUrl: string, user: AuthUser) {
    const election = await this.trouverPour(id, user);
    if (election.statut !== StatutElection.OUVERT) throw new NotFoundException(t('common.notFound'));
    const etablissement = await chargerEtablissement(this.prisma);
    const bulletin: BulletinElection = {
      id: election.id,
      titre: election.titre,
      type: election.type,
      nbSieges: election.nbSieges,
      statut: election.statut,
      candidats: election.candidats.map((c) => ({
        id: c.id,
        nom: c.nom,
        prenom: c.prenom,
        ordre: c.ordre,
      })),
    };
    return documentsElection.bulletinA4(bulletin, {
      etablissement,
      urlVerification: this.urlBulletin(baseUrl, election.id),
    });
  }

  // ---------------------------------------------------------------- journal

  /**
   * Projection d'audit d'un scrutin : sa structure et son calendrier, c'est-à-dire
   * ce que l'administration décide. Le contenu éditorial — titre, description,
   * design du bulletin — n'est pas recopié, seulement signalé. Aucun décompte
   * de voix, de bulletin, de participation ni de résultat n'y figure : le
   * journal ne doit pas devenir une source secondaire de résultats détaillés.
   */
  private instantaneElection(election: any) {
    return {
      id: election.id,
      type: election.type,
      statut: election.statut,
      nbSieges: election.nbSieges,
      promotionId: election.promotionId ?? null,
      departementId: election.departementId ?? null,
      dateOuverture: isoOuNull(election.dateOuverture),
      dateCloture: isoOuNull(election.dateCloture),
      titreFourni: Boolean(election.titre),
      descriptionFournie: Boolean(election.description),
      bulletinFourni: Boolean(election.bulletin),
    };
  }

  /**
   * Projection d'audit d'une candidature : sa place dans la liste et son
   * rattachement éventuel à une fiche personne. Ni le nom, ni le prénom, ni le
   * programme, ni la photo — le journal ne se transforme pas en annuaire des
   * candidats, et aucun lien n'y est tracé entre une personne et un choix.
   */
  private instantaneCandidat(candidat: any, electionId: string) {
    return {
      id: candidat.id,
      electionId: candidat.electionId ?? electionId,
      ordre: candidat.ordre,
      etudiantLie: Boolean(candidat.etudiantId),
      enseignantLie: Boolean(candidat.enseignantId),
      programmeFourni: Boolean(candidat.programme),
      photoFournie: Boolean(candidat.photoUrl),
    };
  }
}
