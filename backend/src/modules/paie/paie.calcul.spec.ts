/**
 * Paie — règles de décompte et cycle de vie d'une feuille mensuelle.
 *
 * La règle comptable est écrite en tête de `paie.service.ts` ; on la vérifie
 * ici par le comportement observable (ce qui est écrit en base), pas en
 * relisant l'implémentation :
 *
 *   1. seules les séances CONTROLE dont le contrôle vaut PRESENT, RETARD ou
 *      DEPART_ANTICIPE sont rémunérées ;
 *   2. les minutes s'additionnent, l'heure payée est l'heure entière ;
 *   3. le brut = heures payées × taux horaire de la fiche, retenue nulle ;
 *   4. le total de la feuille est la somme des nets ;
 *   5. une feuille validée ou payée est figée.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StatutEnseignant, StatutPaie, StatutPresence } from '@prisma/client';
import { PaieService } from './paie.service';

const USER = { id: 'direction-1', nom: 'Dir', prenom: 'Ection', role: 'DIRECTION' } as any;
const UPDATED_AT = new Date('2026-01-02T00:00:00.000Z');

/** Feuille de calcul en brouillon, période janvier 2026. */
function feuilleBrouillon(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'feuille-1',
    statut: StatutPaie.BROUILLON,
    montantTotal: 0,
    updatedAt: UPDATED_AT,
    dateDebut: new Date('2026-01-01'),
    dateFin: new Date('2026-01-31'),
    lignes: [],
    ...surcharge,
  };
}

/**
 * Faux Prisma : une transaction qui exécute le callback sur un « tx »
 * dont chaque delegate est observable.
 */
function fairePrisma(feuille: unknown, tx: Record<string, unknown> = {}) {
  const delegates = {
    seance: { findMany: jest.fn().mockResolvedValue([]) },
    affectation: { findMany: jest.fn().mockResolvedValue([]) },
    lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany: jest.fn() },
    enseignant: { findMany: jest.fn().mockResolvedValue([]) },
    feuillePaie: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue(feuille) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    ...tx,
  };
  const prisma = {
    feuillePaie: { findUnique: jest.fn().mockResolvedValue(feuille) },
    $transaction: jest.fn((operation: (db: unknown) => unknown) => operation(delegates)),
  };
  return { prisma, tx: delegates };
}

