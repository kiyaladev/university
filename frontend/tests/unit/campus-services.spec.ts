import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests de la couche de services du domaine « campus ».
 *
 * Chaque service est vérifié sur trois points : l'URL appelée, les paramètres
 * transmis et la transformation du corps de la réponse.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

// `shared/utils/format` (importé par le service des élections) lit la langue
// active dans boot/i18n, qui dépend de l'application Quasar.
vi.mock('../../src/boot/i18n', () => ({
  getAppLocale: () => 'fr-FR',
  i18n: { global: { te: () => false, t: (cle: string) => cle } },
}));

import { citesService } from '../../src/features/campus/services/cites';
import { equipementsService, ticketsService } from '../../src/features/campus/services/assistance';
import { restoService } from '../../src/features/campus/services/resto';
import { reservationsService } from '../../src/features/campus/services/reservations';
import { vodService } from '../../src/features/campus/services/vod';
import { badgesService } from '../../src/features/campus/services/badges';
import { patrimoineService } from '../../src/features/campus/services/patrimoine';
import { electionsService } from '../../src/features/campus/services/elections';
import { documentsService } from '../../src/features/campus/services/documents';
import { formationsAdminService } from '../../src/features/campus/services/formations';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('campus/services/cites', () => {
  it('liste les résidences avec leurs paramètres', async () => {
    const page = { data: [{ id: 'r1' }], total: 1, page: 1, pageSize: 0 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await citesService.listeResidences({ all: '1' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/residences', { params: { all: '1' } });
  });

  it('crée, modifie et supprime une résidence', async () => {
    api.post.mockResolvedValue({ data: { id: 'r2' } });
    api.put.mockResolvedValue({ data: { id: 'r2', nom: 'Cité B' } });
    api.delete.mockResolvedValue({ data: null });

    await expect(citesService.creerResidence({ code: 'C', nom: 'Cité', capacite: 10 })).resolves.toEqual({ id: 'r2' });
    await expect(citesService.modifierResidence('r2', { nom: 'Cité B' })).resolves.toEqual({
      id: 'r2',
      nom: 'Cité B',
    });
    await expect(citesService.supprimerResidence('r2')).resolves.toBeUndefined();

    expect(api.post).toHaveBeenCalledWith('/residences', { code: 'C', nom: 'Cité', capacite: 10 }, {});
    expect(api.put).toHaveBeenCalledWith('/residences/r2', { nom: 'Cité B' }, {});
    expect(api.delete).toHaveBeenCalledWith('/residences/r2', {});
  });

  it('décide et retire une attribution de logement', async () => {
    api.put.mockResolvedValue({ data: { id: 'a1' } });

    await citesService.deciderAttribution('a1', { statut: 'ACCORDE', commentaire: 'Dossier complet' });
    await citesService.retirerAttribution('a1', { motif: 'Erreur de saisie' });

    expect(api.put).toHaveBeenNthCalledWith(
      1,
      '/attributions-logement/a1/decider',
      { statut: 'ACCORDE', commentaire: 'Dossier complet' },
      {},
    );
    expect(api.put).toHaveBeenNthCalledWith(2, '/attributions-logement/a1/retirer', { motif: 'Erreur de saisie' }, {});
  });

  it('charge toutes les années et recherche les étudiants', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await citesService.listeAnnees();
    await citesService.rechercherEtudiants('Diallo');

    expect(api.get).toHaveBeenNthCalledWith(1, '/annees', { params: { all: '1' } });
    expect(api.get).toHaveBeenNthCalledWith(2, '/etudiants', { params: { search: 'Diallo', all: '1' } });
  });
});

describe('campus/services/assistance', () => {
  it('liste les équipements du parc', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await equipementsService.liste({ all: '1', search: 'vidéoprojecteur', actif: 'true' });

    expect(api.get).toHaveBeenCalledWith('/equipements', {
      params: { all: '1', search: 'vidéoprojecteur', actif: 'true' },
    });
  });

  it('retrouve un équipement par son code QR, encodé', async () => {
    api.get.mockResolvedValue({ data: { id: 'e1', codeQr: 'UP-IT-1' } });

    const resultat = await equipementsService.parCode('UP IT/1');

    expect(resultat).toEqual({ id: 'e1', codeQr: 'UP-IT-1' });
    expect(api.get).toHaveBeenCalledWith('/equipements/par-code/UP%20IT%2F1', { params: undefined });
  });

  it('liste les tickets, lit les statistiques et change un statut', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });
    api.post.mockResolvedValue({ data: null });

    await ticketsService.liste({ page: 2, pageSize: 20, statut: 'OUVERT' });
    await ticketsService.stats();
    await ticketsService.changerStatut('t1', 'RESOLU');

    expect(api.get).toHaveBeenNthCalledWith(1, '/tickets', {
      params: { page: 2, pageSize: 20, statut: 'OUVERT' },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/tickets/stats', { params: undefined });
    expect(api.post).toHaveBeenCalledWith('/tickets/t1/statut', { statut: 'RESOLU' }, {});
  });

  it('ouvre un ticket en silence (l\'intercepteur notifie, la page aussi)', async () => {
    api.post.mockResolvedValue({ data: { id: 't2', numero: 'T-2' } });

    await ticketsService.creer({ categorie: 'Reseau', description: 'Pas de réseau' });

    expect(api.post).toHaveBeenCalledWith(
      '/tickets',
      { categorie: 'Reseau', description: 'Pas de réseau' },
      {},
    );
  });
});

