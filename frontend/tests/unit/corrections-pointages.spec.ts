import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  peutCorriger,
  pointagesService,
  ROLES_CORRECTION_POINTAGES,
  ROLES_SUPPRESSION_POINTAGES,
} from '../../src/features/presence/services/pointages';
import type { Controle } from '../../src/types';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const pointage = {
  id: 'c1',
  seanceId: 's1',
  controleurId: 'u1',
  statut: 'RETARD',
  dureeMinutes: 55,
  heureArrivee: '08:20',
  heureFinReelle: '09:15',
  effectifPresent: 42,
  thematiqueTraitee: 'Chapitre 3',
  observation: 'Retard de 10 minutes',
  methode: 'QR_SALLE',
  qrSalleValide: true,
  attestation: 'SIGNATURE',
  attestationValide: true,
  horsLigne: false,
  horodatage: '2026-01-06T08:20:00.000Z',
} as unknown as Controle;

describe('features/presence/services/pointages', () => {
  it('liste les pointages filtrés', async () => {
    const page = { data: [pointage], total: 1, page: 1, pageSize: 50 };
    api.get.mockResolvedValue({ data: page });

    const resultat = await pointagesService.liste({ dateDebut: '2026-01-01', statut: 'RETARD', page: 1 });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/controles', {
      params: { dateDebut: '2026-01-01', statut: 'RETARD', page: 1 },
    });
  });

  it('lit un pointage', async () => {
    api.get.mockResolvedValue({ data: pointage });

    await expect(pointagesService.lire('c1')).resolves.toEqual(pointage);
    expect(api.get).toHaveBeenCalledWith('/controles/c1', { params: undefined });
  });

  it('corrige un pointage par les seuls champs modifiés', async () => {
    api.put.mockResolvedValue({ data: pointage });

    await pointagesService.modifier('c1', { statut: 'PRESENT', observation: 'Retard excusé' });

    expect(api.put).toHaveBeenCalledWith(
      '/controles/c1',
      { statut: 'PRESENT', observation: 'Retard excusé' },
      {},
    );
  });

  it('supprime un pointage', async () => {
    api.delete.mockResolvedValue({ data: null });

    await pointagesService.supprimer('c1');

    expect(api.delete).toHaveBeenCalledWith('/controles/c1', {});
  });

  it('lit les séances d’une salle par son QR', async () => {
    api.get.mockResolvedValue({ data: { salle: { id: 'sa1' }, seances: [] } });

    await pointagesService.parSalle('token-1');

    expect(api.get).toHaveBeenCalledWith('/controles/salle/token-1', { params: undefined });
  });

  it('n’offre la correction qu’à l’agent concerné, à l’administration et à la direction', () => {
    expect(peutCorriger(pointage, ['ADMIN'], 'u2')).toBe(true);
    expect(peutCorriger(pointage, ['DIRECTION'], 'u2')).toBe(true);
    expect(peutCorriger(pointage, ['CONTROLEUR'], 'u1')).toBe(true);
    expect(peutCorriger(pointage, ['CONTROLEUR'], 'u2')).toBe(false);
    expect(peutCorriger(pointage, ['SCOLARITE'], 'u1')).toBe(false);
  });

  it('aligne les rôles sur les @Roles de l’API', () => {
    // PUT /controles/:id.
    expect([...ROLES_CORRECTION_POINTAGES]).toEqual(['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT']);
    // DELETE /controles/:id.
    expect([...ROLES_SUPPRESSION_POINTAGES]).toEqual(['ADMIN', 'DIRECTION']);
  });
});
