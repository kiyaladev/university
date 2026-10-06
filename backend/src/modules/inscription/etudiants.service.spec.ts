import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EtudiantsService } from './etudiants.service';

function creerService(etudiant = { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() }) {
  const prisma = { etudiant } as any;
  return { prisma, service: new EtudiantsService(prisma) };
}

describe('périmètres du registre étudiant', () => {
  it('ne permet à un étudiant de lister que sa propre fiche', async () => {
    const { prisma, service } = creerService();

    await service.listePour({ all: '1' } as any, {}, {
      id: 'user-etudiant', role: Role.ETUDIANT, etudiantId: 'etudiant-1',
    } as any);

    expect(prisma.etudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{}, { id: 'etudiant-1' }] } }),
    );
  });

  it('omet le jeton QR resto des lectures CRUD administratives', async () => {
    const { prisma, service } = creerService();
    prisma.etudiant.findMany.mockResolvedValue([{ id: 'etudiant-1' }]);
    prisma.etudiant.count.mockResolvedValue(1);

    await service.listePour({ all: '1' } as any, {}, {
      id: 'user-scolarite', role: Role.SCOLARITE,
    } as any);
    await service.detailPour('etudiant-1', {
      id: 'user-scolarite', role: Role.SCOLARITE,
    } as any);

    expect(prisma.etudiant.findMany).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ omit: { qrRestoToken: true } }),
    );
    expect(prisma.etudiant.findMany).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ omit: { qrRestoToken: true } }),
    );
  });

  it('limite enseignant et accès direct à ses étudiants encadrés, avec projection réduite', async () => {
    const { prisma, service } = creerService();
    prisma.etudiant.findMany.mockResolvedValue([{ id: 'etudiant-1' }]);

    await service.listePour({ all: '1' } as any, {}, {
      id: 'user-enseignant', role: Role.ENSEIGNANT, enseignantId: 'enseignant-1',
    } as any);
    expect(prisma.etudiant.findMany).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        where: { AND: [{}, { travauxEncadres: { some: { encadrantId: 'enseignant-1' } } }] },
        select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, actif: true },
      }),
    );

    await service.detailPour('etudiant-1', {
      id: 'user-enseignant', role: Role.ENSEIGNANT, enseignantId: 'enseignant-1',
    } as any);
    expect(prisma.etudiant.findMany).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        where: { AND: [{ id: 'etudiant-1' }, { travauxEncadres: { some: { encadrantId: 'enseignant-1' } } }] },
        select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, actif: true },
      }),
    );
  });

  it('masque en 404 la fiche hors département demandée directement par un chef', async () => {
    const { prisma, service } = creerService();
    prisma.etudiant.findMany.mockResolvedValue([]);

    await expect(service.detailPour('etudiant-hors-departement', {
      id: 'user-chef', role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1',
    } as any)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.etudiant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ id: 'etudiant-hors-departement' }, {
          inscriptions: { some: { promotion: { filiere: { departementId: 'dept-1' } } } },
        }] },
        select: expect.objectContaining({ matricule: true, inscriptions: expect.any(Object) }),
      }),
    );
  });

  it('projette la liste et le détail du chef sur les champs de son tableau départemental', async () => {
    const { prisma, service } = creerService();
    prisma.etudiant.findMany.mockResolvedValue([{ id: 'etudiant-1' }]);
    const chef = { id: 'user-chef', role: Role.CHEF_DEPARTEMENT, departementId: 'dept-1' } as any;

    await service.listePour({ all: '1' } as any, {}, chef);
    await service.detailPour('etudiant-1', chef);

    for (const [index, where] of [
      { AND: [{}, { inscriptions: { some: { promotion: { filiere: { departementId: 'dept-1' } } } } }] },
      { AND: [{ id: 'etudiant-1' }, { inscriptions: { some: { promotion: { filiere: { departementId: 'dept-1' } } } } }] },
    ].entries()) {
      expect(prisma.etudiant.findMany).toHaveBeenNthCalledWith(index + 1, expect.objectContaining({
        where,
        select: expect.objectContaining({
          id: true,
          matricule: true,
          telephone: true,
          email: true,
          _count: { select: { inscriptions: true } },
        }),
      }));
      const select = prisma.etudiant.findMany.mock.calls[index][0].select;
      expect(select).not.toHaveProperty('adresse');
      expect(select).not.toHaveProperty('dateNaissance');
      expect(select).not.toHaveProperty('paiements');
    }
  });
});