describe('campus/services/resto', () => {
  it('valide un repas au guichet, sans notification automatique', async () => {
    api.post.mockResolvedValue({ data: { solde: 5000 } });

    const resultat = await restoService.validerRepas({ reference: 'R-1', repas: 'DEJEUNER', montant: 15000 });

    expect(resultat).toEqual({ solde: 5000 });
    expect(api.post).toHaveBeenCalledWith(
      '/resto/valider',
      { reference: 'R-1', repas: 'DEJEUNER', montant: 15000 },
      { silencieux: true },
    );
  });

  it('liste les portefeuilles, les consommations et les recharges', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await restoService.listePortefeuilles({ all: '1' });
    await restoService.listeConsommations({ dateDebut: '2026-01-01', dateFin: '2026-01-31', cantine: 'G1' });
    await restoService.listeRecharges({ dateDebut: '2026-01-01', dateFin: '2026-01-31', statut: 'PAYE' });

    expect(api.get).toHaveBeenNthCalledWith(1, '/resto/portefeuilles', { params: { all: '1' } });
    expect(api.get).toHaveBeenNthCalledWith(2, '/resto/consommations', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31', cantine: 'G1' },
    });
    expect(api.get).toHaveBeenNthCalledWith(3, '/resto/recharges', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31', statut: 'PAYE' },
    });
  });

  it('recharge un portefeuille et annule une consommation', async () => {
    api.post.mockResolvedValue({ data: { immediat: true, solde: 25000 } });

    const resultat = await restoService.recharger('p1', { montant: 20000, mode: 'ESPECES' });
    await restoService.annulerConsommation('c1', 'Remboursement guichet');

    expect(resultat).toEqual({ immediat: true, solde: 25000 });
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/resto/portefeuilles/p1/recharger',
      { montant: 20000, mode: 'ESPECES' },
      {},
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/resto/consommations/c1/annuler',
      { motif: 'Remboursement guichet' },
      {},
    );
  });
});

describe('campus/services/reservations', () => {
  it('charge le calendrier d\'une période', async () => {
    api.get.mockResolvedValue({ data: { jours: [], salles: [] } });

    await reservationsService.calendrier({ dateDebut: '2026-01-01', dateFin: '2026-01-31', salleId: 's1' });

    expect(api.get).toHaveBeenCalledWith('/reservations/calendrier', {
      params: { dateDebut: '2026-01-01', dateFin: '2026-01-31', salleId: 's1' },
    });
  });

  it('dépose, modifie et annule une réservation en silence', async () => {
    api.post.mockResolvedValue({ data: { id: 'r1' } });
    api.put.mockResolvedValue({ data: { id: 'r1' } });
    api.delete.mockResolvedValue({ data: null });

    await reservationsService.creer({ salleId: 's1', dateJour: '2026-01-01', heureDebut: '08:00', heureFin: '10:00' });
    await reservationsService.modifier('r1', { heureFin: '11:00' });
    await reservationsService.supprimer('r1');

    expect(api.post).toHaveBeenCalledWith(
      '/reservations',
      { salleId: 's1', dateJour: '2026-01-01', heureDebut: '08:00', heureFin: '10:00' },
      { silencieux: true },
    );
    expect(api.put).toHaveBeenCalledWith('/reservations/r1', { heureFin: '11:00' }, { silencieux: true });
    expect(api.delete).toHaveBeenCalledWith('/reservations/r1', { silencieux: true });
  });

  it('confirme ou refuse une demande', async () => {
    api.post.mockResolvedValue({ data: null });

    await reservationsService.decider('r1', { statut: 'CONFIRME', motif: 'Salle libre' });

    expect(api.post).toHaveBeenCalledWith(
      '/reservations/r1/decider',
      { statut: 'CONFIRME', motif: 'Salle libre' },
      { silencieux: true },
    );
  });
});

describe('campus/services/vod', () => {
  it('liste le catalogue et la collecte de l\'étudiant', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await vodService.liste({ page: 1, pageSize: 20, statut: 'EN_LIGNE' });
    await vodService.maCollecte();

    expect(api.get).toHaveBeenNthCalledWith(1, '/vod', { params: { page: 1, pageSize: 20, statut: 'EN_LIGNE' } });
    expect(api.get).toHaveBeenNthCalledWith(2, '/vod/ma-collecte', { params: undefined });
  });

  it('met en ligne, archive et rapporte la position de lecture', async () => {
    api.post.mockResolvedValue({ data: null });

    await vodService.publier('v1');
    await vodService.archiver('v1');
    await vodService.signalerVue('v1', { positionSecondes: 120, dureeSecondes: 600, termine: false });

    expect(api.post).toHaveBeenNthCalledWith(1, '/vod/v1/publier', undefined, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/vod/v1/archiver', {}, {});
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      '/vod/v1/vue',
      { positionSecondes: 120, dureeSecondes: 600, termine: false },
      {},
    );
  });
});

