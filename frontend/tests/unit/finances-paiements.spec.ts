import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  estInscription,
  paiementsService,
  peutAnnulerPaiement,
  peutSimulerPaiement,
  ROUTE_SOURCE,
  routeModule,
  sourceDe,
} from '../../src/features/finances/services/paiements';
import type { Paiement } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const paiement = (extras: Partial<Paiement> = {}): Paiement =>
  ({
    id: 'p1',
    reference: 'PAY-1',
    montant: 100000,
    devise: 'GNF',
    mode: 'ESPECES',
    statut: 'EN_ATTENTE',
    horodatage: '2026-03-01T10:00:00.000Z',
    createdAt: '2026-03-01T10:00:00.000Z',
    ...extras,
  }) as Paiement;

describe('features/finances/services/paiements', () => {
  it('liste le registre paginé avec ses filtres', async () => {
    const page = { data: [paiement()], total: 1, page: 1, pageSize: 20 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await paiementsService.liste({
      page: 2,
      pageSize: 25,
      search: 'PAY',
      statut: 'EN_ATTENTE',
      mode: 'ESPECES',
      inscriptionId: 'i1',
      etudiantId: 'e1',
    });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/paiements', {
      params: {
        page: 2,
        pageSize: 25,
        search: 'PAY',
        statut: 'EN_ATTENTE',
        mode: 'ESPECES',
        inscriptionId: 'i1',
        etudiantId: 'e1',
      },
    });
  });

  it('simule un paiement avec son issue', async () => {
    api.post.mockResolvedValue({ data: paiement({ statut: 'REUSSI' }) });

    await paiementsService.simuler('p1', 'REUSSI');

    expect(api.post).toHaveBeenCalledWith('/paiements/p1/simuler', { statut: 'REUSSI' }, {});
  });

  it('annule un paiement avec son motif', async () => {
    api.post.mockResolvedValue({ data: paiement({ statut: 'ANNULE' }) });

    await paiementsService.annuler('p1', 'Erreur de saisie');

    expect(api.post).toHaveBeenCalledWith('/paiements/p1/annuler', { motif: 'Erreur de saisie' }, {});
  });

  it('lit les inscriptions pour le bandeau de ciblage', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'i1' }] });

    await paiementsService.inscriptions();

    expect(api.get).toHaveBeenCalledWith('/inscriptions', { params: { all: '1' } });
  });

  it('lit la fiche de l’étudiant ciblé', async () => {
    api.get.mockResolvedValue({ data: { id: 'e1', matricule: 'G2026-1' } });

    await paiementsService.etudiant('e1');

    expect(api.get).toHaveBeenCalledWith('/etudiants/e1', { params: undefined });
  });

  it('déduit la source du paiement, les inscriptions par défaut', () => {
    expect(sourceDe(paiement())).toBe('INSCRIPTION');
    expect(sourceDe(paiement({ source: 'RECETTE' } as Partial<Paiement>))).toBe('RECETTE');
    expect(estInscription(paiement())).toBe(true);
    expect(estInscription(paiement({ source: 'RESTO' } as Partial<Paiement>))).toBe(false);
  });

  it('connaît l’écran qui gère chaque portefeuille hors inscriptions', () => {
    expect(ROUTE_SOURCE).toEqual({
      FORMATION: '/formations-admin',
      RESTO: '/resto',
      RECETTE: '/recettes',
      DOCUMENT: '/demandes-docs',
    });
  });

  it('ne propose un module que si le rôle peut l’ouvrir', () => {
    const ouverts = { FORMATION: true, RESTO: false };
    expect(routeModule(paiement(), ouverts)).toBeNull();
    expect(routeModule(paiement({ source: 'FORMATION' } as Partial<Paiement>), ouverts)).toBe('/formations-admin');
    expect(routeModule(paiement({ source: 'RESTO' } as Partial<Paiement>), ouverts)).toBeNull();
  });

  it('n’autorise les actions que sur les paiements d’inscription', () => {
    expect(peutSimulerPaiement(paiement(), true)).toBe(true);
    expect(peutSimulerPaiement(paiement(), false)).toBe(false);
    expect(peutSimulerPaiement(paiement({ statut: 'REUSSI' }), true)).toBe(false);
    expect(peutSimulerPaiement(paiement({ source: 'RECETTE' } as Partial<Paiement>), true)).toBe(false);

    expect(peutAnnulerPaiement(paiement(), true)).toBe(true);
    expect(peutAnnulerPaiement(paiement({ statut: 'ANNULE' }), true)).toBe(false);
    expect(peutAnnulerPaiement(paiement({ statut: 'REMBOURSE' }), true)).toBe(false);
  });
});
