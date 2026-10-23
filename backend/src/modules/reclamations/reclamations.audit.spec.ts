/**
 * Journal avant/après des réclamations — ouvertures, messages, transitions,
 * affectations, escalades et clôtures.
 *
 * Ce que ces tests verrouillent :
 *  - l'acteur (compte connecté) et l'entité visée sont inscrits ;
 *  - l'état avant et après est complet sur la situation du dossier
 *    (statut, priorité, affectation, escalade, clôture, volumétrie) ;
 *  - aucun texte libre, aucune donnée personnelle, aucune coordonnée, aucun
 *    secret et aucun contenu de pièce jointe ne franchit l'écriture du
 *    journal : ni sujet, ni description, ni message, ni note interne, ni nom
 *    ou courriel d'auteur, ni matricule, ni nom d'agent, ni téléphone — seule
 *    la *présence* de ces contenus est notée par un booléen ;
 *  - la mutation et son entrée de journal partagent la transaction ;
 *  - une mutation refusée n'écrit rien, ni réclamation ni trace ;
 *  - les lectures (liste, détail, tableau de bord, agents) ne produisent
 *    aucune entrée : le journal ne trace que des mutations.
 */
import { Prisma, PrioriteReclamation, Role, StatutReclamation, TypeReclamation } from '@prisma/client';
import type { AuthUser } from '../../common/decorators';
import { ReclamationsService } from './reclamations.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

/**
 * Fausse transaction PostgreSQL : les écritures de mutation et de journal ne
 * sont conservées qu'en cas de succès. Un journal écrit hors transaction
 * survivrait à l'échec de la mutation — ces tests le détectent.
 */
