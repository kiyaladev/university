import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { ReclamationsService } from './reclamations.service';

function lierTransaction(prisma: any) {
  prisma.$transaction = jest.fn(async (operation: (tx: any) => unknown) =>
    operation({
      reclamation: prisma.reclamation,
      messageReclamation: prisma.messageReclamation,
      user: prisma.user,
      auditLog: prisma.auditLog ?? { create: jest.fn() },
    }),
  );
}

describe('Périmètre des lectures de réclamations', () => {
  const etudiant = { id: 'user-1', role: Role.ETUDIANT, etudiantId: 'etudiant-1' } as any;

  it('borne la liste étudiant à son profil et omet les notes internes dans Prisma', async () => {
    const ligne = { id: 'rec-1', etudiantId: 'etudiant-1', sujet: 'Bourse' };
    const prisma = {
      reclamation: {
        findMany: jest.fn().mockResolvedValue([ligne]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new ReclamationsService(prisma as any);

    const result = await service.mesReclamations({}, etudiant);

    expect(prisma.reclamation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ etudiantId: 'etudiant-1' }, { anonyme: true, createurId: 'user-1' }],
        },
        omit: { createurId: true, notes: true },
      }),
    );
    expect(result.data).toEqual([ligne]);
    expect(result.data[0]).not.toHaveProperty('notes');
    expect(prisma.reclamation.findMany.mock.calls[0][0].include.messages).toBeUndefined();
  });

  it('retourne le même NotFound pour une réclamation inexistante ou appartenant à un tiers', async () => {
    const notFound = new NotFoundException('Réclamation introuvable');
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Réclamation introuvable',
    } as any);
    const prisma = {
      reclamation: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      },
    };
    const service = new ReclamationsService(prisma as any);

    await expect(service.findOnePour('absente', etudiant)).rejects.toMatchObject({
      status: notFound.getStatus(),
    });
    await expect(service.findOnePour('rec-autre', etudiant)).rejects.toMatchObject({
      status: notFound.getStatus(),
    });
    expect(prisma.reclamation.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          id: 'absente',
          OR: [{ etudiantId: 'etudiant-1' }, { anonyme: true, createurId: 'user-1' }],
        },
        omit: { createurId: true, notes: true },
        include: expect.objectContaining({ messages: expect.objectContaining({ take: 20 }) }),
      }),
    );
    expect(prisma.reclamation.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: 'rec-autre',
          OR: [{ etudiantId: 'etudiant-1' }, { anonyme: true, createurId: 'user-1' }],
        },
        omit: { createurId: true, notes: true },
        include: expect.objectContaining({ messages: expect.objectContaining({ take: 20 }) }),
      }),
    );
    contexte.mockRestore();
  });

  it('ne laisse pas un profil sans identifiant étudiant lire une réclamation sans propriétaire', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Réclamation introuvable',
    } as any);
    const prisma = { reclamation: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ReclamationsService(prisma as any);
    await expect(service.findOnePour('rec-1', { role: Role.ENSEIGNANT, etudiantId: null } as any)).rejects.toThrow(
      NotFoundException,
    );
    contexte.mockRestore();
  });

  it('garde le périmètre étudiant quand une recherche est ajoutée', async () => {
    const prisma = {
      reclamation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    await new ReclamationsService(prisma as any).mesReclamations({ search: 'bourse' } as any, etudiant);
    const where = prisma.reclamation.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual([{ etudiantId: 'etudiant-1' }, { anonyme: true, createurId: 'user-1' }]);
    expect(where.AND[1].OR[0]).toEqual({ numero: { contains: 'bourse', mode: 'insensitive' } });
  });

  it('permet à l’auteur de retrouver son fil anonyme sans révéler son compte', async () => {
    const anonyme = {
      id: 'rec-anonyme',
      anonyme: true,
      etudiantId: null,
      statut: 'OUVERT',
      messages: [],
    };
    const prisma = { reclamation: { findFirst: jest.fn().mockResolvedValue(anonyme) } };
    const result = await new ReclamationsService(prisma as any).findOnePour('rec-anonyme', etudiant);
    expect(result).toEqual(anonyme);
    expect(prisma.reclamation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'rec-anonyme',
          OR: [{ etudiantId: 'etudiant-1' }, { anonyme: true, createurId: 'user-1' }],
        },
        omit: { createurId: true, notes: true },
        include: expect.objectContaining({ messages: expect.objectContaining({ take: 20 }) }),
      }),
    );
  });

  it('garde l’auteur anonyme lors d’une réponse au fil', async () => {
    const reclamation = { id: 'rec-anonyme', numero: 'REC-2026-00001', anonyme: true, statut: 'OUVERT' };
    const prisma: any = {
      reclamation: { findFirst: jest.fn().mockResolvedValue(reclamation) },
      messageReclamation: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    // Le message et sa trace d'audit partagent la transaction : le leurre
    // n'exécute que le message, le journal avant/après est vérifié dans
    // reclamations.audit.spec.ts.
    lierTransaction(prisma);

    await new ReclamationsService(prisma as any).posterMessage('rec-anonyme', { contenu: 'Suivi' }, etudiant);
    expect(prisma.messageReclamation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reclamationId: 'rec-anonyme', auteurId: null, nomAffichage: 'Anonyme' }),
      }),
    );
  });

  it('refuse un message au-delà du plafond et ne l’enregistre pas', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Limite atteinte',
    } as any);
    const prisma = {
      reclamation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rec-1',
          numero: 'REC-2026-00001',
          anonyme: false,
          statut: 'OUVERT',
        }),
      },
      messageReclamation: {
        count: jest.fn().mockResolvedValue(100),
        create: jest.fn(),
      },
    };
    lierTransaction(prisma);
    await expect(
      new ReclamationsService(prisma as any).posterMessage('rec-1', { contenu: 'Encore un message' }, etudiant),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.messageReclamation.create).not.toHaveBeenCalled();
    contexte.mockRestore();
  });

  it('refuse une transition directe hors du cycle prévu', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Transition non autorisée',
    } as any);
    const prisma = {
      reclamation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rec-1',
          statut: 'OUVERT',
          notes: null,
        }),
        update: jest.fn(),
      },
    };
    lierTransaction(prisma);
    const service = new ReclamationsService(prisma as any);

    await expect(
      service.changerStatut(
        'rec-1',
        { statut: 'RESOLU', commentaire: 'Décision' } as any,
        { id: 'agent-1', role: Role.ADMIN } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reclamation.update).not.toHaveBeenCalled();
    contexte.mockRestore();
  });

  it('interdit de réouvrir une réclamation terminale', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Transition non autorisée',
    } as any);
    const prisma = {
      reclamation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rec-1',
          statut: 'RESOLU',
          notes: null,
        }),
        update: jest.fn(),
      },
    };
    lierTransaction(prisma);
    const service = new ReclamationsService(prisma as any);

    await expect(
      service.changerStatut('rec-1', { statut: 'EN_COURS' } as any, { id: 'agent-1', role: Role.ADMIN } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reclamation.update).not.toHaveBeenCalled();
    contexte.mockRestore();
  });

  it('n’assigne qu’à un agent actif de rôle autorisé', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Utilisateur introuvable',
    } as any);
    const prisma = {
      reclamation: { findUnique: jest.fn().mockResolvedValue({ id: 'rec-1', statut: 'OUVERT' }) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    lierTransaction(prisma);
    const service = new ReclamationsService(prisma as any);

    await expect(
      service.assigner('rec-1', { assigneAId: 'compte-inactif' }, { id: 'agent-1', role: Role.ADMIN } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'compte-inactif',
        actif: true,
        role: { in: [Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT] },
      },
      select: { id: true, nom: true, prenom: true },
    });
    contexte.mockRestore();
  });

  it('interdit de réassigner une réclamation close', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({
      t: () => 'Réclamation close',
    } as any);
    const prisma = {
      reclamation: { findUnique: jest.fn().mockResolvedValue({ id: 'rec-1', statut: 'RESOLU' }) },
      user: { findFirst: jest.fn() },
    };
    lierTransaction(prisma);
    const service = new ReclamationsService(prisma as any);

    await expect(
      service.assigner('rec-1', { assigneAId: 'agent-2' }, { id: 'agent-1', role: Role.ADMIN } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    contexte.mockRestore();
  });
});
