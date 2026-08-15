/** Règles de délibération du jury — écrites ici, une fois pour toutes.
 *
 *  Règle pilotée (figée dans le code) :
 *   1. MOYENNE D'UE : pour chaque matière, moyenne pondérée des épreuves par
 *      leur coefficient. Une évaluation OUVERTE ne compte que les notes
 *      réellement saisies (absence non pénalisée, correction possible).
 *      Une évaluation CLOTURÉE fige l'épreuve : une absence consignée
 *      (present=false) vaut 0/20 ; l'absence totale de saisie (aucune ligne)
 *      met la matière « en défaut ».
 *   2. MOYENNE GÉNÉRALE : Σ(moyenneUE × créditsUE) / Σ(créditsUE), arrondie à
 *      2 décimales, sur les UE dotées d'au moins une épreuve clôturée (les
 *      UE jamais évaluées n'entrent pas dans le jugement).
 *   3. DÉCISION :
 *      - DÉFAILLANT : au moins une matière « en défaut » (aucune note
 *        exploitable sur une épreuve clôturée).
 *      - ADMIS : moyenne générale ≥ 10 et aucune matière sous 5/20 due à une
 *        absence consignée sur une épreuve clôturée (défaut d'absence).
 *      - AJOURNÉ : tous les autres cas.
 *   4. MENTION (si ADMIS) : ≥ 16 « Très bien », 14-16 « Bien », 12-14
 *      « Assez bien », 10-12 « Passable ».
 *   5. RANG : classement décroissant de la moyenne générale, ex aequo par nom
 *      puis prénom (ordre alphabétique français).
 *   6. TAUX DE RÉUSSITE : part des ADMIS parmi les lignes délibérées.
 *   7. SESSION RATTRAPAGE : seuls les AJOURNÉ de la session normale sont
 *      repositionnés ; leur moyenne d'UE se recalcule avec les notes de
 *      rattrapage (même formule, épreuves de type RATTRAPAGE incluses) et la
 *      décision suit les mêmes règles (≥ 10 → ADMIS à cette session).
 */
export const REGLES_DELIBERATION = {
  seuilAdmission: 10,
  seuilDefautAbsence: 5,
  arrondi: 2,
} as const;

/** Une épreuve notée telle que vue par le calcul. */
export interface Epreuve {
  /** Note /20 saisie (null si non notée). */
  note: number | null;
  present: boolean;
  coefficient: number;
  cloturee: boolean;
}

export type Decision = 'ADMIS' | 'AJOURNE' | 'DEFAILLANT';

/** Matière d'un étudiant au moment du calcul. */
export interface MatiereAEtudier {
  matiereId: string;
  matiereIntitule: string;
  credits: number;
  /** Moyenne /20 de l'UE, null si aucune épreuve exploitable. */
  moyenne: number | null;
  /** Aucune note exploitable sur une épreuve clôturée → matière en défaut. */
  enDefaut: boolean;
  /** Au moins une absence consignée (present=false) sur une épreuve clôturée. */
  absenceCloturee: boolean;
}

export interface ResultatEtudiant {
  moyenneGenerale: number | null;
  decision: Decision;
  motif: string;
  mention: string | null;
}

export interface CandidatTri {
  moyenne: number;
  nom: string;
  prenom: string;
}

export function arrondi(n: number, decimales = REGLES_DELIBERATION.arrondi): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** « 12,5/20 » — note française, lisible pour les PV. */
export function noteLisible(moyenne: number | null): string {
  return moyenne === null ? '—' : `${moyenne.toLocaleString('fr-FR')}/20`;
}

/**
 * Moyenne d'une matière pour un étudiant : moyenne pondérée des épreuves par
 * leur coefficient, selon les règles de l'évaluation (voir en tête de fichier).
 */
