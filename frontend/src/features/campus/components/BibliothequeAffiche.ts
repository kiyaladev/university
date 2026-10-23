/**
 * Aides d'affichage de la bibliothèque : couleur du score de plagiat et
 * surlignage du terme recherché. Le tableau, les cartes et l'aperçu d'un
 * document partagent ces règles : elles vivent ici, pas dans chaque vue.
 */

/** Rouge au-delà de 80, orange dès 50, vert en dessous. */
export function couleurPlagiat(score: number): string {
  if (score >= 80) return 'negative';
  if (score >= 50) return 'warning';
  return 'positive';
}

/** Icône du badge : signalement, avertissement, ou validation. */
export function iconePlagiat(score: number): string {
  if (score >= 80) return 'report';
  if (score >= 50) return 'warning';
  return 'verified';
}

/**
 * Échappe le texte puis surligne le terme cherché.
 *
 * `terme` est le texte de recherche, pas l'identifiant du document choisi :
 * surligner un identifiant n'aurait aucun sens.
 */
export function surligner(texte: string, terme: string): string {
  const echappe = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const recherche = terme.trim();
  if (!recherche) return echappe;
  const motif = recherche.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return echappe.replace(new RegExp(`(${motif})`, 'gi'), '<mark>$1</mark>');
}
