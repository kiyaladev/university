import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { fondsComplet } from './access';
import { BibliothequeService } from './bibliotheque.service';
import { RechercheService } from './recherche.service';
import { t } from '../../../common/i18n';

describe('Fonds privé de la bibliothèque', () => {
  it.each([null, Role.ETUDIANT, Role.CONTROLEUR, Role.CHEF_DEPARTEMENT])('ne donne pas le fonds privé à %s', (role) => {
    expect(fondsComplet(role ? ({ role } as any) : null)).toBe(false);
  });
  it.each([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.ENSEIGNANT])(
    'autorise le personnel documentaire %s',
    (role) => {
      expect(fondsComplet({ role } as any)).toBe(true);
    },
  );
  it('un étudiant ne peut forcer public=false dans la liste', async () => {
    const prisma = {
      documentDepot: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    const service = new BibliothequeService(prisma as any, {} as any);
    await service.liste({ public: 'false' }, { role: Role.ETUDIANT } as any);
    expect(prisma.documentDepot.findMany.mock.calls[0][0].where.public).toBe(true);
    expect(prisma.documentDepot.findMany.mock.calls[0][0].omit).toEqual({ fichier: true, contenuTexte: true });
  });
  it('n’hydrate pas fichier et texte intégral pour les documents populaires', async () => {
    const prisma = { documentDepot: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new BibliothequeService(prisma as any, {} as any);

    await service.populaires();

    expect(prisma.documentDepot.findMany.mock.calls[0][0].omit).toEqual({ fichier: true, contenuTexte: true });
  });
  it('retire les matricules, identifiants personnels et déposant des métadonnées publiques', async () => {
    const doc = {
      id: 'doc-1',
      titre: 'Cours publié',
      fichier: null,
      enseignantId: 'ens-id',
      etudiantId: 'etu-id',
      deposeParId: 'user-id',
      departement: { id: 'dept-id', nom: 'Informatique' },
      enseignant: {
        id: 'ens-id',
        matricule: 'ENS-001',
        nom: 'Barry',
        prenom: 'Awa',
        departementId: 'dept-id',
        departement: { id: 'dept-id', nom: 'Informatique' },
      },
      etudiant: { id: 'etu-id', matricule: 'ETU-001', nom: 'Diallo', prenom: 'Moussa' },
      deposePar: { id: 'user-id', nom: 'Admin', prenom: 'A', role: Role.ADMIN },
    };
    const prisma = {
      documentDepot: { findMany: jest.fn().mockResolvedValue([doc]), count: jest.fn().mockResolvedValue(1) },
    };
    const service = new BibliothequeService(prisma as any, {} as any);

    const resultat = await service.liste({} as any, null);

    expect(resultat.data[0]).toMatchObject({
      id: 'doc-1',
      titre: 'Cours publié',
      enseignant: { nom: 'Barry', prenom: 'Awa', departement: { nom: 'Informatique' } },
    });
    expect(resultat.data[0]).not.toHaveProperty('etudiant');
    expect(resultat.data[0]).not.toHaveProperty('etudiantId');
    expect(resultat.data[0]).not.toHaveProperty('enseignantId');
    expect(resultat.data[0]).not.toHaveProperty('deposePar');
    expect(resultat.data[0].enseignant).not.toHaveProperty('matricule');
    expect(resultat.data[0].enseignant).not.toHaveProperty('id');
  });
  it('un étudiant ne lit pas les métadonnées privées par identifiant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { documentDepot: { findFirst } };
    const service = new BibliothequeService(prisma as any, {} as any);
    await expect(service.detailPour('foreign', { role: Role.ETUDIANT } as any)).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign', public: true },
        omit: { fichier: true, contenuTexte: true },
      }),
    );
  });
  it('masque un document privé sans fichier aux visiteurs anonymes', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { documentDepot: { findFirst } };
    const service = new BibliothequeService(prisma as any, {} as any);
    const error = await service.fichier('private-draft', null).catch((reason) => reason);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe(t('bibliotheque.document_introuvable'));
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'private-draft', public: true },
        omit: { contenuTexte: true },
      }),
    );
  });

  it('exclut les colonnes volumineuses de la réhydratation FTS', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'doc-1', rank: 1 }])
        .mockResolvedValueOnce([{ count: 1n }]),
      documentDepot: { findMany: jest.fn().mockResolvedValue([{ id: 'doc-1' }]) },
    };
    const service = new RechercheService(prisma as any);

    await service.rechercher({ q: 'cours' } as any, null);

    expect(prisma.documentDepot.findMany.mock.calls[0][0].omit).toEqual({ fichier: true, contenuTexte: true });
  });
  it('signale un document publié déposé sans fichier', async () => {
    const prisma = { documentDepot: { findFirst: jest.fn().mockResolvedValue({ public: true, fichier: null }) } };
    const service = new BibliothequeService(prisma as any, {} as any);
    const error = await service.fichier('public-metadata-only', null).catch((reason) => reason);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe(t('bibliotheque.ce_document_est_depose_sans_fichier_metadonnees_seules'));
  });

  it('journalise le téléchargement authentifié dans la transaction du compteur sans copier le fichier', async () => {
    const documentDepot = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'doc-prive',
        titre: 'Cours privé',
        fichier: 'data:application/pdf;base64,UERG',
        typeMime: 'application/pdf',
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const tx = { documentDepot, auditLog };
    const prisma = {
      documentDepot: { findFirst: documentDepot.findFirst },
      $transaction: jest.fn((travail) => travail(tx)),
    };
    const service = new BibliothequeService(prisma as any, {} as any);

    const resultat = await service.fichier('doc-prive', { id: 'agent-1', role: Role.ENSEIGNANT } as any);

    expect(resultat.octets.toString()).toBe('PDF');
    expect(documentDepot.update).toHaveBeenCalledWith({
      where: { id: 'doc-prive' },
      data: { telechargements: { increment: 1 } },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'agent-1',
        action: 'DOCUMENT_DEPOT_TELECHARGE',
        entite: 'DocumentDepot',
        entiteId: 'doc-prive',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(auditLog.create.mock.calls)).not.toContain('PDF');
    expect(JSON.stringify(auditLog.create.mock.calls)).not.toContain('Cours privé');
  });

  it('ne crée pas d’acteur artificiel pour le téléchargement anonyme d’un document public', async () => {
    const documentDepot = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'doc-public',
        titre: 'Cours public',
        fichier: 'data:text/plain;base64,SGVsbG8=',
        typeMime: 'text/plain',
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    const auditLog = { create: jest.fn() };
    const tx = { documentDepot, auditLog };
    const prisma = {
      documentDepot: { findFirst: documentDepot.findFirst },
      $transaction: jest.fn((travail) => travail(tx)),
    };
    const service = new BibliothequeService(prisma as any, {} as any);

    await service.fichier('doc-public', null);

    expect(auditLog.create).not.toHaveBeenCalled();
    expect(documentDepot.update).toHaveBeenCalledTimes(1);
  });

  it('utilise une projection personnelle sûre pendant la réhydratation FTS', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'doc-1', rank: 1 }])
        .mockResolvedValueOnce([{ count: 1n }]),
      documentDepot: { findMany: jest.fn().mockResolvedValue([{ id: 'doc-1' }]) },
    };
    const service = new RechercheService(prisma as any);
    await service.rechercher({ q: 'test' } as any, { role: Role.ADMIN } as any);

    const include = prisma.documentDepot.findMany.mock.calls[0][0].include;
    expect(include.enseignant.select).toEqual({
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      departement: true,
    });
    expect(include.etudiant.select).toEqual({ id: true, matricule: true, nom: true, prenom: true });
    expect(include.enseignant.include).toBeUndefined();
    expect(include.etudiant).not.toHaveProperty('include');
  });
  it('retire les données personnelles des résultats FTS anonymes', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'doc-1', rank: 1 }])
        .mockResolvedValueOnce([{ count: 1n }]),
      documentDepot: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'doc-1',
            etudiantId: 'etu-id',
            enseignantId: 'ens-id',
            deposeParId: 'user-id',
            etudiant: { id: 'etu-id', matricule: 'ETU-001', nom: 'Diallo' },
            enseignant: { id: 'ens-id', matricule: 'ENS-001', nom: 'Barry', prenom: 'Awa' },
            deposePar: { id: 'user-id', role: Role.ADMIN },
          },
        ]),
      },
    };
    const service = new RechercheService(prisma as any);

    const resultat = await service.rechercher({ q: 'cours' } as any, null);

    expect(resultat.data[0].enseignant).toEqual({ nom: 'Barry', prenom: 'Awa' });
    expect(resultat.data[0]).not.toHaveProperty('etudiant');
    expect(resultat.data[0]).not.toHaveProperty('deposePar');
    expect(resultat.data[0]).not.toHaveProperty('etudiantId');
  });
});
