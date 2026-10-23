import { StatutBadge } from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BADGE_VERIFICATION_SELECT, BadgesService } from './badges.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Vérification publique des badges', () => {
  it('ne charge que les champs nécessaires et ne révèle pas les coordonnées ni la pièce d’identité', async () => {
    const now = new Date();
    const badge = {
      id: 'badge-1',
      qrToken: 'secret-qr',
      statut: StatutBadge.ACTIF,
      dateValidite: new Date(now.getTime() + 86_400_000),
      motif: null,
      numero: 'BADGE-2026-00001',
      type: 'VISITEUR',
      prenom: 'Aminata',
      nom: 'Diallo',
      fonction: null,
      organisation: null,
      zonesAccess: null,
      dateDelivrance: now,
      telephone: '+224620000000',
      email: 'aminata@example.test',
      numeroPiece: 'P-SECRET',
    };
    const prisma = {
      badgeAcces: { findUnique: jest.fn().mockResolvedValue(badge) },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = new BadgesService(prisma as any, {} as any, {} as any);

    const result = await service.verifier({ badge: 'badge-1', k: 'secret-qr' } as any);

    expect(prisma.badgeAcces.findUnique).toHaveBeenCalledWith({
      where: { id: 'badge-1' },
      select: BADGE_VERIFICATION_SELECT,
    });
    expect(result).toEqual({
      valide: true,
      message: 'Badge authentique',
      badge: {
        numero: 'BADGE-2026-00001',
        type: 'VISITEUR',
        porteur: 'Aminata Diallo',
        fonction: null,
        organisation: null,
        zonesAccess: null,
        dateDelivrance: now,
        dateValidite: badge.dateValidite,
      },
    });
    expect(JSON.stringify(result)).not.toContain('+224620000000');
    expect(JSON.stringify(result)).not.toContain('aminata@example.test');
    expect(JSON.stringify(result)).not.toContain('P-SECRET');
  });
});

describe('audit des mutations de badge', () => {
  it.each(['modifier', 'annuler', 'rallonger'] as const)(
    'refuse %s lorsque le badge a été annulé avant la prise du verrou',
    async (operation) => {
      let statut: StatutBadge = StatutBadge.ACTIF;
      const tx = {
        $queryRaw: jest.fn().mockImplementation(async () => {
          statut = StatutBadge.ANNULE;
          return [];
        }),
        badgeAcces: {
          findUnique: jest.fn().mockImplementation(async () => ({ statut, dateValidite: new Date('2099-01-01') })),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      };
      const service = new BadgesService({ $transaction: (fn: any) => fn(tx) } as any, {} as any, {} as any);
      await expect(
        service[operation]('badge-1', { dateValidite: '2099-01-01', motif: 'Recette' } as any, { id: 'admin' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.badgeAcces.update).not.toHaveBeenCalled();
      expect(tx.badgeAcces.updateMany).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  const badge = {
    id: 'badge-2',
    numero: 'BADGE-2026-00002',
    type: 'VISITEUR',
    statut: StatutBadge.ACTIF,
    dateValidite: new Date('2027-01-01T00:00:00Z'),
    zonesAccess: 'Bâtiment A',
    qrToken: 'qr-secret',
    photoUrl: 'private/photo/path',
    nom: 'Personne privée',
    prenom: 'A',
    telephone: '+224620000000',
    email: 'personne@example.test',
    numeroPiece: 'P-SECRET',
    motif: null,
  };

  it('journalise l’émission dans la transaction sans copier les données du porteur', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      badgeAcces: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(badge),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new BadgesService(prisma, {} as any, {} as any);

    await service.creer(
      {
        type: 'VISITEUR',
        nom: 'Personne privée',
        prenom: 'A',
        telephone: '+224620000000',
        email: 'personne@example.test',
        numeroPiece: 'P-SECRET',
        dateValidite: '2099-01-01',
        zonesAccess: 'Bâtiment A',
        photoUrl: 'private/photo/path',
      } as any,
      { id: 'admin' } as any,
    );

    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details).champsModifies).toContain('zonesAccess');
    for (const prive of [
      'Personne privée',
      '+224620000000',
      'personne@example.test',
      'P-SECRET',
      'qr-secret',
      'private/photo/path',
    ]) {
      expect(details).not.toContain(prive);
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('journalise la modification avec des instantanés minimisés dans la transaction', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      badgeAcces: {
        findUnique: jest.fn().mockResolvedValue(badge),
        update: jest.fn().mockResolvedValue({ ...badge, telephone: '+224621111111' }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new BadgesService(prisma, {} as any, {} as any);

    await service.modifier('badge-2', { telephone: '+224621111111' } as any, { id: 'admin' } as any);

    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details)).toMatchObject({
      avant: {
        id: 'badge-2',
        numero: 'BADGE-2026-00002',
        statut: StatutBadge.ACTIF,
        qrConfigure: true,
        photoPresente: true,
      },
      apres: {
        id: 'badge-2',
        numero: 'BADGE-2026-00002',
        statut: StatutBadge.ACTIF,
        qrConfigure: true,
        photoPresente: true,
      },
      champsModifies: ['telephone'],
    });
    for (const prive of [
      'Personne privée',
      '+224620000000',
      'personne@example.test',
      'P-SECRET',
      'qr-secret',
      'private/photo/path',
    ]) {
      expect(details).not.toContain(prive);
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('journalise l’annulation sans stocker le motif libre', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      badgeAcces: {
        findUnique: jest.fn().mockResolvedValue(badge),
        update: jest.fn().mockResolvedValue({ ...badge, statut: StatutBadge.ANNULE, motif: 'motif confidentiel' }),
      },
      auditLog: { create: auditCreate },
    };
    const service = new BadgesService(
      { $transaction: jest.fn((operation) => operation(tx)) } as any,
      {} as any,
      {} as any,
    );

    await service.annuler('badge-2', { motif: 'motif confidentiel' } as any, { id: 'admin' } as any);

    const details = auditCreate.mock.calls[0][0].data.details;
    expect(details).toContain('motifFourni');
    expect(details).not.toContain('motif confidentiel');
    expect(details).not.toContain('Personne privée');
  });

  it('ne réactive pas un badge annulé par une écriture concurrente', async () => {
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      badgeAcces: {
        findUnique: jest.fn().mockResolvedValue(badge),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: auditCreate },
    };
    const service = new BadgesService(
      { $transaction: jest.fn((operation) => operation(tx)) } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.rallonger('badge-2', { dateValidite: '2099-01-01' } as any, { id: 'admin' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.badgeAcces.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'badge-2', statut: StatutBadge.ACTIF },
      }),
    );
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('ne révèle pas le motif d’annulation dans la vérification QR publique', async () => {
    const prisma = {
      badgeAcces: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'badge-2',
          qrToken: 'qr-secret',
          statut: StatutBadge.ANNULE,
          dateValidite: new Date('2027-01-01T00:00:00Z'),
          motif: 'information personnelle',
          numero: 'BADGE-2026-00002',
          type: 'VISITEUR',
          prenom: 'A',
          nom: 'Personne',
          fonction: null,
          organisation: null,
          zonesAccess: null,
          dateDelivrance: new Date('2026-01-01T00:00:00Z'),
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = new BadgesService(prisma as any, {} as any, {} as any);

    const resultat = await service.verifier({ badge: 'badge-2', k: 'qr-secret' } as any);

    expect(resultat.valide).toBe(false);
    expect(JSON.stringify(resultat)).not.toContain('information personnelle');
    expect(BADGE_VERIFICATION_SELECT).not.toHaveProperty('motif');
  });
});
