/**
 * Carte d'étudiant — émission, NIP, révocation et vérification publique.
 *
 * Règles en tête de `carte-etudiante.service.ts` :
 *
 *   - un étudiant n'a qu'une carte : en demander une seconde est un conflit ;
 *   - le NIP est un code personnel stocké haché ; seul l'étudiant propriétaire
 *     peut définir celui de sa propre carte ;
 *   - la révocation est définitive : la carte devient inerte et n'est plus
 *     modifiable ;
 *   - la page de vérité n'ouvre que sur le couple identifiant + jeton exact,
 *     sur une carte émise, active et non expirée.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StatutAttestation } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CarteEtudianteService } from './carte-etudiante.service';

const ETUDIANT = { id: 'etu-1', etudiantId: 'etu-1', nom: 'BARRY', prenom: 'Aminata', role: 'ETUDIANT' } as any;
const AUTRE_ETUDIANT = { id: 'etu-2', etudiantId: 'etu-2', nom: 'DIA', prenom: 'Sory', role: 'ETUDIANT' } as any;
const SCOLARITE = { id: 'scolarite-1', nom: 'Scol', prenom: 'Arite', role: 'SCOLARITE' } as any;

/** Carte émise, active, sans expiration. */
function carte(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'carte-1',
    etudiantId: 'etu-1',
    qrToken: 'jeton-carte',
    statut: StatutAttestation.EMIS,
    active: true,
    nip: null,
    motifRevocation: null,
    photoUrl: null,
    dateEmission: new Date('2026-01-01T00:00:00Z'),
    dateValidite: null,
    etudiant: {
      id: 'etu-1',
      matricule: '2026-0001',
      nom: 'BARRY',
      prenom: 'Aminata',
      sexe: 'F',
      dateNaissance: null,
      lieuNaissance: null,
    },
    ...surcharge,
  };
}

