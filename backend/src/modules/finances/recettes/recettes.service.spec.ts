import { BadRequestException } from '@nestjs/common';
import { TypeRecette } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { RecettesService } from './recettes.service';

function simulerTraductionsRecettes() {
  jest.spyOn(I18nContext, 'current').mockReturnValue({
    t: (key: string) =>
      ({
        'recettes.modification_comptable_apres_encaissement_interdite': 'Montant figé',
        'recettes.modification_concurrente': 'Modification concurrente',
        'recettes.cette_recette_a_deja_ete_encaissee_paiement_deja_rattache': 'Déjà encaissée',
      })[key] ?? key,
  } as never);
}

describe('journal des recettes externes', () => {
  const avant = {
    id: 'recette-1',
    numero: 'REC-2026-00001',
    type: TypeRecette.AUTRE,
    libelle: 'Location de salle',
    montant: 100,
    devise: 'GNF',
    date: new Date('2026-10-01T00:00:00.000Z'),
    paiementId: null,
    client: 'Personne privée',
    factureNum: 'FACT-1',
    description: 'Description privée',
  };
  const apres = { ...avant, montant: 125 };

  afterEach(() => jest.restoreAllMocks());

  it('limite le paiement imbriqué des lectures au montant, à la référence et au statut', async () => {
    const prisma: any = {
      recetteExterne: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new RecettesService(prisma);

    await service.lister({} as any);

    expect(prisma.recetteExterne.findMany.mock.calls[0][0].include.paiement).toEqual({
      select: { id: true, reference: true, montant: true, devise: true, statut: true },
    });
  });

  it('journalise le montant avant/après dans la même transaction sans copier les coordonnées client', async () => {
    const tx = {
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue(avant),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(apres),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)) };
    const service = new RecettesService(prisma as never);

    await expect(service.modifier('recette-1', { montant: 125 }, { id: 'agent-1' } as never)).resolves.toEqual(apres);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.recetteExterne.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recette-1', paiementId: null, montant: 100 },
        data: expect.objectContaining({ montant: 125 }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'agent-1',
        action: 'RECETTE_MODIFIEE',
        entiteId: 'recette-1',
        details: expect.any(String),
      }),
    });
    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details).toEqual({
      avant: {
        id: 'recette-1',
        numero: 'REC-2026-00001',
        type: TypeRecette.AUTRE,
        libelle: 'Location de salle',
        montant: 100,
        devise: 'GNF',
        date: avant.date.toISOString(),
        paiementId: null,
      },
      apres: {
        id: 'recette-1',
        numero: 'REC-2026-00001',
        type: TypeRecette.AUTRE,
        libelle: 'Location de salle',
        montant: 125,
        devise: 'GNF',
        date: avant.date.toISOString(),
        paiementId: null,
      },
      champsModifies: ['montant'],
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('Personne privée');
  });

  it('fige les champs comptables après encaissement', async () => {
    simulerTraductionsRecettes();
    const tx = {
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue({ ...avant, paiementId: 'paiement-1' }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const service = new RecettesService({
      $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)),
    } as never);

    await expect(service.modifier('recette-1', { montant: 125 }, { id: 'agent-1' } as never)).rejects.toMatchObject({
      status: 409,
      message: 'Montant figé',
    });
    expect(tx.recetteExterne.update).not.toHaveBeenCalled();
    expect(tx.recetteExterne.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse une modification comptable si l’encaissement gagne la course en base', async () => {
    simulerTraductionsRecettes();
    const tx = {
      recetteExterne: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(avant)
          .mockResolvedValueOnce({ ...avant, paiementId: 'paiement-concurrent' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn() },
    };
    const service = new RecettesService({
      $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)),
    } as never);

    await expect(service.modifier('recette-1', { montant: 125 }, { id: 'agent-1' } as never)).rejects.toMatchObject({
      status: 409,
      message: 'Montant figé',
    });
    expect(tx.recetteExterne.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'recette-1', paiementId: null, montant: 100 }),
      }),
    );
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('lie un seul paiement conditionnellement et journalise l’encaissement dans la transaction', async () => {
    const payee = { ...avant, paiementId: 'paiement-1' };
    const tx = {
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue(avant),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payee),
      },
      paiement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'paiement-1', reference: 'PAY-X-2026-00001' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new RecettesService({
      $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)),
    } as never);

    await expect(service.encaisser('recette-1', {}, { id: 'agent-1' } as never)).resolves.toEqual(payee);

    expect(tx.recetteExterne.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'recette-1',
        paiementId: null,
        montant: 100,
        devise: 'GNF',
        date: avant.date,
        type: TypeRecette.AUTRE,
        libelle: 'Location de salle',
      },
      data: { paiementId: 'paiement-1' },
    });
    expect(tx.paiement.create.mock.calls[0][0].data.completeLe).toBeInstanceOf(Date);
    expect(tx.paiement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reference: {
            startsWith: 'PAY-X-2026-',
            gte: 'PAY-X-2026-00000',
            lte: 'PAY-X-2026-99999',
          },
        },
        orderBy: { reference: 'desc' },
        take: 1,
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'agent-1',
        action: 'RECETTE_ENCAISSEE',
        entiteId: 'recette-1',
        details: expect.stringContaining('PAY-X-2026-00001'),
      }),
    });
  });

  it('annule le paiement si une autre transaction a déjà encaissé la recette', async () => {
    simulerTraductionsRecettes();
    const tx = {
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue(avant),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      paiement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'paiement-2', reference: 'PAY-X-2026-00001' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new RecettesService({
      $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)),
    } as never);

    tx.recetteExterne.findUnique
      .mockResolvedValueOnce(avant)
      .mockResolvedValueOnce({ ...avant, paiementId: 'paiement-existant' });
    await expect(service.encaisser('recette-1', {}, { id: 'agent-1' } as never)).rejects.toMatchObject({
      status: 409,
      message: 'Déjà encaissée',
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('retente une référence de paiement concurrente pour une autre recette', async () => {
    const payee = { ...avant, paiementId: 'paiement-1' };
    const transaction = (create: jest.Mock) => ({
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue(avant),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payee),
      },
      paiement: { findMany: jest.fn().mockResolvedValue([]), create },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    });
    const premier = transaction(jest.fn().mockRejectedValue({ code: 'P2002', meta: { target: ['reference'] } }));
    const secondCreate = jest.fn().mockResolvedValue({ id: 'paiement-1', reference: 'PAY-X-2026-00001' });
    const second = transaction(secondCreate);
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementationOnce((run: (tx: any) => unknown) => run(premier))
        .mockImplementationOnce((run: (tx: any) => unknown) => run(second)),
    };
    const service = new RecettesService(prisma as never);

    await expect(service.encaisser('recette-1', {}, { id: 'agent-1' } as never)).resolves.toEqual(payee);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(premier.auditLog.create).not.toHaveBeenCalled();
    expect(second.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('numérote sous PAY-X- sans tenir compte des références resto ni des anciennes recettes PAY-R-', async () => {
    const payee = { ...avant, paiementId: 'paiement-1' };
    const references = ['PAY-R-2026-00041', 'PAY-2026-00090', 'PAY-X-2026-00002'];
    const tx = {
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue(avant),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payee),
      },
      paiement: {
        // Honore `startsWith` comme Prisma, sinon le test ne prouverait rien.
        findMany: jest.fn(async (args: any) =>
          references.filter((r) => r.startsWith(args.where.reference.startsWith)).map((reference) => ({ reference })),
        ),
        create: jest.fn().mockResolvedValue({ id: 'paiement-1', reference: 'PAY-X-2026-00003' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new RecettesService({
      $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)),
    } as never);

    await service.encaisser('recette-1', {}, { id: 'agent-1' } as never);

    expect(tx.paiement.create.mock.calls[0][0].data.reference).toBe('PAY-X-2026-00003');
  });

  it('conserve une modification textuelle partielle et permet de vider une description nullable', async () => {
    const tx = {
      recetteExterne: {
        findUnique: jest.fn().mockResolvedValue(avant),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...avant, description: null }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new RecettesService({
      $transaction: jest.fn((run: (tx: any) => unknown) => run(tx)),
    } as never);

    await service.modifier('recette-1', { description: null } as never, { id: 'agent-1' } as never);

    expect(tx.recetteExterne.updateMany).toHaveBeenCalledWith({
      where: { id: 'recette-1', paiementId: null, description: 'Description privée' },
      data: { description: null },
    });
    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details.champsModifies).toEqual(['description']);
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('Description privée');
  });
});

describe('recherche des recettes', () => {
  it('recherche par numéro, libellé ou client sans casser les autres filtres', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new RecettesService({ recetteExterne: { findMany, count } } as never);

    await service.lister({ search: '  laboratoire  ', paiementStatut: 'A_ENCAISSER' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { numero: { contains: 'laboratoire', mode: 'insensitive' } },
      { libelle: { contains: 'laboratoire', mode: 'insensitive' } },
      { client: { contains: 'laboratoire', mode: 'insensitive' } },
    ]);
    expect(where.paiementId).toBeNull();
    expect(count.mock.calls[0][0].where).toEqual(where);
  });
});

