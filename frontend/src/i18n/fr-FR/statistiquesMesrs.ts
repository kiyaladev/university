/** Namespace `statistiquesMesrs` — page StatistiquesMesrsPage.vue (archive des snapshots MESRS). */
export default {
  title: 'Bilans archivés',
  subtitle: 'Chiffres enregistrés à la date de chaque bilan pour les déclarations au Ministère.',
  allYears: 'toutes les années',
  filters: {
    annee: {
      hint: 'Vide : toutes les années',
    },
  },
  actions: {
    export: 'Exporter {count} bilan(s) en CSV',
    exportTooltip: 'Tableur (Excel / LibreOffice) — {annee}',
    generateFromRectorat: 'Ouvrir la situation actuelle',
  },
  emptyState: {
    title: 'Aucun bilan archivé',
    text: 'Enregistrez un bilan depuis « Situation actuelle » pour conserver les effectifs, la réussite et la masse salariale.',
  },
  stats: {
    effectif: 'Effectif déclaré',
    tauxReussite: 'Taux de réussite déclaré',
    masseSalariale: 'Masse salariale déclarée',
    snapshotsArchived: 'Bilans archivés',
    lastSnapshot: 'Dernier bilan du {date}',
  },
  chart: {
    title: 'Évolution des déclarations',
    subtitle: 'Effectif, taux de réussite et masse salariale — un point par bilan, du plus ancien au plus récent',
    summary: 'Évolution des déclarations MESRS sur {count} bilan(s) : {details}.',
    summaryEmpty: 'Aucun bilan à représenter.',
    summaryEntry: '{date} — effectif {effectif}, réussite {reussite}, masse salariale {masse} GNF',
    datasets: {
      tauxReussite: 'Taux de réussite (%)',
      masseSalariale: 'Masse salariale (GNF)',
    },
    axis: {
      taux: 'Taux %',
    },
  },
  table: {
    title: 'Bilans archivés',
    countLabel: '{count} enregistrement(s) —',
    filteredOn: 'filtré sur {annee}',
    columns: {
      genereLe: 'Généré le',
      taux: 'Taux',
      masse: 'Masse salariale (GNF)',
      generePar: 'Par',
    },
    printAria: 'Imprimer le bilan MESRS du {date}',
    printTooltip: 'Imprimer le bilan (A4)',
  },
  csv: {
    headers: {
      tauxReussite: 'Taux réussite',
      masseSalariale: 'Masse salariale',
      moisMasse: 'Mois masse',
      vacataires: 'Vacataires',
      reclamations: 'Réclamations',
      incidents24h: 'Incidents 24h',
      equipementsObsoletes: 'Équipements obsolètes',
      enReparation: 'En réparation',
      generePar: 'Généré par',
    },
  },
  messages: {
    anneesUnavailable: 'Années académiques indisponibles : le filtre restera vide.',
  },
};
