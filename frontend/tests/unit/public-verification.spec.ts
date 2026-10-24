import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { verificationService } from '../../src/features/public/services/verification';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/public/services/verification', () => {
  it('vérifie une attestation en silence, référence et clé rognées', async () => {
    const reponse = { valide: true, verificationId: 'V1' };
    api.get.mockResolvedValue({ data: reponse });

    const resultat = await verificationService.attestation('  ATT-1 ', ' UP-DOC-1 ');

    expect(resultat).toBe(reponse);
    expect(api.get).toHaveBeenCalledWith('/attestations/verifier', {
      silencieux: true,
      params: { ref: 'ATT-1', k: 'UP-DOC-1' },
    });
  });

  it('vérifie une carte étudiante en silence', async () => {
    api.get.mockResolvedValue({ data: { valide: false, raison: 'inconnue' } });

    const resultat = await verificationService.carte('CARTE-9', 'UP-CARTE-9');

    expect(resultat).toEqual({ valide: false, raison: 'inconnue' });
    expect(api.get).toHaveBeenCalledWith('/cartes-etudiantes/verifier', {
      silencieux: true,
      params: { carte: 'CARTE-9', k: 'UP-CARTE-9' },
    });
  });

  it('vérifie un badge en silence', async () => {
    api.get.mockResolvedValue({ data: { valide: true } });

    await verificationService.badge('BADGE-3', 'UP-BADGE-3');

    expect(api.get).toHaveBeenCalledWith('/badges/verifier', {
      silencieux: true,
      params: { badge: 'BADGE-3', k: 'UP-BADGE-3' },
    });
  });

  it('laisse remonter l’erreur : la page affiche le verdict d’échec', async () => {
    const erreur = new Error('502');
    api.get.mockRejectedValue(erreur);

    await expect(verificationService.attestation('ATT-1', 'K')).rejects.toBe(erreur);
  });
});
