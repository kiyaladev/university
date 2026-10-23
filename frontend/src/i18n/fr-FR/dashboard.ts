/** Namespace `dashboard` — page Tableau de bord (assiduité des enseignants). */
export default {
  title: 'Tableau de bord',
  subtitle: 'Assiduité des enseignants — période du {debut} au {fin}',
  actions: {
    refreshAria: 'Recalculer le tableau de bord',
    refreshTooltip: 'Recalculer',
    goToRounds: 'Aller à la tournée',
    prepareRound: 'Préparer hors ligne',
    preparedAt: 'Prête à {time}',
    roundPrepared: 'Tournée du jour chargée pour le mode hors ligne.',
    prepareRequiresNetwork: 'Connectez-vous au réseau et ouvrez l’application installée pour préparer la tournée.',
    prepareFailed: 'Impossible de préparer les données de la tournée.',
    viewSessionsRegistry: 'Voir le registre des séances',
    teacherStats: 'Statistiques par enseignant',
  },
  today: {
    mention: 'Journée du {date}',
    legend: 'séances contrôlées',
  },
  gauge: {
    coverageAria: 'Couverture du contrôle : {percent}',
    coverageLabel: '{percent} de couverture',
  },
  charts: {
    evolutionTitle: 'Évolution sur 14 jours',
    evolutionSubtitle: 'Séances assurées, absences et retards',
    distributionTitle: 'Répartition des constats',
    distributionSubtitle: 'Sur la période sélectionnée',
    noData: 'Aucune donnée sur la période.',
    datasets: {
      sessionsHeld: 'Séances assurées',
      delays: 'Retards',
    },
  },
  departments: {
    title: 'Assiduité par département',
    subtitle: 'Cliquez pour filtrer le tableau',
    itemDetail: '{controlees} contrôles · {absent} absence(s) · {heures} réalisées',
    empty: 'Aucune séance rattachée à un département sur la période.',
  },
  teachers: {
    title: 'Enseignants les plus absents',
    pendingJustifications: '{count} justificatif(s) à arbitrer',
    itemDetail: '{count} séance(s) programmée(s) · présence {percent}',
    viewSessionsAria: 'Voir les séances de cet enseignant',
    viewSessionsTooltip: 'Voir ses séances sur la période',
    empty: 'Aucune absence constatée sur la période.',
  },
  kpis: {
    plannedSessions: 'Séances programmées',
    plannedSessionsDetail: '{count} contrôlées ({percent})',
    presenceRate: 'Taux de présence',
    presenceRateDetail: '{count} séance(s) assurée(s)',
    absencesDetail: '{excused} excusée(s) · {late} retard(s)',
    hoursWorked: 'Heures réalisées',
    hoursWorkedDetail: 'sur {planned} programmées',
  },
};