export function moyenneUe(epreuves: Epreuve[]): {
  moyenne: number | null;
  enDefaut: boolean;
  absencesCloturees: boolean;
} {
  let somme = 0;
  let poids = 0;
  let enDefaut = false;
  let absencesCloturees = false;

  for (const e of epreuves) {
    if (e.cloturee) {
      // Épreuve clôturée : la situation de l'étudiant est figée.
      if (e.present && e.note !== null) {
        somme += e.note * e.coefficient;
        poids += e.coefficient;
      } else if (e.present) {
        // Présent mais jamais noté : aucun témoignage exploitable.
        enDefaut = true;
      } else if (e.note !== null) {
        // Absent consigné avec une note (cas limite) : la note réelle compte.
        somme += e.note * e.coefficient;
        poids += e.coefficient;
        absencesCloturees = true;
      } else {
        // Absent sur une épreuve clôturée, non noté : défaut 0/20. Le zéro
        // compte, la matière n'est pas « en défaut » pour autant.
        somme += 0;
        poids += e.coefficient;
        absencesCloturees = true;
      }
    } else if (e.present && e.note !== null) {
      // Épreuve ouverte : seules les notes réellement saisies comptent.
      somme += e.note * e.coefficient;
      poids += e.coefficient;
    }
  }

  return {
    moyenne: poids > 0 ? arrondi(somme / poids) : null,
    enDefaut,
    absencesCloturees,
  };
}

/** Σ(moyenneUE × créditsUE) / Σ(créditsUE) sur les UE jugées. */
export function moyenneGenerale(
  matieres: Array<{ moyenne: number | null; credits: number }>,
): number | null {
  let somme = 0;
  let credits = 0;
  for (const m of matieres) {
    if (m.moyenne === null) continue;
    somme += m.moyenne * m.credits;
    credits += m.credits;
  }
  return credits > 0 ? arrondi(somme / credits) : null;
}

/** Mention obtenue pour une moyenne admise. */
export function mention(moyenne: number | null): string | null {
  if (moyenne === null) return null;
  if (moyenne >= 16) return 'Très bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez bien';
  if (moyenne >= 10) return 'Passable';
  return null;
}

/** Décision du jury pour un étudiant à partir de ses UE. */
export function decider(matieres: MatiereAEtudier[]): ResultatEtudiant {
  const enDefaut = matieres.some((m) => m.enDefaut);
  if (enDefaut) {
    return {
      decision: 'DEFAILLANT',
      mention: null,
      moyenneGenerale: moyenneGenerale(matieres),
      motif:
        'Matière en défaut : aucune note exploitable sur au moins une épreuve clôturée',
    };
  }

  const moyenneG = moyenneGenerale(matieres);
  const admissible = moyenneG !== null && moyenneG >= REGLES_DELIBERATION.seuilAdmission;
  // « Défaut d'absence » : une matière sous 5/20 alors qu'une absence a été
  // consignée sur une épreuve clôturée — l'admission est exclue.
  const defautAbsence = matieres.some(
    (m) =>
      m.moyenne !== null &&
      m.moyenne < REGLES_DELIBERATION.seuilDefautAbsence &&
      m.absenceCloturee,
  );

  if (admissible && !defautAbsence) {
    return {
      decision: 'ADMIS',
      moyenneGenerale: moyenneG,
      mention: mention(moyenneG),
      motif: `Moyenne générale ${noteLisible(moyenneG)} ≥ 10, aucune matière en défaut`,
    };
  }

  return {
    decision: 'AJOURNE',
    moyenneGenerale: moyenneG,
    mention: null,
    motif: defautAbsence
      ? 'Matière sous 5/20 pour défaut d’absence : l’admission est exclue'
      : `Moyenne générale ${noteLisible(moyenneG ?? 0)} < 10`,
  };
}

/** Rang dans la classe : moyenne décroissante, ex aequo par nom puis prénom. */
export function classer<T extends CandidatTri>(candidats: T[]): (T & { rang: number })[] {
  return [...candidats]
    .sort(
      (a, b) =>
        b.moyenne - a.moyenne ||
        a.nom.localeCompare(b.nom, 'fr') ||
        a.prenom.localeCompare(b.prenom, 'fr'),
    )
    .map((c, i) => ({ ...c, rang: i + 1 }));
}