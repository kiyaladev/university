/**
 * États imprimables de la scolarité LMD : procès-verbal de délibération et
 * bulletin individuel. Le contenu métier est composé ici, l'enveloppe A4
 * (style, en-tête, pied de page) vient de `common/impression`.
 */
import { DecisionJury, Prisma, StatutDeliberation, StatutEvaluation } from '@prisma/client';
import {
  blocIndicateurs,
  echapper,
  Etablissement,
  pageA4,
  PALETTE_IMPRESSION as P,
} from '../../../common/impression/index';
import { noteLisible } from './calcul.service';

/**
 * Chargement de la délibération servie au PV et au bulletin : lignes du jury
 * et étudiant de chaque ligne. Le service s'en sert pour lire exactement ces
 * données (même include, même requête).
 */
export const DELIBERATION_DETAIL_INCLUDE = {
  annee: true,
  promotion: { include: { filiere: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  valideePar: { select: { id: true, nom: true, prenom: true } },
  lignes: {
    include: {
      inscription: {
        include: { etudiant: { select: { nom: true, prenom: true, matricule: true } } },
      },
    },
  },
} satisfies Prisma.DeliberationInclude;

/** Délibération détaillée : lignes du jury, chacune avec son inscrit. */
export type DeliberationDetail = Prisma.DeliberationGetPayload<{ include: typeof DELIBERATION_DETAIL_INCLUDE }>;

/** Ligne du jury (résultat d'un étudiant) telle qu'imprimée. */
export type LigneDeliberation = DeliberationDetail['lignes'][number];

/** Matière (UE) d'un étudiant avec ses épreuves, calculée par le service. */
export interface MatiereEtudiant {
  matiereId: string;
  matiereIntitule: string;
  credits: number;
  matiere: { id: string; code: string; intitule: string; credits: number };
  moyenne: number | null;
  enDefaut: boolean;
  absenceCloturee: boolean;
  epreuves: Array<{
    intitule: string;
    coefficient: number;
    statut: StatutEvaluation;
    note: number | null;
    present: boolean;
  }>;
}

/** Règles propres aux états de délibération ; le reste vient de `pageA4`. */
const STYLE = `
  .ADMIS { background: ${P.vertFond}; color: ${P.vert}; }
  .AJOURNE { background: ${P.jauneFond}; color: ${P.jauneTexte}; }
  .DEFAILLANT { background: ${P.rougeFond}; color: ${P.rouge}; }
  .infos { margin: 10px 0; line-height: 1.6; }
  .mention { font-style: italic; }
`;

const LIBELLE_DECISION: Record<string, string> = {
  ADMIS: 'Admis',
  AJOURNE: 'Ajourné',
  DEFAILLANT: 'Défaillant',
};

const LIBELLE_SESSION: Record<string, string> = {
  NORMALE: 'Session normale',
  RATTRAPAGE: 'Session de rattrapage',
};

function decisionBadge(decision: string): string {
  return `<span class="badge ${decision}">${LIBELLE_DECISION[decision] ?? decision}</span>`;
}

/** `sousTitre` est du HTML dont chaque valeur est déjà échappée. */
function page(etablissement: Etablissement, titre: string, sousTitre: string, contenu: string) {
  const edite = new Date().toLocaleString('fr-FR');
  return pageA4({
    titre,
    lang: 'fr',
    etablissement,
    styles: STYLE,
    entete: `<div class="etab">${echapper(etablissement.nom)}</div>
    <div class="titre">${echapper(titre)}</div>
    <div class="sous-titre">${sousTitre}</div>`,
    corps: contenu,
    piedDePage: `<span>University — scolarité LMD</span><span>Édité le ${edite}</span>`,
  });
}

/** Procès-verbal de délibération (PV du jury). */
export function pvDeliberationHtml(deliberation: DeliberationDetail, etablissement: Etablissement): string {
  const { promotion, annee, session, statut, tauxReussite, lignes, valideePar } = deliberation;

  const lignesHtml = lignes
    .map(
      (l) => `<tr>
        <td>${l.rang ?? '—'}</td>
        <td>${echapper(l.inscription?.numero ?? '')}</td>
        <td>${echapper(l.inscription?.etudiant?.matricule ?? '')}</td>
        <td><strong>${echapper(`${l.inscription?.etudiant?.nom ?? ''} ${l.inscription?.etudiant?.prenom ?? ''}`)}</strong></td>
        <td>${noteLisible(l.moyenne)}</td>
        <td>${decisionBadge(l.decision)}</td>
        <td class="mention">${echapper(l.mention ?? '')}</td>
      </tr>`,
    )
    .join('');

  const contenu = `
    <div class="infos">
      <strong>Promotion :</strong> ${echapper(promotion?.nom ?? '')}${promotion?.filiere?.nom ? ` — ${echapper(promotion.filiere.nom)}` : ''}<br>
      <strong>Année académique :</strong> ${echapper(annee?.libelle ?? '')} · <strong>Session :</strong> ${LIBELLE_SESSION[session] ?? session}
    </div>
    ${blocIndicateurs([
      ['Étudiants délibérés', lignes.length],
      ['Admis', lignes.filter((l) => l.decision === DecisionJury.ADMIS).length],
      ['Ajournés', lignes.filter((l) => l.decision === DecisionJury.AJOURNE).length],
      ['Défaillants', lignes.filter((l) => l.decision === DecisionJury.DEFAILLANT).length],
      ['Taux de réussite', tauxReussite !== null && tauxReussite !== undefined ? `${tauxReussite} %` : '—'],
      ['Statut', statut === StatutDeliberation.VALIDE ? 'Validée par le jury' : 'Brouillon'],
    ])}
    <table>
      <thead><tr>
        <th>Rang</th><th>N° inscription</th><th>Matricule</th><th>Étudiant</th>
        <th>Moyenne</th><th>Décision</th><th>Mention</th>
      </tr></thead>
      <tbody>${lignesHtml || '<tr><td colspan="7">Aucune ligne de délibération.</td></tr>'}</tbody>
    </table>
    <div class="signatures">
      <div class="signature">Le président du jury</div>
      <div class="signature">Les assesseurs</div>
      <div class="signature">La scolarité</div>
    </div>`;

  const ligneValidee =
    statut === StatutDeliberation.VALIDE && valideePar
      ? ` — validée par ${echapper(`${valideePar.prenom ?? ''} ${valideePar.nom ?? ''}`)}`
      : statut === StatutDeliberation.VALIDE
        ? ' — validée par le jury'
        : '';

  return page(
    etablissement,
    'Procès-verbal de délibération',
    `${echapper(promotion?.nom ?? '')} — ${echapper(annee?.libelle ?? '')}, ${LIBELLE_SESSION[session] ?? session}${ligneValidee}`,
    contenu,
  );
}

/** Bulletin individuel de notes (relevé), une page A4 par étudiant. */
export function bulletinDeliberationHtml(
  { delib, ligne, matieres }: { delib: DeliberationDetail; ligne: LigneDeliberation; matieres: MatiereEtudiant[] },
  etablissement: Etablissement,
): string {
  const etudiant = ligne?.inscription?.etudiant;

  const matieresHtml = matieres
    .map(
      (m) =>
        `<tr>
        <td>${echapper(m.matiereIntitule)}</td>
        <td>${m.credits}</td>
        <td>${m.epreuves
          .map(
            (e) =>
              `${echapper(e.intitule)} (c. ${echapper(e.coefficient)}) : ${e.note !== null ? echapper(e.note) : e.present ? 'non noté' : 'absent'}`,
          )
          .join('<br>')}</td>
        <td><strong>${m.moyenne !== null ? noteLisible(m.moyenne) : '—'}</strong></td>
        <td>${m.enDefaut ? '<span class="badge DEFAILLANT">en défaut</span>' : ''}</td>
      </tr>`,
    )
    .join('');

  const contenu = `
    <div class="infos">
      <strong>Étudiant :</strong> ${echapper(`${etudiant?.nom ?? ''} ${etudiant?.prenom ?? ''}`)}<br>
      <strong>Matricule :</strong> ${echapper(etudiant?.matricule ?? '')} · <strong>N° inscription :</strong> ${echapper(ligne?.inscription?.numero ?? '')}<br>
      <strong>Promotion :</strong> ${echapper(delib.promotion?.nom ?? '')} — ${echapper(delib.annee?.libelle ?? '')} · ${LIBELLE_SESSION[delib.session] ?? delib.session}
    </div>
    <table>
      <thead><tr><th>Matière (UE)</th><th>Crédits</th><th>Épreuves</th><th>Moyenne UE</th><th></th></tr></thead>
      <tbody>${matieresHtml || '<tr><td colspan="5">Aucune matière évaluée.</td></tr>'}</tbody>
    </table>
    <div class="kpis">
      <div class="kpi"><span>Moyenne générale</span><strong>${noteLisible(ligne?.moyenne ?? 0)}</strong></div>
      <div class="kpi"><span>Décision du jury</span><strong>${decisionBadge(ligne?.decision)}</strong></div>
      <div class="kpi"><span>Mention</span><strong>${echapper(ligne?.mention ?? '—')}</strong></div>
      <div class="kpi"><span>Rang</span><strong>${ligne?.rang ?? '—'}</strong></div>
    </div>
    <div class="signatures">
      <div class="signature">La scolarité</div>
      <div class="signature">Le Président du jury</div>
      <div class="signature">L'étudiant${''}</div>
    </div>`;

  return page(
    etablissement,
    'Bulletin de délibération',
    `${echapper(`${etudiant?.nom ?? ''} ${etudiant?.prenom ?? ''}`)} — ${echapper(delib.promotion?.nom ?? '')}`,
    contenu,
  );
}
