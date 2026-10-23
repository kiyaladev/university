/**
 * Gabarit commun des documents imprimables A4 (HTML ouvert dans un nouvel
 * onglet, imprimé par le navigateur → PDF).
 *
 * Seize gabarits recopiaient jusqu'ici la même feuille de style, avec deux
 * palettes concurrentes (bleu #1565c0 et vert sombre #10251E). L'enveloppe
 * — doctype, langue, titre, @page, typographie, tableaux, signatures, QR,
 * pied de page, impression automatique — vit désormais ici, dans la palette
 * de DESIGN.md : l'encre et le gris portent tout, la couleur ne dit qu'un état.
 *
 * Contrat d'échappement : `titre`, `lang` et le nom de l'établissement sont du
 * TEXTE BRUT, échappé ici. `entete`, `corps` et `piedDePage` sont du HTML déjà
 * composé par le gabarit appelant, qui en a échappé chaque valeur métier : il
 * est inséré tel quel, sans second échappement.
 */
import { echapper } from './echappement';
import type { Etablissement } from './etablissement';

/**
 * Palette d'impression, relevée sur DESIGN.md (frontmatter `colors`).
 *
 * `encreTertiaire` (#86868B) ne porte que des filets et des traits : sur du
 * blanc il ne tient que 3,6:1, trop peu pour du texte. Toute mention lisible
 * (pied de page, numéro de badge, « aucun … ») prend `encreDouce` (#6E6E73,
 * 5,1:1), qui reste un gris de la même famille.
 */
export const PALETTE_IMPRESSION = {
  encre: '#1D1D1F',
  encreDouce: '#6E6E73',
  encreTertiaire: '#86868B',
  grisFond: '#F5F5F7',
  grisInerte: '#E8E8ED',
  grisFilet: '#D2D2D7',
  blanc: '#FFFFFF',
  vert: '#007A4D',
  vertFond: '#EFF7F2',
  jauneTexte: '#8A6300',
  jauneFond: '#FFF8E1',
  rouge: '#CE1126',
  rougeFond: '#FDF0F2',
  excuse: '#E05A6B',
  remplace: '#2E9E70',
} as const;

const P = PALETTE_IMPRESSION;

/** Pile typographique « texte » de DESIGN.md. */
export const POLICE_IMPRESSION =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif";

export type OrientationA4 = 'portrait' | 'paysage';

export interface OptionsPageA4 {
  /** Titre de l'onglet et du document — texte brut, échappé ici. */
  titre: string;
  /**
   * Contenu HTML du bandeau `<header>`. Absent : nom de l'établissement et
   * titre. `null` : pas de bandeau (étiquettes, fiches sans en-tête).
   */
  entete?: string | null;
  /** Corps du document, HTML déjà échappé. */
  corps: string;
  /** Contenu HTML du `<footer>` ; absent : pas de pied de page. */
  piedDePage?: string;
  /** Langue du contenu (attribut `lang`), par exemple `fr`. */
  lang: string;
  /** Identité de l'établissement, ou son seul nom. */
  etablissement: Etablissement | string;
  /** Portrait par défaut. */
  orientation?: OrientationA4;
  /** Marge de la page imprimée (`@page`), 10 mm par défaut. */
  marge?: string;
  /** Règles propres au document, ajoutées après le style commun. */
  styles?: string;
  /** Ouvre la boîte d'impression au chargement (par défaut : oui). */
  impressionAuto?: boolean;
}

