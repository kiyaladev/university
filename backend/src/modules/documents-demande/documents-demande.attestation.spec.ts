import { BadRequestException } from '@nestjs/common';
import { StatutDemande, TypeAttestation, TypeDemandeDocument } from '@prisma/client';
import { DocumentsDemandeService } from './documents-demande.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Demande de document passée « prête » et attestation vérifiable', () => {
  const user = { id: 'scolarite' } as any;

  function monter(avant: Record<string, unknown>) {
    const demande = {
      id: 'demande-1',
      numero: 'DOC-2026-00001',
      etudiantId: 'etudiant-1',
      inscriptionId: 'inscription-1',
      motif: 'Bourse',
      statut: StatutDemande.EN_TRAITEMENT,
      attestationId: null,
      ...avant,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      demandeDocument: {
        findUnique: jest.fn().mockResolvedValue(demande),
        update: jest.fn().mockImplementation(({ data }: any) => {
          const attestationId = data.attestationId ?? demande.attestationId;
          return Promise.resolve({
            ...demande,
            ...data,
            attestation: attestationId ? { id: attestationId, numero: 'ATT-2026-00001' } : null,
          });
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: (fn: any) => fn(tx),
      etudiant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const attestations = {
      emettrePourDemandeTx: jest.fn().mockResolvedValue({ id: 'att-1', numero: 'ATT-2026-00001' }),
    };
    const service = new DocumentsDemandeService(prisma as any, {} as any, attestations as any);
    jest.spyOn(service, 'findOne').mockResolvedValue(demande as any);
    return { service, tx, attestations };
  }

  it.each([
    [TypeDemandeDocument.ATTESTATION_SCOLARITE, TypeAttestation.SCOLARITE],
    [TypeDemandeDocument.CERTIFICAT_SCOLARITE, TypeAttestation.SCOLARITE],
    [TypeDemandeDocument.ATTESTATION_REUSSITE, TypeAttestation.REUSSITE],
  ])('émet une attestation %s → %s dans la transaction et expose son numéro', async (typeDemande, typeAttestation) => {
    const { service, tx, attestations } = monter({ type: typeDemande });

    const resultat: any = await service.marquerPrete('demande-1', {}, user);

    expect(attestations.emettrePourDemandeTx).toHaveBeenCalledWith(tx, {
      type: typeAttestation,
      etudiantId: 'etudiant-1',
      inscriptionId: 'inscription-1',
      motif: 'Bourse',
    }, user);
    expect(tx.demandeDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statut: StatutDemande.PRETE, attestationId: 'att-1' }),
    }));
    expect(resultat.attestation).toEqual(expect.objectContaining({ numero: 'ATT-2026-00001' }));
  });

  it("n'émet pas une seconde attestation pour une demande déjà liée", async () => {
    const { service, tx, attestations } = monter({ type: TypeDemandeDocument.ATTESTATION_SCOLARITE, attestationId: 'att-existante' });

    await service.marquerPrete('demande-1', {}, user);

    expect(attestations.emettrePourDemandeTx).not.toHaveBeenCalled();
    const data = tx.demandeDocument.update.mock.calls[0][0].data;
    expect(data.statut).toBe(StatutDemande.PRETE);
    expect(data).not.toHaveProperty('attestationId');
  });

  it("n'émet rien quand la demande est devenue prête entre-temps (relecture verrouillée)", async () => {
    const { service, tx, attestations } = monter({ type: TypeDemandeDocument.ATTESTATION_SCOLARITE });
    tx.demandeDocument.findUnique.mockResolvedValue({
      id: 'demande-1', statut: StatutDemande.PRETE, type: TypeDemandeDocument.ATTESTATION_SCOLARITE,
    });

    await expect(service.marquerPrete('demande-1', {}, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(attestations.emettrePourDemandeTx).not.toHaveBeenCalled();
    expect(tx.demandeDocument.update).not.toHaveBeenCalled();
  });

  it.each([
    TypeDemandeDocument.RELEVE_NOTES,
    TypeDemandeDocument.ATTESTATION_FREQUENTATION,
    TypeDemandeDocument.DUPLICATA_CARTE,
    TypeDemandeDocument.AUTRE,
  ])('laisse le type %s sans attestation', async (type) => {
    const { service, tx, attestations } = monter({ type });

    await service.marquerPrete('demande-1', {}, user);

    expect(attestations.emettrePourDemandeTx).not.toHaveBeenCalled();
    const data = tx.demandeDocument.update.mock.calls[0][0].data;
    expect(data.statut).toBe(StatutDemande.PRETE);
    expect(data).not.toHaveProperty('attestationId');
  });
});
