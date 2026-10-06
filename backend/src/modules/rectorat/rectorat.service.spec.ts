import { RectoratService } from './rectorat.service';

describe('Snapshots MESRS', () => {
  it('compte les équipements obsolètes en SQL sans charger le parc en mémoire', async () => {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ count: 7n }]),
      equipementPatrimoine: { findMany: jest.fn() },
    };
    const service = new RectoratService(prisma, {} as any);

    await expect((service as any).obsolescents()).resolves.toBe(7);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.equipementPatrimoine.findMany).not.toHaveBeenCalled();
  });

  it('crée le bilan et son entrée d’audit dans la même transaction', async () => {
    const snapshot = { id: 'bilan-1' };
    const tx = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      statistiqueMesrs: { create: jest.fn().mockResolvedValue(snapshot) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2026-2027' }) },
      equipementPatrimoine: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
      auditLog: { create: jest.fn() },
    };
    const service = new RectoratService(prisma as any, {} as any);
    jest.spyOn(service, 'chiffres').mockResolvedValue({
      effectifTotal: 12,
      tauxReussite: 67.5,
    } as any);
    jest.spyOn(service as any, 'patrimoineParCategorie').mockResolvedValue([]);
    jest.spyOn(service as any, 'patrimoineParDepartement').mockResolvedValue([]);
    jest.spyOn(service as any, 'obsolescents').mockResolvedValue(1);

    await service.genererBilan('annee-1', { id: 'admin-1' } as any);

    expect(tx.statistiqueMesrs.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entiteId: snapshot.id, action: 'BILAN_MESRS_GENERE' }),
    }));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse de créer un bilan si l’année est clôturée', async () => {
    const tx = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      statistiqueMesrs: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2026-2027' }) },
      equipementPatrimoine: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
    };
    const service = new RectoratService(prisma as any, {} as any);
    jest.spyOn(service, 'chiffres').mockResolvedValue({ effectifTotal: 0, tauxReussite: 0 } as any);
    jest.spyOn(service as any, 'patrimoineParCategorie').mockResolvedValue([]);
    jest.spyOn(service as any, 'patrimoineParDepartement').mockResolvedValue([]);
    jest.spyOn(service as any, 'obsolescents').mockResolvedValue(0);

    await expect(service.genererBilan('annee-1', { id: 'admin-1' } as any)).rejects.toThrow();
    expect(tx.statistiqueMesrs.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
