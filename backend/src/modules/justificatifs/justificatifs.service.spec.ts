import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import { JustificatifsService } from './justificatifs.service';

describe('Périmètre des justificatifs', () => {
  const enseignant = { role: Role.ENSEIGNANT, enseignantId: 'ens-1', departementId: null } as any;
  function preparer() {
    const prisma = {
      seance: { findFirst: jest.fn().mockResolvedValue({ affectation: { enseignantId: 'ens-1' } }) },
      justificatif: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'just-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    return { service: new JustificatifsService(prisma as any), prisma };
  }

  it('borne la liste et retire la pièce jointe pour un enseignant', async () => {
    const { service, prisma } = preparer();
    await service.liste({ all: '1' } as any, enseignant);
    expect(prisma.justificatif.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({
      where: { enseignantId: 'ens-1' },
      select: expect.not.objectContaining({ piece: true }),
    }));
    expect(prisma.justificatif.findMany.mock.calls[0][0].select.seance).toEqual({
      select: expect.objectContaining({ date: true, heureDebut: true, heureFin: true }),
    });
  });

  it('exclut la pièce volumineuse du registre de gestion tout en gardant le détail dédié', async () => {
    const { service, prisma } = preparer();
    await service.liste({ pageSize: 50 } as any, { role: Role.SCOLARITE } as any);

    expect(prisma.justificatif.findMany.mock.calls[0][0].omit).toEqual({ piece: true });

    await service.findOnePour('just-1', { role: Role.SCOLARITE } as any);
    expect(prisma.justificatif.findFirst.mock.calls[0][0].include).toBeDefined();
    expect(prisma.justificatif.findFirst.mock.calls[0][0]).not.toHaveProperty('omit');
  });

  it('borne aussi le détail par enseignant et ne sélectionne pas la pièce', async () => {
    const { service, prisma } = preparer();
    await service.findOnePour('just-1', enseignant);
    expect(prisma.justificatif.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'just-1', enseignantId: 'ens-1' },
      select: expect.not.objectContaining({ piece: true }),
    }));
  });

  it('masque un justificatif appartenant à un autre enseignant', async () => {
    const { service, prisma } = preparer();
    prisma.justificatif.findFirst.mockResolvedValue(null);
    await expect(service.findOnePour('foreign', enseignant)).rejects.toThrow(NotFoundException);
    expect(prisma.justificatif.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign', enseignantId: 'ens-1' },
    }));
  });

  it('ignore le département demandé par un chef et borne sa liste à son profil', async () => {
    const { service, prisma } = preparer();
    await service.liste({ departementId: 'dept-other' } as any, {
      role: Role.CHEF_DEPARTEMENT,
      departementId: 'dept-own',
      enseignantId: null,
    } as any);
    expect(prisma.justificatif.findMany.mock.calls[0][0].where.seance.affectation.promotion.filiere)
      .toEqual({ departementId: 'dept-own' });
    expect(prisma.justificatif.findMany.mock.calls[0][0].where.enseignant).toBeUndefined();
  });

  it('borne aussi l’accès direct du chef par le département du cours', async () => {
    const { service, prisma } = preparer();
    await service.findOnePour('justificatif-1', {
      role: Role.CHEF_DEPARTEMENT, departementId: 'dept-own', enseignantId: null,
    } as any);
    expect(prisma.justificatif.findFirst.mock.calls[0][0].where).toMatchObject({
      seance: { affectation: { promotion: { filiere: { departementId: 'dept-own' } } } },
    });
  });

  it('ne renvoie pas la pièce jointe médicale au chef de département', async () => {
    const { service, prisma } = preparer();
    const chef = { role: Role.CHEF_DEPARTEMENT, departementId: 'dept-own', enseignantId: null } as any;
    await service.liste({ all: '1' } as any, chef);
    expect(prisma.justificatif.findMany.mock.calls[0][0].select).toEqual(
      expect.not.objectContaining({ piece: true }),
    );

    await service.findOnePour('just-1', chef);
    expect(prisma.justificatif.findFirst.mock.calls[0][0].select).toEqual(
      expect.not.objectContaining({ piece: true }),
    );
  });

  it('n’inclut que l’identité utile de l’enseignant dans le registre du personnel', async () => {
    const { service, prisma } = preparer();
    await service.liste({ all: '1' } as any, { role: Role.SCOLARITE } as any);
    const enseignantSelect = prisma.justificatif.findMany.mock.calls[0][0].include.enseignant.select;

    expect(enseignantSelect).toEqual({
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      departement: { select: { id: true, code: true, nom: true } },
    });
    for (const champ of ['telephone', 'email', 'tauxHoraire', 'empreinteDoigt', 'empreinteConsentementLe']) {
      expect(enseignantSelect).not.toHaveProperty(champ);
    }
  });

  it('borne la séance d’un dépôt par le département du chef', async () => {
    const contexte = jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Séance introuvable' } as any);
    const { service, prisma } = preparer();
    prisma.seance.findFirst.mockResolvedValue(null);
    await expect(service.deposer({ seanceId: 'session-other', type: 'MALADIE', motif: 'motif' } as any, {
      role: Role.CHEF_DEPARTEMENT, id: 'chef-1', departementId: 'dept-own', enseignantId: null,
    } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.seance.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'session-other',
        affectation: { promotion: { filiere: { departementId: 'dept-own' } } },
      },
    }));
    contexte.mockRestore();
  });

  it('compare bien la fiche d’un enseignant à son profil sur un dépôt direct', async () => {
    const { service, prisma } = preparer();
    prisma.seance.findFirst.mockResolvedValue({ affectation: { enseignantId: 'ens-autre' } });
    await expect(service.deposer({ seanceId: 'seance-1', type: 'MALADIE', motif: 'motif' } as any, {
      role: Role.ENSEIGNANT, id: 'user-1', enseignantId: 'ens-1', departementId: null,
    } as any)).rejects.toThrow();
  });

  it('fournit une erreur métier de repli hors contexte HTTP', async () => {
    const { service, prisma } = preparer();
    prisma.seance.findFirst.mockResolvedValue(null);
    await expect(service.deposer({ seanceId: 'absente', type: 'MALADIE', motif: 'motif' } as any, {
      role: Role.ADMIN, id: 'admin-1', enseignantId: null, departementId: null,
    } as any)).rejects.toThrow(/introuvable/i);
  });

  it('ne laisse pas un chef traiter un justificatif hors de son département', async () => {
    const { service, prisma } = preparer();
    prisma.justificatif.findFirst.mockResolvedValue(null);
    await expect(service.traiter('foreign', { statut: 'VALIDE' } as any, {
      role: Role.CHEF_DEPARTEMENT, id: 'chef-1', departementId: 'dept-own', enseignantId: null,
    } as any)).rejects.toThrow(NotFoundException);
    expect(prisma.justificatif.update).not.toHaveBeenCalled();
  });
});
