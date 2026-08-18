/**
 * Plateforme d'élection des délégués et représentants.
 *
 * Le cycle de vie d'une élection est verrouillé par transitions explicites :
 * BROUILLON → OUVERTE → CLOSE → PROCLAMEE. Aucune transition arrière n'est
 * admise (sauf ANNULEE, qui peut survenir depuis BROUILLON/OUVERTE).
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
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, StatutElection } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { ParametresService } from '../parametres/parametres.module';
import {
  CreateCandidatDto,
  CreateElectionDto,
  ElectionQueryDto,
  UpdateElectionDto,
  VoterDto,
} from './elections.dto';
import { documentsElection, BulletinElection } from './documents';

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

@Injectable()
export class ElectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly jwt: JwtService,
  ) {}

  // ----------------------------------------------------------- consultation

  async liste(query: ElectionQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

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

    const [data, total] = await Promise.all([
      this.prisma.election.findMany({
        where,
        include: ELECTION_INCLUDE,
        orderBy: { dateOuverture: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.election.count({ where }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  /** Élections ouvertes à l'instant T (vitrine publique / portail étudiant). */
  async actives() {
    const maintenant = new Date();
    return this.prisma.election.findMany({
      where: {
        statut: StatutElection.OUVERTE,
        dateOuverture: { lte: maintenant },
        dateCloture: { gt: maintenant },
      },
      include: { candidats: { orderBy: { ordre: 'asc' } } },
      orderBy: { dateCloture: 'asc' },
    });
  }

  async trouver(id: string) {
    const election = await this.prisma.election.findUnique({
      where: { id },
      include: ELECTION_INCLUDE,
    });
    if (!election) throw new NotFoundException('Élection introuvable');
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
        OR: [
          { electeurId: user.id },
          ...(user.etudiantId ? [{ etudiantId: user.etudiantId }] : []),
        ],
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
      throw new BadRequestException('La clôture doit suivre l\'ouverture.');
    }
    const election = await this.prisma.election.create({
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
    await this.journal(user.id, 'ELECTION_CREEE', election.id);
    return election;
  }

  async modifier(id: string, dto: UpdateElectionDto, user: AuthUser) {
    const election = await this.trouver(id);
    if (election.statut !== StatutElection.BROUILLON) {
      throw new BadRequestException(
        'Une élection publiée ne se modifie plus : créez-en une nouvelle.',
      );
    }
    const miseAJour = await this.prisma.election.update({
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
    await this.journal(user.id, 'ELECTION_MODIFIEE', id);
    return miseAJour;
  }

  async ouvrir(id: string, user: AuthUser) {
    const election = await this.trouver(id);
    if (election.statut !== StatutElection.BROUILLON) {
      throw new BadRequestException(
        `L'élection est ${election.statut} : on ne peut l'ouvrir que depuis BROUILLON.`,
      );
    }
    if (election.candidats.length === 0) {
      throw new BadRequestException(
        "Déclarez au moins un candidat avant d'ouvrir le scrutin.",
      );
    }
    const miseAJour = await this.prisma.election.update({
      where: { id },
      data: { statut: StatutElection.OUVERTE },
      include: ELECTION_INCLUDE,
    });
    await this.journal(user.id, 'ELECTION_OUVERTE', id);
    return miseAJour;
  }

  async clore(id: string, user: AuthUser) {
    const election = await this.trouver(id);
    if (election.statut !== StatutElection.OUVERTE) {
      throw new BadRequestException(
        `L'élection est ${election.statut} : seule une OUVERTE peut être close.`,
      );
    }
    const miseAJour = await this.prisma.election.update({
      where: { id },
      data: { statut: StatutElection.CLOSE },
      include: ELECTION_INCLUDE,
    });
    await this.journal(user.id, 'ELECTION_CLOSE', id);
    return miseAJour;
  }

  async proclamer(id: string, user: AuthUser) {
    const election = await this.trouver(id);
    if (election.statut !== StatutElection.CLOSE) {
      throw new BadRequestException(
        `L'élection est ${election.statut} : seule une CLOSE peut être proclamée.`,
      );
    }
    const miseAJour = await this.prisma.election.update({
      where: { id },
      data: { statut: StatutElection.PROCLAMEE },
      include: ELECTION_INCLUDE,
    });
    await this.journal(user.id, 'ELECTION_PROCLAMEE', id);
    return miseAJour;
  }

  // ----------------------------------------------------------- candidats

  async ajouterCandidat(id: string, dto: CreateCandidatDto, user: AuthUser) {
    const election = await this.trouver(id);
    if (election.statut !== StatutElection.BROUILLON) {
      throw new BadRequestException(
        'Les candidats ne se déclarent qu\'avant l\'ouverture du scrutin.',
      );
    }
    const ordre = dto.ordre ?? election.candidats.length;
    const candidat = await this.prisma.candidatElection.create({
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
    await this.journal(user.id, 'CANDIDAT_AJOUTE', candidat.id, `élection ${election.titre}`);
    return candidat;
  }

  async supprimerCandidat(id: string, candidatId: string, user: AuthUser) {
    const election = await this.trouver(id);
    if (election.statut !== StatutElection.BROUILLON) {
      throw new BadRequestException(
        'Les candidats ne se retirent qu\'avant l\'ouverture du scrutin.',
      );
    }
    const candidat = await this.prisma.candidatElection.findUnique({
      where: { id: candidatId },
    });
    if (!candidat || candidat.electionId !== id) {
      throw new NotFoundException('Candidat introuvable sur cette élection');
    }
    await this.prisma.candidatElection.delete({ where: { id: candidatId } });
    await this.journal(user.id, 'CANDIDAT_RETIRE', candidatId, `élection ${election.titre}`);
    return { id: candidatId };
  }

  // ------------------------------------------------------------------ vote

  /**
   * Vote : une seule requête par électeur (un électeur peut voter pour
   * plusieurs candidats à concurrence du nombre de sièges). La contrainte
   * unique Prisma garantit l'unicité : si l'utilisateur ré-essaie, une 409
   * est levée.
   */
  async voter(dto: VoterDto, user: AuthUser, ip?: string) {
    const election = await this.trouver(dto.electionId);
    if (election.statut !== StatutElection.OUVERTE) {
      throw new BadRequestException("Le scrutin n'est pas ouvert.");
    }
    const maintenant = new Date();
    if (election.dateOuverture > maintenant) {
      throw new BadRequestException("L'ouverture du scrutin n'est pas encore effective.");
    }
    if (election.dateCloture <= maintenant) {
      throw new BadRequestException('Le scrutin est clos.');
    }
    if (dto.bulletin.length === 0) {
      throw new BadRequestException('Bulletin vide : sélectionnez au moins un candidat.');
    }
    if (dto.bulletin.length > election.nbSieges) {
      throw new BadRequestException(
        `Vous pouvez choisir au plus ${election.nbSieges} candidat(s) (sièges à pourvoir).`,
      );
    }
    const idsChoisis = dto.bulletin.map((b) => b.candidatId);
    const doublons = new Set<string>();
    for (const id of idsChoisis) {
      if (doublons.has(id)) {
        throw new BadRequestException('Le même candidat ne peut pas être choisi deux fois.');
      }
      doublons.add(id);
    }

    const candidatsExistants = await this.prisma.candidatElection.findMany({
      where: { id: { in: idsChoisis }, electionId: dto.electionId },
      select: { id: true },
    });
    if (candidatsExistants.length !== idsChoisis.length) {
      throw new BadRequestException("Au moins un candidat n'appartient pas à cette élection.");
    }

    /**
     * Un électeur dépose UN bulletin, pas une voix à la fois. La contrainte
     * d'unicité, elle, porte sur le couple (scrutin, candidat, électeur) :
     * elle empêche de voter deux fois pour le même candidat, mais laisserait
     * quelqu'un étaler ses voix sur plusieurs requêtes et dépasser le nombre
     * de sièges. On refuse donc tout second dépôt sur la même élection.
     */
    const dejaVote = await this.prisma.voteElection.findFirst({
      where: {
        electionId: dto.electionId,
        OR: [
          { electeurId: user.id },
          ...(user.etudiantId ? [{ etudiantId: user.etudiantId }] : []),
        ],
      },
      select: { id: true },
    });
    if (dejaVote) {
      throw new ConflictException('Vous avez déjà déposé un bulletin pour cette élection.');
    }

    const scrutinId = randomBytes(8).toString('hex');
    try {
      await this.prisma.$transaction(
        idsChoisis.map((candidatId) =>
          this.prisma.voteElection.create({
            data: {
              electionId: dto.electionId,
              candidatId,
              etudiantId: user.etudiantId ?? null,
              // L'électeur, quel que soit son rôle : c'est lui que la
              // contrainte d'unicité empêche de voter deux fois.
              electeurId: user.id,
              scrutinId,
              mode: dto.mode ?? 'WEB',
              ipAppareil: ip ?? null,
            },
          }),
        ),
      );
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          "Vous avez déjà déposé un bulletin pour cette élection.",
        );
      }
      throw e;
    }

    await this.journal(user.id, 'VOTE_DEPOSE', dto.electionId, scrutinId);
    return { scrutinId, nbVotes: idsChoisis.length };
  }

  // ------------------------------------------------------------ résultats

  /** Calcul des résultats : nb voix par candidat, taux de participation. */
  async resultats(id: string) {
    const election = await this.trouver(id);
    const candidats = await this.prisma.candidatElection.findMany({
      where: { electionId: id },
      orderBy: { ordre: 'asc' },
      include: {
        _count: { select: { votes: true } },
        etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
        enseignant: { select: { id: true, matricule: true, nom: true, prenom: true } },
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
        etudiant: c.etudiant,
        enseignant: c.enseignant,
      })),
    };
  }

  // ---------------------------------------------------------- impression

  private urlBulletin(baseUrl: string, electionId: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/#/elections/${electionId}`;
  }

  async imprimerBulletin(id: string, token: string | undefined, baseUrl: string) {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    const election = await this.trouver(id);
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
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
      nomEtablissement: etablissement,
      urlVerification: this.urlBulletin(baseUrl, election.id),
    });
  }

  // ---------------------------------------------------------------- journal

  private async journal(userId: string, action: string, entiteId: string, details?: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entite: 'Election',
        entiteId,
        ...(details ? { details } : {}),
      },
    });
  }
}