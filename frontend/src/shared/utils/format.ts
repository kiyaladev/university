/** Formateurs d'affichage : dates, durées, montants et nombres, dans la langue active. */
import { getAppLocale } from '@/boot/i18n';

/** "1h45" à partir de minutes. */
export function dureeLisible(minutes?: number | null): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/** "12/08/2026" à partir d'une date ISO. */
export function dateLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(getAppLocale());
}

export function dateHeureLisible(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(getAppLocale());
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

export function montantLisible(v?: number | null): string {
  return (v ?? 0).toLocaleString(getAppLocale(), { maximumFractionDigits: 0 });
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
