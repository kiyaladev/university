import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { parametresService, valeurParametre } from '../../src/features/presence/services/parametres';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/presence/services/parametres', () => {
  it('lit les règles de pointage', async () => {
    api.get.mockResolvedValue({ data: [{ cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'false' }] });

    const regles = await parametresService.reglesPointage();

    expect(regles).toEqual([{ cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'false' }]);
    expect(api.get).toHaveBeenCalledWith('/parametres/pointage', { params: undefined });
  });

  it('lit la valeur d’un paramètre connu', () => {
    const regles = [{ cle: 'ATTESTATION_OBLIGATOIRE', valeur: 'false' }];

    expect(valeurParametre(regles, 'ATTESTATION_OBLIGATOIRE')).toBe('false');
  });

  it('retombe sur la valeur par défaut quand la clé est absente', () => {
    expect(valeurParametre([], 'ATTESTATION_OBLIGATOIRE', 'true')).toBe('true');
    expect(valeurParametre(undefined, 'ATTESTATION_OBLIGATOIRE', 'true')).toBe('true');
  });
});
