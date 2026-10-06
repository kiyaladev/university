import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BibliothequeService } from './bibliotheque.service';

describe('Audit transactionnel du dépôt documentaire', () => {
  const user = { id: 'user-1', role: Role.ADMIN } as any;

  it('trace un dépôt sans inclure le titre, le fichier, les textes libres ou les identités liées', async () => {
    const cree = {
      id: 'doc-1', titre: 'Sujet confidentiel', type: 'THESE', public: true,
      anneeEdition: 2025, typeMime: 'application/pdf', tailleKo: 1,
      contenuTexte: 'texte extrait privé', empreinteHash: 'hash-prive',
      motsClefs: ['secret'], etudiantId: 'student-1', enseignantId: 'teacher-1',
      departementId: 'dept-1',
    };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx: any = {
      documentDepot: { create: jest.fn().mockResolvedValue(cree) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const plagiat: any = {
      preparerContenu: jest.fn().mockResolvedValue({ contenuTexte: null, empreinteHash: null }),
      detecterSilencieusement: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BibliothequeService(prisma, plagiat);

    await service.deposer({ titre: cree.titre } as any, user);

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const trace = auditCreate.mock.calls[0][0].data;
    expect(trace).toMatchObject({ userId: user.id, action: 'DOCUMENT_DEPOT_CREE', entiteId: 'doc-1' });
    expect(trace.details).not.toContain(cree.titre);
    expect(trace.details).not.toContain('student-1');
    expect(trace.details).not.toContain('teacher-1');
    expect(trace.details).not.toContain('hash-prive');
    expect(JSON.parse(trace.details).apres).toMatchObject({ type: 'THESE', public: true, fichierPresent: true });
  });

  it('trace la suppression dans la même transaction avec un instantané minimisé', async () => {
    const document = {
      id: 'doc-2', deposeParId: user.id, titre: 'Titre privé', public: false,
      type: 'MEMOIRE', anneeEdition: 2024, fichier: 'fichier privé', tailleKo: 42,
      contenuTexte: 'contenu privé', empreinteHash: 'hash privé',
      motsClefs: ['mot privé'], etudiantId: 'student-secret', enseignantId: null,
      departementId: null,
    };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const tx: any = {
      documentDepot: {
        findUnique: jest.fn().mockResolvedValue(document),
        delete: jest.fn().mockResolvedValue({ id: document.id }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new BibliothequeService(prisma, {
      detecterSilencieusement: jest.fn().mockResolvedValue(null),
    } as any);

    await expect(service.supprimer(document.id, user)).resolves.toEqual({ id: document.id });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.documentDepot.delete).toHaveBeenCalledWith({ where: { id: document.id } });
    const details = auditCreate.mock.calls[0][0].data.details;
    for (const prive of ['Titre privé', 'fichier privé', 'contenu privé', 'hash privé', 'mot privé', 'student-secret']) {
      expect(details).not.toContain(prive);
    }
    expect(JSON.parse(details)).toMatchObject({ avant: { type: 'MEMOIRE', fichierPresent: true }, apres: null });
  });

  it('journalise une modification partielle et conserve le fichier et son index', async () => {
    const avant = {
      id: 'doc-3', deposeParId: 'staff-1', titre: 'Titre original',
      type: 'ARTICLE', public: true, anneeEdition: 2023,
      typeMime: 'application/pdf', tailleKo: 84, contenuTexte: 'index privé',
      empreinteHash: 'empreinte privée', motsClefs: ['mot'],
      departementId: 'dept-1', enseignantId: null, etudiantId: null,
    };
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const maj = { ...avant, titre: 'Titre corrigé' };
    const tx: any = {
      documentDepot: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue(maj),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new BibliothequeService(prisma, {
      detecterSilencieusement: jest.fn().mockResolvedValue(null),
    } as any);

    await service.modifier(avant.id, { titre: maj.titre } as any, { id: 'staff-1', role: Role.SCOLARITE } as any);

    const update = tx.documentDepot.update.mock.calls[0][0];
    expect(update.data).not.toHaveProperty('typeMime');
    expect(update.data).not.toHaveProperty('tailleKo');
    expect(update.data).toMatchObject({ contenuTexte: 'index privé', empreinteHash: 'empreinte privée' });
    expect(tx.documentDepot.findUnique.mock.calls[0][0].select).not.toHaveProperty('fichier');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(auditCreate.mock.calls[0][0].data.action).toBe('DOCUMENT_DEPOT_MODIFIE');
    expect(auditCreate.mock.calls[0][0].data.details).not.toContain('Titre corrigé');
  });

  it('refuse la modification d’un document tiers sans mutation ni audit', async () => {
    const tx: any = {
      documentDepot: {
        findUnique: jest.fn().mockResolvedValue({ id: 'doc-4', deposeParId: 'autre' }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const service = new BibliothequeService(prisma, {} as any);

    await expect(service.modifier('doc-4', { titre: 'interdit' } as any, {
      id: 'staff-2', role: Role.SCOLARITE,
    } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.documentDepot.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('ne crée pas d’audit si le document à supprimer est absent', async () => {
    const auditCreate = jest.fn();
    const tx: any = {
      documentDepot: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() },
      auditLog: { create: auditCreate },
    };
    const service = new BibliothequeService({ $transaction: (fn: any) => fn(tx) } as any, {} as any);

    await expect(service.supprimer('absent', user)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.documentDepot.delete).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
