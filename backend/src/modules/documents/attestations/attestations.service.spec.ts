import { StatutAttestation, TypeAttestation } from '@prisma/client';
import { ATTESTATION_INCLUDE, AttestationsService } from './attestations.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Mutations après révocation des attestations', () => {
  it.each(['modifier', 'revoquer'] as const)('refuse %s après une révocation concurrente', async (operation) => {
    const avant = { id: 'attestation-1', statut: StatutAttestation.EMIS, anneeId: 'annee-1' };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      attestation: {
        findUnique: jest.fn().mockResolvedValue({ ...avant, statut: StatutAttestation.REVOQUE }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      anneeAcademique: tx.anneeAcademique,
      attestation: { findUnique: jest.fn().mockResolvedValue(avant) },
      $transaction: (fn: any) => fn(tx),
    };
    const service = new AttestationsService(prisma as any, {} as any);
    await expect(
      service[operation](
        'attestation-1',
        { motif: 'Recette', motifRevocation: 'Recette' } as any,
        { id: 'admin' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.attestation.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('Lecture du registre des attestations', () => {
  it('limite les relations chargées à celles utilisées par le registre et le document', async () => {
    const prisma = {
      attestation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new AttestationsService(prisma as any, {} as any);

    await service.lister({} as any);

    expect(prisma.attestation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: ATTESTATION_INCLUDE,
      }),
    );
    expect(ATTESTATION_INCLUDE).toMatchObject({
      annee: { select: { libelle: true } },
      promotion: { select: { nom: true, filiere: { select: { nom: true } } } },
      inscription: { select: { numero: true } },
    });
    expect(ATTESTATION_INCLUDE.inscription).not.toHaveProperty('include');
  });
});

describe('Vérification publique des attestations', () => {
  /** Client complet : la vérification et sa trace d'audit sont écrites ensemble. */
  function client(attestation: any) {
    const prisma: any = {
      attestation: { findUnique: jest.fn().mockResolvedValue(attestation) },
      verificationAttestation: { create: jest.fn().mockResolvedValue({ id: 'verification-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) => operation(prisma));
    return prisma;
  }

  it('confirme la révocation sans publier son motif confidentiel', async () => {
    const prisma = client({
      id: 'attestation-1',
      qrToken: 'secret',
      statut: StatutAttestation.REVOQUE,
      revoqueeLe: new Date('2026-10-01'),
      motifRevocation: 'information confidentielle',
    });
    const service = new AttestationsService(prisma as any, {} as any);
    const resultat = await service.verifier({ ref: 'ATT-1', k: 'secret' } as any);
    expect(resultat.valide).toBe(false);
    expect(resultat.raison).toContain('révoquée');
    expect(JSON.stringify(resultat)).not.toContain('information confidentielle');
  });

  it('projette seulement les champs publiés de l’année, de la promotion et de l’étudiant', async () => {
    const emiseLe = new Date('2026-09-01T00:00:00Z');
    const verificationId = 'verification-1';
    const attestation = {
      id: 'attestation-1',
      numero: 'ATT-2026-00001',
      qrToken: 'secret-qr',
      statut: StatutAttestation.EMIS,
      type: TypeAttestation.SCOLARITE,
      motif: null,
      emiseLe,
      etudiant: { nom: 'Diallo', prenom: 'Aminata', matricule: 'MAT-1' },
      annee: { libelle: '2026-2027' },
      promotion: { nom: 'L2', filiere: { nom: 'Informatique' } },
    };
    const prisma = client(attestation);
    const service = new AttestationsService(prisma as any, {} as any);

    const result = await service.verifier({ ref: attestation.numero, k: 'secret-qr' } as any);

    expect(prisma.attestation.findUnique).toHaveBeenCalledWith({
      where: { numero: attestation.numero },
      include: {
        etudiant: { select: { nom: true, prenom: true, matricule: true } },
        annee: { select: { libelle: true } },
        promotion: { select: { nom: true, filiere: { select: { nom: true } } } },
      },
    });
    expect(result).toMatchObject({
      valide: true,
      verificationId,
      attestation: {
        numero: attestation.numero,
        etudiant: attestation.etudiant,
        annee: '2026-2027',
        promotion: 'L2 (Informatique)',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret-qr');
    expect(JSON.stringify(result)).not.toContain('attestation-1');
  });

  it('bloque la modification d’une attestation rattachée à une année clôturée', async () => {
    const attestation = {
      id: 'attestation-1',
      numero: 'ATT-2026-00001',
      anneeId: 'annee-1',
      statut: StatutAttestation.EMIS,
    };
    const tx = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      attestation: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      attestation: { findUnique: jest.fn().mockResolvedValue(attestation) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
    };
    const service = new AttestationsService(prisma as any, {} as any);

    await expect(
      service.modifier('attestation-1', { motif: 'Correction' } as any, { id: 'user-1' } as any),
    ).rejects.toThrow();

    expect(tx.attestation.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('consigne la modification avec avant/après dans la transaction et omet le QR secret', async () => {
    const avant = {
      id: 'attestation-1',
      numero: 'ATT-2026-00001',
      qrToken: 'secret-qr',
      type: TypeAttestation.SCOLARITE,
      motif: 'Ancien motif',
      statut: StatutAttestation.EMIS,
      anneeId: 'annee-1',
      promotionId: 'promotion-1',
      inscriptionId: 'inscription-1',
      etudiantId: 'etudiant-1',
    };
    const apres = { ...avant, motif: 'Nouveau motif' };
    const tx = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
      attestation: { findUnique: jest.fn().mockResolvedValue(avant), update: jest.fn().mockResolvedValue(apres) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      attestation: { findUnique: jest.fn().mockResolvedValue(avant) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
      auditLog: { create: jest.fn() },
    };
    const service = new AttestationsService(prisma as any, {} as any);

    await service.modifier('attestation-1', { motif: 'Nouveau motif' } as any, { id: 'user-1' } as any);

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    const details = tx.auditLog.create.mock.calls[0][0].data.details;
    expect(details).not.toContain('Ancien motif');
    expect(details).not.toContain('Nouveau motif');
    expect(details).not.toContain('secret-qr');
  });

  it('écrit la tentative de fraude et sa trace dans la même transaction', async () => {
    const prisma = client({
      id: 'attestation-1',
      numero: 'ATT-2026-00001',
      qrToken: 'jeton-attendu',
      statut: StatutAttestation.EMIS,
      type: TypeAttestation.SCOLARITE,
    });
    const service = new AttestationsService(prisma as any, {} as any);

    const resultat = await service.verifier({ ref: 'ATT-2026-00001', k: 'jeton-faux' } as any, '10.0.0.1');

    expect(resultat.valide).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.verificationAttestation.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'VERIF_ATTESTATION_ECHEC',
      entiteId: 'ATT-2026-00001',
      ip: '10.0.0.1',
    });
  });

  it('abandonne la vérification si la trace d’échec ne peut pas être écrite', async () => {
    const prisma = client({
      id: 'attestation-1',
      numero: 'ATT-2026-00001',
      qrToken: 'jeton-attendu',
      statut: StatutAttestation.EMIS,
      type: TypeAttestation.SCOLARITE,
    });
    prisma.auditLog.create.mockRejectedValue(new Error('journal indisponible'));
    const service = new AttestationsService(prisma as any, {} as any);

    await expect(service.verifier({ ref: 'ATT-2026-00001', k: 'jeton-faux' } as any)).rejects.toThrow(
      'journal indisponible',
    );
  });
});

describe('Cohérence année-promotion des attestations', () => {
  it.each([
    { etudiantId: 'autre-etudiant', anneeId: 'annee-1', promotionId: 'promotion-1' },
    { etudiantId: 'etudiant-1', anneeId: 'autre-annee', promotionId: 'promotion-1' },
    { etudiantId: 'etudiant-1', anneeId: 'annee-1', promotionId: 'autre-promotion' },
  ])('refuse une inscription dont le rattachement diffère (%j)', async (inscription) => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false, anneeId: 'annee-1' }]),
      promotion: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-1', annee: { libelle: '2026-2027' } }) },
      inscription: { findUnique: jest.fn().mockResolvedValue(inscription) },
      attestation: { findFirst: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etudiant-1' }) },
      inscription: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-1' }) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2026-2027' }) },
      $transaction: (fn: any) => fn(tx),
    };
    const service = new AttestationsService(prisma as any, {} as any);
    await expect(
      service.creer(
        {
          etudiantId: 'etudiant-1',
          anneeId: 'annee-1',
          promotionId: 'promotion-1',
          inscriptionId: 'inscription-1',
          type: TypeAttestation.SCOLARITE,
        } as any,
        { id: 'admin' } as any,
      ),
    ).rejects.toThrow('attestations.rattachement_incoherent');
    expect(tx.attestation.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('renvoie une erreur métier pour une inscription inexistante avant toute transaction', async () => {
    const prisma = {
      etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etudiant-1' }) },
      inscription: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = new AttestationsService(prisma as any, {} as any);
    await expect(
      service.creer(
        { etudiantId: 'etudiant-1', inscriptionId: 'absente', type: TypeAttestation.SCOLARITE } as any,
        { id: 'admin' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse un changement de type qui créerait une deuxième attestation active', async () => {
    const actuel = {
      id: 'attestation-1',
      etudiantId: 'etudiant-1',
      anneeId: 'annee-1',
      type: TypeAttestation.SITUATION,
      statut: StatutAttestation.EMIS,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
      attestation: {
        findUnique: jest.fn().mockResolvedValue(actuel),
        findFirst: jest.fn().mockResolvedValue({ numero: 'ATT-EXISTANTE' }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      attestation: tx.attestation,
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $transaction: (fn: any) => fn(tx),
    };
    const service = new AttestationsService(prisma as any, {} as any);
    await expect(
      service.modifier(actuel.id, { type: TypeAttestation.SCOLARITE }, { id: 'admin' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.attestation.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: actuel.id },
        etudiantId: actuel.etudiantId,
        anneeId: actuel.anneeId,
        type: TypeAttestation.SCOLARITE,
        statut: StatutAttestation.EMIS,
      },
    });
    expect(tx.attestation.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse une attestation dont l’année ne correspond pas à la promotion', async () => {
    const annee = { id: 'annee-b', libelle: '2026-2027', cloturee: false };
    const tx = {
      promotion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'promotion-a', anneeId: 'annee-a', annee: { libelle: '2025-2026' } }),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      attestation: { findFirst: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      etudiant: { findUnique: jest.fn().mockResolvedValue({ id: 'etudiant-1' }) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue(annee) },
      $transaction: jest.fn((operation: (db: typeof tx) => unknown) => operation(tx)),
    };
    const service = new AttestationsService(prisma as any, {} as any);

    await expect(
      service.creer(
        {
          type: TypeAttestation.SCOLARITE,
          etudiantId: 'etudiant-1',
          anneeId: 'annee-b',
          promotionId: 'promotion-a',
        } as any,
        { id: 'scolarite-1' } as any,
      ),
    ).rejects.toThrow('common.academicPromotionMismatch');

    expect(tx.attestation.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
