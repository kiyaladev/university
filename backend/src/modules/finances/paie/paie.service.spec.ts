import { ConflictException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { StatutPaie, StatutPresence, StatutSeance } from '@prisma/client';
import { PaieService } from './paie.service';

const USER = { id: 'direction-1', nom: 'Dir', prenom: 'Ection', role: 'DIRECTION' } as any;

describe('PaieService — historique avant/après', () => {
  it('ne charge que l’identité utile de l’enseignant dans une feuille', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'feuille-1' });
    const service = new PaieService({ feuillePaie: { findUnique } } as any, {} as any);

    await service.detail('feuille-1');

    expect(findUnique.mock.calls[0][0].include.lignes.include.enseignant.select).toEqual({
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      statut: true,
    });
  });

  it('journalise dans la transaction les anciennes et nouvelles lignes recalculées', async () => {
    const avant = {
      statut: StatutPaie.BROUILLON,
      montantTotal: 100,
      lignes: [
        {
          enseignantId: 'enseignant-1',
          tauxHoraire: 25,
          heuresReelles: 4,
          volumePrevu: 6,
          montantBrut: 100,
          retenue: 0,
          montantNet: 100,
          commentaire: null,
        },
      ],
    };
    const apres = {
      statut: StatutPaie.BROUILLON,
      montantTotal: 150,
      lignes: [
        {
          enseignantId: 'enseignant-1',
          tauxHoraire: 50,
          heuresReelles: 3,
          volumePrevu: 6,
          montantBrut: 150,
          retenue: 0,
          montantNet: 150,
          commentaire: null,
        },
      ],
    };
    const auditCreate = jest.fn().mockResolvedValue({});
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const tx = {
      seance: {
        findMany: jest.fn().mockResolvedValue([
          {
            controle: { dureeMinutes: 180 },
            affectation: { enseignantId: 'enseignant-1' },
          },
        ]),
      },
      affectation: { findMany: jest.fn().mockResolvedValue([{ enseignantId: 'enseignant-1', volumeHorairePrevu: 6 }]) },
      lignePaie: {
        findMany: jest.fn().mockResolvedValue(avant.lignes),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      enseignant: { findMany: jest.fn().mockResolvedValue([{ id: 'enseignant-1', tauxHoraire: 50 }]) },
      feuillePaie: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(apres),
      },
      auditLog: { create: auditCreate },
    };
    const feuille = {
      id: 'feuille-1',
      statut: StatutPaie.BROUILLON,
      montantTotal: 100,
      updatedAt,
      dateDebut: new Date('2026-01-01'),
      dateFin: new Date('2026-01-31'),
      lignes: avant.lignes,
    };
    const prisma = {
      feuillePaie: { findUnique: jest.fn().mockResolvedValue(feuille) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new PaieService(prisma as any, {} as any);

    await service.calculer('feuille-1', false, USER);

    expect(tx.seance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: StatutSeance.CONTROLE,
          controle: { is: { statut: { in: expect.arrayContaining([StatutPresence.PRESENT]) } } },
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER.id,
        action: 'PAIE_RECALCULEE',
        entite: 'FeuillePaie',
        entiteId: 'feuille-1',
        details: JSON.stringify({
          avant: {
            statut: StatutPaie.BROUILLON,
            montantTotal: 100,
            lignes: [
              {
                enseignantId: 'enseignant-1',
                tauxHoraire: 25,
                heuresReelles: 4,
                volumePrevu: 6,
                montantBrut: 100,
                retenue: 0,
                montantNet: 100,
              },
            ],
          },
          apres: {
            statut: StatutPaie.BROUILLON,
            montantTotal: 150,
            lignes: [
              {
                enseignantId: 'enseignant-1',
                tauxHoraire: 50,
                heuresReelles: 3,
                volumePrevu: 6,
                montantBrut: 150,
                retenue: 0,
                montantNet: 150,
              },
            ],
          },
        }),
      }),
    });
    expect(tx.feuillePaie.updateMany).toHaveBeenCalledWith({
      where: { id: 'feuille-1', statut: StatutPaie.BROUILLON, updatedAt },
      data: { montantTotal: 150 },
    });
  });

  it('annule le recalcul si la feuille a été modifiée depuis sa lecture initiale', async () => {
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const tx: any = {
      seance: { findMany: jest.fn().mockResolvedValue([]) },
      affectation: { findMany: jest.fn().mockResolvedValue([]) },
      lignePaie: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn(),
      },
      enseignant: { findMany: jest.fn().mockResolvedValue([]) },
      feuillePaie: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      feuillePaie: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'feuille-1',
          statut: StatutPaie.BROUILLON,
          updatedAt,
          montantTotal: 0,
          dateDebut: new Date('2026-01-01'),
          dateFin: new Date('2026-01-31'),
          lignes: [],
        }),
      },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Cette feuille vient d’être modifiée.' } as never);
    const service = new PaieService(prisma, {} as any);

    await expect(service.calculer('feuille-1', false, USER)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.feuillePaie.findUnique).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('journalise avant/après au gel puis au paiement d’une feuille', async () => {
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const brouillon = {
      id: 'feuille-2',
      statut: StatutPaie.BROUILLON,
      updatedAt,
      montantTotal: 0,
      lignes: [
        {
          enseignantId: 'enseignant-2',
          tauxHoraire: 20,
          heuresReelles: 1,
          volumePrevu: 2,
          montantBrut: 20,
          retenue: 0,
          montantNet: 20,
        },
      ],
    };
    const validee = { ...brouillon, statut: StatutPaie.VALIDE };
    const payee = { ...brouillon, statut: StatutPaie.PAYE };
    const events: any[] = [];
    const tx = {
      feuillePaie: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(brouillon)
          .mockResolvedValueOnce(validee)
          .mockResolvedValueOnce(validee)
          .mockResolvedValueOnce(payee),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn(async ({ data }) => {
          events.push(data);
          return {};
        }),
      },
    };
    const prisma = {
      feuillePaie: { findUnique: jest.fn() },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new PaieService(prisma as any, {} as any);

    await service.valider('feuille-2', USER);
    await service.payer('feuille-2', USER);

    expect(tx.feuillePaie.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'feuille-2', statut: StatutPaie.BROUILLON, updatedAt },
      }),
    );
    expect(tx.feuillePaie.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'feuille-2', statut: StatutPaie.VALIDE, updatedAt },
      }),
    );
    expect(events.map((event) => event.action)).toEqual(['PAIE_VALIDEE', 'PAIE_PAYEE']);
    expect(JSON.parse(events[0].details)).toMatchObject({
      avant: { statut: StatutPaie.BROUILLON },
      apres: { statut: StatutPaie.VALIDE },
    });
    expect(JSON.parse(events[1].details)).toMatchObject({
      avant: { statut: StatutPaie.VALIDE },
      apres: { statut: StatutPaie.PAYE },
    });
  });
});