/** Style commun des documents imprimés. */
export function styleImpression(orientation: OrientationA4 = 'portrait', marge = '10mm'): string {
  const format = orientation === 'paysage' ? 'A4 landscape' : 'A4';
  return `
  * { box-sizing: border-box; }
  body { font-family: ${POLICE_IMPRESSION}; color: ${P.encre}; margin: 0; padding: 16mm 12mm; font-size: 12px; line-height: 1.45; }
  header { border-bottom: 2px solid ${P.encre}; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .coordonnees { font-size: 11px; color: ${P.encreDouce}; margin-top: 2px; }
  .titre { font-size: 20px; font-weight: 600; margin-top: 6px; letter-spacing: -0.019em; }
  .sous-titre { color: ${P.encreDouce}; margin-top: 2px; }
  .meta { display: flex; gap: 18px; margin: 12px 0 4px; font-size: 11px; color: ${P.encreDouce}; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid ${P.grisFilet}; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: ${P.grisFond}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
  tbody tr:nth-child(even) { background: #FAFAFB; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .kpis { display: flex; gap: 10px; margin: 12px 0; flex-wrap: wrap; }
  .kpi { flex: 1 1 120px; border: 1px solid ${P.grisFilet}; border-radius: 8px; padding: 8px 10px; }
  .kpi span { display: block; font-size: 11px; color: ${P.encreDouce}; text-transform: uppercase; }
  .kpi strong { font-size: 20px; font-variant-numeric: tabular-nums; }
  .badge { padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 600; background: ${P.grisInerte}; color: ${P.encre}; }
  .PRESENT { background: ${P.vertFond}; color: ${P.vert}; }
  .RETARD { background: ${P.jauneFond}; color: ${P.jauneTexte}; }
  .ABSENT { background: ${P.rougeFond}; color: ${P.rouge}; }
  .EXCUSE { background: ${P.rougeFond}; color: ${P.excuse}; }
  .REMPLACE, .DEPART_ANTICIPE { background: ${P.vertFond}; color: ${P.remplace}; }
  .NON_CONTROLE { background: transparent; color: ${P.encreDouce}; }
  .qr { text-align: center; margin-top: 26px; }
  .verification { margin-top: 24px; border-top: 1px solid ${P.grisFilet}; padding-top: 12px; text-align: center; }
  .verification .mention { font-size: 11px; color: ${P.encreDouce}; margin-top: 8px; word-break: break-all; }
  .verification .numero-clair { font-size: 12px; font-weight: 700; letter-spacing: .4px; margin-top: 4px; }
  .revoque { margin-top: 12px; border: 2px solid ${P.rouge}; color: ${P.rouge}; padding: 8px; text-align: center; font-weight: 700; letter-spacing: .6px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 36px; }
  .signature { width: 30%; border-top: 1px solid ${P.encreTertiaire}; padding-top: 4px; text-align: center; color: ${P.encreDouce}; }
  footer { margin-top: 22px; font-size: 11px; color: ${P.encreDouce}; display: flex; justify-content: space-between; border-top: 1px solid ${P.grisFilet}; padding-top: 6px; }
  @media print { body { padding: 8mm; } .no-print { display: none; } }
  @page { size: ${format}; margin: ${marge}; }
`;
}

/** Planche de quatre étiquettes autocollantes (inventaire, support IT). */
export const STYLE_ETIQUETTES = `
  body { padding: 0; }
  .entete { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid ${P.encre}; padding-bottom: 4px; margin-bottom: 6mm; }
  .etab { font-size: 12px; }
  .consigne { font-size: 11px; color: ${P.encreDouce}; }
  .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
  .etiquette { border: 1.5px dashed ${P.encreDouce}; padding: 5mm 4mm; text-align: center; page-break-inside: avoid; }
  .libelle { font-weight: 700; text-transform: uppercase; letter-spacing: .03em; font-size: 12px; margin-top: 2mm; }
  @media print { body { padding: 0; } }
`;

const IMPRESSION_AUTO =
  "<script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>";

/** Garde un code de langue BCP 47 simple ; tout le reste retombe sur `fr`. */
function langue(lang: string): string {
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang ?? '') ? lang : 'fr';
}

/** Document HTML A4 complet : enveloppe et style commun autour du contenu. */
export function pageA4(options: OptionsPageA4): string {
  const nom = typeof options.etablissement === 'string' ? options.etablissement : (options.etablissement?.nom ?? '');
  const entete =
    options.entete === undefined
      ? `<div class="etab">${echapper(nom)}</div>
    <div class="titre">${echapper(options.titre)}</div>`
      : options.entete;

  return `<!doctype html>
<html lang="${echapper(langue(options.lang))}"><head><meta charset="utf-8">
<title>${echapper(options.titre)}</title>
<meta name="author" content="${echapper(nom)}">
<style>${styleImpression(options.orientation, options.marge)}${options.styles ?? ''}</style></head>
<body>
${
  entete
    ? `  <header>
    ${entete}
  </header>
`
    : ''
}  ${options.corps}
${
  options.piedDePage !== undefined
    ? `  <footer>${options.piedDePage}</footer>
`
    : ''
}${
    options.impressionAuto === false
      ? ''
      : `  ${IMPRESSION_AUTO}
`
  }</body></html>`;
}
