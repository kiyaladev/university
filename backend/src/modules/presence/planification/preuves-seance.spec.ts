import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SeancesService } from './seances.service';
import { AffectationsService } from '../../socle/referentiel/affectations.service';
import { includeDemandePour } from '../../documents/documents-demande/documents-demande.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => undefined } }));

/**
 * Contrôles et justificatifs sont la preuve opposable du service fait et la
 * base de la paie : Controle/Justificatif -> Seance et Seance -> Affectation
 * sont en RESTRICT, et les services refusent explicitement (409).
 */
describe('Suppression d’une séance pointée', () => {
  function monter(preuves: { controle: unknown; justificatif: unknown }) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
      seance: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'seance-1', anneeId: 'annee-1', affectationId: 'aff-1' })
          .mockResolvedValueOnce(preuves),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const service = new SeancesService({ $transaction: (fn: any) => fn(tx) } as any);
    return { tx, service };
  }

  it.each([
    ['un contrôle', { controle: { id: 'c-1' }, justificatif: null }],
    ['un justificatif', { controle: null, justificatif: { id: 'j-1' } }],
  ])('refuse en 409 une séance qui porte %s', async (_libelle, preuves) => {
    const { tx, service } = monter(preuves);
    const erreur = await service.remove('seance-1', { id: 'admin' } as any).catch((e) => e);
    expect(erreur).toBeInstanceOf(ConflictException);
    expect(erreur.message).toContain('preuve de service');
    expect(tx.seance.delete).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('supprime une séance seulement planifiée', async () => {
    const { tx, service } = monter({ controle: null, justificatif: null });
    await expect(service.remove('seance-1', { id: 'admin' } as any)).resolves.toEqual({ id: 'seance-1' });
    expect(tx.seance.delete).toHaveBeenCalledWith({ where: { id: 'seance-1' } });
  });
});

describe('Suppression d’une affectation', () => {
  function monter(pointees: number) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]),
      affectation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'aff-1', anneeId: 'annee-1' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      seance: {
        count: jest.fn().mockResolvedValue(pointees),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $transaction: (fn: any) => fn(tx),
    };
    const service = new AffectationsService(prisma as any);
    jest.spyOn(service, 'lire').mockResolvedValue({ id: 'aff-1', anneeId: 'annee-1' } as any);
    return { tx, service };
  }

  it('refuse en 409 tant qu’une séance porte un contrôle ou un justificatif', async () => {
    const { tx, service } = monter(2);
    const erreur = await service.supprimer('aff-1', { id: 'admin' } as any).catch((e) => e);
    expect(erreur).toBeInstanceOf(ConflictException);
    expect(erreur.message).toContain('2 séance(s)');
    expect(tx.seance.count).toHaveBeenCalledWith({
      where: { affectationId: 'aff-1', OR: [{ controle: { isNot: null } }, { justificatif: { isNot: null } }] },
    });
    expect(tx.seance.deleteMany).not.toHaveBeenCalled();
    expect(tx.affectation.delete).not.toHaveBeenCalled();
  });

  it('efface explicitement les séances sans preuve puis l’affectation', async () => {
    const { tx, service } = monter(0);
    await expect(service.supprimer('aff-1', { id: 'admin' } as any)).resolves.toEqual({ id: 'aff-1' });
    expect(tx.seance.deleteMany).toHaveBeenCalledWith({
      where: { affectationId: 'aff-1', controle: { is: null }, justificatif: { is: null } },
    });
    expect(tx.affectation.delete).toHaveBeenCalledWith({ where: { id: 'aff-1' } });
    expect(JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details).seancesSupprimees).toBe(3);
  });
});

describe('Jeton de vérification d’attestation dans une demande de document', () => {
  it.each([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE])(
    'expose qrToken à %s, comme le registre des attestations',
    (role) => {
      expect((includeDemandePour({ role }).attestation.select as any).qrToken).toBe(true);
    },
  );

  it.each([Role.ETUDIANT, Role.ENSEIGNANT, Role.CONTROLEUR])('ne l’expose pas à %s', (role) => {
    const select = includeDemandePour({ role }).attestation.select as any;
    expect(select.qrToken).toBeUndefined();
    expect(select.numero).toBe(true);
  });
});
