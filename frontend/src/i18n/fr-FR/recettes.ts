/** Namespace `recettes` — page RecettesPage.vue (régie des recettes propres de l'université). */
export default {
  title: 'Régie des recettes',
  subtitle:
    "Les recettes propres de l'université — analyses de laboratoire, location d'amphithéâtre, prestations de formation ou de conseil. Une recette est d'abord émise, puis encaissée : l'encaissement crée le paiement qui la solde.",
  actions: {
    issueRecette: 'Émettre une recette',
    cash: 'Encaisser',
    viewPayment: 'Voir le paiement',
  },
  formDialog: {
    editTitle: 'Modifier la recette',
    newTitle: 'Émettre une recette',
    numberHint: 'Le numéro suit le format REC-AAAA-NNNNN ; il figure sur la facture ou le reçu.',
    number: 'Numéro (REC-AAAA-XXXXX)',
    amount: 'Montant *',
    invoiceNumber: 'N° de facture',
    accountingLocked: 'La recette est encaissée : son type, sa date, son montant et sa devise sont figés.',
    updated: 'Recette modifiée',
    created: 'Recette émise',
  },
  kpis: {
    totalMois: {
      title: 'Total du mois en cours',
    },
    totalAnnee: {
      title: 'Total année {annee}',
    },
  },
  search: {
    placeholder: 'Rechercher (numéro, libellé, client…)',
  },
  filters: {
    paiementStatut: 'Encaissement',
  },
  paiementOptions: {
    reussi: 'Encaissées',
    aEncaisser: 'À encaisser',
  },
  chips: {
    search: '« {texte} »',
    type: 'Type : {type}',
    paiementStatut: 'Encaissement : {statut}',
  },
  status: {
    encaissee: 'Encaissée',
    aEncaisser: 'À encaisser',
  },
  period: {
    summary: '{periode} — {total} recette(s).',
    range: 'du {debut} au {fin}',
    from: 'depuis le {debut}',
    until: "jusqu'au {fin}",
    all: 'Toutes les dates',
  },
  table: {
    columns: {
      client: 'Client',
    },
  },
  tooltips: {
    detail: 'Détail / modifier',
    voirPaiement: "Le reçu se délivre depuis l'écran des paiements",
  },
  ariaLabels: {
    detail: 'Détail de la recette {numero}',
  },
  emptyState: {
    title: 'Aucune recette sur la période',
    message:
      'La régie enregistre ici les prestations facturées à des tiers. Élargissez la période, retirez les filtres, ou émettez la première recette.',
  },
  encaisserDialog: {
    title: 'Encaisser la recette',
    message: 'Encaisser « {numero} — {libelle} » de {montant} {devise} ?',
    ok: 'Encaisser',
  },
  messages: {
    cashSuccess: 'Recette encaissée',
  },
};
