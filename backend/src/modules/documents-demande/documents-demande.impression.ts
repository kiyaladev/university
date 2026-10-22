/**
 * Fiche imprimable d'une demande de document (ouverte dans un nouvel onglet
 * avec un jeton vérifié par le contrôleur). Le contenu métier est composé ici,
 * l'enveloppe A4 vient de `common/impression`.
 */
import { echapper, Etablissement, pageA4 } from '../../common/impression';

/** Règles propres à la fiche ; le reste vient de `pageA4`. */
const STYLE = `
  body { padding: 24px; }
  th { width: 26%; }
`;

export function demandeDocumentHtml(demande: any, etablissement: Etablissement): string {
  const numero = echapper(demande.numero);
  const type = echapper(demande.type);
  const etudiant = echapper(demande.etudiant
    ? `${demande.etudiant.prenom ?? ''} ${demande.etudiant.nom ?? ''}`.trim()
    : '—');
  const matricule = echapper(demande.etudiant?.matricule ?? '—');
  const inscription = echapper(demande.inscription?.numero ?? '—');
  return pageA4({
    titre: `Demande ${demande.numero ?? ''}`,
    lang: 'fr',
    etablissement,
    entete: null,
    impressionAuto: false,
    styles: STYLE,
    corps: `<h1>Demande ${numero}</h1>
<table><tbody><tr><th>Type</th><td>${type}</td></tr>
<tr><th>Étudiant</th><td>${etudiant} (${matricule})</td></tr>
<tr><th>Inscription</th><td>${inscription}</td></tr>
<tr><th>Statut</th><td>${echapper(demande.statut)}</td></tr>
<tr><th>Frais</th><td>${echapper(demande.frais)} ${echapper(demande.devise)}</td></tr>
<tr><th>Créée le</th><td>${echapper(demande.creeLe)}</td></tr>
</tbody></table>`,
  });
}
