/** Namespace `plagiatPage` — page PlagiatPage.vue (anti-plagiarism arbitration queue). */
export default {
  title: 'Anti-plagiarism',
  subtitle:
    'Arbitration queue for fingerprint-detected suspicions on submitted documents. Acquitting clears the suspicion; confirming opens a disciplinary procedure — both decisions are final and logged.',
  actions: {
    library: 'Library',
    recalculateAll: 'Recalculate all suspicions',
  },
  kpis: {
    total: 'Total suspicions',
    avgScore: 'Average score',
    pending: 'Pending arbitration',
    arbitrated: 'Arbitrated',
    acquittedSuffix: 'acquitted · ',
    confirmedSuffix: 'confirmed',
  },
  banner: {
    dismiss: 'Dismiss',
    dismissAria: 'Dismiss the summary',
  },
  filters: {
    searchPlaceholder: 'Search (title, document authors…)',
    scoreMin: 'Minimum score (%)',
    document: 'Related document',
    documentPlaceholder: 'Type the title…',
    detectedFrom: 'Detected from',
    detectedTo: 'to',
  },
  topDocuments: {
    title: 'Most duplicated documents',
    count: '{count} suspicion(s)',
  },
  emptyState: {
    filteredTitle: 'No suspicion matches these criteria.',
    defaultTitle: 'No suspicion pending arbitration.',
    filteredHint: 'Broaden the criteria to review the arbitration queue.',
    defaultHint: 'New submissions are compared automatically; run a full recalculation after a bulk import.',
  },
  table: {
    columns: {
      documentA: 'Document A',
      documentB: 'Document B',
      detectedOn: 'Detected on',
    },
    actions: {
      viewDetailAria: 'View suspicion detail',
      viewDetailTooltip: 'View detail and diff',
      acquitAria: 'Acquit the suspicion',
      acquitTooltip: 'Acquit',
      confirmAria: 'Confirm plagiarism',
      confirmTooltip: 'Confirm plagiarism',
    },
  },
  chips: {
    search: '"{value}"',
    scoreMin: 'Score ≥ {value} %',
    targetedDocument: 'Targeted document',
    since: 'Since: {date}',
    until: 'Until: {date}',
  },
  dialog: {
    titleAcquit: 'Acquit the suspicion',
    titleConfirm: 'Confirm plagiarism',
    comparisonDocs: '"{documentA}" against "{documentB}"',
    confirmWarning:
      'Confirming opens a disciplinary procedure. The reason is mandatory and the decision can no longer be changed.',
    acquitWarning: 'The suspicion will be closed without follow-up. The decision can no longer be changed.',
    motifOptional: 'Reason (optional)',
    acquitSubmit: 'Acquit permanently',
    confirmSubmit: 'Confirm plagiarism',
  },
  messages: {
    motifRequired: 'A reason is required to confirm',
    acquitted: 'Suspicion acquitted',
    confirmed: 'Plagiarism confirmed — procedure opened',
    recalculateDialogTitle: 'Recalculate all suspicions',
    recalculateDialogMessage:
      'All submitted documents will be compared pairwise: this operation may take several minutes. Decisions already made are not reconsidered.',
    recalculateDialogOk: 'Start recalculation',
    recalculateDoneTitle: 'Recalculation complete',
    recalculateDoneMessage: '{created} suspicion(s) created, {updated} updated, {ignored} ignored.',
    recalculateSuccess: 'Anti-plagiarism recalculation complete',
  },
};