describe('PaieService — décompte des heures', () => {
  it('ne compte que les contrôles PRESENT, RETARD et DEPART_ANTICIPE', async () => {
    const seanceFindMany = jest.fn().mockResolvedValue([]);
    const { prisma } = fairePrisma(feuilleBrouillon(), { seance: { findMany: seanceFindMany } });
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    const where = seanceFindMany.mock.calls[0][0].where;
    expect(where.controle).toEqual({
      is: { statut: { in: [StatutPresence.PRESENT, StatutPresence.RETARD, StatutPresence.DEPART_ANTICIPE] } },
    });
  });

  it('borne la période aux dates de la feuille', async () => {
    const seanceFindMany = jest.fn().mockResolvedValue([]);
    const { prisma } = fairePrisma(feuilleBrouillon(), { seance: { findMany: seanceFindMany } });
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    expect(seanceFindMany.mock.calls[0][0].where.date).toEqual({
      gte: new Date('2026-01-01'),
      lte: new Date('2026-01-31'),
    });
  });

  it('ne paie que les heures entières : 59 minutes valent zéro heure', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      {
        seance: {
          findMany: jest.fn().mockResolvedValue([
            { controle: { dureeMinutes: 59 }, affectation: { enseignantId: 'ens-1' } },
          ]),
        },
        enseignant: { findMany: jest.fn().mockResolvedValue([{ id: 'ens-1', tauxHoraire: 50 }]) },
        lignePaie: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(),
          createMany,
        },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ enseignantId: 'ens-1', heuresReelles: 0, montantBrut: 0, montantNet: 0 })],
    });
  });

  it('additionne les minutes d’un enseignant avant de compter les heures', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      {
        seance: {
          findMany: jest.fn().mockResolvedValue([
            { controle: { dureeMinutes: 90 }, affectation: { enseignantId: 'ens-1' } },
            { controle: { dureeMinutes: 90 }, affectation: { enseignantId: 'ens-1' } },
          ]),
        },
        enseignant: { findMany: jest.fn().mockResolvedValue([{ id: 'ens-1', tauxHoraire: 50 }]) },
        lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    // 90 + 90 = 180 minutes = 3 heures payées, et non 1 h + 1 h.
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ heuresReelles: 3, montantBrut: 150, montantNet: 150 })],
    });
  });

  it('cumule le volume contractuel et paie chaque enseignant sur son taux', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      {
        seance: {
          findMany: jest.fn().mockResolvedValue([
            { controle: { dureeMinutes: 120 }, affectation: { enseignantId: 'ens-1' } },
            { controle: { dureeMinutes: 60 }, affectation: { enseignantId: 'ens-2' } },
          ]),
        },
        affectation: {
          findMany: jest.fn().mockResolvedValue([
            { enseignantId: 'ens-1', volumeHorairePrevu: 6 },
            { enseignantId: 'ens-1', volumeHorairePrevu: 4 },
            { enseignantId: 'ens-2', volumeHorairePrevu: 3 },
          ]),
        },
        enseignant: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ens-1', tauxHoraire: 25 },
            { id: 'ens-2', tauxHoraire: 40 },
          ]),
        },
        lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    const lignes = createMany.mock.calls[0][0].data;
    expect(lignes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enseignantId: 'ens-1',
          volumePrevu: 10,
          heuresReelles: 2,
          tauxHoraire: 25,
          montantBrut: 50,
          retenue: 0,
          montantNet: 50,
        }),
        expect.objectContaining({
          enseignantId: 'ens-2',
          volumePrevu: 3,
          heuresReelles: 1,
          tauxHoraire: 40,
          montantBrut: 40,
          retenue: 0,
          montantNet: 40,
        }),
      ]),
    );
  });

  it('porte au total de la feuille la somme des nets', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      {
        seance: {
          findMany: jest.fn().mockResolvedValue([
            { controle: { dureeMinutes: 120 }, affectation: { enseignantId: 'ens-1' } },
            { controle: { dureeMinutes: 60 }, affectation: { enseignantId: 'ens-2' } },
          ]),
        },
        enseignant: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ens-1', tauxHoraire: 25 },
            { id: 'ens-2', tauxHoraire: 40 },
          ]),
        },
        lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany: jest.fn() },
        feuillePaie: { updateMany, findUnique: jest.fn().mockResolvedValue(feuilleBrouillon()) },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { montantTotal: 90 } }));
  });

  it('conserve le commentaire d’une ligne au recalcul', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      {
        seance: {
          findMany: jest.fn().mockResolvedValue([
            { controle: { dureeMinutes: 60 }, affectation: { enseignantId: 'ens-1' } },
          ]),
        },
        enseignant: { findMany: jest.fn().mockResolvedValue([{ id: 'ens-1', tauxHoraire: 30 }]) },
        lignePaie: {
          findMany: jest.fn().mockResolvedValue([
            { enseignantId: 'ens-1', commentaire: 'Congé exceptionnel', tauxHoraire: 30, heuresReelles: 1 },
          ]),
          deleteMany: jest.fn(),
          createMany,
        },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ enseignantId: 'ens-1', commentaire: 'Congé exceptionnel' })],
    });
  });

  it('limite le calcul aux vacataires, sauf demande explicite de tous les enseignants', async () => {
    const seanceFindMany = jest.fn().mockResolvedValue([]);
    const affectationFindMany = jest.fn().mockResolvedValue([]);
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      { seance: { findMany: seanceFindMany }, affectation: { findMany: affectationFindMany } },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);
    await service.calculer('feuille-1', true, USER);

    expect(seanceFindMany.mock.calls[0][0].where.affectation).toEqual({
      enseignant: { statut: StatutEnseignant.VACATAIRE },
    });
    expect(affectationFindMany.mock.calls[0][0].where.enseignant).toEqual({ statut: StatutEnseignant.VACATAIRE });
    // En mode « tous », aucun filtre de statut : les permanents entrent aussi.
    expect(seanceFindMany.mock.calls[1][0].where.affectation).toEqual({ enseignant: {} });
    expect(affectationFindMany.mock.calls[1][0].where.enseignant).toBeUndefined();
  });

  it('calcule sur des nombres quand le taux horaire vient d’une colonne numeric', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma } = fairePrisma(
      feuilleBrouillon(),
      {
        seance: {
          findMany: jest.fn().mockResolvedValue([
            { controle: { dureeMinutes: 120 }, affectation: { enseignantId: 'ens-1' } },
          ]),
        },
        // La base renvoie un Decimal : 25,50 GNF de l'heure.
        enseignant: { findMany: jest.fn().mockResolvedValue([{ id: 'ens-1', tauxHoraire: new Prisma.Decimal('25.50') }]) },
        lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    const ligne = createMany.mock.calls[0][0].data[0];
    // Un nombre, jamais une chaîne sérialisée : le front attend des nombres.
    expect(typeof ligne.montantBrut).toBe('number');
    expect(ligne.montantBrut).toBe(51);
    expect(ligne.montantNet).toBe(51);
  });
});

