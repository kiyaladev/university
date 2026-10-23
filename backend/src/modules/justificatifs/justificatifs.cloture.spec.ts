import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JustificatifsService } from './justificatifs.service';

describe('Mutations atomiques des justificatifs', () => {
  const admin: any = { id: 'admin-1', role: Role.ADMIN };
  const dto: any = { seanceId: 'seance-1', type: 'MALADIE', motif: 'donnée médicale privée', piece: 'secret' };
  const verrouAnnee = (cloturee: boolean) => jest.fn().mockResolvedValue([{ cloturee }]);

  it.each(['VALIDE', 'REJETE'])('conserve une décision %s et refuse un nouveau traitement', async (statut) => {
    const avant = { id: 'just-1', statut, seance: { anneeId: 'year-1' } };
    const tx: any = {
      justificatif: { findUnique: jest.fn().mockResolvedValue(avant), updateMany: jest.fn() },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $queryRaw: verrouAnnee(false),
      controle: { upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      justificatif: { findFirst: jest.fn().mockResolvedValue(avant) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    await expect(
      new JustificatifsService(prisma).traiter('just-1', { statut: 'REJETE' } as any, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.justificatif.updateMany).not.toHaveBeenCalled();
    expect(tx.controle.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse de supprimer la preuve d’une absence déjà excusée', async () => {
    const tx: any = {
      justificatif: {
        findUnique: jest.fn().mockResolvedValue({ id: 'just-1', statut: 'VALIDE', seance: { anneeId: 'year-1' } }),
        delete: jest.fn(),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $queryRaw: verrouAnnee(false),
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    await expect(new JustificatifsService(prisma).remove('just-1', admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.justificatif.delete).not.toHaveBeenCalled();
  });

  it('refuse EN_ATTENTE comme décision de traitement', async () => {
    const prisma: any = {
      justificatif: { findFirst: jest.fn().mockResolvedValue({ id: 'just-1' }) },
      $transaction: jest.fn(),
    };
    await expect(
      new JustificatifsService(prisma).traiter('just-1', { statut: 'EN_ATTENTE' } as any, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('masque la pièce dans la réponse de dépôt du chef', async () => {
    const seance = { anneeId: 'year-1', affectation: { enseignantId: 'ens-1' } };
    const tx: any = {
      seance: { findFirst: jest.fn().mockResolvedValue(seance) },
      justificatif: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'just-1' }),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $queryRaw: verrouAnnee(false),
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      seance: { findFirst: jest.fn().mockResolvedValue(seance) },
      justificatif: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    await new JustificatifsService(prisma).deposer(dto, {
      id: 'chef',
      role: Role.CHEF_DEPARTEMENT,
      departementId: 'dep-1',
    } as any);
    const selection = tx.justificatif.create.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty('piece');
    expect(selection.enseignant.select).not.toHaveProperty('telephone');
  });

  it('refuse le dépôt si la séance appartient à une année clôturée', async () => {
    const tx: any = {
      seance: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'seance-1', anneeId: 'year-1', affectation: { enseignantId: 'ens-1' } }),
      },
      justificatif: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      $queryRaw: verrouAnnee(true),
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      seance: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'seance-1', anneeId: 'year-1', affectation: { enseignantId: 'ens-1' } }),
      },
      justificatif: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((operation: any) => operation(tx)),
    };
    const service = new JustificatifsService(prisma);

    await expect(service.deposer(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.justificatif.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('crée et journalise atomiquement sans motif médical ni pièce dans le journal', async () => {
    const created = {
      id: 'just-1',
      seanceId: 'seance-1',
      enseignantId: 'ens-1',
      type: 'MALADIE',
      statut: 'EN_ATTENTE',
      piece: 'secret',
      motif: 'donnée médicale privée',
    };
    const tx: any = {
      seance: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'seance-1', anneeId: 'year-1', affectation: { enseignantId: 'ens-1' } }),
      },
      justificatif: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: false }) },
      $queryRaw: verrouAnnee(false),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      seance: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'seance-1', anneeId: 'year-1', affectation: { enseignantId: 'ens-1' } }),
      },
      justificatif: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((operation: any) => operation(tx)),
    };
    const service = new JustificatifsService(prisma);

    await service.deposer(dto, admin);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.justificatif.create).toHaveBeenCalledTimes(1);
    const details = tx.auditLog.create.mock.calls[0][0].data.details;
    expect(details).not.toContain('donnée médicale privée');
    expect(details).not.toContain('secret');
    expect(JSON.parse(details)).toMatchObject({ apres: { id: 'just-1', seanceId: 'seance-1' } });
  });

  it('refuse le traitement après clôture avant de changer le contrôle', async () => {
    const avant = {
      id: 'just-1',
      seanceId: 'seance-1',
      enseignantId: 'ens-1',
      type: 'MALADIE',
      motif: 'privé',
      statut: 'EN_ATTENTE',
      seance: { id: 'seance-1', anneeId: 'year-1' },
    };
    const tx: any = {
      justificatif: { findUnique: jest.fn().mockResolvedValue(avant), update: jest.fn() },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      $queryRaw: verrouAnnee(true),
      controle: { upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      justificatif: { findFirst: jest.fn().mockResolvedValue(avant) },
      $transaction: jest.fn((operation: any) => operation(tx)),
    };
    const service = new JustificatifsService(prisma);

    await expect(service.traiter('just-1', { statut: 'VALIDE' } as any, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.justificatif.update).not.toHaveBeenCalled();
    expect(tx.controle.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuse aussi la suppression après clôture', async () => {
    const tx: any = {
      justificatif: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'just-1',
          seanceId: 'seance-1',
          type: 'MALADIE',
          statut: 'EN_ATTENTE',
          seance: { id: 'seance-1', anneeId: 'year-1' },
        }),
        delete: jest.fn(),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee: true }) },
      $queryRaw: verrouAnnee(true),
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((operation: any) => operation(tx)) };
    const service = new JustificatifsService(prisma);

    await expect(service.remove('just-1', admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(tx.justificatif.delete).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
