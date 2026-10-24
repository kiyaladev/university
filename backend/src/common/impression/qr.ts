/**
 * Rendu des QR codes des documents imprimables.
 *
 * Huit modules appelaient `qrcode` directement avec leurs propres options
 * (marge, largeur, correction d'erreur). Le rendu est factorisé ici pour que
 * le même contenu produise exactement la même image partout : seules les
 * options Passed explicitly par l'appelant changent le résultat.
 *
 * Deux formes sont utilisées dans l'application :
 * - `qrSvg` : une balise `<svg>` glissée dans le HTML de la page A4 ;
 * - `qrDataUrl` : une image `data:` encodée en base64, utilisée par les
 *   étiquettes qui ne sont pas des pages HTML (PDF, impression directe).
 */
import * as QRCode from 'qrcode';

/** Options communes aux deux formes de rendu. */
export interface OptionsQr {
  /** Largeur du code en pixels. */
  width?: number;
  /** Marge blanche autour du code, en modules. */
  margin?: number;
  /** Niveau de correction d'erreur. */
  errorCorrectionLevel?: QRCode.QRCodeErrorCorrectionLevel;
}

/** Valeurs par défaut : celles de la bibliothèque `qrcode`, rendues explicites. */
const DEFAUTS_SVG: Required<OptionsQr> = { width: 220, margin: 1, errorCorrectionLevel: 'M' };
const DEFAUTS_DATA_URL: Required<OptionsQr> = { width: 320, margin: 1, errorCorrectionLevel: 'M' };

/**
 * QR code au format SVG, prêt à être inséré dans une page HTML.
 * Le contenu est encodé tel quel : il ne doit contenir que l'URL publique.
 */
export async function qrSvg(texte: string, options: OptionsQr = {}): Promise<string> {
  return QRCode.toString(texte, { type: 'svg', ...DEFAUTS_SVG, ...options });
}

/**
 * QR code au format `data:` (PNG encodé en base64), utilisable dans un
 * `<img src="…">` comme dans une étiquette imprimée hors HTML.
 */
export async function qrDataUrl(texte: string, options: OptionsQr = {}): Promise<string> {
  return QRCode.toDataURL(texte, { ...DEFAUTS_DATA_URL, ...options });
}
