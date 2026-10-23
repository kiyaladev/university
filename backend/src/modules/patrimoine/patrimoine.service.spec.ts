import { NotFoundException } from '@nestjs/common';
import { PatrimoineService } from './patrimoine.service';

describe('Résolution publique des QR du patrimoine', () => {
  const prepare = (equipement: unknown) => {
    const db: any = {
      equipementPatrimoine: { findUnique: jest.fn().mockResolvedValue(equipement) },
    };
    return { db, service: new PatrimoineService(db, {} as any) };
  };

  it('renvoie une projection limitée aux informations utiles et exclut les équipements inactifs', async () => {
    const equipement = {
      id: 'eq-1',
      libelle: 'Projecteur',
      actif: true,
      categorie: { id: 'cat-1', code: 'VIDEO', libelle: 'Audiovisuel' },
      departement: { nom: 'Informatique' },
      salle: { id: 's-1', code: 'A12', nom: 'Salle A12' },
    };
    const { db, service } = prepare(equipement);

    await expect(service.parQr('UP-PAT-token')).resolves.toEqual(equipement);
    expect(db.equipementPatrimoine.findUnique).toHaveBeenCalledWith({
      where: { qrCode: 'UP-PAT-token' },
      select: {
        id: true,
        libelle: true,
        actif: true,
        categorie: { select: { id: true, code: true, libelle: true } },
        departement: { select: { nom: true } },
        salle: { select: { id: true, code: true, nom: true } },
      },
    });
  });

  it('masque un QR absent ou désactivé', async () => {
    for (const equipement of [null, { id: 'eq-1', actif: false }]) {
      const { service } = prepare(equipement);
      await expect(service.parQr('UP-PAT-token')).rejects.toThrow(NotFoundException);
    }
  });

  it('n’écrit jamais le nouveau jeton QR dans le journal', async () => {
    const avant = {
      id: 'eq-1',
      numeroInventaire: 'PAT-001',
      numeroSerie: 'SN-1',
      libelle: 'Projecteur',
      categorieId: 'cat-1',
      qrCode: 'UP-PAT-jeton-ancien',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'eq-1' }]),
      equipementPatrimoine: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn(async ({ data }: any) => ({ ...avant, ...data })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      $transaction: jest.fn((operation: any) => operation(tx)),
    };
    const service = new PatrimoineService(prisma, {} as any);

    const maj = await service.regenererQr('eq-1', { id: 'admin-1' } as any);

    expect(maj.qrCode).toMatch(/^UP-PAT-/);
    const data = tx.auditLog.create.mock.calls[0][0].data;
    expect(data.action).toBe('PATRIMOINE_QR_REGENERE');
    expect(data.userId).toBe('admin-1');
    expect(tx.equipementPatrimoine.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'eq-1' } }));
    expect(data.details).not.toContain(maj.qrCode);
    expect(data.details).not.toContain('UP-PAT-jeton-ancien');
    expect(JSON.parse(data.details).champsModifies).toEqual(['qrCode']);
  });
});

describe('Tableau de bord patrimoine par année académique', () => {
  it('filtre les acquisitions sur les dates de l’année demandée', async () => {
    const debut = new Date('2025-09-01T00:00:00.000Z');
    const fin = new Date('2026-08-31T00:00:00.000Z');
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ dateDebut: debut, dateFin: fin }) },
      equipementPatrimoine: {
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { valeurAcquisition: null } }),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      categoriePatrimoine: { findMany: jest.fn().mockResolvedValue([]) },
      departement: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([{ count: 0n }]),
    };
    const service = new PatrimoineService(prisma, {} as any);

    await service.dashboard('annee-1');

    expect(prisma.equipementPatrimoine.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actif: true, dateAcquisition: { gte: debut, lte: fin } },
      }),
    );
    expect(prisma.equipementPatrimoine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actif: true, dateAcquisition: { gte: debut, lte: fin } },
      }),
    );
  });

  it('refuse un identifiant d’année inconnu', async () => {
    const prisma: any = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue(null) },
      equipementPatrimoine: { aggregate: jest.fn() },
    };
    const service = new PatrimoineService(prisma, {} as any);

    await expect(service.dashboard('inconnue')).rejects.toThrow(NotFoundException);
    expect(prisma.equipementPatrimoine.aggregate).not.toHaveBeenCalled();
  });
});
