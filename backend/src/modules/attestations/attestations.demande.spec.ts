import { ConflictException } from '@nestjs/common';
import { TypeAttestation } from '@prisma/client';
import { AttestationsService } from './attestations.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Émission depuis une demande de document', () => {
  const user = { id: 'scolarite' } as any;
  const dto = { type: TypeAttestation.SCOLARITE, etudiantId: 'etudiant-1', inscriptionId: 'inscription-1' };

  function monter(doublon: any, lien: any = null) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false, anneeId: 'annee-1' }]),
      inscription: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ anneeId: 'annee-1', etudiantId: 'etudiant-1', promotionId: 'promo-1' }),
      },
      anneeAcademique: {
        findUnique: jest.fn().mockResolvedValue({ id: 'annee-1', libelle: '2026-2027', cloturee: false }),
      },
      attestation: {
        findFirst: jest.fn().mockResolvedValue(doublon),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'att-neuve', numero: 'ATT-2026-00001' }),
      },
      demandeDocument: { findUnique: jest.fn().mockResolvedValue(lien) },
      auditLog: { create: jest.fn() },
    };
    const service = new AttestationsService({} as any, {} as any);
    return { tx, service };
  }

  it("émet dans la transaction de l'appelant, sur l'année de l'inscription", async () => {
    const { tx, service } = monter(null);
    await expect(service.emettrePourDemandeTx(tx as any, dto, user)).resolves.toMatchObject({ id: 'att-neuve' });
    expect(tx.attestation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anneeId: 'annee-1',
          inscriptionId: 'inscription-1',
          promotionId: 'promo-1',
          type: TypeAttestation.SCOLARITE,
          emiseParId: 'scolarite',
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('réutilise une attestation identique déjà émise et rattachée à aucune demande', async () => {
    const existante = { id: 'att-manuelle', numero: 'ATT-2026-00004' };
    const { tx, service } = monter(existante);
    await expect(service.emettrePourDemandeTx(tx as any, dto, user)).resolves.toBe(existante);
    expect(tx.demandeDocument.findUnique).toHaveBeenCalledWith({
      where: { attestationId: 'att-manuelle' },
      select: { id: true },
    });
    expect(tx.attestation.create).not.toHaveBeenCalled();
  });

  it('refuse de rattacher une attestation déjà remise au titre d’une autre demande', async () => {
    const { tx, service } = monter({ id: 'att-prise', numero: 'ATT-2026-00007' }, { id: 'autre-demande' });
    await expect(service.emettrePourDemandeTx(tx as any, dto, user)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.attestation.create).not.toHaveBeenCalled();
  });
});
