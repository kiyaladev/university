import { DepartementsService } from './departements.service';
import { FilieresService } from './filieres.service';

describe('audit des mutations de structure académique', () => {
  it('journalise la création et modification d’un département dans les transactions', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const departement = { id: 'dept-1', code: 'INFO', nom: 'Informatique', faculte: 'Sciences' };
    const tx: any = {
      departement: {
        create: jest.fn().mockResolvedValue({ ...departement, _count: { enseignants: 0, filieres: 0 } }),
        findUnique: jest.fn().mockResolvedValue(departement),
        update: jest.fn().mockResolvedValue({
          ...departement,
          nom: 'Informatique et systèmes',
          _count: { enseignants: 0, filieres: 0 },
        }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new DepartementsService(prisma);

    await service.creer({ code: 'INFO', nom: 'Informatique', faculte: 'Sciences' }, { id: 'admin-1' } as any);
    expect(auditCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'DEPARTEMENT_CREE',
        entiteId: 'dept-1',
        details: expect.stringContaining('"avant":null'),
      }),
    });

    await service.modifier('dept-1', { nom: 'Informatique et systèmes' }, { id: 'admin-1' } as any);
    expect(auditCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        action: 'DEPARTEMENT_MODIFIE',
        entiteId: 'dept-1',
        details: expect.stringContaining('Informatique et systèmes'),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(JSON.parse(auditCreate.mock.calls[1][0].data.details)).toMatchObject({
      avant: { nom: 'Informatique' },
      apres: { nom: 'Informatique et systèmes' },
      champsModifies: ['nom'],
    });
  });

  it('journalise les modifications de filière sans copier les données imbriquées du département', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const avant = { id: 'filiere-1', code: 'GL', nom: 'Génie logiciel', departementId: 'dept-1' };
    const tx: any = {
      filiere: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue({
          ...avant,
          nom: 'Génie logiciel avancé',
          departement: { id: 'dept-1', nom: 'Informatique' },
        }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new FilieresService(prisma);

    await service.modifier('filiere-1', { nom: 'Génie logiciel avancé' }, { id: 'admin-1' } as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details)).toEqual({
      avant: { id: 'filiere-1', code: 'GL', nom: 'Génie logiciel', departementId: 'dept-1' },
      apres: { id: 'filiere-1', code: 'GL', nom: 'Génie logiciel avancé', departementId: 'dept-1' },
      champsModifies: ['nom'],
    });
    expect(details).not.toContain('Informatique');
  });

  it('ne laisse pas passer la modification si l’écriture du journal échoue', async () => {
    const tx: any = {
      filiere: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'filiere-1', code: 'GL', nom: 'Génie logiciel', departementId: 'dept-1' }),
        update: jest.fn().mockResolvedValue({ id: 'filiere-1', code: 'GL', nom: 'GL avancé', departementId: 'dept-1' }),
      },
      auditLog: { create: jest.fn().mockRejectedValue(new Error('audit indisponible')) },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new FilieresService(prisma);

    await expect(service.modifier('filiere-1', { nom: 'GL avancé' } as any)).rejects.toThrow('audit indisponible');
    expect(tx.filiere.update).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
