/**
 * Journal avant/après des élections — mutations de métadonnées.
 *
 * Ce que ces tests verrouillent :
 *  - les sept mutations (création, modification, ouverture, clôture,
 *    proclamation, déclaration et retrait d'un candidat) écrivent leur état
 *    avant et après dans la transaction qui les porte ;
 *  - les projections sont minimales : ni identité d'électeur, ni vote, ni
 *    contenu de bulletin, ni total détaillé, ni titre, description, nom,
 *    programme ou photo en clair ;
 *  - les règles, transitions et garde-fous d'ouverture sont inchangés, et une
 *    mutation refusée n'écrit rien ;
 *  - le dépôt d'un bulletin ne produit toujours aucun journal supplémentaire.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, StatutElection, TypeElection } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import type { AuthUser } from '../../common/decorators';
import { ElectionsService } from './elections.service';

const TITRE = 'Élections BDE — liste interne confidentielle';
const TITRE_NOUVEAU = 'Élections BDE — liste corrigée confidentielle';
const DESCRIPTION = 'Description interne confidentielle du scrutin';
const BULLETIN = 'Design du bulletin — version de travail interne';
const NOM_CANDIDAT = 'Candidat Confidentiel';
const PRENOM_CANDIDAT = 'Prénom Confidentiel';
const PROGRAMME = 'Programme confidentiel du candidat';
const PHOTO = 'https://campus.test/photo-candidat-confidentielle.png';
const ETUDIANT_LIE = 'etudiant-9';

const CANDIDAT = {
  id: 'candidat-1',
  electionId: 'election-1',
  nom: NOM_CANDIDAT,
  prenom: PRENOM_CANDIDAT,
  etudiantId: ETUDIANT_LIE,
  enseignantId: null,
  photoUrl: PHOTO,
  programme: PROGRAMME,
  ordre: 0,
};

/** Un scrutin complet, textes compris : le journal ne doit rien en reprendre. */
const ELECTION = {
  id: 'election-1',
  titre: TITRE,
  type: TypeElection.DELEGUE_PROMOTION,
  promotionId: 'promo-1',
  departementId: null,
  description: DESCRIPTION,
  dateOuverture: new Date('2026-10-01T08:00:00.000Z'),
  dateCloture: new Date('2026-10-08T18:00:00.000Z'),
  nbSieges: 2,
  bulletin: BULLETIN,
  statut: StatutElection.BROUILLON,
  creeParId: 'admin-1',
  candidats: [CANDIDAT],
};

/** Projection réellement attendue dans le journal, ni avant ni après. */
const INSTANTANE = {
  id: 'election-1',
  type: TypeElection.DELEGUE_PROMOTION,
  statut: StatutElection.BROUILLON,
  nbSieges: 2,
  promotionId: 'promo-1',
  departementId: null,
  dateOuverture: '2026-10-01T08:00:00.000Z',
  dateCloture: '2026-10-08T18:00:00.000Z',
  titreFourni: true,
  descriptionFournie: true,
  bulletinFourni: true,
};

const INSTANTANE_CANDIDAT = {
  id: 'candidat-1',
  electionId: 'election-1',
  ordre: 0,
  etudiantLie: true,
  enseignantLie: false,
  programmeFourni: true,
  photoFournie: true,
};

interface Options {
  statut?: StatutElection;
  fenetreOuverte?: boolean;
  journalEchoue?: boolean;
  ecritureEchouee?: string;
}

/**
 * Fausse transaction fidèle sur un point : les écritures ne deviennent
 * visibles dans `base` qu'après le commit. Si l'opération lève, l'état validé
 * reste intact — c'est ce qui permet d'affirmer qu'un échec de journal ne
 * laisse pas de mutation fantôme, et qu'une mutation refusée ne laisse pas de
 * trace. `journalRacine` isole les écritures passées hors transaction.
 */
