/** Namespace `statistiques`. */
export default {
  title: 'Statistiques',
  subtitle: 'Ce que la tournée a produit — salle par salle, enseignant par enseignant',
  filters: {
    recalculateAria: 'Recalculer les relevés',
  },
  shortcuts: {
    d7: '7 jours',
    d30: '30 jours',
    d90: '90 jours',
  },
  tabs: {
    salles: 'Par salle',
    enseignants: 'Par enseignant',
  },
  salles: {
    summary: {
      visited: 'Salles visitées',
      controlled: 'Séances contrôlées',
      absences: 'Absences constatées',
      hours: 'Heures assurées',
    },
    card: {
      controlled: 'Contrôlées',
      occupation: 'Occupation',
      visitedOn: 'Vue le',
      neverVisited: 'jamais visitée',
      sessionsLink: 'Ses séances',
    },
    empty: {
      cards: 'Aucune séance programmée en salle sur cette période — élargissez les dates.',
      table: 'Aucune séance programmée en salle sur cette période.',
    },
    table: {
      loading: 'Calcul du relevé…',
      columns: {
        controlees: 'Contr.',
        effectif: 'Étud.',
        occupation: 'Occupation',
        visite: 'Vue le',
      },
    },
    actions: {
      sessionsAria: 'Voir les séances de cette salle',
      sessionsTooltip: 'Ses séances sur la période',
    },
  },
  enseignants: {
    summary: {
      hours: 'Heures assurées',
    },
    card: {
      done: 'Assurées',
      late: 'Retards',
      hoursDone: '{hours} assurées',
    },
    empty: {
      cards: 'Aucun enseignant n’a de séance programmée sur cette période — élargissez les dates.',
      table: 'Aucun enseignant n’a de séance programmée sur cette période.',
    },
    table: {
      loading: 'Calcul du relevé…',
      columns: {
        matricule: 'Matricule',
        assurees: 'Assurées',
        retard: 'Retards',
      },
    },
    actions: {
      sessionsAria: 'Voir ses séances au registre',
      sessionsTooltip: 'Ses séances sur la période',
      printAria: 'Imprimer sa fiche d’assiduité',
      printTooltip: 'Fiche d’assiduité',
    },
  },
};
