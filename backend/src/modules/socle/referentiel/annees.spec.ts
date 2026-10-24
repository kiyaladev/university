import { BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AnneesService } from './annees.service';

describe('Clôture des années académiques', () => {
  const user: any = { id: 'admin-1', role: Role.ADMIN };
  function preparer(cloturee = false) {
    const annee = {
      id: 'annee-1',
      libelle: '2025-2026',
      dateDebut: new Date('2025-09-01'),
      dateFin: new Date('2026-08-31'),
      active: true,
      cloturee,
      _count: {
        promotions: 0,
        affectations: 0,
        seances: 0,
        inscriptions: 0,
        paiements: 0,
        evaluations: 0,
        deliberations: 0,
        attestations: 0,
        feuillesPaie: 0,
        frais: 0,
        attributionsLogement: 0,
        statistiquesMesrs: 0,
        examens: 0,
      },
    };
    const tx: any = {
      anneeAcademique: {
        findUnique: jest.fn().mockResolvedValue(annee),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ ...annee, active: false, cloturee: true }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ ...annee, id: 'annee-new', cloturee: false }),
        delete: jest.fn().mockResolvedValue({ id: 'annee-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      anneeAcademique: {
        findUnique: jest.fn().mockResolvedValue(annee),
        update: jest.fn().mockResolvedValue(annee),
        delete: jest.fn().mockResolvedValue({ id: 'annee-1' }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    return { prisma, tx, service: new AnneesService(prisma) };
  }

  it('clôture une année en la désactivant et journalise l’auteur', async () => {
    const { prisma, tx, service } = preparer();
    await service.modifier('annee-1', { cloturee: true }, user);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.anneeAcademique.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'annee-1' },
        data: expect.objectContaining({ cloturee: true, active: false }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: user.id, action: 'ANNEE_ACADEMIQUE_CLOTUREE', entiteId: 'annee-1' }),
      }),
    );
  });

  it('crée une année dans une transaction sérialisable', async () => {
    const { prisma, service } = preparer();
    await service.creer({ libelle: '2026-2027', dateDebut: '2026-09-01', dateFin: '2027-08-31' }, user);
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('refuse la réouverture par le PUT générique', async () => {
    const { tx, service } = preparer(true);
    await expect(service.modifier('annee-1', { cloturee: false }, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.anneeAcademique.update).not.toHaveBeenCalled();
  });

  it('fige les dates et le libellé après clôture', async () => {
    const { tx, service } = preparer(true);
    await expect(service.modifier('annee-1', { dateFin: '2026-09-30' }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.anneeAcademique.update).not.toHaveBeenCalled();
  });

  it('refuse de supprimer une année close avant l’accès Prisma de suppression', async () => {
    const { tx, service } = preparer(true);
    await expect(service.supprimer('annee-1', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.anneeAcademique.delete).not.toHaveBeenCalled();
  });

  it('refuse de supprimer une année ouverte qui porte des données métier', async () => {
    const { prisma, tx, service } = preparer();
    tx.anneeAcademique.findUnique.mockResolvedValue({
      cloturee: false,
      _count: {
        promotions: 1,
        affectations: 0,
        seances: 0,
        inscriptions: 0,
        paiements: 0,
        evaluations: 0,
        deliberations: 0,
        attestations: 0,
        feuillesPaie: 0,
        frais: 0,
        attributionsLogement: 0,
        statistiquesMesrs: 0,
        examens: 0,
      },
    });

    await expect(service.supprimer('annee-1', user)).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.anneeAcademique.delete).not.toHaveBeenCalled();
  });

  it('refuse la suppression si la seule dépendance est un paiement', async () => {
    const { tx, service } = preparer();
    tx.anneeAcademique.findUnique.mockResolvedValue({
      id: 'annee-1',
      libelle: '2025-2026',
      active: false,
      cloturee: false,
      _count: {
        promotions: 0,
        affectations: 0,
        seances: 0,
        inscriptions: 0,
        paiements: 1,
        evaluations: 0,
        deliberations: 0,
        attestations: 0,
        feuillesPaie: 0,
        frais: 0,
        attributionsLogement: 0,
        statistiquesMesrs: 0,
        examens: 0,
      },
    });

    await expect(service.supprimer('annee-1', user)).rejects.toMatchObject({ status: 409 });
    expect(tx.anneeAcademique.delete).not.toHaveBeenCalled();
  });

  it('supprime une année vide et journalise le snapshot dans la transaction', async () => {
    const { prisma, tx, service } = preparer();
    await service.supprimer('annee-1', user);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.anneeAcademique.delete).toHaveBeenCalledWith({ where: { id: 'annee-1' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          action: 'ANNEE_ACADEMIQUE_SUPPRIMEE',
          entiteId: 'annee-1',
        }),
      }),
    );
  });

  it('ignore une valeur cloturee fournie à la création', async () => {
    const { service, tx } = preparer();
    await service.creer(
      { libelle: '2026-2027', dateDebut: '2026-09-01', dateFin: '2027-08-31', cloturee: true } as any,
      user,
    );
    expect(tx.anneeAcademique.create.mock.calls[0][0].data).not.toHaveProperty('cloturee');
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ANNEE_ACADEMIQUE_CREEE', userId: user.id }),
      }),
    );
  });

  it('ne désactive que les autres années encore ouvertes', async () => {
    const { service, tx } = preparer();
    tx.anneeAcademique.findMany.mockResolvedValue([
      {
        id: 'annee-ancienne',
        active: true,
        cloturee: false,
        libelle: '2024-2025',
        dateDebut: new Date('2024-09-01'),
        dateFin: new Date('2025-08-31'),
      },
    ]);

    await service.creer(
      {
        libelle: '2026-2027',
        dateDebut: '2026-09-01',
        dateFin: '2027-08-31',
        active: true,
      } as any,
      user,
    );

    expect(tx.anneeAcademique.findMany).toHaveBeenCalledWith({
      where: { active: true, cloturee: false },
    });
    expect(tx.anneeAcademique.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['annee-ancienne'] }, active: true, cloturee: false },
      data: { active: false },
    });
  });

  it('refuse une période inversée à la création avant toute écriture', async () => {
    const { prisma, tx, service } = preparer();
    await expect(
      service.creer(
        {
          libelle: '2026-2027',
          dateDebut: '2027-09-01',
          dateFin: '2026-08-31',
        } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.anneeAcademique.create).not.toHaveBeenCalled();
  });

  it('refuse de déplacer le début après la fin déjà enregistrée', async () => {
    const { tx, service } = preparer();
    await expect(service.modifier('annee-1', { dateDebut: '2026-09-01' }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.anneeAcademique.update).not.toHaveBeenCalled();
  });

  it('journalise l’état complet avant/après de la clôture', async () => {
    const { service, tx } = preparer();
    await service.modifier('annee-1', { cloturee: true }, user);
    const event = tx.auditLog.create.mock.calls[0][0].data;
    const details = JSON.parse(event.details);
    expect(details.avant).toMatchObject({ active: true, cloturee: false });
    expect(details.apres).toMatchObject({ active: false, cloturee: true });
  });
});
