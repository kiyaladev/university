/**
 * Journal avant/après du helpdesk — inventaire d'équipements, déclaration de
 * ticket, prise en charge et clôture.
 *
 * Ce que ces tests verrouillent :
 *  - l'acteur (compte connecté), l'entité et sa ligne sont inscrits ;
 *  - l'état avant et après est complet sur le statut, l'affectation et les
 *    horodatages de traitement, et minimal : ni texte de ticket, ni identité
 *    de contact du déclarant, ni code QR imprimé ;
 *  - la mutation et sa trace partagent la transaction (aucune écriture via
 *    `prisma.auditLog`, seul le client de transaction n'enregistre) ;
 *  - une mutation refusée, introuvable ou en échec ne laisse aucune trace,
 *    et l'échec de la trace annule la mutation ;
 *  - une lecture — liste, fiche, statistiques, résolution de QR — n'écrit rien.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CategorieIncident, Prisma, PrioriteTicket, Role, StatutTicket } from '@prisma/client';
import type { AuthUser } from '../../../common/decorators';
import { EquipementsService, TicketsService } from './helpdesk.service';

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

const EQUIPEMENT = {
  id: 'eq-1',
  libelle: 'Vidéoprojecteur S204',
  emplacement: 'Bâtiment A — étage 2',
  actif: true,
  createdAt: new Date('2026-10-01T08:00:00.000Z'),
  // Le code QR n'est jamais projeté par le chemin du journal.
  codeQr: 'UP-IT-jeton-imprime-secret',
};

const INSTANTANE_EQUIPEMENT = {
  id: 'eq-1',
  libelle: 'Vidéoprojecteur S204',
  emplacement: 'Bâtiment A — étage 2',
  actif: true,
  createdAt: '2026-10-01T08:00:00.000Z',
};

const TICKET = {
  id: 'ticket-1',
  numero: 'TKT-2026-0001',
  categorie: CategorieIncident.VIDEO,
  priorite: PrioriteTicket.NORMALE,
  statut: StatutTicket.OUVERT,
  equipementId: 'eq-1',
  utilisateurId: 'user-1',
  traiteParId: null,
  traiteLe: null,
  clicheLe: null,
  description: 'Pas d’image au démarrage, l.ops ne répond plus',
  declarantNom: 'Aïssatou Diallo',
  declarantEmail: 'aissatou.diallo@campus.test',
  declarantTelephone: '+223 76 00 00 00',
  equipement: { id: 'eq-1', libelle: 'Vidéoprojecteur S204', emplacement: 'Bâtiment A' },
  utilisateur: { id: 'user-1', nom: 'Diallo', prenom: 'Aïssatou' },
  traitePar: null,
};

const INSTANTANE_TICKET = {
  id: 'ticket-1',
  numero: 'TKT-2026-0001',
  categorie: CategorieIncident.VIDEO,
  priorite: PrioriteTicket.NORMALE,
  statut: StatutTicket.OUVERT,
  equipementId: 'eq-1',
  utilisateurId: 'user-1',
  traiteParId: null,
  traiteLe: null,
  clicheLe: null,
  descriptionFournie: true,
  declarantNomFourni: true,
  contactDeclarantFourni: true,
};

const details = (journal: any[]) => JSON.parse(journal[0].data.details);

/**
 * Le faux client applique la projection demandée, comme le fait Prisma :
 * c'est ce qui permet de vérifier que la réponse à l'écran est aussi épurée
 * que l'état journalisé.
 */
function projette(ligne: any, select: Record<string, boolean> | undefined) {
  if (!select) return ligne;
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, actif]) => actif)
      .map(([champ]) => [champ, ligne[champ]]),
  );
}

