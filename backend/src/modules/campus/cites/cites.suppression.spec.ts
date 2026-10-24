import { ConflictException } from '@nestjs/common';
import { ChambresService, ResidencesService } from './cites.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => undefined } }));

/**
 * Le parc des cités est un référentiel : une résidence qui porte des chambres
 * et une chambre qui porte des attributions se conservent. Le refus est un
 * **409** (conflit avec l'état existant), pas une 400 : la demande est
 * licite, c'est l'objet qui est encore utilisé. La 400 dirait à tort que
 * l'appel est mal formé.
 */
describe('Suppressions refusées dans les cités', () => {
  const utilisateur = { id: 'admin-1' } as any;

  function preparerResidence(nbChambres: number) {
    const tx = {
      residence: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'res-1',
          code: 'RES-A',
          nom: 'Cité Kaloum',
          ville: 'Conakry',
          adresse: null,
          capacite: 100,
          responsable: null,
          actif: true,
          _count: { chambres: nbChambres },
        }),
        delete: jest.fn().mockResolvedValue({ id: 'res-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)) };
    return { service: new ResidencesService(prisma as any), tx };
  }

  function preparerChambre(nbAttributions: number) {
    const tx = {
      chambre: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ch-1',
          code: 'A-01',
          residenceId: 'res-1',
          categorie: 'STANDARD',
          lits: 2,
          loyer: 100,
          devise: 'GNF',
          statut: 'LIBRE',
          _count: { attributions: nbAttributions },
        }),
        delete: jest.fn().mockResolvedValue({ id: 'ch-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)) };
    return { service: new ChambresService(prisma as any), tx };
  }

  it('refuse la suppression d’une résidence qui porte des chambres (409)', async () => {
    const { service, tx } = preparerResidence(3);

    const erreur = await service.supprimer('res-1', utilisateur).catch((e) => e);

    expect(erreur).toBeInstanceOf(ConflictException);
    expect(erreur.message).toContain('Cité Kaloum');
    expect(erreur.message).toContain('3');
    expect(tx.residence.delete).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse la suppression d’une chambre qui porte des attributions (409)', async () => {
    const { service, tx } = preparerChambre(2);

    const erreur = await service.supprimer('ch-1', utilisateur).catch((e) => e);

    expect(erreur).toBeInstanceOf(ConflictException);
    expect(erreur.message).toContain('A-01');
    expect(erreur.message).toContain('2');
    expect(tx.chambre.delete).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('supprime une résidence vide et la journalise', async () => {
    const { service, tx } = preparerResidence(0);

    await expect(service.supprimer('res-1', utilisateur)).resolves.toEqual({ id: 'res-1' });
    expect(tx.residence.delete).toHaveBeenCalledWith({ where: { id: 'res-1' } });
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
