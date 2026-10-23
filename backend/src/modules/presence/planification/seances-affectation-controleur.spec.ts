import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { SeancesService } from './seances.service';
import { AffecterControleurDto } from './planification.dto';

describe('Affectation des tournées contrôleurs', () => {
  const user = { id: 'scolarite-1', role: Role.SCOLARITE } as any;

  function preparer({ cloturee = false, actif = true, role = Role.CONTROLEUR } = {}) {
    const tx = {
      seance: {
        findUnique: jest.fn().mockResolvedValue({ id: 'seance-1', anneeId: 'annee-1', controleurAssigneId: null }),
        update: jest.fn().mockResolvedValue({ id: 'seance-1', controleurAssigneId: 'ctrl-1' }),
      },
      anneeAcademique: { findUnique: jest.fn().mockResolvedValue({ cloturee }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'ctrl-1', role, actif }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      seance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'seance-1',
          anneeId: 'annee-1',
          controleurAssigneId: null,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ctrl-1',
          nom: 'Diallo',
          prenom: 'Aminata',
          role,
          actif,
        }),
      },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    return { service: new SeancesService(prisma), prisma, tx };
  }

  it('attribue la séance et journalise le nouvel acteur attendu', async () => {
    const { service, prisma, tx } = preparer();
    await service.affecterControleur('seance-1', { controleurId: 'ctrl-1' }, user);

    expect(tx.seance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seance-1' },
        data: { controleurAssigneId: 'ctrl-1' },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          action: 'CONTROLEUR_AFFECTE_SEANCE',
          entiteId: 'seance-1',
          details: JSON.stringify({ avant: { controleurAssigneId: null }, apres: { controleurAssigneId: 'ctrl-1' } }),
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuse un compte qui n’est pas un contrôleur actif', async () => {
    const { service, prisma } = preparer({ actif: false });
    await expect(service.affecterControleur('seance-1', { controleurId: 'ctrl-1' }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuse de changer la tournée d’une année clôturée', async () => {
    const { service, prisma } = preparer({ cloturee: true });
    await expect(service.affecterControleur('seance-1', { controleurId: 'ctrl-1' }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('laisse le service produire son erreur lisible si le champ est absent', async () => {
    const { service, prisma } = preparer();
    const dto = new AffecterControleurDto();
    expect(await validate(dto)).toHaveLength(0);
    await expect(service.affecterControleur('seance-1', dto, user)).rejects.toThrow(
      'Choisissez un contrôleur ou envoyez null pour retirer l’affectation.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
