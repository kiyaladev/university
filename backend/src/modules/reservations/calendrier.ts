import { isoDate, toDateOnly } from '../../common/utils';

/**
 * Découpe une période en jours consécutifs (YYYY-MM-DD). La vue semaine du
 * frontend s'appuie dessus : une ligne par jour, les mêmes dates partout.
 */
export function joursEntre(dateDebut: string, dateFin: string): string[] {
  const debut = toDateOnly(dateDebut);
  const fin = toDateOnly(dateFin);
  const jours: string[] = [];
  for (let d = new Date(debut); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    jours.push(isoDate(d));
  }
  return jours;
}