/** Faux Prisma : transaction et lecture administrative observables. */
function preparer(carteCourante: Record<string, unknown> | null = carte()) {
  const tx: any = {
    carteEtudiante: {
      findUnique: jest.fn().mockResolvedValue(carteCourante),
      create: jest.fn().mockResolvedValue(carte()),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...carte(), ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const prisma: any = {
    carteEtudiante: {
      findUnique: jest.fn().mockResolvedValue(carteCourante),
      findMany: jest.fn().mockResolvedValue(carteCourante ? [carteCourante] : []),
      count: jest.fn().mockResolvedValue(1),
    },
    etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etu-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((work) => work(tx)),
  };
  return { prisma, tx, service: new CarteEtudianteService(prisma, {} as any) };
}

describe('CarteEtudianteService — émission', () => {
  it('refuse une carte pour un étudiant inconnu', async () => {
    const { prisma, tx, service } = preparer();
    prisma.etudiant.findUnique.mockResolvedValue(null);

    await expect(service.creer({ etudiantId: 'etu-x' } as any, SCOLARITE)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.carteEtudiante.create).not.toHaveBeenCalled();
  });

  it('refuse une seconde carte pour un étudiant déjà doté', async () => {
    const { prisma, tx, service } = preparer();
    prisma.carteEtudiante.findUnique.mockResolvedValue({ id: 'carte-1' });

    await expect(service.creer({ etudiantId: 'etu-1' } as any, SCOLARITE)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.carteEtudiante.create).not.toHaveBeenCalled();
  });

  it('attribue un jeton QR unique et distinct du matricule', async () => {
    const { prisma, tx, service } = preparer();
    prisma.carteEtudiante.findUnique.mockResolvedValue(null);

    await service.creer({ etudiantId: 'etu-1' } as any, SCOLARITE);

    const data = tx.carteEtudiante.create.mock.calls[0][0].data;
    expect(data.qrToken).toMatch(/^UP-CARTE-/);
    expect(data.qrToken).not.toBe('2026-0001');
  });

  it('stocke le NIP haché, jamais en clair', async () => {
    const { prisma, tx, service } = preparer();
    prisma.carteEtudiante.findUnique.mockResolvedValue(null);

    await service.creer({ etudiantId: 'etu-1', nip: '1234' } as any, SCOLARITE);

    const data = tx.carteEtudiante.create.mock.calls[0][0].data;
    expect(data.nip).not.toBe('1234');
    expect(data.nip).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('1234', data.nip)).toBe(true);
  });
});

describe('CarteEtudianteService — carte du portail', () => {
  it('refuse la carte du portail à un compte sans profil étudiant', async () => {
    const { prisma, service } = preparer();

    await expect(service.maCarte({ ...SCOLARITE, etudiantId: null })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.carteEtudiante.findUnique).not.toHaveBeenCalled();
  });

  it('signale qu’aucune carte n’a encore été émise pour l’étudiant', async () => {
    const { prisma, service } = preparer();
    prisma.carteEtudiante.findUnique.mockResolvedValue(null);

    await expect(service.maCarte({ ...ETUDIANT, etudiantId: 'etu-1' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('charge la carte par profil étudiant, pas par identifiant de carte', async () => {
    const { prisma, service } = preparer();

    await service.maCarte({ ...ETUDIANT, etudiantId: 'etu-1' });

    expect(prisma.carteEtudiante.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { etudiantId: 'etu-1' } }),
    );
  });
});

describe('CarteEtudianteService — NIP', () => {
  it('refuse qu’un tiers définisse le NIP d’une carte', async () => {
    const { tx, service } = preparer();

    await expect(
      service.definirNip('carte-1', { nip: '1234' } as any, { ...SCOLARITE, etudiantId: 'etu-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
  });

  it('refuse qu’un étudiant définisse le NIP d’une autre carte', async () => {
    const { tx, service } = preparer();

    await expect(service.definirNip('carte-1', { nip: '1234' } as any, AUTRE_ETUDIANT)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
  });

  it('refuse de définir le NIP d’une carte révoquée', async () => {
    const { tx, service } = preparer(carte({ statut: StatutAttestation.REVOQUE }));

    await expect(service.definirNip('carte-1', { nip: '1234' } as any, ETUDIANT)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
  });

  it('laisse l’étudiant définir le NIP de sa propre carte', async () => {
    const { tx, service } = preparer();

    const resultat = await service.definirNip('carte-1', { nip: '1234' } as any, ETUDIANT);

    expect(resultat).toEqual({ id: 'carte-1', nipDefini: true });
    const data = tx.carteEtudiante.update.mock.calls[0][0].data;
    expect(data.nip).not.toBe('1234');
    expect(await bcrypt.compare('1234', data.nip)).toBe(true);
  });

  it('accepte le NIP correct d’une carte valide', async () => {
    const { service } = preparer(carte({ nip: bcrypt.hashSync('1234', 4) }));

    await expect(service.verifierNip('carte-1', { nip: '1234' } as any)).resolves.toEqual({ ok: true });
  });

  it('refuse un NIP erroné', async () => {
    const { service } = preparer(carte({ nip: bcrypt.hashSync('1234', 4) }));

    await expect(service.verifierNip('carte-1', { nip: '9999' } as any)).resolves.toEqual({ ok: false });
  });

  it.each([
    ['carte révoquée', carte({ nip: bcrypt.hashSync('1234', 4), statut: StatutAttestation.REVOQUE })],
    ['carte désactivée', carte({ nip: bcrypt.hashSync('1234', 4), active: false })],
    ['carte expirée', carte({ nip: bcrypt.hashSync('1234', 4), dateValidite: new Date('2020-01-01T00:00:00Z') })],
    ['carte sans NIP', carte({ nip: null })],
  ])('refuse la vérification du NIP sur une %s', async (_cas, carteCourante) => {
    const { service } = preparer(carteCourante);

    await expect(service.verifierNip('carte-1', { nip: '1234' } as any)).resolves.toEqual({ ok: false });
  });
});

describe('CarteEtudianteService — révocation', () => {
  it('révoque une carte active et la désactive', async () => {
    const { tx, service } = preparer();

    await service.revoquer('carte-1', { motif: 'Carte perdue' } as any, SCOLARITE);

    expect(tx.carteEtudiante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: StatutAttestation.REVOQUE,
          active: false,
          motifRevocation: 'Carte perdue',
        }),
      }),
    );
  });

  it('refuse de révoquer une carte déjà révoquée', async () => {
    const { tx, service } = preparer(carte({ statut: StatutAttestation.REVOQUE }));

    await expect(service.revoquer('carte-1', { motif: 'Carte perdue' } as any, SCOLARITE)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
  });

  it('refuse de modifier une carte révoquée', async () => {
    const { tx, service } = preparer(carte({ statut: StatutAttestation.REVOQUE }));

    await expect(service.modifier('carte-1', { photoUrl: 'photo.jpg' } as any, SCOLARITE)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
  });
});

describe('CarteEtudianteService — vérification publique', () => {
  it('refuse un identifiant inconnu et journalise l’échec', async () => {
    const { prisma, service } = preparer(null);

    const resultat = await service.verifier({ carte: 'carte-x', k: 'jeton-carte' } as any, '10.0.0.1');

    expect(resultat.valide).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VERIF_CARTE_ECHEC', ip: '10.0.0.1' }),
      }),
    );
  });

  it('refuse un jeton qui ne correspond pas à la carte présentée', async () => {
    const { service } = preparer();

    const resultat = await service.verifier({ carte: 'carte-1', k: 'jeton-faux' } as any);

    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('copie falsifiée');
  });

  it('refuse une carte révoquée même avec le bon jeton', async () => {
    const { service } = preparer(carte({ statut: StatutAttestation.REVOQUE, active: false }));

    const resultat = await service.verifier({ carte: 'carte-1', k: 'jeton-carte' } as any);

    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('révoquée');
  });

  it('refuse une carte expirée même avec le bon jeton', async () => {
    const { service } = preparer(carte({ dateValidite: new Date('2020-01-01T00:00:00Z') }));

    const resultat = await service.verifier({ carte: 'carte-1', k: 'jeton-carte' } as any);

    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('expirée');
  });

  it('accepte une carte émise, active et non expirée', async () => {
    const { prisma, service } = preparer();

    const resultat = await service.verifier({ carte: 'carte-1', k: 'jeton-carte' } as any);

    expect(resultat.valide).toBe(true);
    expect((resultat as any).carte.etudiant).toBe('Aminata BARRY (2026-0001)');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'VERIF_CARTE_OK' }) }),
    );
  });
});

