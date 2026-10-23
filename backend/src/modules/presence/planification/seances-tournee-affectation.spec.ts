import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SeancesService } from './seances.service';

describe('Affectation groupée d’une tournée', () => {
  const dto = {
    dateDebut: '2026-10-01',
    dateFin: '2026-10-07',
    controleurId: 'ctrl-1',
    departementId: 'dep-1',
  };
  const user = { id: 'scolarite-1', role: Role.SCOLARITE } as any;

  function preparer() {
    const candidates = [
      { id: 'session-open-1', anneeId: 'year-open', annee: { cloturee: false } },
      { id: 'session-open-2', anneeId: 'year-open', annee: { cloturee: false } },
      { id: 'session-closed', anneeId: 'year-closed', annee: { cloturee: true } },
    ];
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'ctrl-1', role: Role.CONTROLEUR, actif: true }) },
      seance: {
        findMany: jest.fn().mockResolvedValue(candidates),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      anneeAcademique: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve({ cloturee: where.id === 'year-closed' })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'ctrl-1', role: Role.CONTROLEUR, actif: true }) },
      seance: { findMany: jest.fn().mockResolvedValue(candidates) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    return { service: new SeancesService(prisma), prisma, tx };
  }

  it('prévisualise les séances ouvertes et celles qu’une clôture exclut', async () => {
    const { service, prisma } = preparer();
    await expect(service.apercuTournee(dto)).resolves.toEqual({
      seancesSansAffectation: 3,
      seancesAffectables: 2,
      ignoreesAnneeCloturee: 1,
    });
    expect(prisma.seance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          controleurAssigneId: null,
          affectation: { enseignant: { departementId: 'dep-1' } },
        }),
      }),
    );
  });

  it('n’affecte que les séances ouvertes, conserve celles déjà attribuées et journalise le lot', async () => {
    const { service, tx } = preparer();
    const resultat = await service.affecterTournee(dto, user);

    expect(tx.seance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['session-open-1', 'session-open-2'] }, controleurAssigneId: null }),
        data: { controleurAssigneId: 'ctrl-1' },
      }),
    );
    expect(resultat).toEqual({
      seancesAffectees: 1,
      seancesIgnoreesAnneeCloturee: 1,
      seancesDejaAffecteesOuAbsentes: 1,
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          action: 'TOURNEE_CONTROLEUR_AFFECTEE',
          details: expect.stringContaining('"seancesAffectees":1'),
        }),
      }),
    );
  });

  it('refuse une période inversée avant toute lecture des séances', async () => {
    const { service, prisma } = preparer();
    await expect(service.apercuTournee({ ...dto, dateDebut: '2026-10-08' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.seance.findMany).not.toHaveBeenCalled();
  });

  it('ne masque pas une année académique manquante comme si elle était clôturée', async () => {
    const { service, tx } = preparer();
    tx.anneeAcademique.findUnique.mockResolvedValue(null as any);

    await expect(service.affecterTournee(dto, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.seance.updateMany).not.toHaveBeenCalled();
  });
});
