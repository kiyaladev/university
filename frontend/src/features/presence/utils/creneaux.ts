import type { Creneau } from '@/types';

/**
 * Petits calculs de l'emploi du temps, partagés par la grille et par la liste
 * du jour : la durée d'un créneau et sa période de validité.
 */

/** Minutes depuis minuit, pour "08:30". */
export function minutes(h: string): number {
  return Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
}

/** Durée d'un créneau, en heures. */
export function dureeHeuresCreneau(creneau: Creneau): number {
  return (minutes(creneau.heureFin) - minutes(creneau.heureDebut)) / 60;
}

/**
 * « du 01/01 au 31/01 » — ce qu'il faut lire sur le bloc, rien de plus.
 *
 * La période est optionnelle : un créneau sans période vaut toute l'année, et
 * n'affiche alors rien.
 */
export function libellePeriodeCreneau(
  creneau: Creneau,
  t: (cle: string, params?: Record<string, unknown>) => string,
): string {
  const jjmm = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
  if (creneau.dateDebut && creneau.dateFin) {
    return t('emploiDuTemps.period.fromTo', { from: jjmm(creneau.dateDebut), to: jjmm(creneau.dateFin) });
  }
  if (creneau.dateDebut) return t('emploiDuTemps.period.from', { from: jjmm(creneau.dateDebut) });
  if (creneau.dateFin) return t('emploiDuTemps.period.until', { to: jjmm(creneau.dateFin) });
  return '';
}
