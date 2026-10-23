import { StatutAttributionLogement, StatutChambre } from '@prisma/client';
import { ChambresService, ResidencesService } from './cites.service';

describe('audit des mutations du parc de logements', () => {
  it('journalise création et modification de résidence sans copier ses coordonnées', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const residence = {
      id: 'residence-1',
      code: 'C1',
      nom: 'Résidence privée',
      ville: 'Conakry',
      adresse: 'Adresse privée',
      capacite: 120,
      responsable: 'Personne privée',
      actif: true,
      _count: { chambres: 0 },
      chambres: [],
    };
    const tx: any = {
      residence: {
        create: jest.fn().mockResolvedValue(residence),
        findUnique: jest.fn().mockResolvedValue(residence),
        update: jest.fn().mockResolvedValue({ ...residence, capacite: 140 }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ResidencesService(prisma);

    await service.creer(
      {
        code: 'C1',
        nom: 'Résidence privée',
        ville: 'Conakry',
        adresse: 'Adresse privée',
        capacite: 120,
        responsable: 'Personne privée',
      },
      { id: 'admin-1' } as any,
    );
    await service.modifier('residence-1', { capacite: 140 }, { id: 'admin-1' } as any);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(auditCreate.mock.calls.map(([call]: any[]) => call.data.action)).toEqual([
      'RESIDENCE_CREEE',
      'RESIDENCE_MODIFIEE',
    ]);
    for (const { data } of auditCreate.mock.calls.map(([call]: any[]) => call)) {
      expect(data.userId).toBe('admin-1');
      expect(data.details).not.toContain('Résidence privée');
      expect(data.details).not.toContain('Conakry');
      expect(data.details).not.toContain('Adresse privée');
      expect(data.details).not.toContain('Personne privée');
    }
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.details).apres).toMatchObject({
      id: 'residence-1',
      code: 'C1',
      capacite: 120,
      adresseRenseignee: true,
      responsableRenseigne: true,
    });
  });

  it('journalise le passage justifié à OCCUPEE sans exposer l’étudiant', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const chambre = {
      id: 'chambre-1',
      code: 'R1-101',
      residenceId: 'residence-1',
      categorie: 'CHAMBRE_PARTAGEE',
      lits: 2,
      loyer: 600000,
      devise: 'GNF',
      statut: StatutChambre.LIBRE,
    };
    const tx: any = {
      chambre: {
        findUnique: jest.fn().mockResolvedValue(chambre),
        update: jest.fn().mockResolvedValue({ ...chambre, statut: StatutChambre.OCCUPEE }),
      },
      attributionLogement: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attribution-1',
          chambreId: 'chambre-1',
          etudiantId: 'etudiant-secret',
          statut: StatutAttributionLogement.ACCORDEE,
        }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ChambresService(prisma);

    await service.modifier('chambre-1', { statut: StatutChambre.OCCUPEE }, { id: 'direction-1' } as any);

    expect(tx.attributionLogement.findFirst).toHaveBeenCalledWith({
      where: { chambreId: 'chambre-1', statut: StatutAttributionLogement.ACCORDEE },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details)).toMatchObject({
      avant: { id: 'chambre-1', statut: 'LIBRE' },
      apres: { id: 'chambre-1', statut: 'OCCUPEE' },
    });
    expect(details).not.toContain('etudiant-secret');
  });

  it.each([StatutChambre.LIBRE, StatutChambre.RESERVEE, StatutChambre.MAINTENANCE])(
    'refuse le passage à %s tant que le logement reste accordé',
    async (statut) => {
      const tx: any = {
        chambre: {
          findUnique: jest.fn().mockResolvedValue({ id: 'chambre-1', statut: StatutChambre.OCCUPEE }),
          update: jest.fn(),
        },
        attributionLogement: { findFirst: jest.fn().mockResolvedValue({ id: 'attribution-1' }) },
        auditLog: { create: jest.fn() },
      };
      const service = new ChambresService({ $transaction: (operation: any) => operation(tx) } as any);
      await expect(service.modifier('chambre-1', { statut })).rejects.toThrow();
      expect(tx.chambre.update).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it('journalise la suppression d’une chambre vide dans la transaction', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const chambre = {
      id: 'chambre-1',
      code: 'R1-101',
      residenceId: 'residence-1',
      categorie: 'CHAMBRE_PARTAGEE',
      lits: 2,
      loyer: 600000,
      devise: 'GNF',
      statut: StatutChambre.LIBRE,
      _count: { attributions: 0 },
    };
    const tx: any = {
      chambre: {
        findUnique: jest.fn().mockResolvedValue(chambre),
        delete: jest.fn().mockResolvedValue({ id: 'chambre-1' }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new ChambresService(prisma);

    await expect(service.remove('chambre-1', { id: 'admin-1' } as any)).resolves.toEqual({ id: 'chambre-1' });

    expect(tx.chambre.delete).toHaveBeenCalledWith({ where: { id: 'chambre-1' } });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'CHAMBRE_SUPPRIMEE',
        entiteId: 'chambre-1',
      }),
    });
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.details).apres).toBeNull();
  });
});
