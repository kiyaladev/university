import {
  distanceMetres,
  dureeMinutes,
  fromMinutes,
  isoDate,
  jourSemaine,
  pct,
  toDateOnly,
  toMinutes,
} from './utils';

describe('utilitaires horaires', () => {
  it('convertit une heure "HH:mm" en minutes', () => {
    expect(toMinutes('08:00')).toBe(480);
    expect(toMinutes('13:45')).toBe(825);
    expect(toMinutes('00:00')).toBe(0);
  });

  it('rejette les heures invalides', () => {
    expect(toMinutes('25:00')).toBeNull();
    expect(toMinutes('08:70')).toBeNull();
    expect(toMinutes('huit heures')).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
  });

  it('reconstruit une heure lisible', () => {
    expect(fromMinutes(480)).toBe('08:00');
    expect(fromMinutes(825)).toBe('13:45');
  });

  it('calcule la durée effective d’une séance', () => {
    expect(dureeMinutes('08:00', '10:00')).toBe(120);
    expect(dureeMinutes('08:22', '09:58')).toBe(96);
  });

  it('renvoie 0 quand les heures sont incohérentes ou absentes', () => {
    expect(dureeMinutes('10:00', '08:00')).toBe(0);
    expect(dureeMinutes('10:00', undefined)).toBe(0);
  });
});

describe('utilitaires de dates', () => {
  it('normalise une date en minuit UTC', () => {
    expect(toDateOnly('2026-08-12').toISOString()).toBe('2026-08-12T00:00:00.000Z');
    expect(isoDate(toDateOnly('2026-08-12'))).toBe('2026-08-12');
  });

  it('numérote les jours de 1 (lundi) à 7 (dimanche)', () => {
    expect(jourSemaine(toDateOnly('2026-08-10'))).toBe(1); // lundi
    expect(jourSemaine(toDateOnly('2026-08-15'))).toBe(6); // samedi
    expect(jourSemaine(toDateOnly('2026-08-16'))).toBe(7); // dimanche
  });
});

describe('utilitaires statistiques', () => {
  it('calcule la distance entre le contrôleur et la salle', () => {
    // ~111 m au nord du point de départ
    expect(distanceMetres(9.5335, -13.6875, 9.5345, -13.6875)).toBeGreaterThan(100);
    expect(distanceMetres(9.5335, -13.6875, 9.5345, -13.6875)).toBeLessThan(120);
    expect(distanceMetres(9.5335, -13.6875, 9.5335, -13.6875)).toBe(0);
  });

  it('évite la division par zéro dans les taux', () => {
    expect(pct(3, 4)).toBe(75);
    expect(pct(0, 0)).toBe(0);
  });
});
