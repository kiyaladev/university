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
    date: 'Date *',
    amount: 'Amount *',
    currency: 'Currency',
    invoiceNumber: 'Invoice number',
    accountingLocked: 'This revenue item has been collected; its type, date, amount and currency are locked.',
    updated: 'Revenue entry updated',
    created: 'Revenue entry issued',
    saveFailed: 'Unable to save',
  },
  crossLinks: {
    paiements: {
      label: 'Payments',
      help: 'The payments collected from these revenue items, and their receipts',
    },
    rectorat: {
      label: 'Rectorat dashboard',
      help: 'The overall situation of the institution',
    },
  },
  kpis: {
    totalMois: {
      title: 'Total for the current month',
      subtitle: 'revenue items in GNF, issued or collected',
    },
    totalAnnee: {
      title: 'Total for year {annee}',
      subtitle: 'total revenue in GNF',
    },
    top3: {
      title: 'Top three revenue types in GNF',
      empty: 'No revenue item this year.',
    },
  },
  search: {
    placeholder: 'Search (number, label, client…)',
  },
  filters: {
    type: 'Type',
    paiementStatut: 'Collection',
    dateDebut: 'From',
    dateFin: 'To',
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
  status: {
    encaissee: 'Collected',
    aEncaisser: 'To be collected',
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
      numero: 'No.',
      type: 'Type',
      libelle: 'Label',
      client: 'Client',
      date: 'Date',
      montant: 'Amount',
      statut: 'Status',
    },
  },
  card: {
    montant: 'Amount',
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
    loadError: 'Unable to load revenue items.',
    cashSuccess: 'Revenue item collected',
    cashError: 'Unable to collect',
  },
};