function depotAtomique(options: Options = {}) {
  const maintenant = Date.now();
  const initial: any = {
    ...ELECTION,
    statut: options.statut ?? ELECTION.statut,
    dateOuverture: new Date(options.fenetreOuverte ? maintenant - 3_600_000 : ELECTION.dateOuverture),
    dateCloture: new Date(options.fenetreOuverte ? maintenant + 3_600_000 : ELECTION.dateCloture),
    candidats: [{ ...CANDIDAT }],
  };
  const base: any = { ...initial, candidats: [{ ...CANDIDAT }] };
  const journal: any[] = [];
  let tampon: any = { ...initial, candidats: [{ ...CANDIDAT }] };
  let candidats: any[] = [{ ...CANDIDAT }];

  const recharger = () => {
    tampon = { ...base, candidats: [...candidats] };
  };
  const ecriture = (nom: string) => {
    if (options.ecritureEchouee === nom) throw new Error('mutation refusée');
  };
  const avecCandidats = (election: any) => ({ ...election, candidats: [...candidats] });

  const tx: any = {
    $queryRaw: jest.fn(async () => []),
    election: {
      findUnique: async () => avecCandidats(tampon),
      create: async ({ data }: any) => {
        ecriture('create');
        Object.assign(tampon, { ...data, id: 'election-1' });
        return avecCandidats(tampon);
      },
      update: async ({ data }: any) => {
        ecriture('update');
        Object.assign(tampon, data);
        return avecCandidats(tampon);
      },
    },
    candidatElection: {
      findMany: async () => candidats.map((c) => ({ id: c.id })),
      findUnique: async ({ where }: any) => {
        const candidat = candidats.find((c) => c.id === where.id);
        return candidat ? { ...candidat } : null;
      },
      create: async ({ data }: any) => {
        ecriture('create');
        const candidat = { ...data, id: 'candidat-2' };
        candidats = [...candidats, candidat];
        return candidat;
      },
      delete: async () => {
        ecriture('delete');
        candidats = [];
        return {};
      },
    },
    voteElection: {
      findFirst: async () => null,
      createMany: async () => ({ count: 1 }),
    },
    auditLog: {
      create: async ({ data }: any) => {
        if (options.journalEchoue) throw new Error('journal indisponible');
        journal.push(data);
        return {};
      },
    },
  };

  const prisma: any = {
    election: { findUnique: async () => avecCandidats(base) },
    candidatElection: { findMany: async () => candidats.map((c) => ({ id: c.id })) },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        // Une trace écrite hors transaction échouerait ici, après le commit :
        // les tests d'annulation le verraient, l'état validé aurait changé.
        if (options.journalEchoue) throw new Error('journal indisponible');
        journal.push(data);
        return {};
      }),
    },
    $transaction: async (operation: (c: any) => unknown) => {
      recharger();
      candidats = [...base.candidats];
      try {
        const resultat = await operation(tx);
        for (const cle of Object.keys(tampon)) base[cle] = tampon[cle];
        base.candidats = [...candidats];
        return resultat;
      } catch (e) {
        // Rollback : ni la mutation ni sa trace ne sont conservées.
        recharger();
        candidats = [...base.candidats];
        throw e;
      }
    },
  };
  return { prisma, journal, base, journalRacine: prisma.auditLog.create };
}

const details = (entree: any) => JSON.parse(entree.details);

