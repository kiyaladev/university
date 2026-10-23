import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/boot/axios', () => ({ api }));

import {
  CONTENU_MAX,
  TAILLE_MAX_CSV,
  TAILLE_MAX_XLSX,
  estFichierCsv,
  estFichierXlsx,
  importsService,
  tailleFichierAutorisee,
} from '../../src/features/administration/services/imports';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});

const apercu = {
  type: 'enseignants' as const,
  lignesLues: 3,
  valides: 2,
  rejetees: 1,
  apercu: [],
  erreurs: [{ numero: 3, erreurs: ['colonne manquante'] }],
};

describe('features/administration/services/imports', () => {
  it('prévisualise un fichier sans rien écrire', async () => {
    api.post.mockResolvedValue({ data: apercu });

    const resultat = await importsService.previsualiser({ type: 'enseignants', contenu: 'a;b\n' });

    expect(resultat).toBe(apercu);
    expect(api.post).toHaveBeenCalledWith(
      '/imports/referentiels/previsualiser',
      { type: 'enseignants', contenu: 'a;b\n' },
      { timeout: 60_000 },
    );
  });

  it('applique l’import d’un fichier', async () => {
    const rapport = { importees: 2, rejetees: 1, erreurs: [] };
    api.post.mockResolvedValue({ data: rapport });

    const resultat = await importsService.appliquer({ type: 'matieres', contenu: 'a;b\n' });

    expect(resultat).toBe(rapport);
    expect(api.post).toHaveBeenCalledWith(
      '/imports/referentiels/appliquer',
      { type: 'matieres', contenu: 'a;b\n' },
      { timeout: 120_000 },
    );
  });

  it('reconnaît les formats de fichier', () => {
    expect(estFichierXlsx('Referentiel.XLSX')).toBe(true);
    expect(estFichierXlsx('referentiel.csv')).toBe(false);
    expect(estFichierCsv('referentiel.CSV')).toBe(true);
    expect(estFichierCsv('referentiel.txt')).toBe(false);
  });

  it('limite la taille du fichier selon son format', () => {
    expect(tailleFichierAutorisee(TAILLE_MAX_XLSX, true)).toBe(true);
    expect(tailleFichierAutorisee(TAILLE_MAX_XLSX + 1, true)).toBe(false);
    expect(tailleFichierAutorisee(TAILLE_MAX_CSV, false)).toBe(true);
    expect(tailleFichierAutorisee(TAILLE_MAX_CSV + 1, false)).toBe(false);
  });

  it('connaît la taille maximale du contenu transmis', () => {
    expect(CONTENU_MAX).toBe(1_000_000);
  });
});
