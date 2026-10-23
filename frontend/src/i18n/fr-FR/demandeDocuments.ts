/** Namespace `demandeDocuments`. */
export default {
  title: 'Demandes de documents',
  subtitle:
    "L'étudiant formule sa demande en ligne, paie les frais au tarif paramétré, la scolarité traite, marque le document comme prêt et le remet au guichet.",
  actions: {
    tarifs: 'Tarifs des demandes',
  },
  studentBanner: {
    message: "Registre restreint aux demandes d'un seul étudiant (lien entrant).",
    seeAll: 'Voir toutes les demandes',
  },
  stats: {
    revenues: 'Recettes encaissées : {amount} GNF.',
  },
  plaques: {
    awaitingPayment: 'À payer',
    processing: 'En traitement',
    ready: 'Prêtes',
    readyOverdue: 'Prêtes > 7 j',
  },
  filters: {
    searchPlaceholder: 'Rechercher (N°, motif, matricule…)',
  },
  table: {
    columns: {
      frais: 'Frais',
      actions: '',
    },
    paymentConfirmed: 'Paiement confirmé',
    paymentPending: 'Paiement en attente',
  },
  emptyState: {
    message:
      "Aucune demande pour ces critères. Les demandes sont créées par les étudiants depuis « Mes demandes de documents ».",
  },
  actionsColumn: {
    confirmPayment: 'Confirmer le paiement',
    startProcessing: 'Lancer le traitement',
    markReady: 'Marquer prête',
    handOver: 'Remettre',
  },
  cardActions: {
    process: 'Traiter',
    ready: 'Prête',
  },
  steps: {
    paid: 'Payée',
    processing: 'Traitement',
    ready: 'Prête',
    handedOver: 'Remise',
  },
  detail: {
    theirCard: 'Sa carte',
    enrollment: 'Inscription',
    fees: 'Frais',
    paymentNotStarted: 'Non initié',
    processedBy: 'Traitée par',
    handedOverOn: 'Remise le',
    smsNotification: 'Notification SMS',
  },
  createDialog: {
    title: 'Nouvelle demande de document',
    documentType: 'Type de document *',
    delay: 'délai : {hours} h',
    fees: 'Frais :',
    usualDelay: 'délai habituel : {hours} h',
    noFeeConfigured: 'Aucun tarif n’est paramétré pour ce type : la demande sera créée sans frais. Contactez la scolarité si nécessaire.',
    reasonLabel: 'Motif de la demande',
    reasonPlaceholder: 'Ex. : besoin pour un dossier de bourse',
    enrollmentSection: 'Inscription concernée',
    noEnrollment: 'Aucune inscription enregistrée : la demande portera uniquement sur votre dossier.',
    created: 'Demande {number} créée',
    createFailed: 'Création impossible',
  },
  markReadyDialog: {
    title: 'Marquer prête',
    message: "Un SMS sera envoyé à l'étudiant. Message personnalisé (optionnel) :",
    confirm: 'Marquer prête',
  },
  handOverDialog: {
    title: 'Confirmer la remise',
    message: 'Note de remise (optionnel) :',
    confirm: 'Remettre',
  },
  rejectDialog: {
    title: 'Rejeter la demande',
    message: 'Motif du rejet (obligatoire) :',
  },
  messages: {
    forbidden: "Vous n'avez pas accès à cette section.",
    loadError: 'Chargement impossible',
    paymentConfirmed: 'Paiement confirmé',
    confirmError: 'Confirmation impossible',
    processingStarted: 'Traitement lancé',
    processingError: 'Lancement impossible',
    markedReady: 'Demande marquée prête, étudiant notifié',
    markReadyError: 'Impossible de marquer prête',
    handedOver: 'Document remis',
    handOverError: 'Remise impossible',
    rejected: 'Demande rejetée',
    rejectError: 'Rejet impossible',
  },
};
