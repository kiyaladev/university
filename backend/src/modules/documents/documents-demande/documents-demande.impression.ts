/**
 * Fiche imprimable d'une demande de document (ouverte dans un nouvel onglet
 * avec un jeton vérifié par le contrôleur). Le contenu métier est composé ici,
 * l'enveloppe A4 vient de `common/impression`.
 */
import { Prisma, StatutDemande, TypeDemandeDocument } from '@prisma/client';
import { echapper, Etablissement, pageA4 } from '../../../common/impression/index';

/**
 * Demande de document telle que la compose la fiche imprimable : seul ce que
 * la fiche montre est décrit ici, le reste de la charge utile n'est pas lu.
 */
export type DemandeImprimable = {
  numero: string;
  type: TypeDemandeDocument;
  statut: StatutDemande;
  frais: Prisma.Decimal;
  devise: string;
  createdAt: Date;
  etudiant: { matricule: string; nom: string; prenom: string } | null;
  inscription: { numero: string } | null;
};

/** Règles propres à la fiche ; le reste vient de `pageA4`. */
const STYLE = `
  body { padding: 24px; }
  th { width: 26%; }
`;

export function demandeDocumentHtml(demande: DemandeImprimable, etablissement: Etablissement): string {
  const numero = echapper(demande.numero);
  const type = echapper(demande.type);
  const etudiant = echapper(
    demande.etudiant ? `${demande.etudiant.prenom ?? ''} ${demande.etudiant.nom ?? ''}`.trim() : '—',
  );
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
<tr><th>Créée le</th><td>${echapper(demande.createdAt)}</td></tr>
</tbody></table>`,
  });
}