describe("Journal avant/après de l'inventaire d'équipements", () => {
  const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

  function preparer() {
    const tx: any = {
      equipementCampus: {
        findUnique: jest.fn(async (args: any) => projette(EQUIPEMENT, args.select)),
        create: jest.fn(async (args: any) => projette(EQUIPEMENT, args.select)),
        update: jest.fn(async (args: any) => projette({ ...EQUIPEMENT, ...args.data }, args.select)),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = {
      equipementCampus: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(async (args: any) => projette(EQUIPEMENT, args.select)),
      },
      // Un journal écrit hors transaction serait visible ici.
      auditLog: { create: jest.fn() },
    };
    const ecritures = transaction(prisma, tx);
    return { service: new EquipementsService(prisma, {} as never), prisma, tx, ...ecritures };
  }

  it('journalise la création dans la transaction, sans le code QR imprimé', async () => {
    const { service, prisma, journal, mutations } = preparer();

    const cree = await service.creer({ libelle: 'Vidéoprojecteur S204' } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['create']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'EQUIPEMENT_CREATION',
      entite: 'Equipement',
      entiteId: 'eq-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toBeNull();
    expect(ecrit.apres).toEqual(INSTANTANE_EQUIPEMENT);
    expect(journal[0].data.details).not.toContain('UP-IT-jeton-imprime-secret');
    // La réponse à l'écran reste sans le code : même projection que l'état journalisé.
    expect(cree).toEqual({ ...INSTANTANE_EQUIPEMENT, createdAt: EQUIPEMENT.createdAt });
  });

  it("conserve l'état avant et après d'une désactivation, champ par champ", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.equipementCampus.update.mockResolvedValue({
      ...EQUIPEMENT,
      libelle: 'Vidéoprojecteur S204 — hors service',
      actif: false,
    });

    await service.modifier('eq-1', { libelle: 'Vidéoprojecteur S204 — hors service', actif: false } as any, admin);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'EQUIPEMENT_MODIFICATION',
      entite: 'Equipement',
      entiteId: 'eq-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(INSTANTANE_EQUIPEMENT);
    expect(ecrit.apres).toEqual({
      ...INSTANTANE_EQUIPEMENT,
      libelle: 'Vidéoprojecteur S204 — hors service',
      actif: false,
    });
    expect(ecrit.champsModifies).toEqual(['libelle', 'actif']);
    expect(journal[0].data.details).not.toContain('UP-IT-jeton-imprime-secret');
    // Ni la lecture « avant » ni l'écriture ne chargent le code QR.
    expect(tx.equipementCampus.findUnique.mock.calls[0][0].select).not.toHaveProperty('codeQr');
    expect(tx.equipementCampus.update.mock.calls[0][0].select).not.toHaveProperty('codeQr');
  });

  it("journalise la suppression avec l'état avant et un après vide", async () => {
    const { service, prisma, journal, mutations } = preparer();

    await expect(service.supprimer('eq-1', admin)).resolves.toEqual({
      id: 'eq-1',
      libelle: 'Vidéoprojecteur S204',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['delete']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'admin-1',
      action: 'EQUIPEMENT_SUPPRESSION',
      entite: 'Equipement',
      entiteId: 'eq-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(INSTANTANE_EQUIPEMENT);
    expect(ecrit.apres).toBeNull();
    expect(journal[0].data.details).not.toContain('UP-IT-jeton-imprime-secret');
  });

  it("n'écrit rien sur un équipement introuvable", async () => {
    const { service, tx, journal, mutations } = preparer();
    tx.equipementCampus.findUnique.mockResolvedValue(null);

    await expect(service.supprimer('eq-inconnu', admin)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.modifier('eq-inconnu', { actif: false } as any, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("annule la création si l'écriture du journal échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecJournal = true;

    await expect(service.creer({ libelle: 'Climatisation amphi' } as any, admin)).rejects.toThrow(
      'journal indisponible',
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit aucun journal lorsque la modification échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecEcriture = 'update';

    await expect(service.modifier('eq-1', { actif: false } as any, admin)).rejects.toThrow('mutation refusée');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit rien sur une lecture de l'inventaire ou d'un QR", async () => {
    const { service, prisma, journal } = preparer();

    await service.liste({});
    await service.findOne('eq-1');
    await service.parCode('UP-IT-jeton-imprime-secret');

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
  });
});

describe('Journal avant/après des tickets de support', () => {
  const enseignant = {
    id: 'user-1',
    role: Role.ENSEIGNANT,
    nom: 'Diallo',
    prenom: 'Aïssatou',
    email: 'aissatou.diallo@campus.test',
  } as AuthUser;
  const agent = { id: 'agent-1', role: Role.ADMIN } as AuthUser;

  function preparer() {
    const tx: any = {
      $queryRaw: jest.fn(async () => []),
      ticketSupport: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(TICKET),
        create: jest.fn().mockResolvedValue(TICKET),
        update: jest.fn().mockResolvedValue(TICKET),
      },
    };
    const prisma: any = {
      ticketSupport: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(TICKET),
        findUnique: jest.fn().mockResolvedValue(TICKET),
        groupBy: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(TICKET),
      },
      equipementCampus: { findUnique: jest.fn().mockResolvedValue(EQUIPEMENT) },
      // Un journal écrit hors transaction serait visible ici.
      auditLog: { create: jest.fn() },
    };
    const ecritures = transaction(prisma, tx);
    return { service: new TicketsService(prisma), prisma, tx, ...ecritures };
  }

  const declaration = {
    categorie: CategorieIncident.VIDEO,
    description: 'Pas d’image au démarrage, l.ops ne répond plus',
    priorite: PrioriteTicket.HAUTE,
  } as any;

  it('journalise la déclaration dans la transaction, sans le texte ni le contact', async () => {
    const { service, prisma, journal, mutations } = preparer();

    const ticket = await service.declarer(declaration, enseignant);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['create']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'user-1',
      action: 'TICKET_OUVERT',
      entite: 'TicketSupport',
      entiteId: 'ticket-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toBeNull();
    expect(ecrit.apres).toEqual(INSTANTANE_TICKET);

    const brut = journal[0].data.details;
    expect(brut).not.toContain('Pas d’image au démarrage');
    expect(brut).not.toContain('Aïssatou Diallo');
    expect(brut).not.toContain('aissatou.diallo@campus.test');
    expect(brut).not.toContain('+223 76 00 00 00');
    // Le ticket rendu à l'écran, lui, garde son texte : seul le journal est épuré.
    expect(ticket).toBe(TICKET);
  });

  it('reprend sur conflit de numéro sans laisser de trace de la tentative avortée', async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.ticketSupport.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      )
      .mockResolvedValueOnce(TICKET);

    await service.declarer(declaration, enseignant);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    // Une seule trace : celle de la déclaration effectivement enregistrée.
    expect(journal).toHaveLength(1);
    expect(journal[0].data.action).toBe('TICKET_OUVERT');
    expect(mutations).toEqual(['create']);
  });

  it("annule la déclaration si l'écriture du journal échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecJournal = true;

    await expect(service.declarer(declaration, enseignant)).rejects.toThrow('journal indisponible');

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'abandonne aucune trace quand les dix tentatives de numérotation échouent", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.ticketSupport.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(service.declarer(declaration, enseignant)).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(10);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'ouvre aucune transaction ni trace si l'équipement visé est désactivé", async () => {
    const { service, prisma, journal, mutations } = preparer();
    prisma.equipementCampus.findUnique.mockResolvedValue({ ...EQUIPEMENT, actif: false });

    await expect(service.declarer({ ...declaration, equipementId: 'eq-1' }, enseignant)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("conserve statut, affectation et horodatage d'une prise en charge", async () => {
    const { service, prisma, tx, journal, mutations } = preparer();
    tx.ticketSupport.update.mockResolvedValue({
      ...TICKET,
      statut: StatutTicket.EN_COURS,
      traiteParId: 'agent-1',
      traiteLe: new Date('2026-10-03T09:30:00.000Z'),
      traitePar: { id: 'agent-1', nom: 'Barry', prenom: 'Ibrahima' },
    });

    await service.changerStatut('ticket-1', { statut: StatutTicket.EN_COURS } as any, agent);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mutations).toEqual(['update']);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'agent-1',
      action: 'TICKET_EN_COURS',
      entite: 'TicketSupport',
      entiteId: 'ticket-1',
    });
    const ecrit = details(journal);
    expect(ecrit.avant).toEqual(INSTANTANE_TICKET);
    expect(ecrit.apres).toEqual({
      ...INSTANTANE_TICKET,
      statut: StatutTicket.EN_COURS,
      traiteParId: 'agent-1',
      traiteLe: '2026-10-03T09:30:00.000Z',
    });
    expect(ecrit.champsModifies).toEqual(['statut', 'traiteParId', 'traiteLe']);
    const brut = journal[0].data.details;
    expect(brut).not.toContain('Pas d’image au démarrage');
    expect(brut).not.toContain('aissatou.diallo@campus.test');
  });

  it('trace la clôture sur clicheLe plutôt que sur traiteLe', async () => {
    const { service, tx, journal } = preparer();
    tx.ticketSupport.update.mockResolvedValue({
      ...TICKET,
      statut: StatutTicket.CLOTURE,
      traiteParId: 'agent-1',
      clicheLe: new Date('2026-10-04T08:00:00.000Z'),
    });

    await service.changerStatut('ticket-1', { statut: StatutTicket.CLOTURE } as any, agent);

    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({ action: 'TICKET_CLOTURE', userId: 'agent-1' });
    const ecrit = details(journal);
    expect(ecrit.avant.statut).toBe(StatutTicket.OUVERT);
    expect(ecrit.apres.statut).toBe(StatutTicket.CLOTURE);
    expect(ecrit.apres.clicheLe).toBe('2026-10-04T08:00:00.000Z');
    expect(ecrit.apres.traiteLe).toBeNull();
    expect(ecrit.champsModifies).toEqual(['statut', 'traiteParId', 'clicheLe']);
  });

  it("n'ouvre aucune transaction ni trace sur un ticket déjà clos", async () => {
    const { service, prisma, journal, mutations } = preparer();
    prisma.ticketSupport.findUnique.mockResolvedValue({ ...TICKET, statut: StatutTicket.RESOLU });

    await expect(
      service.changerStatut('ticket-1', { statut: StatutTicket.RESOLU } as any, agent),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it('refuse une prise en charge après une résolution concurrente', async () => {
    const { service, tx, journal, mutations } = preparer();
    tx.ticketSupport.findUnique.mockResolvedValue({ ...TICKET, statut: StatutTicket.RESOLU });
    await expect(
      service.changerStatut('ticket-1', { statut: StatutTicket.EN_COURS } as any, agent),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.ticketSupport.findUnique.mock.invocationCallOrder[0],
    );
    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit aucun journal lorsque la transition échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecEcriture = 'update';

    await expect(service.changerStatut('ticket-1', { statut: StatutTicket.EN_COURS } as any, agent)).rejects.toThrow(
      'mutation refusée',
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("annule la transition si l'écriture du journal échoue", async () => {
    const { service, flags, journal, mutations } = preparer();
    flags.echecJournal = true;

    await expect(service.changerStatut('ticket-1', { statut: StatutTicket.EN_COURS } as any, agent)).rejects.toThrow(
      'journal indisponible',
    );

    expect(mutations).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("n'écrit rien sur une lecture : registre, fiche et statistiques", async () => {
    const { service, prisma, journal } = preparer();
    prisma.ticketSupport.groupBy.mockResolvedValue([{ statut: StatutTicket.OUVERT, _count: { _all: 2 } }]);

    await service.liste({}, agent);
    await service.findTicket('ticket-1', enseignant);
    await service.stats();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
  });
});
