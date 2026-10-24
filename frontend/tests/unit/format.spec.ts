import { describe, expect, it, vi } from 'vitest';

// `shared/utils/format` lit la langue active dans boot/i18n, qui dépend de
// l'application Quasar : on fige la locale française.
vi.mock('../../src/boot/i18n', () => ({
  getAppLocale: () => 'fr-FR',
  i18n: { global: { te: () => false, t: (cle: string) => cle } },
}));

import {
  DEVISE,
  dateCourteLisible,
  dateHeureLisible,
  dateLisible,
  dateLongueLisible,
  montantLisible,
} from '../../src/shared/utils/format';

/** La locale française sépare les milliers par une espace fine insécable. */
const sansEspacesFines = (texte: string) => texte.replace(/[\u202f\u00a0]/g, ' ');

describe('shared/utils/format', () => {
  it('la devise de l’établissement est le franc guinéen', () => {
    expect(DEVISE).toBe('GNF');
  });

  it('montantLisible formate le nombre dans la langue active', () => {
    expect(sansEspacesFines(montantLisible(12000))).toBe('12 000');
    expect(sansEspacesFines(montantLisible(12000.4))).toBe('12 000');
    expect(montantLisible(null)).toBe('0');
    expect(montantLisible(undefined)).toBe('0');
  });

  it('montantLisible n’ajoute la devise que si on la demande', () => {
    expect(sansEspacesFines(montantLisible(12000, DEVISE))).toBe('12 000 GNF');
    expect(sansEspacesFines(montantLisible(12000, 'EUR'))).toBe('12 000 EUR');
    expect(sansEspacesFines(montantLisible(12000, ''))).toBe('12 000');
  });

  it('les dates se lisent dans la langue active', () => {
    expect(dateLisible('2026-03-12T10:00:00Z')).toBe('12/03/2026');
    expect(dateLisible(null)).toBe('—');
    expect(dateLisible('pas une date')).toBe('pas une date');
  });

  it('la date longue et la date courte ont leur format', () => {
    expect(dateLongueLisible('2026-03-12T10:00:00Z')).toBe('12 mars 2026');
    expect(dateCourteLisible('2026-03-12T10:00:00Z')).toBe('12 mars 2026');
    expect(dateLongueLisible(null)).toBe('—');
    expect(dateLongueLisible('pas une date')).toBe('—');
  });

  it('la date-heure se lit dans la langue active', () => {
    expect(dateHeureLisible('2026-03-12T10:00:00Z')).toContain('2026');
    expect(dateHeureLisible(null)).toBe('—');
  });
});
