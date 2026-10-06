/** Namespace `statistiquesMesrs` — page StatistiquesMesrsPage.vue (archive des snapshots MESRS). */
export default {
  title: 'Statistiques MESRS',
  subtitle:
    'L’archive de ce qui a été déclaré au Ministère. Chaque snapshot fige les chiffres à sa date de génération et ne bouge plus — c’est la mémoire de la déclaration, pas la situation du jour. Les chiffres d’aujourd’hui sont sur le Tableau de bord Rectorat, qui produit justement ces snapshots.',
  allYears: 'toutes les années',
  filters: {
    annee: {
      label: 'Année',
      hint: 'Vide : toutes les années',
    },
  },
  actions: {
    export: 'Exporter {count} snapshot(s) en CSV',
    exportTooltip: 'Tableur (Excel / LibreOffice) — {annee}',
    generateFromRectorat: 'Générer un bilan depuis le Rectorat',
  },
  links: {
    rectorat: {
      label: 'Tableau de bord Rectorat',
      hint: 'Les mêmes indicateurs à l’instant présent — et le bouton qui génère un snapshot',
    },
    rapports: {
      label: 'Rapports & états',
      hint: 'Les états ligne à ligne derrière ces agrégats',
    },
    statistiques: {
      label: 'Statistiques',
      hint: 'Le suivi du contrôle des séances au jour le jour',
    },
  },
  emptyState: {
    title: 'Aucun snapshot archivé',
    text: 'Un snapshot MESRS se crée depuis le Tableau de bord Rectorat : il y fige les effectifs, le taux de réussite et la masse salariale de l’année choisie. Tant qu’aucun n’a été généré, cette archive reste vide.',
  },
  stats: {
    effectif: 'Effectif déclaré',
    tauxReussite: 'Taux de réussite déclaré',
    masseSalariale: 'Masse salariale déclarée',
    snapshotsArchived: 'Snapshots archivés',
    lastSnapshot: 'Dernier snapshot du {date}',
  },
  chart: {
    title: 'Évolution des déclarations',
    subtitle:
      'Effectif, taux de réussite et masse salariale — un point par snapshot, du plus ancien au plus récent',
    summary: 'Évolution des déclarations MESRS sur {count} snapshot(s) : {details}.',
    summaryEmpty: 'Aucun snapshot à représenter.',
    summaryEntry: '{date} — effectif {effectif}, réussite {reussite}, masse salariale {masse} GNF',
    datasets: {
      effectif: 'Effectif',
      tauxReussite: 'Taux de réussite (%)',
      masseSalariale: 'Masse salariale (GNF)',
    },
    axis: {
      effectif: 'Effectif',
      taux: 'Taux %',
      gnf: 'GNF',
    },
  },
  table: {
    title: 'Snapshots archivés',
    countLabel: '{count} enregistrement(s) —',
    filteredOn: 'filtré sur {annee}',
    columns: {
      genereLe: 'Généré le',
      annee: 'Année',
      effectif: 'Effectif',
      taux: 'Taux',
      masse: 'Masse salariale (GNF)',
      generePar: 'Par',
    },
    printAria: 'Imprimer le bilan MESRS du {date}',
    printTooltip: 'Imprimer le bilan (A4)',
  },
  csv: {
    headers: {
      date: 'Date',
      annee: 'Année',
      effectif: 'Effectif',
      tauxReussite: 'Taux réussite',
      masseSalariale: 'Masse salariale',
      moisMasse: 'Mois masse',
      enseignants: 'Enseignants',
      vacataires: 'Vacataires',
      reclamations: 'Réclamations',
      incidents24h: 'Incidents 24h',
      equipementsObsoletes: 'Équipements obsolètes',
      enReparation: 'En réparation',
      generePar: 'Généré par',
    },
  },
  messages: {
    loadError: 'Chargement des snapshots MESRS impossible.',
    anneesUnavailable: 'Années académiques indisponibles : le filtre restera vide.',
  },
};
