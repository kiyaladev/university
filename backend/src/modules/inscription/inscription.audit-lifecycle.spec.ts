import { BadRequestException } from '@nestjs/common';
import { Role, StatutInscription } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { InscriptionService } from './inscription.service';

describe('Audit des transitions d’inscription', () => {
  it('journalise avant/après dans la transaction sans recopier les coordonnées', async () => {
    const avant = {
      id: 'ins-1',
      numero: 'INS-2026-00001',
      etudiantId: 'etu-1',
      anneeId: 'annee-1',
      promotionId: 'promo-1',
      statut: StatutInscription.PAYEE,
      montantFrais: 250000,
      etudiant: { nom: 'Diallo', prenom: 'Aïssatou', telephone: '+224600000000', email: 'private@example.test' },
      promotion: { filiere: { departementId: 'dep-1' } },
    };
    const apres = { ...avant, statut: StatutInscription.VALIDEE };
    const tx = {
      inscription: { update: jest.fn().mockResolvedValue(apres) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
    };
    const prisma: any = {
      inscription: { findUnique: jest.fn().mockResolvedValue(avant) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $transaction: jest.fn((work) => work(tx)),
    };
    const service = new InscriptionService(prisma, {} as any, {} as any, {} as any);
    const user = { id: 'agent-1', role: Role.SCOLARITE } as AuthUser;

    await service.validerInscription('ins-1', user);

    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details).toEqual({
      avant: expect.objectContaining({ statut: StatutInscription.PAYEE, montantFrais: 250000 }),
      apres: expect.objectContaining({ statut: StatutInscription.VALIDEE, montantFrais: 250000 }),
    });
    expect(tx.auditLog.create.mock.calls[0][0].data).not.toHaveProperty('telephone');
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('private@example.test');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuse la validation d’un dossier rattaché à une année close', async () => {
    const avant = {
      id: 'ins-closed', numero: 'INS-2024-00001', etudiantId: 'etu-1', anneeId: 'annee-close',
      promotionId: 'promo-1', statut: StatutInscription.PAYEE, montantFrais: 250000,
      etudiant: { nom: 'Diallo', prenom: 'Aïssatou' }, promotion: { filiere: { departementId: 'dep-1' } },
    };
    const tx = {
      inscription: { update: jest.fn() },
      auditLog: { create: jest.fn() },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
    };
    const prisma: any = {
      inscription: { findUnique: jest.fn().mockResolvedValue(avant) },
      $transaction: jest.fn((work) => work(tx)),
    };
    const service = new InscriptionService(prisma, {} as any, {} as any, {} as any);

    await expect(service.validerInscription('ins-closed', { id: 'agent-1', role: Role.SCOLARITE } as AuthUser))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inscription.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