describe('Élections — journal d’audit avant/après des métadonnées', () => {
  const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;
  const scolarite = { id: 'scol-1', role: Role.SCOLARITE } as AuthUser;

  beforeEach(() => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Opération refusée' } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const DTO_ELECTION = {
    titre: TITRE,
    type: TypeElection.DELEGUE_PROMOTION,
    promotionId: 'promo-1',
    description: DESCRIPTION,
    dateOuverture: '2026-10-01T08:00:00.000Z',
    dateCloture: '2026-10-08T18:00:00.000Z',
    nbSieges: 2,
    bulletin: BULLETIN,
  };
  const DTO_CANDIDAT = {
    nom: NOM_CANDIDAT,
    prenom: PRENOM_CANDIDAT,
    etudiantId: ETUDIANT_LIE,
    programme: PROGRAMME,
    photoUrl: PHOTO,
  };

  // ------------------------------------------------------------------ acteur

  it('rattribue la création du scrutin à son auteur, dans la transaction', async () => {
    const { prisma, journal, journalRacine } = depotAtomique();
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await service.creer(DTO_ELECTION as any, scolarite);

    expect(prisma.$transaction).toBeDefined();
    expect(journalRacine).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      userId: 'scol-1',
      action: 'ELECTION_CREEE',
      entite: 'Election',
      entiteId: 'election-1',
    });
    const ecrit = details(journal[0]);
    expect(ecrit.avant).toBeNull();
    expect(ecrit.apres).toEqual(INSTANTANE);
  });

  it('rattribue la déclaration d’un candidat à son auteur', async () => {
    const { prisma, journal, journalRacine } = depotAtomique();
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await service.ajouterCandidat('election-1', DTO_CANDIDAT as any, admin);

    expect(journalRacine).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      userId: 'admin-1',
      action: 'CANDIDAT_AJOUTE',
      entite: 'Election',
      entiteId: 'candidat-2',
    });
  });

  // ---------------------------------------------------------- avant / après

  it('journalise la modification avec l’état avant, l’état atteint et les champs touchés', async () => {
    const { prisma, journal, journalRacine } = depotAtomique();
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await service.modifier(
      'election-1',
      {
        titre: TITRE_NOUVEAU,
        description: 'Autre description confidentielle',
        dateCloture: '2026-10-09T12:00:00.000Z',
        nbSieges: 3,
      } as any,
      admin,
    );

    expect(journalRacine).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      userId: 'admin-1',
      action: 'ELECTION_MODIFIEE',
      entiteId: 'election-1',
    });
    const ecrit = details(journal[0]);
    expect(ecrit.avant).toEqual(INSTANTANE);
    expect(ecrit.apres).toEqual({
      ...INSTANTANE,
      dateCloture: '2026-10-09T12:00:00.000Z',
      nbSieges: 3,
    });
    // Les champs touchés sont nommés, jamais leur valeur.
    expect(ecrit.champsModifies).toEqual(['titre', 'description', 'dateCloture', 'nbSieges']);
    const brut = journal[0].details;
    expect(brut).not.toContain(TITRE);
    expect(brut).not.toContain(TITRE_NOUVEAU);
    expect(brut).not.toContain('Autre description confidentielle');
  });

  // Le détail « transition » garde le vocabulaire du journal : une transition
  // écrite avant l'harmonisation des statuts reste lisible après, sans
  // réécriture du journal (docs/decisions/statuts.md).
  it.each([
    ['ouvrir', StatutElection.BROUILLON, 'ELECTION_OUVERTE', StatutElection.OUVERT, 'BROUILLON→OUVERTE'],
    ['clore', StatutElection.OUVERT, 'ELECTION_CLOSE', StatutElection.CLOS, 'OUVERTE→CLOSE'],
    ['proclamer', StatutElection.CLOS, 'ELECTION_PROCLAMEE', StatutElection.PROCLAME, 'CLOSE→PROCLAMEE'],
  ])(
    'journalise la transition « %s » avec l’état de départ et l’état atteint',
    async (methode, depart, action, arrivee, transition) => {
      const { prisma, journal, journalRacine } = depotAtomique({ statut: depart });
      const service = new ElectionsService(prisma, {} as any, {} as any);

      await (service as any)[methode]('election-1', admin);

      expect(journalRacine).not.toHaveBeenCalled();
      expect(journal).toHaveLength(1);
      expect(journal[0]).toMatchObject({
        userId: 'admin-1',
        action,
        entite: 'Election',
        entiteId: 'election-1',
      });
      const ecrit = details(journal[0]);
      expect(ecrit.transition).toBe(transition);
      expect(ecrit.avant).toEqual({ ...INSTANTANE, statut: depart });
      expect(ecrit.apres).toEqual({ ...INSTANTANE, statut: arrivee });
    },
  );

  it('conserve l’état du scrutin après la proclamation', async () => {
    const { prisma, base, journal } = depotAtomique({ statut: StatutElection.CLOS });
    const service = new ElectionsService(prisma, {} as any, {} as any);

    const proclamation = await service.proclamer('election-1', admin);

    expect(proclamation.statut).toBe(StatutElection.PROCLAME);
    expect(base.statut).toBe(StatutElection.PROCLAME);
    expect(base.titre).toBe(TITRE);
    expect(details(journal[0]).apres.statut).toBe(StatutElection.PROCLAME);
  });

  it('réduit la déclaration d’un candidat à sa position et à son rattachement', async () => {
    const { prisma, journal } = depotAtomique();
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await service.ajouterCandidat('election-1', DTO_CANDIDAT as any, admin);

    const ecrit = details(journal[0]);
    expect(ecrit.avant).toBeNull();
    // Second candidat de la liste : l'ordre se déduit de la liste, pas du nom.
    expect(ecrit.apres).toEqual({ ...INSTANTANE_CANDIDAT, id: 'candidat-2', ordre: 1 });
    const brut = journal[0].details;
    expect(brut).not.toContain(NOM_CANDIDAT);
    expect(brut).not.toContain(PRENOM_CANDIDAT);
    expect(brut).not.toContain(PROGRAMME);
    expect(brut).not.toContain(PHOTO);
    expect(brut).not.toContain(ETUDIANT_LIE);
    expect(brut).not.toContain(TITRE);
  });

  it('garde la trace du candidat retiré, désormais seule survivante', async () => {
    const { prisma, journal, base } = depotAtomique();
    const service = new ElectionsService(prisma, {} as any, {} as any);

    const retire = await service.supprimerCandidat('election-1', 'candidat-1', admin);

    expect(retire).toEqual({ id: 'candidat-1' });
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      userId: 'admin-1',
      action: 'CANDIDAT_RETIRE',
      entiteId: 'candidat-1',
    });
    const ecrit = details(journal[0]);
    expect(ecrit.avant).toEqual(INSTANTANE_CANDIDAT);
    expect(ecrit.apres).toBeNull();
    expect(base.candidats).toEqual([]);
    expect(journal[0].details).not.toContain(NOM_CANDIDAT);
  });

  // ------------------------------------------------------------ minimisation

  it('n’écrit dans aucun journal ni identité, ni choix, ni total, ni texte libre', async () => {
    const scenarios: Array<[string, (s: ElectionsService) => Promise<unknown>, Options?]> = [
      ['création', (s) => s.creer(DTO_ELECTION as any, admin)],
      [
        'modification',
        (s) => s.modifier('election-1', { titre: TITRE_NOUVEAU, description: DESCRIPTION } as any, admin),
      ],
      ['ouverture', (s) => s.ouvrir('election-1', admin)],
      ['clôture', (s) => s.clore('election-1', admin), { statut: StatutElection.OUVERT }],
      ['proclamation', (s) => s.proclamer('election-1', admin), { statut: StatutElection.CLOS }],
      ['déclaration', (s) => s.ajouterCandidat('election-1', DTO_CANDIDAT as any, admin)],
      ['retrait', (s) => s.supprimerCandidat('election-1', 'candidat-1', admin)],
    ];

    const entrees: any[] = [];
    for (const [, jouer, options] of scenarios) {
      const { prisma, journal } = depotAtomique(options);
      await jouer(new ElectionsService(prisma, {} as any, {} as any));
      expect(journal).toHaveLength(1);
      entrees.push(...journal);
    }

    const clesAutorisees = new Set([...Object.keys(INSTANTANE), ...Object.keys(INSTANTANE_CANDIDAT)]);
    const clesInterdites = [
      // identité d'un électeur et lien avec un choix
      'electeurId',
      'etudiantId',
      'enseignantId',
      'candidatId',
      'scrutinId',
      'electeur',
      'ip',
      'ipAppareil',
      'mode',
      // bulletin et résultats
      'bulletin',
      'bulletins',
      'votes',
      'voix',
      'voixTotales',
      'nbBulletins',
      'nbVotes',
      'participation',
      'candidatsElus',
      'resultats',
      // texte libre
      'titre',
      'description',
      'nom',
      'prenom',
      'programme',
      'photoUrl',
    ];
    for (const entree of entrees) {
      const ecrit = details(entree);
      // L'écran Journal ne lit un événement que s'il porte les deux états.
      expect(Object.keys(ecrit)).toEqual(expect.arrayContaining(['avant', 'apres']));
      for (const etat of [ecrit.avant, ecrit.apres]) {
        if (!etat || typeof etat !== 'object') continue;
        for (const cle of Object.keys(etat)) {
          expect(clesAutorisees.has(cle)).toBe(true);
          expect(clesInterdites).not.toContain(cle);
        }
      }
      for (const interdit of [
        TITRE,
        TITRE_NOUVEAU,
        DESCRIPTION,
        BULLETIN,
        NOM_CANDIDAT,
        PRENOM_CANDIDAT,
        PROGRAMME,
        PHOTO,
        ETUDIANT_LIE,
      ]) {
        expect(entree.details).not.toContain(interdit);
      }
    }
  });

  // --------------------------------------------------- atomicité et refus

  it('n’écrit aucun journal quand la mutation échoue', async () => {
    const { prisma, journal, base } = depotAtomique({ ecritureEchouee: 'update' });
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.modifier('election-1', { nbSieges: 4 } as any, admin)).rejects.toThrow('mutation refusée');

    expect(journal).toEqual([]);
    expect(base.nbSieges).toBe(2);
  });

  it('annule la proclamation si l’écriture du journal échoue', async () => {
    const { prisma, journal, base } = depotAtomique({
      statut: StatutElection.CLOS,
      journalEchoue: true,
    });
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.proclamer('election-1', admin)).rejects.toThrow('journal indisponible');

    // La proclamation est passée par la transaction avant l'échec du journal :
    // c'est l'annulation de l'ensemble, pas l'ordre des appels, qui protège l'état.
    expect(base.statut).toBe(StatutElection.CLOS);
    expect(journal).toEqual([]);
  });

  it('annule le retrait d’un candidat si l’écriture du journal échoue', async () => {
    const { prisma, journal, base } = depotAtomique({ journalEchoue: true });
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.supprimerCandidat('election-1', 'candidat-1', admin)).rejects.toThrow('journal indisponible');

    expect(base.candidats).toEqual([{ ...CANDIDAT }]);
    expect(journal).toEqual([]);
  });

  it('conserve le refus d’ouvrir un scrutin sans candidat, sans rien écrire', async () => {
    const { prisma, journal, base } = depotAtomique();
    base.candidats = [];
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.ouvrir('election-1', admin)).rejects.toBeInstanceOf(BadRequestException);

    expect(base.statut).toBe(StatutElection.BROUILLON);
    expect(journal).toEqual([]);
  });

  it('conserve les transitions verrouillées, sans rien écrire', async () => {
    const { prisma, journal, base } = depotAtomique();
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.clore('election-1', admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.proclamer('election-1', admin)).rejects.toBeInstanceOf(BadRequestException);

    expect(base.statut).toBe(StatutElection.BROUILLON);
    expect(journal).toEqual([]);
  });

  it('conserve le refus de modifier un scrutin publié, sans rien écrire', async () => {
    const { prisma, journal, base } = depotAtomique({ statut: StatutElection.OUVERT });
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.modifier('election-1', { nbSieges: 5 } as any, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.ajouterCandidat('election-1', DTO_CANDIDAT as any, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(base.nbSieges).toBe(2);
    expect(base.candidats).toEqual([{ ...CANDIDAT }]);
    expect(journal).toEqual([]);
  });

  it('refuse un candidat qui n’appartient pas au scrutin, sans rien écrire', async () => {
    const { prisma, journal, base } = depotAtomique();
    // Un candidat déclaré sur un autre scrutin : le retrait visé n'existe pas ici.
    base.candidats = [{ ...CANDIDAT }, { ...CANDIDAT, id: 'candidat-3', electionId: 'election-2' }];
    const service = new ElectionsService(prisma, {} as any, {} as any);

    await expect(service.supprimerCandidat('election-1', 'candidat-3', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.supprimerCandidat('election-1', 'candidat-9', admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(base.candidats).toHaveLength(2);
    expect(journal).toEqual([]);
  });

  // ------------------------------------------------------------------ vote

  it('ne journalise ni le dépôt, ni le votant, ni le scrutin choisi', async () => {
    const { prisma, journal, journalRacine } = depotAtomique({
      statut: StatutElection.OUVERT,
      fenetreOuverte: true,
    });
    const service = new ElectionsService(prisma, {} as any, {} as any);
    const electeur = { id: 'user-etu-77', role: Role.ETUDIANT, etudiantId: 'etudiant-77' } as AuthUser;

    const depot = await service.voter(
      { electionId: 'election-1', bulletin: [{ candidatId: CANDIDAT.id }] } as any,
      electeur,
      '10.0.0.9',
    );

    // La réponse métier conserve le reçu destiné au votant ; le journal
    // d'audit ne conserve aucune ligne qui permette de déduire participation,
    // identité ou choix.
    expect(depot).toMatchObject({ scrutinId: expect.any(String), nbVotes: 1 });
    expect(journal).toEqual([]);
    expect(journalRacine).not.toHaveBeenCalled();
  });
});
