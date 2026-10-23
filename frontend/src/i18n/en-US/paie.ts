/** Namespace `paie` — PaiePage.vue page (adjunct/hourly staff payroll, admin view). */
export default {
  title: 'Adjunct staff payroll',
  subtitle:
    "The path of a monthly sheet: it aggregates the hours recorded during attendance checks, management validates it — the amounts are then locked —, then admin staff mark it paid.",
  actions: {
    newSheet: 'New sheet',
    markPaid: 'Mark paid',
    printSheet: 'Print the sheet (A4)',
    createFirst: 'Create the first sheet',
  },
  filters: {
    statutChip: 'Status: {value}',
    anneeChip: 'Year: {value}',
  },
  summary: {
    sheetsCount: '{count} sheet(s)',
    allStatuses: 'all statuses',
    allYears: 'all years',
    totalShown: 'total shown',
  },
  table: {
    columns: {
      libelle: 'Sheet',
      lignes: 'Lines',
      montantTotal: 'Total amount (GNF)',
    },
    lignesColumns: {
      taux: 'Hourly rate (GNF)',
      heures: 'Hours completed',
      volume: 'Planned volume',
      brut: 'Gross (GNF)',
      retenue: 'Deduction (GNF)',
      montant: 'Net (GNF)',
      commentaire: 'Comment',
    },
  },
  card: {
    totalAmount: 'Total amount',
    lignesCount: '{count} line(s)',
  },
  tooltips: {
    detail: 'Line detail',
    recalculate: 'Recalculate checked hours',
    validate: 'Validate and lock the amounts',
    markPaid: 'Mark paid',
    print: 'Print the sheet (A4)',
  },
  ariaLabels: {
    reload: 'Reload payroll sheets',
    detail: 'Line detail for {libelle}',
    recalculate: 'Recalculate {libelle}',
    validate: 'Validate {libelle}',
    markPaid: 'Mark {libelle} paid',
    print: 'Print {libelle}',
    delete: 'Delete {libelle}',
  },
  emptyState: {
    title: 'No payroll sheet',
    description:
      'A sheet covers one month: it gathers the checked hours for the period and converts them into amounts at each teacher’s rate.',
    filtered: 'None match the current filters.',
  },
  detail: {
    lineEmptyTitle: 'Sheet with no lines',
    lineEmptyMessage:
      'No checked hours were found for the period. Run a recalculation, or check that the month’s sessions have been recorded.',
    total: 'Total — {count} teacher(s)',
    completed: 'completed',
  },
  dialogs: {
    createDialog: {
      title: 'New payroll sheet',
      month: 'Month *',
      year: 'Year *',
      periodHint: 'The “{label}” sheet covers the first through the last day of the month. Checked hours from UniPrésence are then aggregated line by line.',
      create: 'Create sheet',
      draftHint: 'The sheet is a draft: recalculate it to aggregate checked hours, then have it approved by management.',
      recalculateNow: 'Recalculate now',
      created: 'Sheet “{label}” created',
      createFailed: 'Unable to create the sheet',
    },
    recalculate: {
      title: 'Recalculate',
      message:
        'Aggregate the hours checked by UniPrésence for sheet “{libelle}”? The lines will be recreated (comments are kept).',
      ok: 'Recalculate',
    },
    validate: {
      title: 'Validate the sheet',
      message:
        'Validate “{libelle}” for {montant} GNF? The amounts will be locked: no further recalculation will be possible.',
      ok: 'Validate',
    },
    markPaid: {
      title: 'Mark paid',
      message: 'Mark “{libelle}” as paid ({montant} GNF)?',
      ok: 'Mark paid',
    },
    delete: {
      title: 'Delete',
      message: 'Permanently delete sheet “{libelle}”?',
      ok: 'Delete',
    },
  },
  messages: {
    recalculated: 'Sheet recalculated',
    validated: 'Sheet validated',
    paid: 'Sheet paid',
    deleted: 'Sheet deleted',
  },
};
