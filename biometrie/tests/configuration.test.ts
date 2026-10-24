/**
 * Configuration : le fichier d'appareil est un secret, hors du dépôt, lisible
 * par son seul propriétaire. La passerelle doit refuser de démarrer sinon.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chargerConfiguration,
  cheminConfigParDefaut,
  ErreurConfiguration,
  lireFichierAppareil,
  SECRET_EXEMPLE,
} from '../src/configuration';

const APPAREIL_ID = '3f2b6c1a-9d4e-4a71-8c2f-0b5a7e9d1c33';
const SECRET_APPAREIL = 'a'.repeat(64);

// Deux répertoires distincts : l'un tient lieu de dépôt (interdit aux
// fichiers de configuration), l'autre accueille le fichier de configuration.
let dossier = '';
let depot = '';
beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'biometrie-config-'));
  depot = mkdtempSync(join(tmpdir(), 'biometrie-depot-'));
});
afterEach(() => {
  rmSync(dossier, { recursive: true, force: true });
  rmSync(depot, { recursive: true, force: true });
});

function ecrireFichier(nom: string, contenu: unknown, mode = 0o600) {
  const chemin = join(dossier, nom);
  writeFileSync(chemin, typeof contenu === 'string' ? contenu : JSON.stringify(contenu), { mode });
  chmodSync(chemin, mode);
  return chemin;
}

describe('Configuration — fichier d’appareil', () => {
  it('lit un appareil enrôlé', () => {
    const chemin = ecrireFichier('appareil.json', { appareilId: APPAREIL_ID, secret: SECRET_APPAREIL });
    const lu = lireFichierAppareil(chemin, depot);

    expect(lu?.appareil).toEqual({ appareilId: APPAREIL_ID, secret: SECRET_APPAREIL });
  });

  it('refuse un fichier lisible par d’autres comptes', () => {
    const chemin = ecrireFichier('appareil.json', { appareilId: APPAREIL_ID, secret: SECRET_APPAREIL }, 0o644);
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(ErreurConfiguration);
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(/600/);
  });

  it('refuse un fichier lisible par le groupe', () => {
    const chemin = ecrireFichier('appareil.json', { appareilId: APPAREIL_ID, secret: SECRET_APPAREIL }, 0o640);
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(ErreurConfiguration);
  });

  it('refuse un fichier placé dans le dépôt', () => {
    const chemin = join(depot, 'appareil.json');
    writeFileSync(chemin, JSON.stringify({ appareilId: APPAREIL_ID, secret: SECRET_APPAREIL }), { mode: 0o600 });
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(/dépôt/);
  });

  it('refuse un identifiant qui n’est pas un UUID', () => {
    const chemin = ecrireFichier('appareil.json', { appareilId: 'pas-un-uuid', secret: SECRET_APPAREIL });
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(/UUID/);
  });

  it('refuse une clé mal formée', () => {
    const chemin = ecrireFichier('appareil.json', { appareilId: APPAREIL_ID, secret: 'court' });
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(/hexadécimaux/);
  });

  it('refuse un JSON invalide', () => {
    const chemin = ecrireFichier('appareil.json', '{ pas du json');
    expect(() => lireFichierAppareil(chemin, depot)).toThrow(/JSON/);
  });

  it('ignore un fichier absent', () => {
    expect(lireFichierAppareil(join(dossier, 'absent.json'), depot)).toBeNull();
  });
});

describe('Configuration — assemblage', () => {
  it('passe en mode appareil quand un fichier est présent', () => {
    const chemin = ecrireFichier('appareil.json', {
      appareilId: APPAREIL_ID,
      secret: SECRET_APPAREIL,
      port: 5045,
      origines: ['https://university.naimba.com'],
    });

    const configuration = chargerConfiguration({ env: {}, cheminConfig: chemin, racineDepot: depot });

    expect(configuration.mode).toBe('appareil');
    expect(configuration.appareil?.appareilId).toBe(APPAREIL_ID);
    expect(configuration.secret).toBe(SECRET_APPAREIL);
    expect(configuration.port).toBe(5045);
    expect(configuration.origines).toEqual(['https://university.naimba.com']);
  });

  it('retombe sur le secret partagé et prévient', () => {
    const configuration = chargerConfiguration({
      env: { BIOMETRIE_SECRET: 'secret-partage-0001' },
      cheminConfig: null,
      racineDepot: depot,
    });

    expect(configuration.mode).toBe('secret-partage');
    expect(configuration.secret).toBe('secret-partage-0001');
    expect(configuration.avertissements.join(' ')).toMatch(/secret partagé/);
  });

  it('avertit que le chemin est refusé en production sans secret', () => {
    const configuration = chargerConfiguration({
      env: {},
      cheminConfig: null,
      racineDepot: depot,
    });

    expect(configuration.secret).toBe(SECRET_EXEMPLE);
    expect(configuration.avertissements.join(' ')).toMatch(/production/);
  });

  it('laisse l’environnement primer sur le fichier pour le port', () => {
    const chemin = ecrireFichier('appareil.json', { appareilId: APPAREIL_ID, secret: SECRET_APPAREIL, port: 5045 });

    const configuration = chargerConfiguration({
      env: { PORT: '5050' },
      cheminConfig: chemin,
      racineDepot: depot,
    });

    expect(configuration.port).toBe(5050);
  });

  it('refuse un fichier d’appareil demandé mais absent', () => {
    expect(() =>
      chargerConfiguration({ env: {}, cheminConfig: join(dossier, 'absent.json'), racineDepot: depot }),
    ).toThrow(/introuvable/);
  });

  it('place le fichier de configuration hors du dépôt par défaut', () => {
    const chemin = cheminConfigParDefaut({ XDG_CONFIG_HOME: '/tmp/xdg' });
    expect(chemin).toBe('/tmp/xdg/university/biometrie.json');
  });
});
