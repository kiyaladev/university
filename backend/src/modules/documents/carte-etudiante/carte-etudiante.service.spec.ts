import { CarteEtudianteService } from './carte-etudiante.service';
import * as bcrypt from 'bcryptjs';
import { BadRequestException } from '@nestjs/common';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Protection des données de la carte étudiante', () => {
  it.each(['modifier', 'revoquer', 'definirNip'] as const)(
    'refuse %s lorsque la carte a été révoquée avant la prise du verrou',
    async (operation) => {
      let statut = 'EMIS';
      const tx = {
        $queryRaw: jest.fn().mockImplementation(async () => {
          statut = 'REVOQUE';
          return [];
        }),
        carteEtudiante: { findUnique: jest.fn().mockImplementation(async () => ({ statut })), update: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      const service = new CarteEtudianteService({ $transaction: (fn: any) => fn(tx) } as any, {} as any);
      await expect(
        service[operation](
          'carte-1',
          { nip: '1234', motif: 'Recette' } as any,
          { id: 'user-1', role: 'ETUDIANT', etudiantId: 'etudiant-1' } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it.each([null, new Date('2099-01-01')])(
    'accepte seulement le bon NIP d’une carte active encore valide (%s)',
    async (dateValidite) => {
      const prisma = {
        carteEtudiante: {
          findUnique: jest.fn().mockResolvedValue({
            active: true,
            statut: 'EMIS',
            dateValidite,
            nip: await bcrypt.hash('1234', 4),
          }),
        },
      };
      const service = new CarteEtudianteService(prisma as any, {} as any);
      expect(await service.verifierNip('carte-1', { nip: '1234' } as any)).toEqual({ ok: true });
      expect(await service.verifierNip('carte-1', { nip: '9876' } as any)).toEqual({ ok: false });
    },
  );

  it.each([
    { active: true, statut: 'EMIS', dateValidite: new Date('2000-01-01') },
    { active: false, statut: 'EMIS', dateValidite: null },
    { active: true, statut: 'REVOQUE', dateValidite: null },
  ])('refuse le NIP d’une carte invalide (%j)', async (etat) => {
    const prisma = { carteEtudiante: { findUnique: jest.fn().mockResolvedValue({ ...etat, nip: 'hash' }) } };
    const service = new CarteEtudianteService(prisma as any, {} as any);
    expect(await service.verifierNip('carte-1', { nip: '1234' } as any)).toEqual({ ok: false });
  });

  it('journalise une vérification QR expirée comme un échec', async () => {
    const prisma = {
      carteEtudiante: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'carte-1',
          qrToken: 'secret',
          statut: 'EMIS',
          active: true,
          dateValidite: new Date('2000-01-01'),
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CarteEtudianteService(prisma as any, {} as any);
    expect(await service.verifier({ carte: 'carte-1', k: 'secret' } as any)).toMatchObject({ valide: false });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIF_CARTE_ECHEC' }),
      }),
    );
  });

  const carte = {
    id: 'carte-1',
    etudiantId: 'etudiant-1',
    qrToken: 'jeton-qr-secret',
    statut: 'EMIS',
    active: true,
    dateValidite: new Date('2027-09-01T00:00:00Z'),
    etudiant: { id: 'etudiant-1', matricule: 'MAT-1', nom: 'Diallo', prenom: 'Aminata' },
  };

  it('borne la liste des cartes à 1000 lignes même avec all=1', async () => {
    const prisma: any = {
      carteEtudiante: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(5000) },
    };
    const service = new CarteEtudianteService(prisma, {} as any);

    const resultat = await service.liste({ all: '1', pageSize: 1_000_000 } as any);

    expect(prisma.carteEtudiante.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 1000,
      }),
    );
    expect(resultat).toMatchObject({ total: 5000, page: 1, pageSize: 1000 });
  });

  it('omet le hash du NIP lors du chargement administratif', async () => {
    const prisma = {
      carteEtudiante: { findUnique: jest.fn().mockResolvedValue(carte) },
    };
    const service = new CarteEtudianteService(prisma as any, {} as any);

    const result = await service.trouver('carte-1');

    expect(prisma.carteEtudiante.findUnique).toHaveBeenCalledWith({
      where: { id: 'carte-1' },
      include: expect.any(Object),
      omit: { nip: true },
    });
    expect(result).not.toHaveProperty('nip');
  });

  it('journalise l’émission sans identité étudiante, QR ni données du NIP', async () => {
    const nouvelleCarte = { ...carte, nip: null, photoUrl: null };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      carteEtudiante: { create: jest.fn().mockResolvedValue(nouvelleCarte) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      etudiant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'etudiant-1', nom: 'Diallo', prenom: 'Aminata', matricule: 'MAT-1' }),
      },
      carteEtudiante: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new CarteEtudianteService(prisma, {} as any);

    await service.creer({ etudiantId: 'etudiant-1' } as any, { id: 'admin' } as any);

    const details = auditCreate.mock.calls[0][0].data.details;
    expect(JSON.parse(details).champsModifies).toContain('nip');
    expect(details).not.toContain('Aminata');
    expect(details).not.toContain('Diallo');
    expect(details).not.toContain('MAT-1');
    expect(details).not.toContain('jeton-qr-secret');
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('omet le hash du NIP dans la carte du portail étudiant', async () => {
    const prisma = {
      carteEtudiante: { findUnique: jest.fn().mockResolvedValue(carte) },
    };
    const service = new CarteEtudianteService(prisma as any, {} as any);

    const result = await service.maCarte({ etudiantId: 'etudiant-1' } as any);

    expect(prisma.carteEtudiante.findUnique).toHaveBeenCalledWith({
      where: { etudiantId: 'etudiant-1' },
      include: expect.any(Object),
      omit: { nip: true },
    });
    expect(result).not.toHaveProperty('nip');
  });

  it('omet le hash du NIP et les champs non publics lors de la vérification QR', async () => {
    const dateEmission = new Date('2026-09-01T00:00:00Z');
    const prisma = {
      carteEtudiante: {
        findUnique: jest.fn().mockResolvedValue({
          ...carte,
          active: true,
          dateEmission,
          dateValidite: null,
          motifRevocation: null,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = new CarteEtudianteService(prisma as any, {} as any);

    const result = await service.verifier({ carte: 'carte-1', k: 'jeton-qr-secret' } as any);

    expect(prisma.carteEtudiante.findUnique).toHaveBeenCalledWith({
      where: { id: 'carte-1' },
      select: {
        id: true,
        qrToken: true,
        statut: true,
        active: true,
        dateEmission: true,
        dateValidite: true,
        etudiant: { select: { matricule: true, nom: true, prenom: true } },
      },
    });
    expect(result).toMatchObject({ valide: true, carte: { identifiant: 'carte-1' } });
    expect(result).not.toHaveProperty('nip');
    expect(JSON.stringify(result)).not.toContain('jeton-qr-secret');
  });

  it('journalise les champs modifiés dans la même transaction sans copier le NIP, le QR ou la photo', async () => {
    const actuel = { ...carte, photoUrl: 'private/photo/path', nip: 'hash-nip-secret' };
    const maj = { ...actuel, dateValidite: new Date('2028-09-01T00:00:00Z') };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      carteEtudiante: {
        findUnique: jest.fn().mockResolvedValue(actuel),
        update: jest.fn().mockResolvedValue(maj),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new CarteEtudianteService(prisma, {} as any);

    await service.modifier('carte-1', { dateValidite: '2028-09-01T00:00:00Z' } as any, { id: 'admin' } as any);

    const details = JSON.parse(auditCreate.mock.calls[0][0].data.details);
    expect(details).toEqual({
      avant: {
        id: 'carte-1',
        statut: 'EMIS',
        active: true,
        dateValidite: carte.dateValidite.toISOString(),
        photoPresente: true,
        nipConfigure: true,
      },
      apres: {
        id: 'carte-1',
        statut: 'EMIS',
        active: true,
        dateValidite: maj.dateValidite.toISOString(),
        photoPresente: true,
        nipConfigure: true,
      },
      champsModifies: ['dateValidite'],
    });
    expect(JSON.stringify(details)).not.toContain('etudiant-1');
    expect(JSON.stringify(details)).not.toContain('hash-nip-secret');
    expect(JSON.stringify(details)).not.toContain('jeton-qr-secret');
    expect(JSON.stringify(details)).not.toContain('private/photo/path');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('journalise la révocation sans enregistrer le motif libre', async () => {
    const actuel = { ...carte, photoUrl: 'private/photo/path', nip: 'hash-nip-secret' };
    const maj = { ...actuel, statut: 'REVOQUE', active: false, motifRevocation: 'situation privée' };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      carteEtudiante: {
        findUnique: jest.fn().mockResolvedValue(actuel),
        update: jest.fn().mockResolvedValue(maj),
      },
      auditLog: { create: auditCreate },
    };
    const service = new CarteEtudianteService(
      { $transaction: jest.fn((operation) => operation(tx)) } as any,
      {} as any,
    );

    await service.revoquer('carte-1', { motif: 'situation privée' } as any, { id: 'admin' } as any);

    const details = auditCreate.mock.calls[0][0].data.details;
    expect(details).toContain('motifFourni');
    expect(details).not.toContain('situation privée');
    expect(details).not.toContain('hash-nip-secret');
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('ne révèle pas le motif de révocation dans la vérification QR publique', async () => {
    const prisma = {
      carteEtudiante: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'carte-1',
          qrToken: 'jeton-qr-secret',
          statut: 'REVOQUE',
          active: false,
          dateEmission: new Date('2026-09-01T00:00:00Z'),
          dateValidite: null,
          motifRevocation: 'information personnelle',
          etudiant: { matricule: 'MAT-1', nom: 'Diallo', prenom: 'Aminata' },
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const service = new CarteEtudianteService(prisma as any, {} as any);

    const resultat = await service.verifier({ carte: 'carte-1', k: 'jeton-qr-secret' } as any);

    expect(resultat.valide).toBe(false);
    expect(JSON.stringify(resultat)).not.toContain('information personnelle');
  });
});