describe('campus/services/badges', () => {
  it('annule un badge avec son motif et prolonge sa validité', async () => {
    api.post.mockResolvedValue({ data: null });

    await badgesService.annuler('b1', 'Badge perdu');
    await badgesService.rallonger('b1', '2027-01-01');

    expect(api.post).toHaveBeenNthCalledWith(1, '/badges/b1/annuler', { motif: 'Badge perdu' }, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/badges/b1/rallonger', { dateValidite: '2027-01-01' }, {});
  });
});

describe('campus/services/patrimoine', () => {
  it('liste les équipements avec leurs filtres', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await patrimoineService.listeEquipements({ all: '1', categorieId: 'c1' });

    expect(api.get).toHaveBeenCalledWith('/patrimoine/equipements', { params: { all: '1', categorieId: 'c1' } });
  });

  it('déclare puis résout une réparation', async () => {
    api.post.mockResolvedValue({ data: { id: 'rep1' } });

    await patrimoineService.declarerReparation('e1', { description: 'Écran cassé' });
    await patrimoineService.resoudreReparation('e1', { noteResolution: 'Remplacé' });

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/patrimoine/equipements/e1/reparation',
      { description: 'Écran cassé' },
      {},
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/patrimoine/equipements/e1/reparation/resoudre',
      { noteResolution: 'Remplacé' },
      {},
    );
  });

  it('lit le tableau de bord et les catégories', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await patrimoineService.tableauDeBord();
    await patrimoineService.listeCategories();

    expect(api.get).toHaveBeenNthCalledWith(1, '/patrimoine/dashboard', { params: undefined });
    expect(api.get).toHaveBeenNthCalledWith(2, '/patrimoine/categories', { params: { all: '1' } });
  });
});

describe('campus/services/elections', () => {
  it('liste les scrutins et lit un scrutin précis', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0 } });

    await electionsService.liste({ statut: 'BROUILLON', page: 1, pageSize: 20 });
    await electionsService.trouver('e1', true);

    expect(api.get).toHaveBeenNthCalledWith(1, '/elections', {
      params: { statut: 'BROUILLON', page: 1, pageSize: 20 },
      silencieux: false,
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/elections/e1', { params: undefined, silencieux: true });
  });

  it('crée, modifie et fait transitionner un scrutin', async () => {
    api.post.mockResolvedValue({ data: { id: 'e1' } });
    api.put.mockResolvedValue({ data: { id: 'e1' } });

    await electionsService.creer({ titre: 'Scrutin', type: 'CLUB' });
    await electionsService.modifier('e1', { titre: 'Scrutin 2' });
    await electionsService.transition('e1', 'ouvrir');

    expect(api.post).toHaveBeenNthCalledWith(1, '/elections', { titre: 'Scrutin', type: 'CLUB' }, {});
    expect(api.put).toHaveBeenCalledWith('/elections/e1', { titre: 'Scrutin 2' }, {});
    expect(api.post).toHaveBeenNthCalledWith(2, '/elections/e1/ouvrir', undefined, {});
  });

  it('déclare un candidat et le retire', async () => {
    api.post.mockResolvedValue({ data: { id: 'c1' } });
    api.delete.mockResolvedValue({ data: null });

    await electionsService.creerCandidat('e1', { nom: 'Traoré', prenom: 'Awa', ordre: 1 });
    await electionsService.supprimerCandidat('e1', 'c1');

    expect(api.post).toHaveBeenCalledWith(
      '/elections/e1/candidats',
      { nom: 'Traoré', prenom: 'Awa', ordre: 1 },
      {},
    );
    expect(api.delete).toHaveBeenCalledWith('/elections/e1/candidats/c1', {});
  });
});

describe('campus/services/documents et formations', () => {
  it('dépose un document et corrige une fiche', async () => {
    api.post.mockResolvedValue({ data: { id: 'd1' } });
    api.put.mockResolvedValue({ data: { id: 'd1', public: true } });

    await documentsService.creer({ titre: 'Mémoire', type: 'MEMOIRE' });
    await documentsService.modifier('d1', { public: true });

    expect(api.post).toHaveBeenCalledWith('/documents', { titre: 'Mémoire', type: 'MEMOIRE' }, {});
    expect(api.put).toHaveBeenCalledWith('/documents/d1', { public: true });
  });

  it('ouvre et corrige une formation', async () => {
    api.post.mockResolvedValue({ data: { id: 'f1' } });
    api.put.mockResolvedValue({ data: { id: 'f1' } });

    await formationsAdminService.creer({ intitule: 'Formation', prix: 50000 });
    await formationsAdminService.modifier('f1', { prix: 60000 });

    expect(api.post).toHaveBeenCalledWith('/formations', { intitule: 'Formation', prix: 50000 }, {});
    expect(api.put).toHaveBeenCalledWith('/formations/f1', { prix: 60000 }, {});
  });
});