describe('audit des fiches étudiant', () => {
  it('crée la fiche et son instantané minimisé dans la même transaction', async () => {
    const etudiant = {
      id: 'etu-1', matricule: '2026-0001', nom: 'Diallo', prenom: 'Aïssatou', sexe: 'F', actif: true,
      email: 'private@example.test', telephone: '+224600000000', qrRestoToken: 'qr-secret',
    };
    const tx = {
      etudiant: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(etudiant),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const auditHorsTransaction = jest.fn();
    const prisma: any = {
      auditLog: { create: auditHorsTransaction },
      $transaction: jest.fn((work) => work(tx)),
    };
    const service = new EtudiantsService(prisma);

    await service.creer({ nom: 'Diallo', prenom: 'Aïssatou', sexe: 'F' } as any, { id: 'agent-1' } as any);

    expect(tx.etudiant.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'agent-1', action: 'ETUDIANT_CREE', entite: 'Etudiant', entiteId: 'etu-1',
      details: JSON.stringify({
        avant: null,
        apres: { matricule: '2026-0001', nom: 'Diallo', prenom: 'Aïssatou', sexe: 'F', actif: true },
      }),
    }) });
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('private@example.test');
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('+224600000000');
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('qr-secret');
    expect(auditHorsTransaction).not.toHaveBeenCalled();
  });

  it('journalise avant/après dans la transaction sans coordonnées ni données de compte', async () => {
    const avant = {
      id: 'etu-1', matricule: '2026-0001', nom: 'Diallo', prenom: 'Aïssatou', sexe: 'F', actif: true,
      email: 'private@example.test', telephone: '+224600000000', dateNaissance: new Date('2000-01-01'),
      adresse: 'Adresse privée', qrRestoToken: 'qr-secret', userId: 'user-1',
    };
    const apres = { ...avant, nom: 'Barry', telephone: '+224611111111', dateNaissance: new Date('2001-02-03') };
    const tx = {
      etudiant: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue(apres),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = { $transaction: jest.fn((work) => work(tx)) };
    const service = new EtudiantsService(prisma);

    await service.modifier('etu-1', {
      nom: 'Barry', telephone: '+224611111111', dateNaissance: '2001-02-03',
    } as any, { id: 'agent-1', role: Role.SCOLARITE } as any);

    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details).toEqual({
      avant: { matricule: '2026-0001', nom: 'Diallo', prenom: 'Aïssatou', sexe: 'F', actif: true },
      apres: { matricule: '2026-0001', nom: 'Barry', prenom: 'Aïssatou', sexe: 'F', actif: true },
      champsModifies: ['nom', 'telephone', 'dateNaissance'],
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('private@example.test');
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('+224');
    expect(tx.auditLog.create.mock.calls[0][0].data.details).not.toContain('qr-secret');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('journalise la désactivation avec son état avant/après dans la transaction', async () => {
    const avant = {
      id: 'etu-1', matricule: '2026-0001', nom: 'Diallo', prenom: 'Aïssatou', sexe: 'F', actif: true,
    };
    const tx = {
      etudiant: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue({ ...avant, actif: false }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = { $transaction: jest.fn((work) => work(tx)) };
    const service = new EtudiantsService(prisma);

    await service.remove('etu-1', { id: 'agent-1' } as any);

    const details = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details);
    expect(details.avant.actif).toBe(true);
    expect(details.apres.actif).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
