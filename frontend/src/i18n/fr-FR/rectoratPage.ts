/** Namespace `rectoratPage` — page Tableau de bord Rectorat. */
export default {
  title: 'Tableau de bord Rectorat',
  subtitle:
    "L'état de l'université en une page, à l'instant présent : effectifs, réussite, masse salariale, incidents. Chaque chiffre renvoie à l'écran qui le produit. Année académique {annee}.",
  subtitleFallback: '—',
  filters: {
    year: 'Année',
  },
  actions: {
    generateReport: 'Générer le bilan MESRS',
    generateReportTooltip:
      'Fige les chiffres ci-dessous dans un snapshot archivé, consultable dans Statistiques MESRS.',
  },
  links: {
    statisticsMesrs: 'Statistiques MESRS',
    statisticsMesrsHelp: 'Les snapshots figés déjà transmis au Ministère',
    reports: 'Rapports & états',
    reportsHelp: 'Les états ligne à ligne, exportables',
    statistics: 'Statistiques',
    statisticsHelp: 'Le suivi du contrôle des séances au jour le jour',
  },
  kpis: {
    totalHeadcount: 'Effectif total',
    totalHeadcountDetail: '{count} promotion(s) · inscriptions non annulées',
    viewStudents: 'Voir les étudiants',
    successRate: 'Taux de réussite global',
    successRateDetail: 'Session normale · délibérations validées',
    viewDeliberations: 'Voir les délibérations',
    payroll: 'Masse salariale',
    viewPayroll: 'Voir la paie',
    pendingComplaints: 'Réclamations en attente',
    pendingComplaintsDetail: 'Tous motifs · non clôturées',
    viewComplaints: 'Voir les réclamations',
  },
  headcountChart: {
    title: 'Effectif par promotion',
    subtitle: 'Inscriptions non annulées · 24 premières promotions',
    enrollments: 'Inscriptions',
    datasetLabel: 'Effectif',
    emptyTitle: 'Aucune inscription sur cette année',
    emptyDescription:
      "L'effectif se lit sur les inscriptions non annulées. Changez d'année, ou ouvrez les inscriptions pour en enregistrer.",
    openEnrollments: 'Ouvrir les inscriptions',
    ariaSummary: 'Effectif par promotion : {details}.',
  },
  payrollChart: {
    title: 'Masse salariale mensuelle',
    subtitle: '12 derniers mois — feuilles validées ou payées',
    payroll: 'Paie',
    datasetLabel: 'Masse salariale (GNF)',
    emptyTitle: 'Aucune feuille de paie validée',
    emptyDescription:
      "La courbe agrège les feuilles mensuelles une fois validées par la direction. Tant qu'aucune ne l'est, la masse salariale reste à zéro.",
    openPayroll: 'Ouvrir la paie',
    ariaSummary: 'Masse salariale des 12 derniers mois, en francs guinéens : {details}.',
  },
  staffIncidents: {
    title: 'Personnel & incidents',
    teachers: '{count} enseignants',
    teachersDetail: '{vacataires} vacataire(s) · {permanents} permanent(s)',
    helpdeskIncidents: '{count} incident(s) helpdesk',
    helpdeskIncidentsDetail: 'sur les dernières 24 h — tous statuts confondus',
  },
  assets: {
    title: 'Patrimoine — obsolescences',
    subtitle: "Équipements dont l'âge dépasse la durée d'obsolescence prévue",
    link: 'Patrimoine & matériel',
    obsoleteEquipment: 'équipements obsolètes',
    detail: '{total} équipements actifs · {enReparation} en réparation',
  },
  loading: 'Chargement du tableau de bord…',
  messages: {
    dashboardLoadFailed: 'Chargement du tableau de bord impossible.',
    reportGenerated: 'Bilan MESRS {annee} généré et archivé.',
    viewSnapshots: 'Voir les snapshots',
    reportGenerationFailed: 'Génération du bilan impossible.',
    yearsUnavailable: 'Années académiques indisponibles.',
  },
};
