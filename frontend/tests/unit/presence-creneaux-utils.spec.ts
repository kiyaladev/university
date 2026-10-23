import { describe, expect, it } from 'vitest';

import { dureeHeuresCreneau, libellePeriodeCreneau, minutes } from '../../src/features/presence/utils/creneaux';
import type { Creneau } from '../../src/types';

const creneau: Creneau = {
  id: 'c1',
  affectationId: 'a1',
  jourSemaine: 1,
  heureDebut: '08:00',
  heureFin: '10:30',
  type: 'CM',
  actif: true,
};

describe('features/presence/utils/creneaux', () => {
  it('convertit une heure en minutes depuis minuit', () => {
    expect(minutes('08:30')).toBe(510);
    expect(minutes('00:00')).toBe(0);
  });

  it('calcule la durée d’un créneau en heures', () => {
    expect(dureeHeuresCreneau(creneau)).toBe(2.5);
  });

  it('affiche la période complète d’un créneau', () => {
    const t = (cle: string, params?: Record<string, unknown>) =>
      params ? `${cle}:${Object.values(params).join('-')}` : cle;

    expect(libellePeriodeCreneau({ ...creneau, dateDebut: '2026-01-05', dateFin: '2026-03-31' }, t)).toBe(
      'emploiDuTemps.period.fromTo:05/01-31/03',
    );
  });

  it('affiche une période ouverte', () => {
    const t = (cle: string, params?: Record<string, unknown>) =>
      params ? `${cle}:${Object.values(params).join('-')}` : cle;

    expect(libellePeriodeCreneau({ ...creneau, dateDebut: '2026-01-05' }, t)).toBe('emploiDuTemps.period.from:05/01');
    expect(libellePeriodeCreneau({ ...creneau, dateFin: '2026-03-31' }, t)).toBe('emploiDuTemps.period.until:31/03');
  });

  it('n’affiche rien quand le créneau vaut toute l’année', () => {
    const t = (cle: string) => cle;

    expect(libellePeriodeCreneau(creneau, t)).toBe('');
  });
});
