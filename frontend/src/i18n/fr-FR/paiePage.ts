/** Namespace `paiePage` — page PaiePage.vue (paie des vacataires, vue admin). */
export default {
  title: 'Paie des vacataires',
  subtitle:
    "Le chemin d'une feuille mensuelle : elle agrège les heures constatées lors des contrôles, la direction la valide — les montants sont alors figés —, puis l'administration la marque payée.",
  actions: {
    newSheet: 'Nouvelle feuille',
    reload: 'Recharger',
    recalculate: 'Recalculer',
    validate: 'Valider',
    markPaid: 'Marquer payée',
    print: 'Imprimer',
    printSheet: 'Imprimer la feuille (A4)',
    delete: 'Supprimer',
    close: 'Fermer',
    clearFilters: 'Retirer les filtres',
    createFirst: 'Créer la première feuille',
  },
  links: {
    reports: {
      label: 'Rapports & états',
      help: 'L’état de paiement détaillé, enseignant par enseignant',
    },
    teachingLoads: {
      label: 'Charges d’enseignement',
      help: 'Les taux horaires et volumes contractuels utilisés au calcul',
    },
    dashboard: {
      label: 'Tableau de bord Rectorat',
      help: 'La masse salariale consolidée sur 12 mois',
    },
  },
  filters: {
    statut: 'Statut',
    annee: 'Année',
    statutChip: 'Statut : {value}',
    anneeChip: 'Année : {value}',
  },
  summary: {
    sheetsCount: '{count} feuille(s)',
    allStatuses: 'tous statuts',
    allYears: 'toutes années',
    totalShown: 'total affiché',
  },
  table: {
    columns: {
      libelle: 'Feuille',
      periode: 'Période',
      statut: 'Statut',
      lignes: 'Lignes',
      montantTotal: 'Montant total (GNF)',
    },
    lignesColumns: {
      enseignant: 'Enseignant',
      taux: 'Taux horaire (GNF)',
      heures: 'Heures réalisées',
      volume: 'Volume prévu',
      brut: 'Brut (GNF)',
      retenue: 'Retenue (GNF)',
      montant: 'Net (GNF)',
      commentaire: 'Commentaire',
    },
  },
  card: {
    totalAmount: 'Montant total',
    lignesCount: '{count} ligne(s)',
  },
  tooltips: {
    reload: 'Recharger',
    detail: 'Détail des lignes',
    recalculate: 'Recalculer les heures contrôlées',
    validate: 'Valider et figer les montants',
    markPaid: 'Marquer payée',
    print: 'Imprimer la feuille (A4)',
    delete: 'Supprimer',
  },
  ariaLabels: {
    reload: 'Recharger les feuilles de paie',
    detail: 'Détail des lignes de {libelle}',
    recalculate: 'Recalculer {libelle}',
    validate: 'Valider {libelle}',
    markPaid: 'Marquer {libelle} payée',
    print: 'Imprimer {libelle}',
    delete: 'Supprimer {libelle}',
  },
  emptyState: {
    title: 'Aucune feuille de paie',
    description:
      'Une feuille couvre un mois : elle rassemble les heures contrôlées de la période et les convertit en montants au taux de chaque enseignant.',
    filtered: 'Aucune ne correspond aux filtres en cours.',
  },
  detail: {
    lineEmptyTitle: 'Feuille sans ligne',
    lineEmptyMessage:
      'Aucune heure contrôlée n’a été trouvée sur la période. Lancez un recalcul, ou vérifiez que les séances du mois ont bien été pointées.',
    total: 'Total — {count} enseignant(s)',
    completed: 'réalisées',
  },
  dialogs: {
    createDialog: {
      title: 'Nouvelle feuille de paie',
      month: 'Mois *',
      year: 'Année *',
      periodHint: 'La feuille « {label} » couvre du premier au dernier jour du mois. Les heures contrôlées depuis UniPrésence sont ensuite agrégées ligne par ligne.',
      create: 'Créer la feuille',
      draftHint: 'La feuille est en brouillon : recalculez-la pour agréger les heures contrôlées, puis faites-la valider par la direction.',
      recalculateNow: 'Recalculer maintenant',
      created: 'Feuille « {label} » créée',
      createFailed: 'Création impossible',
    },
    recalculate: {
      title: 'Recalculer',
      message:
        'Agréger les heures contrôlées d’UniPrésence sur la feuille « {libelle} » ? Les lignes seront recréées (les commentaires sont conservés).',
      ok: 'Recalculer',
    },
    validate: {
      title: 'Valider la feuille',
      message:
        'Valider « {libelle} » pour {montant} GNF ? Les montants seront figés : plus aucun recalcul possible.',
      ok: 'Valider',
    },
    markPaid: {
      title: 'Marquer payée',
      message: 'Marquer « {libelle} » comme payée ({montant} GNF) ?',
      ok: 'Marquer payée',
    },
    delete: {
      title: 'Supprimer',
      message: 'Supprimer définitivement la feuille « {libelle} » ?',
      ok: 'Supprimer',
    },
  },
  messages: {
    loadError: 'Chargement des feuilles de paie impossible.',
    recalculated: 'Feuille recalculée',
    recalculateError: 'Recalcul impossible',
    validated: 'Feuille validée',
    validateError: 'Validation impossible',
    paid: 'Feuille payée',
    payError: 'Opération impossible',
    deleted: 'Feuille supprimée',
    deleteError: 'Suppression impossible',
  },
};