describe('PaieService — cycle de vie de la feuille', () => {
  it('refuse de recalculer une feuille validée', async () => {
    const { prisma } = fairePrisma(feuilleBrouillon({ statut: StatutPaie.VALIDE }));
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.calculer('feuille-1', false, USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de recalculer une feuille payée', async () => {
    const { prisma } = fairePrisma(feuilleBrouillon({ statut: StatutPaie.PAYE }));
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.calculer('feuille-1', false, USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signale une feuille introuvable', async () => {
    const { prisma } = fairePrisma(null);
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.calculer('feuille-1', false, USER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse de valider une feuille qui n’est pas en brouillon', async () => {
    const { prisma } = fairePrisma(null, {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue(feuilleBrouillon({ statut: StatutPaie.VALIDE, lignes: [{}] })),
        updateMany: jest.fn(),
      },
    });
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.valider('feuille-1', USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de valider une feuille sans ligne : rien n’a été calculé', async () => {
    const { prisma } = fairePrisma(null, {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue(feuilleBrouillon()),
        updateMany: jest.fn(),
      },
    });
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.valider('feuille-1', USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de payer une feuille qui n’est pas validée', async () => {
    const { prisma } = fairePrisma(null, {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue(feuilleBrouillon()),
        updateMany: jest.fn(),
      },
    });
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.payer('feuille-1', USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de supprimer une feuille validée', async () => {
    const { prisma } = fairePrisma(null, {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue(feuilleBrouillon({ statut: StatutPaie.VALIDE })),
        deleteMany: jest.fn(),
      },
    });
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.supprimer('feuille-1', USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de créer une seconde feuille pour le même mois', async () => {
    const prisma = {
      feuillePaie: { findUnique: jest.fn().mockResolvedValue({ id: 'feuille-1' }) },
      $transaction: jest.fn(),
    };
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.creer({ mois: 1, annee: 2026 }, USER)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('dérive le libellé et la période d’une feuille de son mois et de son année', async () => {
    const feuille = { id: 'feuille-9', libelle: 'Février 2026' };
    const create = jest.fn().mockResolvedValue(feuille);
    const tx = { feuillePaie: { create }, auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = {
      feuillePaie: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((operation: (db: unknown) => unknown) => operation(tx)),
    };
    const service = new PaieService(prisma as any, {} as any);

    await service.creer({ mois: 2, annee: 2026 }, USER);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          libelle: 'Février 2026',
          mois: 2,
          annee: 2026,
          dateDebut: new Date(Date.UTC(2026, 1, 1)),
          dateFin: new Date(Date.UTC(2026, 2, 0)),
        }),
      }),
    );
  });
});

describe('PaieService — borne haute de la période', () => {
  /**
   * `Seance.date` et les bornes de la feuille sont des colonnes `@db.Date` :
   * une séance du dernier jour vaut minuit ce jour-là et tombe dans la borne
   * `lte: dateFin`. Ce test garde ce comportement.
   */
  it('paie les séances tenues le dernier jour du mois', async () => {
    const seances = [
      {
        date: new Date('2026-01-31T00:00:00Z'),
        controle: { dureeMinutes: 60 },
        affectation: { enseignantId: 'ens-1' },
      },
    ];
    // Le faux findMany applique le filtre de période comme le ferait la base.
    const seanceFindMany = jest.fn().mockImplementation(async ({ where }: any) => {
      const { gte, lte } = where.date;
      return seances.filter((s) => (!gte || s.date >= gte) && (!lte || s.date <= lte));
    });
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma } = fairePrisma(
      feuilleBrouillon({
        dateDebut: new Date('2026-01-01T00:00:00Z'),
        dateFin: new Date('2026-01-31T00:00:00Z'),
      }),
      {
        seance: { findMany: seanceFindMany },
        enseignant: { findMany: jest.fn().mockResolvedValue([{ id: 'ens-1', tauxHoraire: 50 }]) },
        lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany },
      },
    );
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ enseignantId: 'ens-1', heuresReelles: 1, montantNet: 50 })],
    });
  });
});

describe('PaieService — recherche et paiement', () => {
  it('filtre la liste par statut, année, mois et libellé', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { feuillePaie: { findMany, count } };
    const service = new PaieService(prisma as any, {} as any);

    await service.liste({ statut: StatutPaie.VALIDE, annee: 2026, mois: 1, search: 'Janvier' } as any);

    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      statut: StatutPaie.VALIDE,
      annee: 2026,
      mois: 1,
      libelle: { contains: 'Janvier', mode: 'insensitive' },
    });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ annee: 'desc' }, { mois: 'desc' }]);
  });

  it('paye une feuille validée et horodate le paiement', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { prisma, tx } = fairePrisma(null, {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue(feuilleBrouillon({ statut: StatutPaie.VALIDE, lignes: [] })),
        updateMany,
      },
    });
    const service = new PaieService(prisma as any, {} as any);

    await service.payer('feuille-1', USER);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'feuille-1', statut: StatutPaie.VALIDE, updatedAt: UPDATED_AT },
      data: { statut: StatutPaie.PAYE, payeeLe: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PAIE_PAYEE', entiteId: 'feuille-1' }),
      }),
    );
  });

  it('refuse le paiement si la feuille a changé depuis sa lecture', async () => {
    const { prisma } = fairePrisma(null, {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue(feuilleBrouillon({ statut: StatutPaie.VALIDE, lignes: [] })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.payer('feuille-1', USER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('signale une feuille de paie introuvable', async () => {
    const { prisma } = fairePrisma(null);
    const service = new PaieService(prisma as any, {} as any);

    await expect(service.detail('feuille-x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
