/** Namespace `mesSeances` — page MesSeancesPage.vue (relevé des séances de l’enseignant). */
export default {
  title: 'Mes séances',
  subtitle: 'Suivi de mes cours et des contrôles de présence me concernant',
  actions: {
    myJustificatifs: 'Mes justificatifs',
    printAttendance: 'Imprimer ma fiche d’assiduité',
  },
  kpis: {
    planned: 'Séances programmées',
    ensured: 'Séances assurées',
    hoursDone: 'Heures réalisées',
  },
  table: {
    columns: {
      promotion: 'Promotion',
      statut: 'Constat',
      theme: 'Thème déroulé',
    },
    loadingLabel: 'Chargement de vos séances…',
  },
  emptyState: {
    seances: 'Aucune séance sur cette période. Élargissez les dates pour remonter plus loin.',
  },
  messages: {
    noTeacherFile:
      'Votre compte n’est rattaché à aucun dossier d’enseignant : la fiche est indisponible.',
  },
};
