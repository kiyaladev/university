/** Namespace `resto` — page Restaurant universitaire. */
export default {
  title: 'Restaurant universitaire',
  subtitle:
    "Fini les tickets papier : le guichet scanne la carte de l'étudiant, valide le repas en deux secondes — zéro cash, zéro fraude.",
  cantine: 'Cantine',
  actions: {
    creditWallet: 'Créditer un portefeuille',
  },
  rechargeDialog: {
    title: 'Recharger un portefeuille resto',
    student: 'Étudiant *',
    noWallet: 'Aucun portefeuille trouvé',
    sectionTitle: 'Rechargement',
    amount: 'Montant (GNF) *',
    mode: 'Mode *',
    confirmImmediately: 'Confirmer immédiatement (simulation pilote)',
    mobileMoneyNote:
      "En Mobile Money, la recharge reste « en attente » : elle sera confirmée via le module de paiement (simulation) avant d'être créditée sur le portefeuille.",
    cashNote: 'Espèces au guichet : crédit immédiat du portefeuille.',
    messages: {
      credited: 'Portefeuille crédité : {balance} GNF',
      pending: 'Recharge en attente de confirmation ({reference})',
    },
  },
  tabs: {
    guichet: 'Guichet',
    wallets: 'Portefeuilles',
    transactions: 'Transactions',
  },
  guichet: {
    header: 'Poste de validation',
    onlineNote: 'en ligne — le solde est contrôlé au serveur',
    studentLabel: "Carte de l'étudiant (QR, matricule ou téléphone)",
    studentHint: 'Scannez la carte du convive ou saisissez son matricule',
    mealLabel: 'Repas *',
    mealFree: 'libre',
    priceLabel: 'Prix (GNF)',
    cantinePlaceholder: 'Principale',
    validate: 'Valider le repas',
    result: {
      ok: {
        title: 'Repas validé',
        newBalance: 'Nouveau solde',
      },
      ko: {
        title: 'Repas refusé',
        rechargeWallet: 'Recharger le portefeuille',
        networkError: 'Erreur réseau : vérifiez la connexion du poste de guichet',
      },
      empty: {
        message:
          "Scannez la carte ou saisissez le matricule, choisissez le repas, puis validez : l'écran affichera ici le verdict.",
      },
    },
  },
  wallets: {
    searchPlaceholder: 'Rechercher (matricule, nom, prénom…)',
    table: {
      columns: {
        student: 'Étudiant',
        phone: 'Téléphone',
        balance: 'Solde',
      },
    },
    actions: {
      recharge: 'Recharger',
    },
    emptyState: {
      title: 'Aucun portefeuille pour cette recherche.',
      description:
        "Un portefeuille naît à la première recharge : créditez-en un pour ouvrir le compte resto d'un étudiant.",
    },
    chips: {
      search: '« {search} »',
    },
  },
  transactions: {
    tabs: {
      recharges: 'Recharges',
      consommations: 'Consommations',
    },
    filters: {
      from: 'Du',
      to: 'Au',
      paymentStatus: 'Statut du paiement',
    },
    actions: {
      today: "Aujourd'hui",
      refresh: 'Actualiser la liste',
      refundAria: 'Rembourser ce repas',
    },
    kpi: {
      credited: 'Encaissé : {amount} GNF',
      debited: 'Dépensé : {amount} GNF',
      netPositive: 'Net positif : {amount} GNF',
      netNegative: 'Net négatif : {amount} GNF',
    },
    table: {
      columns: {
        date: 'Le',
        type: 'Opération',
        student: 'Étudiant',
        detail: 'Détail',
        amount: 'Montant',
        status: 'Statut',
      },
    },
    type: {
      meal: 'Repas',
      recharge: 'Recharge',
    },
    typeLabel: {
      recharges: 'recharge',
      consommations: 'consommation',
    },
    emptyState: {
      title: 'Aucune {type} sur cette période.',
      description: 'La période va du {from} au {to} — élargissez-la pour voir plus loin.',
    },
    confirmRefund: {
      title: 'Rembourser ce repas ?',
      message: "{meal} — {amount} GNF seront recrédités sur le portefeuille de l'étudiant.",
      confirm: 'Rembourser',
    },
    messages: {
      refunded: 'Repas annulé — solde remboursé',
    },
    chips: {
      cantine: 'Cantine : {cantine}',
    },
    paymentModeFallback: 'Paiement',
  },
};
