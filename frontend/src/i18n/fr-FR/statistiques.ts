/** Namespace `statistiques`. */
export default {
  title: 'Statistiques',
  subtitle: 'Ce que la tournée a produit — salle par salle, enseignant par enseignant',
  filters: {
    from: 'Du',
    to: 'Au',
    recalculateAria: 'Recalculer les relevés',
    recalculateTooltip: 'Recalculer',
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
      sessions: 'Séances',
      controlled: 'Contrôlées',
      absences: 'Absences',
      students: 'Étudiants',
      occupation: 'Occupation',
      presence: 'Présence',
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
        salle: 'Salle',
        planifiees: 'Séances',
        controlees: 'Contr.',
        absent: 'Absences',
        effectif: 'Étud.',
        occupation: 'Occupation',
        presence: 'Présence',
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
      sessions: 'Séances',
      presence: 'Présence',
      absences: 'Absences',
      hours: 'Heures assurées',
    },
    card: {
      sessions: 'Séances',
      done: 'Assurées',
      late: 'Retards',
      absences: 'Absences',
      presence: 'Présence',
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
        nom: 'Enseignant',
        departement: 'Département',
        planifiees: 'Séances',
        assurees: 'Assurées',
        retard: 'Retards',
        absent: 'Absences',
        heures: 'Heures',
        presence: 'Présence',
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
