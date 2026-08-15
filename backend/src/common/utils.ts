/** Utilitaires partagés : heures "HH:mm", dates ISO, distance géographique. */

/**
 * Base d'URL publique du FRONT (et non de l'API) pour les QR et liens
 * imprimés : le formulaire d'impression est servi par l'API mais l'utilisateur
 * est sur la SPA. Priorité : variable d'environnement URL_APPLICATION, puis
 * en-tête Origin de la requête (le navigateur l'envoie lors de window.open),
 * puis le Host de la requête en dernier recours.
 */
export function baseApplicative(req: {
  protocol: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const envUrl = process.env.URL_APPLICATION?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('http')) {
    return origin.replace(/\/+$/, '');
  }
  const host = req.headers.host;
  if (typeof host === 'string' && host) {
    const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return '';
}

/** "08:30" -> 510 minutes depuis minuit. Retourne null si invalide. */
export function toMinutes(heure?: string | null): number | null {
  if (!heure) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 -> "08:30" */
export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Durée en minutes entre deux heures "HH:mm" (0 si incohérent). */
export function dureeMinutes(debut?: string | null, fin?: string | null): number {
  const d = toMinutes(debut);
  const f = toMinutes(fin);
  if (d === null || f === null) return 0;
  return Math.max(0, f - d);
}

/** Normalise une date (string ou Date) en date UTC à minuit — colonnes @db.Date. */
export function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-08-12" à partir d'une Date. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Jour de la semaine 1=lundi … 7=dimanche. */
export function jourSemaine(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

export const JOURS = [
  '',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

/** Distance en mètres entre deux points GPS (formule de haversine). */
export function distanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Arrondi à 2 décimales pour les taux et volumes horaires. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Pourcentage sûr (0 si dénominateur nul). */
export function pct(num: number, den: number): number {
  return den > 0 ? round2((num / den) * 100) : 0;
}