describe('CarteEtudianteService — modification administrative', () => {
  it('met à jour la photo et la date de validité', async () => {
    const { tx, service } = preparer();

    await service.modifier('carte-1', { photoUrl: 'photo.jpg', dateValidite: '2030-01-01' } as any, SCOLARITE);

    expect(tx.carteEtudiante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'carte-1' },
        data: { photoUrl: 'photo.jpg', dateValidite: new Date('2030-01-01') },
      }),
    );
  });

  it('rehache le NIP quand la scolarité le remplace', async () => {
    const { tx, service } = preparer();

    await service.modifier('carte-1', { nip: '4321' } as any, SCOLARITE);

    const data = tx.carteEtudiante.update.mock.calls[0][0].data;
    expect(data.nip).not.toBe('4321');
    expect(await bcrypt.compare('4321', data.nip)).toBe(true);
  });

  it('ne touche pas au NIP quand la modification n’en parle pas', async () => {
    const { tx, service } = preparer();

    await service.modifier('carte-1', { photoUrl: 'photo.jpg' } as any, SCOLARITE);

    expect(tx.carteEtudiante.update.mock.calls[0][0].data).not.toHaveProperty('nip');
  });

  it('signale une carte introuvable', async () => {
    const { tx, service } = preparer(null);

    await expect(service.modifier('carte-x', { photoUrl: 'photo.jpg' } as any, SCOLARITE)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(tx.carteEtudiante.update).not.toHaveBeenCalled();
  });
});
