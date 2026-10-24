/**
 * Calcul de paie sur des montants stockés en `numeric(14,2)`.
 *
 * Les colonnes monétaires sont des `Prisma.Decimal` : ce qu'on vérifie ici
 * n'est pas le type, mais que le calcul reste exact et que l'instantané
 * d'audit porte des NOMBRES (un `Decimal` sérialisé en chaîne rendrait le
 * journal d'audit illisible et les comparaisons fausses).
 */
import { Prisma, StatutPaie } from '@prisma/client';
import { PaieService } from './paie.service';

const USER = { id: 'direction-1', nom: 'Dir', prenom: 'Ection', role: 'DIRECTION' } as any;

describe('PaieService — montants exacts (numeric(14,2))', () => {
  it('calcule un brut exact à partir d’un taux Decimal et journalise des nombres', async () => {
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const auditCreate = jest.fn().mockResolvedValue({});
    const createMany = jest.fn().mockResolvedValue({ count: 1 });

    const tx = {
      seance: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ controle: { dureeMinutes: 180 }, affectation: { enseignantId: 'enseignant-1' } }]),
      },
      affectation: {
        findMany: jest.fn().mockResolvedValue([{ enseignantId: 'enseignant-1', volumeHorairePrevu: 6 }]),
      },
      lignePaie: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn(), createMany },
      // Le taux horaire vient de la base : c'est un Decimal, pas un nombre.
      enseignant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'enseignant-1', tauxHoraire: new Prisma.Decimal('50.50') }]),
      },
      feuillePaie: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'feuille-1', statut: StatutPaie.BROUILLON, lignes: [] }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'feuille-1',
          statut: StatutPaie.BROUILLON,
          montantTotal: new Prisma.Decimal('0'),
          updatedAt,
          dateDebut: new Date('2026-01-01'),
          dateFin: new Date('2026-01-31'),
          lignes: [],
        }),
      },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    // 3 heures (180 minutes) × 50,50 GNF = 151,50 GNF.
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          enseignantId: 'enseignant-1',
          tauxHoraire: 50.5,
          heuresReelles: 3,
          montantBrut: 151.5,
          retenue: 0,
          montantNet: 151.5,
        }),
      ],
    });
    // Le total de la feuille est la somme des nets, au centième.
    expect(tx.feuillePaie.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { montantTotal: 151.5 } }));
  });

  it('journalise l’instantané avec des nombres, jamais avec des chaînes', async () => {
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const auditCreate = jest.fn().mockResolvedValue({});
    const lignes = [
      {
        enseignantId: 'enseignant-1',
        commentaire: null,
        tauxHoraire: new Prisma.Decimal('50.50'),
        heuresReelles: 3,
        volumePrevu: 6,
        montantBrut: new Prisma.Decimal('151.50'),
        retenue: new Prisma.Decimal('0'),
        montantNet: new Prisma.Decimal('151.50'),
      },
    ];

    const tx = {
      seance: { findMany: jest.fn().mockResolvedValue([]) },
      affectation: { findMany: jest.fn().mockResolvedValue([]) },
      lignePaie: { findMany: jest.fn().mockResolvedValue(lignes), deleteMany: jest.fn(), createMany: jest.fn() },
      enseignant: { findMany: jest.fn().mockResolvedValue([]) },
      feuillePaie: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'feuille-1', statut: StatutPaie.BROUILLON, lignes: [] }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'feuille-1',
          statut: StatutPaie.BROUILLON,
          montantTotal: new Prisma.Decimal('151.50'),
          updatedAt,
          dateDebut: new Date('2026-01-01'),
          dateFin: new Date('2026-01-31'),
          lignes,
        }),
      },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details.avant.lignes[0]).toEqual({
      enseignantId: 'enseignant-1',
      tauxHoraire: 50.5,
      heuresReelles: 3,
      volumePrevu: 6,
      montantBrut: 151.5,
      retenue: 0,
      montantNet: 151.5,
    });
    expect(details.avant.montantTotal).toBe(151.5);
    // La trace JSON ne doit contenir aucune chaîne à la place d'un montant.
    expect(auditCreate.mock.calls[0][0].data.details).not.toContain('"montantNet":"');
  });
});