describe('filtre des recettes à encaisser', () => {
  it('filtre les recettes dont aucun paiement n’est encore rattaché', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new RecettesService({ recetteExterne: { findMany, count } } as never);

    await service.lister({ paiementStatut: 'A_ENCAISSER' });

    expect(findMany.mock.calls[0][0].where.paiementId).toBeNull();
    expect(count.mock.calls[0][0].where.paiementId).toBeNull();
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('paiement');
  });
});

describe('indicateurs du tableau des recettes', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('calcule les totaux sur la même période et dans la devise GNF', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-03T12:00:00.000Z'));
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([{ type: TypeRecette.AUTRE, _sum: { montant: 100 }, _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ type: TypeRecette.AUTRE, _sum: { montant: 100 } }]);
    const findMany = jest.fn().mockResolvedValue([
      { date: new Date('2026-10-02T00:00:00.000Z'), montant: 60, devise: 'GNF' },
      { date: new Date('2026-03-01T00:00:00.000Z'), montant: 40, devise: 'GNF' },
    ]);
    const service = new RecettesService({ recetteExterne: { groupBy, findMany } } as never);

    const result = await service.dashboard();

    expect(result.totalMois).toBe(60);
    expect(result.totalAnnee).toBe(100);
    expect(groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          date: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-12-31T00:00:00.000Z') },
          devise: 'GNF',
        },
      }),
    );
    expect(groupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          date: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-12-31T00:00:00.000Z') },
          devise: 'GNF',
        },
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-12-31T00:00:00.000Z') },
          devise: 'GNF',
        },
      }),
    );
  });
});

describe('numéro de recette', () => {
  const service = (prisma: any) => new RecettesService(prisma);

  const dossier = (numero: string) => ({
    numero,
    type: TypeRecette.AUTRE,
    libelle: 'Location de salle',
    montant: 100,
    devise: 'GNF',
    date: '2026-10-01',
  }) as any;

  it("accepte le préfixe « RECX- », réservé aux recettes", async () => {
    const prisma = {
      $transaction: jest.fn((run: (tx: any) => unknown) =>
        run({
          recetteExterne: { create: jest.fn().mockResolvedValue({ id: 'recette-1' }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };

    await service(prisma).creer(dossier('RECX-2026-00001'), { id: 'u1' } as never);

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('refuse le préfixe « REC- », réservé aux réclamations', async () => {
    const prisma = { $transaction: jest.fn() };

    await expect(service(prisma).creer(dossier('REC-2026-00001'), { id: 'u1' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse un numéro qui ne suit pas le format', async () => {
    const prisma = { $transaction: jest.fn() };

    await expect(service(prisma).creer(dossier('RECX-2026-1'), { id: 'u1' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
