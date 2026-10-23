import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Role } from '@prisma/client';
import { RestoService } from './resto.service';

describe('Lecture de la carte restaurant au guichet', () => {
  beforeEach(() => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: (key: string) => key } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const preparer = (role: Role = Role.CONTROLEUR) => {
    const etudiant = {
      id: 'etudiant-1',
      matricule: 'E-2026-001',
      nom: 'Diallo',
      prenom: 'Awa',
      telephone: '+224600000001',
      qrRestoToken: 'UP-RESTO-secret',
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'guichet-1',
          actif: true,
          role,
          motDePasseModifieLe: null,
          departementId: null,
          etudiant: null,
          enseignant: null,
        }),
      },
      etudiant: { findUnique: jest.fn().mockResolvedValue(etudiant) },
      portefeuilleResto: {
        upsert: jest.fn().mockResolvedValue({ id: 'portefeuille-1', etudiantId: etudiant.id, solde: 42 }),
        create: jest.fn(),
      },
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'guichet-1' }) };
    return { prisma, jwt, service: new RestoService(prisma, {} as never, jwt as never) };
  };

  it('vérifie le poste de guichet et renvoie uniquement le résumé utile, sans jeton QR ni téléphone', async () => {
    const { prisma, service } = preparer();

    const resultat = await service.carteInfo('UP-RESTO-secret', 'jeton-session');

    expect(resultat).toEqual({
      etudiant: { matricule: 'E-2026-001', nom: 'Diallo', prenom: 'Awa' },
      carte: { qrToken: true },
      solde: 42,
    });
    expect(JSON.stringify(resultat)).not.toContain('UP-RESTO-secret');
    expect(JSON.stringify(resultat)).not.toContain('+224600000001');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'guichet-1' } }));
    expect(prisma.portefeuilleResto.create).not.toHaveBeenCalled();
  });

  it('refuse un jeton invalide avant de chercher une fiche étudiante', async () => {
    const { prisma, jwt, service } = preparer();
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));

    await expect(service.carteInfo('E-2026-001', 'jeton-invalide')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.etudiant.findUnique).not.toHaveBeenCalled();
  });

  it('refuse un compte étudiant même si son jeton est valide', async () => {
    const { prisma, service } = preparer(Role.ETUDIANT);

    await expect(service.carteInfo('E-2026-001', 'jeton-etudiant')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.etudiant.findUnique).not.toHaveBeenCalled();
  });

  it('conserve le premier QR créé quand deux lectures arrivent en même temps', async () => {
    const etudiant = {
      id: 'etudiant-1',
      matricule: 'E-2026-001',
      nom: 'Diallo',
      prenom: 'Awa',
      telephone: '+224600000001',
      qrRestoToken: null,
    };
    let jetonGagnant = '';
    const updateMany = jest.fn(({ data }: { data: { qrRestoToken: string } }) => {
      if (!jetonGagnant) {
        jetonGagnant = data.qrRestoToken;
        return Promise.resolve({ count: 1 });
      }
      return Promise.resolve({ count: 0 });
    });
    const findUnique = jest.fn().mockImplementation(async () => ({ ...etudiant, qrRestoToken: jetonGagnant }));
    const service = new RestoService({ etudiant: { updateMany, findUnique } } as never, {} as never, {} as never);

    const [premiere, seconde] = await Promise.all([
      (service as any).assurerQrToken(null, etudiant),
      (service as any).assurerQrToken(null, etudiant),
    ]);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'etudiant-1', qrRestoToken: null },
      data: { qrRestoToken: expect.stringMatching(/^UP-RESTO-/) },
    });
    expect(premiere.qrRestoToken).toBe(seconde.qrRestoToken);
    expect(seconde.qrRestoToken).toBe(jetonGagnant);
  });

  it('crée ou récupère le portefeuille par upsert atomique', async () => {
    const etudiant = {
      id: 'etudiant-1',
      matricule: 'E-2026-001',
      nom: 'Diallo',
      prenom: 'Awa',
      telephone: '+224600000001',
      qrRestoToken: 'UP-RESTO-secret',
    };
    const portefeuille = { id: 'portefeuille-1', etudiantId: etudiant.id, solde: 42 };
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'guichet-1',
          actif: true,
          role: Role.CONTROLEUR,
          motDePasseModifieLe: null,
          departementId: null,
          etudiant: null,
          enseignant: null,
        }),
      },
      etudiant: { findUnique: jest.fn().mockResolvedValue(etudiant) },
      portefeuilleResto: { upsert: jest.fn().mockResolvedValue(portefeuille) },
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'guichet-1' }) };
    const service = new RestoService(prisma, {} as never, jwt as never);

    await expect(service.carteInfo('E-2026-001', 'jeton-session')).resolves.toMatchObject({ solde: 42 });
    expect(prisma.portefeuilleResto.upsert).toHaveBeenCalledWith({
      where: { etudiantId: 'etudiant-1' },
      create: { etudiantId: 'etudiant-1', solde: 0 },
      update: {},
    });
  });
});

describe('Registres du restaurant — filtres de dates', () => {
  const prisma: any = {
    recharge: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    consommationResto: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  };
  const service = new RestoService(prisma, {} as never, {} as never);
  const debut = new Date('2026-10-01T00:00:00');
  const fin = new Date('2026-10-31T23:59:59.999');

  it('conserve les deux bornes des recharges', async () => {
    await service.listeRecharges({ dateDebut: '2026-10-01', dateFin: '2026-10-31' } as any);
    expect(prisma.recharge.findMany.mock.calls[0][0].where).toEqual({ rechargeLe: { gte: debut, lte: fin } });
  });

  it('conserve les deux bornes des consommations', async () => {
    await service.listeConsommations({ dateDebut: '2026-10-01', dateFin: '2026-10-31' } as any);
    expect(prisma.consommationResto.findMany.mock.calls[0][0].where).toEqual({ consommeLe: { gte: debut, lte: fin } });
  });
});
