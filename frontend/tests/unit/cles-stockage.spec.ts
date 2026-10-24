import { beforeEach, describe, expect, it, vi } from 'vitest';

import { creerStockageFaux } from './stockage-outil';

beforeEach(() => {
  vi.stubGlobal('localStorage', creerStockageFaux());
  vi.stubGlobal('sessionStorage', creerStockageFaux());
  vi.resetModules();
});

describe('shared/services/cles-stockage', () => {
  it('reprend les anciennes clés sous le nouveau préfixe', async () => {
    const { migrerClesLocales, CLE_TOKEN, CLE_FILE_POINTAGES } =
      await import('../../src/shared/services/cles-stockage');
    localStorage.setItem('unipresence_token', 'JETON');
    localStorage.setItem('unipresence_file_pointages_agent-1', 'FILE');
    localStorage.setItem('unipresence_tournee_preparee_agent-1', 'TOURNEE');
    sessionStorage.setItem('unipresence_inscription_publique_brouillon', 'BROUILLON');

    const migrees = migrerClesLocales();

    expect(migrees).toContain(CLE_TOKEN);
    expect(localStorage.getItem(CLE_TOKEN)).toBe('JETON');
    expect(localStorage.getItem(`${CLE_FILE_POINTAGES}_agent-1`)).toBe('FILE');
    expect(localStorage.getItem('university_tournee_preparee_agent-1')).toBe('TOURNEE');
    expect(sessionStorage.getItem('university_inscription_publique_brouillon')).toBe('BROUILLON');
    // L'ancienne clé est retirée : elle ne peut plus être lue par un ancien
    // code, mais rien n'est perdu.
    expect(localStorage.getItem('unipresence_token')).toBeNull();
    expect(localStorage.getItem('unipresence_file_pointages_agent-1')).toBeNull();
  });

  it('rejoue la reprise sans rien changer ni perdre', async () => {
    const { migrerClesLocales, CLE_TOKEN } = await import('../../src/shared/services/cles-stockage');
    localStorage.setItem('unipresence_token', 'JETON');

    migrerClesLocales();
    const seconde = migrerClesLocales();

    expect(seconde).toEqual([]);
    expect(localStorage.getItem(CLE_TOKEN)).toBe('JETON');
  });

  it('laisse la nouvelle clé faire foi quand les deux existent', async () => {
    const { migrerClesLocales, CLE_TOKEN } = await import('../../src/shared/services/cles-stockage');
    localStorage.setItem('unipresence_token', 'ANCIEN');
    localStorage.setItem(CLE_TOKEN, 'COURANT');

    migrerClesLocales();

    expect(localStorage.getItem(CLE_TOKEN)).toBe('COURANT');
    expect(localStorage.getItem('unipresence_token')).toBeNull();
  });

  it('reprend la clé nue de la langue', async () => {
    const { migrerClesLocales, CLE_LANGUE } = await import('../../src/shared/services/cles-stockage');
    localStorage.setItem('lang', 'en-US');

    migrerClesLocales();

    expect(localStorage.getItem(CLE_LANGUE)).toBe('en-US');
    expect(localStorage.getItem('lang')).toBeNull();
  });

  it('ne touche pas aux clés déjà à jour', async () => {
    const { migrerClesLocales, CLE_TOKEN } = await import('../../src/shared/services/cles-stockage');
    localStorage.setItem(CLE_TOKEN, 'JETON');
    localStorage.setItem('autre-appli', 'CLE');

    migrerClesLocales();

    expect(localStorage.getItem(CLE_TOKEN)).toBe('JETON');
    expect(localStorage.getItem('autre-appli')).toBe('CLE');
  });
});
