/** Namespace `recettes` — page RecettesPage.vue (university's own revenue office). */
export default {
  title: 'Revenue office',
  subtitle:
    "The university's own revenue — lab analyses, lecture hall rental, training or consulting services. A recette (revenue item) is first issued, then collected: collecting it creates the payment that settles it.",
  actions: {
    issueRecette: 'Issue a revenue item',
    cash: 'Collect',
    viewPayment: 'View payment',
  },
  formDialog: {
    editTitle: 'Edit revenue entry',
    newTitle: 'Issue a revenue entry',
    numberHint: 'The number follows the REC-YYYY-NNNNN format and appears on the invoice or receipt.',
    number: 'Number (REC-YYYY-XXXXX)',
    amount: 'Amount *',
    invoiceNumber: 'Invoice number',
    accountingLocked: 'This revenue item has been collected; its type, date, amount and currency are locked.',
    updated: 'Revenue entry updated',
    created: 'Revenue entry issued',
  },
  kpis: {
    totalMois: {
      title: 'Total for the current month',
    },
    totalAnnee: {
      title: 'Total for year {annee}',
    },
  },
  search: {
    placeholder: 'Search (number, label, client…)',
  },
  filters: {
    paiementStatut: 'Collection',
  },
  paiementOptions: {
    reussi: 'Collected',
    aEncaisser: 'To collect',
  },
  chips: {
    search: '"{texte}"',
    type: 'Type: {type}',
    paiementStatut: 'Collection: {statut}',
  },
  period: {
    summary: '{periode} — {total} item(s).',
    range: 'from {debut} to {fin}',
    from: 'since {debut}',
    until: 'through {fin}',
    all: 'All dates',
  },
  table: {
    columns: {
      client: 'Client',
    },
  },
  tooltips: {
    detail: 'Detail / edit',
    voirPaiement: 'The receipt is issued from the payments screen',
  },
  ariaLabels: {
    detail: 'Detail of revenue item {numero}',
  },
  emptyState: {
    title: 'No revenue item for the period',
    message:
      'This is where the revenue office records services billed to third parties. Widen the period, clear the filters, or issue the first revenue item.',
  },
  encaisserDialog: {
    title: 'Collect the revenue item',
    message: 'Collect "{numero} — {libelle}" for {montant} {devise}?',
    ok: 'Collect',
  },
  messages: {
    cashSuccess: 'Revenue item collected',
  },
};
