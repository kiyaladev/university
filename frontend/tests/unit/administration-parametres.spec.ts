import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { parametresService, referenceParametres } from '../../src/features/administration/services/parametres';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const parametres = [
  { cle: 'NOM_ETABLISSEMENT', valeur: 'Université', description: 'Nom affiché' },
  { cle: 'QR_OBLIGATOIRE', valeur: 'true', description: null },
];

describe('features/administration/services/parametres', () => {
  it('liste les paramètres', async () => {
    api.get.mockResolvedValue({ data: parametres });

    const resultat = await parametresService.liste();

    expect(resultat).toBe(parametres);
    expect(api.get).toHaveBeenCalledWith('/parametres', { params: undefined });
  });

  it('enregistre la liste complète des paramètres', async () => {
    api.put.mockResolvedValue({ data: parametres });

    const resultat = await parametresService.enregistrer(parametres);

    expect(resultat).toBe(parametres);
    expect(api.put).toHaveBeenCalledWith('/parametres', { parametres }, {});
  });

  it('construit la copie de référence des valeurs chargées', () => {
    expect(referenceParametres(parametres)).toEqual({
      NOM_ETABLISSEMENT: 'Université',
      QR_OBLIGATOIRE: 'true',
    });
    expect(referenceParametres([])).toEqual({});
  });
});
