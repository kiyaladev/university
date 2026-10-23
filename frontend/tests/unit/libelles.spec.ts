import { beforeEach, describe, expect, it, vi } from 'vitest';

// `shared/utils/libelles` lit la langue et les traductions dans boot/i18n, qui dépend
// de l'application Quasar : on le remplace par un catalogue minimal.
const etat = vi.hoisted(() => ({
  locale: 'fr-FR' as 'fr-FR' | 'en-US',
  messages: {} as Record<string, string>,
}));

vi.mock('../../src/boot/i18n', () => ({
  getAppLocale: () => etat.locale,
  i18n: {
    global: {
      te: (cle: string) => cle in etat.messages,
      t: (cle: string) => etat.messages[cle],
    },
  },
}));

import {
  LIBELLE_ROLE,
  dateLisible,
  decalerJours,
  dureeLisible,
  montantLisible,
  optionsDepuis,
  pourcentLisible,
} from '../../src/shared/utils/libelles';
import { accueilParRole } from '../../src/shared/utils/accueil';

/** Les séparateurs de milliers varient (espace fine insécable…) : on les unifie. */
const espaces = (s: string) => s.replace(/\s/g, ' ');

beforeEach(() => {
  etat.locale = 'fr-FR';
  etat.messages = {};
});

describe('formats de date et de durée', () => {
  it('dateLisible suit la langue active et tolère les valeurs absentes ou invalides', () => {
    expect(dateLisible('2026-08-12T10:00:00')).toBe('12/08/2026');
    etat.locale = 'en-US';
    expect(dateLisible('2026-08-12T10:00:00')).toBe('8/12/2026');
    expect(dateLisible(null)).toBe('—');
    expect(dateLisible('pas une date')).toBe('pas une date');
  });

  it('decalerJours franchit les fins de mois et d’année', () => {
    expect(decalerJours('2026-01-31', 1)).toBe('2026-02-01');
    expect(decalerJours('2026-12-31', 1)).toBe('2027-01-01');
    expect(decalerJours('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('dureeLisible rend des heures et minutes', () => {
    expect(dureeLisible(105)).toBe('1h45');
    expect(dureeLisible(120)).toBe('2h00');
    expect(dureeLisible(40)).toBe('40 min');
    expect(dureeLisible(0)).toBe('—');
    expect(dureeLisible(undefined)).toBe('—');
  });

  it('montants et pourcentages à la française', () => {
    expect(espaces(montantLisible(1500000))).toBe('1 500 000');
    expect(montantLisible(undefined)).toBe('0');
    expect(espaces(pourcentLisible(94.25))).toBe('94,3 %');
  });
});

describe('libellés traduits', () => {
  it('reprennent le français par défaut quand la clé manque', () => {
    expect(LIBELLE_ROLE.SCOLARITE).toBe('Scolarité');
  });

  it('suivent le catalogue vue-i18n quand la clé existe, à chaque lecture', () => {
    etat.messages['libelles.role.SCOLARITE'] = 'Registrar';
    expect(LIBELLE_ROLE.SCOLARITE).toBe('Registrar');
    etat.messages = {};
    expect(LIBELLE_ROLE.SCOLARITE).toBe('Scolarité');
  });

  it('optionsDepuis prépare les options d’un q-select', () => {
    expect(optionsDepuis({ A: 'Alpha', B: 'Bêta' })).toEqual([
      { value: 'A', label: 'Alpha' },
      { value: 'B', label: 'Bêta' },
    ]);
  });

  it('accueilParRole envoie chaque rôle vers son écran de départ', () => {
    expect(accueilParRole('CONTROLEUR')).toBe('/controle');
    expect(accueilParRole('ETUDIANT')).toBe('/portail');
    expect(accueilParRole('ADMIN')).toBe('/');
    expect(accueilParRole(null)).toBe('/');
  });
});