const METHODES_ECRITURE = ['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

function transaction(base: any, tx: any) {
  const journal: any[] = [];
  const mutations: string[] = [];
  const flags = { echecEcriture: null as string | null, echecJournal: false };

  const handler: ProxyHandler<any> = {
    get(objet, propriete) {
      if (propriete === 'auditLog') {
        return {
          create: async (args: any) => {
            if (flags.echecJournal) throw new Error('journal indisponible');
            journal.push(args);
            return args;
          },
        };
      }
      const valeur = (objet as any)[propriete];
      const nom = String(propriete);
      if (typeof valeur === 'function' && METHODES_ECRITURE.includes(nom)) {
        return async (...args: any[]) => {
          if (flags.echecEcriture === nom) throw new Error('mutation refusée');
          mutations.push(nom);
          return valeur.apply(objet, args);
        };
      }
      if (valeur && typeof valeur === 'object') return new Proxy(valeur, handler);
      return valeur;
    },
  };
  const client = new Proxy(tx, handler);

  base.$transaction = jest.fn(async (operation: (c: any) => unknown) => {
    try {
      return await operation(client);
    } catch (e) {
      // Rollback : ni la mutation ni son journal ne sont conservés.
      mutations.length = 0;
      journal.length = 0;
      throw e;
    }
  });
  return { journal, mutations, flags };
}

describe('Journal avant/après des réclamations', () => {
  const etudiant = {
    id: 'user-1', role: Role.ETUDIANT, etudiantId: 'etudiant-1',
    nom: 'Ndiaye', prenom: 'Awa', email: 'awa.ndiaye@exemple.test', telephone: '+221771234567',
  } as unknown as AuthUser;
  const admin = {
    id: 'admin-1', role: Role.ADMIN,
    nom: 'Bassène', prenom: 'Ibrahima', email: 'ibrahima.bassene@exemple.test',
  } as unknown as AuthUser;

  const dossier = (extra: Record<string, unknown> = {}) => ({
    id: 'rec-1',
    numero: 'REC-2026-00001',
    type: TypeReclamation.INSCRIPTION,
    // Textes libres et données personnelles : rien de tout cela ne doit
    // atteindre le journal.
    sujet: 'Refus d\'inscription après résultats',
    description: 'Mon nom est Ndiaye et ma date de naissance est le 04/05/2004',
    notes: '[2026-10-02 09:00 Ibrahima Bassène] Dossier incomplet, motif interne',
    nomAuteur: 'Awa Ndiaye',
    emailAuteur: 'awa.ndiaye@exemple.test',
    anonyme: false,
    etudiantId: 'etudiant-1',
    priorite: PrioriteReclamation.NORMALE,
    statut: StatutReclamation.OUVERTE,
    departementId: 'departement-1',
    assigneAId: null,
    assigneA: null,
    delaiEscaladeHeures: 48,
    escaladeLe: null,
    creeLe: new Date('2026-10-01T08:00:00.000Z'),
    fermeLe: null,
    _count: { messages: 1 },
    etudiant: { id: 'etudiant-1', matricule: 'ETU-2026-0042', nom: 'Ndiaye', prenom: 'Awa', telephone: '+221771234567' },
    ...extra,
  });

  const instantane = (extra: Record<string, unknown> = {}) => ({
    id: 'rec-1',
    numero: 'REC-2026-00001',
    type: TypeReclamation.INSCRIPTION,
    priorite: PrioriteReclamation.NORMALE,
    statut: StatutReclamation.OUVERTE,
    anonyme: false,
    etudiantId: 'etudiant-1',
    departementId: 'departement-1',
    assigneAId: null,
    assigneARole: null,
    delaiEscaladeHeures: 48,
    escaladeLe: null,
    creeLe: new Date('2026-10-01T08:00:00.000Z').toISOString(),
    fermeLe: null,
    nombreMessages: 1,
    sujetFourni: true,
    descriptionFournie: true,
    noteInterneFournie: true,
    nomAuteurFourni: true,
    emailAuteurFourni: true,
    ...extra,
  });

  /** Valeurs sensibles qui ne doivent apparaître dans aucune entrée de journal. */
  const VALEURS_INTERDITES = [
    'Refus d\'inscription après résultats',   // sujet
    'date de naissance',                        // description
    'Dossier incomplet',                       // note interne
    'Awa Ndiaye',                              // nom d'auteur / matricule porteur
    'awa.ndiaye@exemple.test',                 // adresse de l'auteur
    'ETU-2026-0042',                            // matricule
    '+221771234567',                            // téléphone
    'Bassène',                                  // nom de l'agent
  ];

  function preparer() {
    const courante = dossier();
    const tx: any = {
      reclamation: {
        findUnique: jest.fn().mockResolvedValue(courante),
        findFirst: jest.fn().mockResolvedValue(courante),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(courante),
        update: jest.fn().mockResolvedValue(courante),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      messageReclamation: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({
          id: 'msg-2', reclamationId: 'rec-1', auteurId: 'admin-1',
          auteur: { id: 'admin-1', nom: 'Bassène', prenom: 'Ibrahima', role: Role.ADMIN },
          nomAffichage: 'Ibrahima Bassène',
          contenu: 'Votre dossier a été réexaminé', joint: null,
          creeLe: new Date('2026-10-02T10:00:00.000Z'),
        }),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', nom: 'Bassène', prenom: 'Ibrahima', role: Role.ADMIN }) },
    };
    const prisma: any = {
      reclamation: {
        findUnique: jest.fn().mockResolvedValue(courante),
        findFirst: jest.fn().mockResolvedValue(courante),
        findMany: jest.fn().mockResolvedValue([courante]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([{ statut: StatutReclamation.OUVERTE, _count: { _all: 1 } }]),
      },
      messageReclamation: { count: jest.fn().mockResolvedValue(1) },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1', nom: 'Bassène', prenom: 'Ibrahima', role: Role.ADMIN,
        }),
      },
      // Un journal écrit hors transaction serait visible ici.
      auditLog: { create: jest.fn() },
    };
    const ecritures = transaction(prisma, tx);
    return { service: new ReclamationsService(prisma), prisma, tx, ...ecritures };
  }

  const details = (journal: any[]) => JSON.parse(journal[0].data.details);

  /** Aucune valeur sensible ne doit traverser l'écriture du journal. */
  function expectPasDeFuite(journal: any[]) {
    for (const entree of journal) {
      for (const interdite of VALEURS_INTERDITES) {
        expect(entree.data.details).not.toContain(interdite);
      }
    }
  }

  it("journalise l'ouverture dans la transaction, sans le sujet ni la description", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await service.creer({
      type: TypeReclamation.INSCRIPTION,
      sujet: 'Refus d\'inscription après résultats',
      description: 'Mon nom est Ndiaye et ma date de naissance est le 04/05/2004',
    } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['create']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_OUVERTE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toBeNull();
    expect(ecrit.apres).toEqual(instantane());
    expect(ecrit.champsModifies).toEqual(['statut', 'priorite', 'anonyme', 'departementId']);
    expect(ecrit.premierMessageInclus).toBe(true);
    expectPasDeFuite(journal);
  });

  it("consigne l'anonymat et l'absence de fiche rattachée, jamais l'identité déclarée", async () => {
    const { service, tx, journal } = preparer();
    tx.reclamation.create.mockResolvedValue(dossier({
      anonyme: true, etudiantId: null, nomAuteur: 'Awa Ndiaye',
      emailAuteur: 'awa.ndiaye@exemple.test', etudiant: null,
    }));

    await service.creer({
      type: TypeReclamation.INSCRIPTION,
      sujet: 'Refus d\'inscription après résultats',
      description: 'Mon nom est Ndiaye et ma date de naissance est le 04/05/2004',
      anonyme: true, nomAuteur: 'Awa Ndiaye', emailAuteur: 'awa.ndiaye@exemple.test',
    } as any, etudiant);

    const ecrit = details(journal);
    expect(journal[0].data.userId).toBeNull();
    expect(ecrit.apres).toEqual(instantane({ anonyme: true, etudiantId: null }));
    expect(ecrit.apres.nomAuteurFourni).toBe(true);
    expect(ecrit.apres.emailAuteurFourni).toBe(true);
    expectPasDeFuite(journal);
  });

  it("journalise le message sans son texte ni sa pièce jointe", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await service.posterMessage('rec-1', {
      contenu: 'Votre dossier a été réexaminé',
      joint: 'data:image/png;base64,QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo',
    } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['create']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_MESSAGE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(instantane());
    // Le compteur de messages progresse : l'état après est bien distinct.
    expect(ecrit.apres).toEqual(instantane({ nombreMessages: 2 }));
    expect(ecrit.champsModifies).toEqual(['messages']);
    expect(ecrit.message).toEqual({
      id: 'msg-2',
      auteurId: 'admin-1',
      auteurRole: Role.ADMIN,
      auteurAnonyme: false,
      creeLe: new Date('2026-10-02T10:00:00.000Z').toISOString(),
      contenuFourni: true,
      pieceJointeFournie: true,
    });
    expect(journal[0].data.details).not.toContain('Votre dossier a été réexaminé');
    expect(journal[0].data.details).not.toContain('QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo');
    expectPasDeFuite(journal);
  });

  it("marque l'auteur anonyme d'un fil sans le rattacher à un compte", async () => {
    const { service, tx, journal } = preparer();
    tx.reclamation.findFirst.mockResolvedValue(dossier({ anonyme: true, etudiantId: null }));
    tx.messageReclamation.count.mockResolvedValue(0);
    tx.messageReclamation.create.mockResolvedValue({
      id: 'msg-3', reclamationId: 'rec-1', auteurId: null, auteur: null,
      nomAffichage: 'Anonyme', contenu: 'Je relance ma demande', joint: null,
      creeLe: new Date('2026-10-02T12:00:00.000Z'),
    });

    await service.posterMessage('rec-1', { contenu: 'Je relance ma demande' } as any, etudiant);

    const ecrit = details(journal);
    expect(journal[0].data.userId).toBeNull();
    expect(ecrit.message.auteurAnonyme).toBe(true);
    expect(ecrit.message.auteurId).toBeNull();
    expect(ecrit.message.auteurRole).toBeNull();
    expect(ecrit.apres).toEqual(instantane({ anonyme: true, etudiantId: null, nombreMessages: 1 }));
    expect(journal[0].data.details).not.toContain('Je relance ma demande');
    expectPasDeFuite(journal);
  });

  it('journalise la résolution avec les deux états et sans le motif de rejet', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    prisma.reclamation.findUnique.mockResolvedValue(dossier({ statut: StatutReclamation.EN_COURS }));
    tx.reclamation.update.mockResolvedValue(dossier({
      statut: StatutReclamation.RESOLUE,
      notes: '[2026-10-02 11:00 Ibrahima Bassène] Dossier incomplet, motif interne',
      fermeLe: new Date('2026-10-02T11:00:00.000Z'),
    }));
    tx.reclamation.findUnique.mockResolvedValue(dossier({ statut: StatutReclamation.EN_COURS }));

    await service.changerStatut(
      'rec-1',
      { statut: StatutReclamation.RESOLUE, commentaire: 'Dossier incomplet, motif interne' } as any,
      admin,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_RESOLUE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant.statut).toBe(StatutReclamation.EN_COURS);
    expect(ecrit.avant.fermeLe).toBeNull();
    expect(ecrit.apres.statut).toBe(StatutReclamation.RESOLUE);
    expect(ecrit.apres.fermeLe).toBe(new Date('2026-10-02T11:00:00.000Z').toISOString());
    expect(ecrit.champsModifies).toEqual(['statut', 'notes', 'fermeLe']);
    expect(ecrit.commentaireFourni).toBe(true);
    expectPasDeFuite(journal);
  });

  it("journalise l'affectation et la prise en charge automatique, sans le nom de l'agent", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reclamation.update.mockResolvedValue(dossier({
      statut: StatutReclamation.EN_COURS,
      assigneAId: 'admin-1',
      assigneA: { id: 'admin-1', nom: 'Bassène', prenom: 'Ibrahima', role: Role.DIRECTION },
    }));

    await service.assigner('rec-1', { assigneAId: 'admin-1' } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_ASSIGNEE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant.assigneAId).toBeNull();
    expect(ecrit.avant.statut).toBe(StatutReclamation.OUVERTE);
    expect(ecrit.apres.assigneAId).toBe('admin-1');
    expect(ecrit.apres.assigneARole).toBe(Role.DIRECTION);
    expect(ecrit.apres.statut).toBe(StatutReclamation.EN_COURS);
    expect(ecrit.champsModifies).toEqual(['assigneAId', 'statut']);
    expect(ecrit.priseEnCharge).toBe(true);
    expect(ecrit.assigneAId).toBe('admin-1');
    expectPasDeFuite(journal);
  });

  it("journalise une réassignation sans prise en charge quand le dossier est déjà repris", async () => {
    const { service, tx, journal } = preparer();
    tx.reclamation.findUnique.mockResolvedValue(dossier({
      statut: StatutReclamation.EN_COURS, assigneAId: 'scolarite-1',
      assigneA: { id: 'scolarite-1', nom: 'Sow', prenom: 'Fatou', role: Role.SCOLARITE },
    }));
    tx.reclamation.update.mockResolvedValue(dossier({
      statut: StatutReclamation.EN_COURS, assigneAId: 'admin-1',
      assigneA: { id: 'admin-1', nom: 'Bassène', prenom: 'Ibrahima', role: Role.DIRECTION },
    }));

    await service.assigner('rec-1', { assigneAId: 'admin-1' } as any, admin);

    const ecrit = details(journal);
    expect(ecrit.avant.assigneAId).toBe('scolarite-1');
    expect(ecrit.avant.assigneARole).toBe(Role.SCOLARITE);
    expect(ecrit.apres.assigneAId).toBe('admin-1');
    expect(ecrit.champsModifies).toEqual(['assigneAId']);
    expect(ecrit.priseEnCharge).toBe(false);
    expectPasDeFuite(journal);
  });

  it("journalise l'escalade forcée par l'ADMIN hors délai", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    const maintenant = new Date('2026-10-03T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(maintenant);
    prisma.reclamation.findUnique.mockResolvedValue(dossier({ creeLe: new Date('2026-10-03T08:00:00.000Z') }));
    tx.reclamation.update.mockResolvedValue(dossier({
      escaladeLe: maintenant, assigneA: null,
    }));
    tx.reclamation.findUnique.mockResolvedValue(dossier({ creeLe: new Date('2026-10-03T08:00:00.000Z') }));

    try {
      await service.escalader('rec-1', admin);
    } finally {
      jest.useRealTimers();
    }

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_ESCALADEE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant.escaladeLe).toBeNull();
    expect(ecrit.apres.escaladeLe).toBe(maintenant.toISOString());
    expect(ecrit.champsModifies).toEqual(['escaladeLe']);
    expect(ecrit.delaiAtteint).toBe(false);
    expect(ecrit.forcee).toBe(true);
    expect(ecrit.delaiEscaladeHeures).toBe(48);
    expectPasDeFuite(journal);
  });

  it("journalise la clôture sans la note de décision", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    prisma.reclamation.findUnique.mockResolvedValue(dossier({
      statut: StatutReclamation.REJETEE,
      notes: '[2026-10-02 11:00 Ibrahima Bassène] Dossier incomplet, motif interne',
      fermeLe: new Date('2026-10-02T11:00:00.000Z'),
    }));
    tx.reclamation.update.mockResolvedValue(dossier({
      statut: StatutReclamation.REJETEE,
      notes: '[2026-10-02 11:00 Ibrahima Bassène] Dossier incomplet, motif interne\nCLÔTURE — rejetée',
      fermeLe: new Date('2026-10-02T11:00:00.000Z'),
    }));
    tx.reclamation.findUnique.mockResolvedValue(dossier({
      statut: StatutReclamation.REJETEE,
      notes: '[2026-10-02 11:00 Ibrahima Bassène] Dossier incomplet, motif interne',
      fermeLe: new Date('2026-10-02T11:00:00.000Z'),
    }));

    await service.cloturer('rec-1', { noteCloture: 'Dossier incomplet, motif interne' } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_CLOTUREE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant.statut).toBe(StatutReclamation.REJETEE);
    expect(ecrit.apres.statut).toBe(StatutReclamation.REJETEE);
    expect(ecrit.noteClotureFournie).toBe(true);
    expect(ecrit.champsModifies).toEqual(['notes']);
    expectPasDeFuite(journal);
  });

  it("journalise l'escalade automatique du cron dans la transaction de l'escalade", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    const maintenant = new Date('2026-10-03T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(maintenant);
    prisma.reclamation.findMany.mockResolvedValue([
      {
        id: 'rec-1', numero: 'REC-2026-00001', creeLe: new Date('2026-10-01T08:00:00.000Z'),
        delaiEscaladeHeures: 48, type: TypeReclamation.INSCRIPTION,
        priorite: PrioriteReclamation.NORMALE, statut: StatutReclamation.OUVERTE,
        anonyme: false, escaladeLe: null,
      },
    ]);
    tx.reclamation.updateMany.mockResolvedValue({ count: 1 });

    let resultat: any;
    try {
      resultat = await service.cronEscalade(admin);
    } finally {
      jest.useRealTimers();
    }

    expect(resultat).toEqual({ escaladees: 1, numeros: ['REC-2026-00001'] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['updateMany']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'RECLAMATION_ESCALADEE',
      entite: 'Reclamation',
      entiteId: 'rec-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant.escaladeLe).toBeNull();
    expect(ecrit.avant.statut).toBe(StatutReclamation.OUVERTE);
    expect(ecrit.apres.escaladeLe).toBe(maintenant.toISOString());
    expect(ecrit.origine).toBe('CRON');
    expect(ecrit.forcee).toBe(false);
    expect(ecrit.delaiAtteint).toBe(true);
    expectPasDeFuite(journal);
  });

  it("n'ouvre ni transaction ni journal quand aucune réclamation n'est échue", async () => {
    const { service, prisma, journal, mutations } = preparer();
    prisma.reclamation.findMany.mockResolvedValue([]);

    const resultat = await service.cronEscalade(admin);

    expect(resultat).toEqual({ escaladees: 0, numeros: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
    expect(mutations).toEqual([]);
  });

  it("n'annonce et ne journalise pas une escalade cron perdue contre une autre écriture", async () => {
    const { service, prisma, tx, journal } = preparer();
    const maintenant = new Date('2026-10-03T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(maintenant);
    prisma.reclamation.findMany.mockResolvedValue([{
      id: 'rec-1', numero: 'REC-2026-00001', creeLe: new Date('2026-10-01T08:00:00.000Z'),
      delaiEscaladeHeures: 48, type: TypeReclamation.INSCRIPTION,
      priorite: PrioriteReclamation.NORMALE, statut: StatutReclamation.OUVERTE,
      anonyme: false, escaladeLe: null,
    }]);
    tx.reclamation.updateMany.mockResolvedValue({ count: 0 });

    try {
      await expect(service.cronEscalade(admin)).resolves.toEqual({ escaladees: 0, numeros: [] });
    } finally {
      jest.useRealTimers();
    }

    expect(tx.reclamation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'rec-1', statut: { in: [StatutReclamation.OUVERTE, StatutReclamation.EN_COURS, StatutReclamation.EN_ATTENTE_REPONSE] }, escaladeLe: null },
    }));
    expect(journal).toEqual([]);
  });

  it('utilise une transaction sérialisable pour les mutations soumises à concurrence', async () => {
    const { service, prisma } = preparer();
    await service.posterMessage('rec-1', { contenu: 'Suivi' } as any, admin);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('convertit un conflit de sérialisation en 409 sans garder mutation ni journal', async () => {
    const { service, tx, mutations, journal } = preparer();
    tx.reclamation.findUnique.mockResolvedValue(dossier({ statut: StatutReclamation.EN_COURS }));
    tx.reclamation.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('serialization conflict', {
      code: 'P2034', clientVersion: 'test',
    }));

    await expect(service.changerStatut(
      'rec-1', { statut: StatutReclamation.RESOLUE, commentaire: 'Décision concurrente' } as any, admin,
    )).rejects.toMatchObject({
      status: 409,
      response: { message: 'reclamations.ecriture_concurrente_reessayez' },
    });
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit aucun journal lorsque la mutation échoue", async () => {
    const { service, tx, flags, journal, mutations } = preparer();
    tx.reclamation.findUnique.mockResolvedValue(dossier({ statut: StatutReclamation.EN_COURS }));
    flags.echecEcriture = 'update';

    await expect(service.changerStatut(
      'rec-1', { statut: StatutReclamation.RESOLUE, commentaire: 'Dossier incomplet' } as any, admin,
    )).rejects.toThrow('mutation refusée');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit aucun journal lorsque le message est refusé", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reclamation.findFirst.mockResolvedValue(dossier({ statut: StatutReclamation.RESOLUE }));

    await expect(service.posterMessage('rec-1', { contenu: 'Dernier essai' } as any, etudiant))
      .rejects.toThrow();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit aucun journal sur une transition refusée par la matrice", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.reclamation.findUnique.mockResolvedValue(dossier({ statut: StatutReclamation.RESOLUE }));

    await expect(service.changerStatut(
      'rec-1', { statut: StatutReclamation.EN_COURS } as any, admin,
    )).rejects.toThrow('reclamations.transition_de_statut_non_autorisee');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("annule l'escalade si l'écriture du journal échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecJournal = true;

    await expect(service.assigner('rec-1', { assigneAId: 'admin-1' } as any, admin))
      .rejects.toThrow('journal indisponible');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'inscrit rien au journal pour une lecture : liste, détail, tableau de bord et agents", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await service.liste({}, admin);
    await service.findOnePour('rec-1', admin);
    await service.mesReclamations({}, etudiant);
    await service.dashboard();
    await service.agents();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mutations).toEqual([]);
  });
});
