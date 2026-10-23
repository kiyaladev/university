/** Formateurs d'affichage : dates, durées, montants et nombres, dans la langue active. */
import { getAppLocale } from '@/boot/i18n';

/**
 * Devise des montants de l'établissement : le franc guinéen.
 *
 * Elle était écrite en dur dans une quinzaine d'écrans (formulaires de
 * paiement, de recharge, de formation…). Elle a un nom, maintenant.
 */
export const DEVISE = 'GNF';

/** "1h45" à partir de minutes. */
export function dureeLisible(minutes?: number | null): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/**
 * "12/08/2026" à partir d'une date ISO.
 *
 * `options` : format d'affichage (`{ day: '2-digit', month: 'long', … }`).
 * Sans option, la langue active décide — « 12/08/2026 » en français.
 */
export function dateLisible(iso?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(getAppLocale(), options);
}

/**
 * "12 mars 2026" — la date en toutes lettres.
 *
 * Trois écrans écrivaient ce format à la main ; il a un nom.
 */
export function dateLongueLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getAppLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

/** "12 mars 2026" — la date au mois abrégé. */
export function dateCourteLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getAppLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateHeureLisible(iso?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(getAppLocale(), options);
}

/** Date du jour au format YYYY-MM-DD (fuseau local). */
export function aujourdhui(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Décale une date ISO de n jours. */
export function decalerJours(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + jours);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Heure courante "HH:mm". */
export function maintenantHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Montant formaté dans la langue active.
 *
 * `devise` : devise affichée après le montant — « 12 000 GNF ». Elle est
 * facultative : les écrans qui affichent la devise d'une ligne (inscription,
 * paiement, facture) l'impriment à côté du nombre et ne doivent pas la voir
 * deux fois. Passez `DEVISE` pour les deux dans une seule expression.
 */
export function montantLisible(v?: number | null, devise?: string): string {
  const nombre = (v ?? 0).toLocaleString(getAppLocale(), { maximumFractionDigits: 0 });
  return devise ? `${nombre} ${devise}` : nombre;
}

/** Nombre à la française : virgule décimale, espace insécable pour les milliers. */
export function nombreLisible(v?: number | null, decimales = 2): string {
  return (v ?? 0).toLocaleString(getAppLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

/** « 85,3 h » plutôt que « 85.3 H ». */
export function heuresLisibles(v?: number | null): string {
  return `${nombreLisible(v, 1)} h`;
}

/** « 94,2 % ». */
export function pourcentLisible(v?: number | null): string {
  return `${nombreLisible(v, 1)} %`;
}
