import { ConflictException } from '@nestjs/common';
import { DepartementsService } from './departements.service';
import { FilieresService } from './filieres.service';
import { PromotionsService } from './promotions.service';

describe('Protection des archives du référentiel', () => {
  it('refuse de supprimer un département qui porte des données métier', async () => {
    const prisma: any = {
      departement: {
        findUnique: jest.fn().mockResolvedValue({
          _count: {
            membres: 0,
            enseignants: 0,
            filieres: 0,
            matieres: 0,
            documents: 0,
            equipementsPatrimoine: 0,
            reclamations: 0,
            elections: 1,
          },
        }),
        delete: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((operation: any) => operation(prisma));
    prisma.auditLog = { create: jest.fn() };
    const service = new DepartementsService(prisma);

    await expect(service.remove('dept-1')).rejects.toThrow(ConflictException);
    expect(prisma.departement.delete).not.toHaveBeenCalled();
  });

  it('refuse de supprimer une filière qui conserve des promotions', async () => {
    const prisma: any = {
      filiere: {
        findUnique: jest.fn().mockResolvedValue({ _count: { promotions: 1 } }),
        delete: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((operation: any) => operation(prisma));
    prisma.auditLog = { create: jest.fn() };
    const service = new FilieresService(prisma);

    await expect(service.remove('filiere-1')).rejects.toThrow(ConflictException);
    expect(prisma.filiere.delete).not.toHaveBeenCalled();
  });

  it('refuse de déplacer une promotion qui possède déjà des dossiers ou résultats', async () => {
    const promotion = { id: 'promo-1', anneeId: 'year-1', filiereId: 'filiere-1' };
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      promotion: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(promotion)
          .mockResolvedValueOnce({
            _count: {
              affectations: 0,
              inscriptions: 0,
              frais: 0,
              evaluations: 0,
              deliberations: 0,
              attestations: 0,
              examens: 0,
              elections: 1,
            },
          }),
        update: jest.fn(),
      },
      $transaction: jest.fn((operation: any) => operation(prisma)),
      auditLog: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((operation: any) => operation(prisma));
    prisma.auditLog = { create: jest.fn() };
    const service = new PromotionsService(prisma);

    await expect(service.modifier('promo-1', { anneeId: 'year-2' } as any)).rejects.toThrow(ConflictException);
    expect(prisma.promotion.update).not.toHaveBeenCalled();
  });
});
