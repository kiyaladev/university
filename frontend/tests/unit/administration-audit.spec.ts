import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import { auditService, bornesAudit } from '../../src/features/administration/services/audit';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const page = { data: [], total: 0, page: 1, pageSize: 25 };

describe('features/administration/services/audit', () => {
  it('liste le journal en silence : l’écran affiche l’échec dans son bandeau', async () => {
    api.get.mockResolvedValue({ data: page });

    const resultat = await auditService.liste({ page: 1, pageSize: 25, entite: 'COURRIER' });

    expect(resultat).toBe(page);
    expect(api.get).toHaveBeenCalledWith('/controles/audit', {
      silencieux: true,
      params: { page: 1, pageSize: 25, entite: 'COURRIER' },
    });
  });

  it('convertit les jours saisis en bornes horodatées', () => {
    const bornes = bornesAudit({
      entite: '',
      action: '',
      acteur: '',
      dateDebut: '2026-01-10',
      dateFin: '2026-01-12',
    });

    expect(bornes.dateDebut).toBe(new Date('2026-01-10T00:00:00').toISOString());
    expect(bornes.dateFin).toBe(new Date('2026-01-12T23:59:59.999').toISOString());
  });

  it('laisse les bornes absentes quand la période est vide', () => {
    const bornes = bornesAudit({ entite: '', action: '', acteur: '', dateDebut: '', dateFin: '' });

    expect(bornes).toEqual({ dateDebut: undefined, dateFin: undefined });
  });
});
