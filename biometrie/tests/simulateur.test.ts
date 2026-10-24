/**
 * Simulateur : il permet de dérouler la chaîne complète sans lecteur physique.
 * Il ne prouve rien — et le dit.
 */
import { describe, expect, it } from 'bun:test';
import { PiloteSimulateur } from '../src/pilotes/simulateur';

describe('Pilote simulateur', () => {
  it('se déclare comme simulé', () => {
    const pilote = new PiloteSimulateur();
    expect(pilote.simule).toBe(true);
    expect(pilote.nom).toBe('simulateur');
  });

  it('reproduit le gabarit demandé', async () => {
    const pilote = new PiloteSimulateur();
    await pilote.initialiser();
    pilote.preparerDoigt('GABARIT-1');

    const capture = await pilote.capturer();

    expect(capture.template).toBe('GABARIT-1');
    expect(capture.qualite).toBeGreaterThanOrEqual(0);
    expect(capture.qualite).toBeLessThanOrEqual(100);
    expect(capture.doigt).toBeTruthy();
  });

  it('reconnaît le même gabarit', async () => {
    const pilote = new PiloteSimulateur();
    expect(await pilote.comparer('GABARIT-1', 'GABARIT-1')).toBeGreaterThanOrEqual(60);
  });

  it('refuse un gabarit différent', async () => {
    const pilote = new PiloteSimulateur();
    expect(await pilote.comparer('GABARIT-1', 'AUTRE-GABARIT')).toBeLessThan(60);
  });

  it('rend un score nul si un gabarit est vide', async () => {
    const pilote = new PiloteSimulateur();
    expect(await pilote.comparer('', 'GABARIT-1')).toBe(0);
    expect(await pilote.comparer('GABARIT-1', '')).toBe(0);
  });
});
