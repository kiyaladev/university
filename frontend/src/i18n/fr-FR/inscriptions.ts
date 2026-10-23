/** Namespace `inscriptions` — page Inscriptions (dossiers de l'année). */
export default {
  subtitle:
    "Dossiers de l’année : encaisser les frais par Mobile Money ou au guichet, valider les dossiers réglés, imprimer les certificats.",
  actions: {
    new: 'Nouvelle inscription au guichet',
  },
  banner: {
    dossiersOf: 'Dossiers de',
    allYears: '({matricule}) — toutes années confondues.',
    viewAll: 'Voir tous les dossiers',
  },
  filters: {
    searchPlaceholder: 'Rechercher (n° de dossier, nom étudiant)…',
    promotion: 'Promotion',
    enrolledFrom: 'Inscrit depuis',
    enrolledUntil: "jusqu'à",
  },
  table: {
    columns: {
      number: 'N° dossier',
      promotion: 'Année / Promotion',
      fees: 'Frais (GNF)',
      paid: 'Payé (GNF)',
      balance: 'Reste à payer (GNF)',
      enrolledOn: 'Inscrit le',
    },
    actions: {
      collectAria: 'Encaisser un paiement sur ce dossier',
      collectTooltip: 'Encaisser — reste {amount} GNF',
      viewPaymentsAria: 'Voir les paiements de ce dossier',
      viewPaymentsTooltip: 'Paiements du dossier',
      validateAria: 'Valider le dossier',
      validateTooltip: 'Valider le dossier (frais réglés)',
      cancelAria: 'Annuler le dossier',
      cancelTooltip: 'Annuler le dossier',
      printAria: "Imprimer le certificat d'inscription",
      printTooltip: 'Certificat d’inscription A4',
      viewStudentAria: "Voir la fiche de l'étudiant",
      viewStudentTooltip: 'Fiche de l’étudiant',
    },
  },
  cards: {
    fees: 'Frais',
    paid: 'Payé',
    balance: 'Reste à payer',
    actions: {
      collect: 'Encaisser',
      certificate: 'Certificat',
    },
  },
  emptyState: {
    noRecordsForStudent: '{name} n’a aucun dossier d’inscription.',
    noMatch: 'Aucun dossier ne correspond à ces critères.',
    none: 'Aucun dossier d’inscription : ouvrez-en un au guichet.',
  },
  chips: {
    search: '« {value} »',
    year: 'Année : {value}',
    promotion: 'Promo : {value}',
    status: 'Statut : {value}',
    since: 'Depuis : {value}',
    until: "Jusqu'à : {value}",
  },
  studentDialog: {
    unavailable: 'Fiche étudiant indisponible.',
    sex: 'Sexe',
    birthDate: 'Date de naissance',
    address: 'Adresse',
    portalAccount: 'Compte portail',
    none: 'aucun',
    registry: 'Registre',
    hisPayments: 'Ses paiements',
    editRecord: 'Modifier la fiche',
  },
  createDialog: {
    title: 'Nouvelle inscription (guichet)',
    studentPlaceholder: 'Tapez nom, prénom ou matricule…',
    inactive: 'inactif',
    officialFee: 'Tarif officiel',
    amount: 'Montant des frais (GNF)',
    noFee: 'Aucun tarif paramétré : saisissez le montant',
    save: 'Enregistrer l’inscription',
    created: 'Inscription créée — en attente de paiement',
  },
  dialogs: {
    validate: {
      title: 'Valider le dossier',
      message:
        'Valider {numero} ({prenom} {nom}) ? Les frais sont réglés, le dossier devient définitif.',
    },
    cancel: {
      title: 'Annuler le dossier',
      message: 'Annuler {numero} ? Les paiements restent tracés au registre.',
      confirm: 'Annuler le dossier',
    },
  },
  messages: {
    validated: 'Dossier validé',
    cancelled: 'Dossier annulé',
    studentNotFound: 'Étudiant introuvable : filtre ignoré.',
  },
};
