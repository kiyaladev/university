/** Namespace `justificatifs` — page JustificatifsPage.vue (justificatifs d'absence). */
export default {
  title: 'Justificatifs d’absence',
  subtitle: 'Une absence justifiée et validée devient une « absence excusée » dans les statistiques',
  actions: {
    record: 'Enregistrer un justificatif',
  },
  banner: {
    info:
      'Un justificatif s’enregistre auprès de la scolarité, sur présentation de la pièce. Vous retrouvez ici l’état de vos demandes.',
  },
  filters: {
    sessionsFrom: 'Séances du',
    sessionsTo: 'au',
  },
  table: {
    loadingLabel: 'Chargement des justificatifs…',
    emptyFiltered: 'Aucun justificatif ne correspond à ces filtres sur la période.',
    emptyDefault: 'Aucun justificatif déposé sur cette période.',
    columns: {
      explanation: 'Explication',
    },
    actions: {
      viewAria: 'Voir le justificatif',
      validateAria: 'Valider ce justificatif',
      validateTooltip: 'Valider — la séance passera en absence excusée',
      rejectAria: 'Rejeter ce justificatif',
      rejectTooltip: 'Rejeter — l’absence reste constatée',
    },
  },
  depositDialog: {
    title: 'Enregistrer un justificatif',
    subtitle: 'Saisi par l’administration, sur présentation de la pièce par l’enseignant.',
    session: 'Séance concernée *',
    sessionHint: 'Séances non assurées des 90 derniers jours',
    explanation: 'Explication *',
    file: 'Pièce justificative (image ou PDF)',
    submit: 'Déposer le justificatif',
  },
  detailDialog: {
    title: 'Justificatif',
    explanation: 'Explication',
    decisionComment: 'Commentaire de décision',
    arbitratedBy: 'Arbitré par',
    fileAlt: 'Pièce justificative fournie par l’enseignant',
    openAttachment: 'Ouvrir la pièce jointe',
    viewSession: 'Voir la séance au registre',
  },
  dialogs: {
    validateTitle: 'Valider le justificatif',
    rejectTitle: 'Rejeter le justificatif',
    validateMessage:
      'La séance passera en « absence excusée » dans les statistiques. Commentaire (facultatif) :',
    rejectMessage: 'L’absence restera constatée telle quelle. Motif du rejet (facultatif) :',
    doNothing: 'Ne rien faire',
  },
  messages: {
    validated: 'Justificatif validé — absence excusée',
    rejected: 'Justificatif rejeté',
    missingFields: 'Enseignant, séance concernée et explication sont obligatoires.',
    deposited: 'Justificatif déposé',
  },
};
