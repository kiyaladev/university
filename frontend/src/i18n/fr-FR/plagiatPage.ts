/** Namespace `plagiatPage` — page PlagiatPage.vue (file d'arbitrage anti-plagiat). */
export default {
  title: 'Anti-plagiat',
  subtitle:
    'File d’arbitrage des suspicions détectées par empreinte sur les documents déposés. Acquitter lève la suspicion ; confirmer ouvre une procédure disciplinaire — les deux décisions sont définitives et journalisées.',
  actions: {
    library: 'Bibliothèque',
    recalculateAll: 'Recalculer toutes les suspicions',
  },
  kpis: {
    total: 'Total suspicions',
    avgScore: 'Score moyen',
    pending: 'En attente d’arbitrage',
    arbitrated: 'Arbitrées',
    acquittedSuffix: 'acquittées · ',
    confirmedSuffix: 'confirmées',
  },
  banner: {
    dismiss: 'Masquer',
    dismissAria: 'Masquer le récapitulatif',
  },
  filters: {
    searchPlaceholder: 'Rechercher (titre, auteurs d’un document…)',
    scoreMin: 'Score minimum (%)',
    document: 'Document concerné',
    documentPlaceholder: 'Tapez le titre…',
    detectedFrom: 'Détecté du',
    detectedTo: 'au',
  },
  topDocuments: {
    title: 'Documents les plus dupliqués',
    count: '{count} suspicion(s)',
  },
  emptyState: {
    filteredTitle: 'Aucune suspicion ne correspond à ces critères.',
    defaultTitle: 'Aucune suspicion en attente d’arbitrage.',
    filteredHint: 'Élargissez les critères pour revoir la file d’arbitrage.',
    defaultHint:
      'Les nouveaux dépôts sont comparés automatiquement ; relancez un recalcul complet après un import massif.',
    resetFilters: 'Réinitialiser les filtres',
  },
  table: {
    columns: {
      score: 'Score',
      documentA: 'Document A',
      documentB: 'Document B',
      detectedOn: 'Détecté le',
      status: 'Statut',
    },
    actions: {
      viewDetailAria: 'Voir le détail de la suspicion',
      viewDetailTooltip: 'Voir le détail et le diff',
      acquitAria: 'Acquitter la suspicion',
      acquitTooltip: 'Acquitter',
      confirmAria: 'Confirmer le plagiat',
      confirmTooltip: 'Confirmer le plagiat',
    },
  },
  chips: {
    search: '« {value} »',
    scoreMin: 'Score ≥ {value} %',
    targetedDocument: 'Document ciblé',
    since: 'Depuis : {date}',
    until: 'Jusqu’à : {date}',
  },
  dialog: {
    titleAcquit: 'Acquitter la suspicion',
    titleConfirm: 'Confirmer le plagiat',
    scoreLabel: 'Score',
    comparisonDocs: '« {documentA} » contre « {documentB} »',
    confirmWarning:
      'Confirmer ouvre une procédure disciplinaire. Le motif est obligatoire et la décision ne pourra plus être modifiée.',
    acquitWarning: 'La suspicion sera close sans suite. La décision ne pourra plus être modifiée.',
    motifRequired: 'Motif *',
    motifOptional: 'Motif (facultatif)',
    cancel: 'Annuler',
    acquitSubmit: 'Acquitter définitivement',
    confirmSubmit: 'Confirmer le plagiat',
  },
  messages: {
    dashboardUnavailable: 'Tableau de bord anti-plagiat indisponible',
    motifRequired: 'Le motif est obligatoire pour une confirmation',
    acquitted: 'Suspicion acquittée',
    confirmed: 'Plagiat confirmé — procédure ouverte',
    decisionFailed: 'Décision impossible',
    recalculateDialogTitle: 'Recalculer toutes les suspicions',
    recalculateDialogMessage:
      'Tous les documents déposés seront comparés deux à deux : l’opération peut prendre plusieurs minutes. Les décisions déjà prises ne sont pas remises en cause.',
    recalculateDialogOk: 'Lancer le recalcul',
    recalculateDoneTitle: 'Recalcul terminé',
    recalculateDoneMessage:
      '{created} suspicion(s) créée(s), {updated} mise(s) à jour, {ignored} ignorée(s).',
    recalculateSuccess: 'Recalcul anti-plagiat terminé',
    recalculateFailed: 'Recalcul impossible',
  },
};
