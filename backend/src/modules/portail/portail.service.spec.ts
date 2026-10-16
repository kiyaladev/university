import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { Role, type Etudiant } from '@prisma/client';
import { PortailService } from './portail.service';

describe('liaison du compte après OTP étudiant', () => {
  afterEach(() => jest.restoreAllMocks());

  const etudiant: Etudiant = {
    id: 'etu-1',
    matricule: '2026-00001',
    nom: 'Bah',
    prenom: 'Aminata',
    sexe: null,
    dateNaissance: null,
    lieuNaissance: null,
    telephone: '622000001',
    email: null,
    adresse: null,
    actif: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    qrRestoToken: null,
    userId: 'user-1',
  };

  function preparer(options: {
    userId?: string | null;
    linkedUser?: Record<string, unknown> | null;
    userCreate?: jest.Mock;
    collisionUser?: Record<string, unknown> | null;
  } = {}) {
    const userCreate = options.userCreate ?? jest.fn();
    const userId = options.userId === undefined ? etudiant.userId : options.userId;
    const hasLinkedUserId = userId !== null;
    const userFindUnique = jest.fn();
    if (hasLinkedUserId) userFindUnique.mockResolvedValueOnce(options.linkedUser ?? null);
    userFindUnique.mockResolvedValueOnce(options.collisionUser ?? null);
    const prisma: any = {
      etudiant: {
        findFirst: jest.fn().mockResolvedValue({
          ...etudiant,
          userId,
        }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: userFindUnique, create: userCreate },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn((operation: (tx: any) => unknown) => operation(prisma));
    const otp: any = { verifier: jest.fn().mockResolvedValue({ valid: true }) };
    const jwt: any = { signAsync: jest.fn().mockResolvedValue('jwt-student') };
    const service = new PortailService(prisma, otp, jwt);
    return { service, prisma, jwt };
  }

  it.each([
    ['inactif', { id: 'user-1', role: Role.ETUDIANT, actif: false, etudiant: { id: 'etu-1' } }],
    ['privilégié', { id: 'user-1', role: Role.ADMIN, actif: true, etudiant: { id: 'etu-1' } }],
    ['lié à un autre étudiant', { id: 'user-1', role: Role.ETUDIANT, actif: true, etudiant: { id: 'etu-2' } }],
  ])('refuse un compte déjà lié %s', async (_cas, linkedUser) => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Compte étudiant indisponible' } as never);
    const { service, jwt } = preparer({ linkedUser });

    await expect(service.verifierCode('622000001', '123456'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('refuse de rattacher un compte privilégié trouvé après collision d’adresse', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Compte étudiant indisponible' } as never);
    const erreurUnique = Object.assign(new Error('unique'), { code: 'P2002' });
    const userCreate = jest.fn().mockRejectedValue(erreurUnique);
    const { service, prisma, jwt } = preparer({
      userId: null,
      userCreate,
      collisionUser: { id: 'existing-admin', role: Role.ADMIN, actif: true, etudiant: null },
    });

    await expect(service.verifierCode('622000001', '123456'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.etudiant.update).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('réutilise un compte actif de rôle ETUDIANT lié à la même fiche', async () => {
    const { service, prisma, jwt } = preparer({
      linkedUser: {
        id: 'user-1',
        email: 'ine-2026-00001@university.local',
        nom: 'Bah',
        prenom: 'Aminata',
        role: Role.ETUDIANT,
        actif: true,
        etudiant: { id: 'etu-1' },
      },
    });

    await expect(service.verifierCode('622000001', '123456')).resolves.toMatchObject({ token: 'jwt-student' });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1', role: Role.ETUDIANT });
  });

  it('journalise la création du compte portail dans la transaction sans identité ni secret', async () => {
    const userCreate = jest.fn().mockResolvedValue({ id: 'user-created', role: Role.ETUDIANT, actif: true });
    const { service, prisma } = preparer({ userId: null, userCreate });

    await service.verifierCode('622000001', '123456');

    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit).toMatchObject({
      userId: null,
      action: 'COMPTE_ETUDIANT_CREE',
      entite: 'Etudiant',
      entiteId: 'etu-1',
    });
    expect(audit.details).toBe(JSON.stringify({
      avant: null,
      apres: { compteLie: true, role: Role.ETUDIANT, actif: true },
    }));
    expect(audit.details).not.toMatch(/622000001|2026-00001|Bah|Aminata|password/);
  });

  it('journalise le rattachement transactionnel d’un compte étudiant précréé', async () => {
    const collisionUser = { id: 'user-precreated', role: Role.ETUDIANT, actif: true, etudiant: null };
    const userCreate = jest.fn().mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const { service, prisma } = preparer({ userId: null, userCreate, collisionUser });

    await service.verifierCode('622000001', '123456');

    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      userId: null,
      action: 'COMPTE_ETUDIANT_RATTACHE',
      entite: 'Etudiant',
      entiteId: 'etu-1',
    });
    expect(JSON.parse(audit.details)).toEqual({
      avant: { compteLie: false },
      apres: { compteLie: true, role: Role.ETUDIANT, actif: true },
    });
  });

  it('retourne la même erreur pour un code absent et un code incorrect', async () => {
    const messages = await Promise.all(['no_active_code', 'invalid_code'].map(async (raison) => {
      const prisma: any = {};
      const otp: any = { verifier: jest.fn().mockResolvedValue({ valid: false, raison }) };
      const service = new PortailService(prisma, otp, {} as never);
      try {
        await service.verifierCode('622000001', '000000');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        return (error as BadRequestException).message;
      }
      throw new Error('La vérification aurait dû échouer');
    }));

    expect(messages[0]).toBe(messages[1]);
  });
});

describe('résultats dans le portail étudiant', () => {
  it('filtre sur la fiche de la session et ne charge que les champs rendus', async () => {
    const valideeLe = new Date('2026-09-15T12:00:00Z');
    const ligne = {
      id: 'ligne-1',
      deliberationId: 'delib-1',
      moyenne: 15.5,
      decision: 'ADMIS',
      mention: 'Bien',
      rang: 2,
      deliberation: {
        session: 'NORMALE',
        statut: 'VALIDEE',
        valideeLe,
        promotion: { nom: 'L2 Informatique' },
        annee: { libelle: '2025-2026' },
      },
    };
    const prisma: any = {
      deliberationLigne: { findMany: jest.fn().mockResolvedValue([ligne]) },
    };
    const service = new PortailService(prisma, {} as any, {} as any);

    const resultat = await service.resultats({ id: 'user-1', role: Role.ETUDIANT, etudiantId: 'etu-1' } as any);

    expect(prisma.deliberationLigne.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        inscription: { etudiantId: 'etu-1' },
        deliberation: { statut: 'VALIDEE' },
      },
      select: expect.objectContaining({
        moyenne: true,
        deliberation: {
          select: expect.objectContaining({
            promotion: { select: { nom: true } },
            annee: { select: { libelle: true, dateDebut: true } },
          }),
        },
      }),
    }));
    expect(resultat).toMatchObject({
      deliberations: [{ id: 'ligne-1', moyenne: 15.5, promotion: 'L2 Informatique', annee: '2025-2026' }],
      finale: { decision: 'ADMIS' },
    });
    const select = prisma.deliberationLigne.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('inscription.etudiant');
    expect(select.deliberation.select.promotion).not.toHaveProperty('include');
  });
});

describe('résultat final du portail étudiant', () => {
  const ligne = (id: string, session: string, annee: string, dateDebut: string, valideeLe: string) => ({
    id, deliberationId: `d-${id}`, moyenne: 12, decision: 'ADMIS', mention: null, rang: null,
    deliberation: {
      session, statut: 'VALIDEE', valideeLe: new Date(valideeLe),
      promotion: { nom: 'L' }, annee: { libelle: annee, dateDebut: new Date(dateDebut) },
    },
  });

  it('retient l’année la plus récente, puis sa dernière session', async () => {
    // Ordre renvoyé par la requête : session asc, puis validation desc.
    const lignes = [
      ligne('n-2026', 'NORMALE', '2025-2026', '2025-10-01', '2026-07-01'),
      ligne('n-2025', 'NORMALE', '2024-2025', '2024-10-01', '2025-07-01'),
      ligne('r-2025', 'RATTRAPAGE', '2024-2025', '2024-10-01', '2025-09-01'),
    ];
    const prisma: any = { deliberationLigne: { findMany: jest.fn().mockResolvedValue(lignes) } };
    const service = new PortailService(prisma, {} as any, {} as any);

    const resultat = await service.resultats({ id: 'user-1', role: Role.ETUDIANT, etudiantId: 'etu-1' } as any);
    expect(resultat.finale).toMatchObject({ id: 'n-2026' });

    prisma.deliberationLigne.findMany.mockResolvedValue([
      ...lignes.slice(0, 1),
      ligne('r-2026', 'RATTRAPAGE', '2025-2026', '2025-10-01', '2026-09-01'),
    ]);
    const avecRattrapage = await service.resultats({ id: 'user-1', role: Role.ETUDIANT, etudiantId: 'etu-1' } as any);
    expect(avecRattrapage.finale).toMatchObject({ id: 'r-2026' });
  });
});
