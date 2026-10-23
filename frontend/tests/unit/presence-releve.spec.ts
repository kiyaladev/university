import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { nomFichierReleve, telechargerReleveHebdomadaire } from '../../src/features/presence/services/releve';
import { verifierServeur } from '../../src/features/presence/services/systeme';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

describe('features/presence/services/releve', () => {
  it('demande le relevé en blob et le renvoie tel quel', async () => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    api.post.mockResolvedValue({ data: pdf });

    const fichier = await telechargerReleveHebdomadaire({
      departementId: 'd1',
      dateDebut: '2026-01-05',
      dateFin: '2026-01-11',
      signatureBase64: 'data:image/png;base64,AAA',
    });

    expect(fichier).toBe(pdf);
    expect(api.post).toHaveBeenCalledWith(
      '/impression/releve-hebdomadaire',
      {
        departementId: 'd1',
        dateDebut: '2026-01-05',
        dateFin: '2026-01-11',
        signatureBase64: 'data:image/png;base64,AAA',
      },
      { responseType: 'blob', silencieux: true },
    );
  });

  it('nomme le fichier d’après le début de la semaine', () => {
    expect(nomFichierReleve('2026-01-05')).toBe('releve-hebdomadaire-2026-01-05.pdf');
  });
});

describe('features/presence/services/systeme', () => {
  it('interroge le serveur sans laisser le cache répondre', async () => {
    api.get.mockResolvedValue({ data: { status: 'ok' } });

    await verifierServeur();

    expect(api.get).toHaveBeenCalledWith('/health', {
      params: { _tournee: expect.any(Number) },
    });
  });
});
