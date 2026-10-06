/** Namespace `mesDemandes` — page Mes demandes de documents (vue étudiante). */
export default {
  title: 'Mes demandes de documents',
  subtitle:
    "Demandez vos attestations et relevés en ligne : payez les frais au tarif paramétré, suivez l'avancement, retirez au guichet lorsque le statut passe à « Prête ».",
  actions: {
    new: 'Nouvelle demande',
    pay: 'Payer',
    payNow: 'Payer maintenant',
    track: 'Suivre',
    close: 'Fermer',
    cancel: 'Annuler',
  },
  banner: {
    wrongRole:
      'Cette page est réservée aux comptes étudiants. Vous êtes connecté en {role} — le registre complet se trouve sur « {registry} ».',
    goToRegistry: 'Demandes de documents',
  },
  stats: {
    caption: 'Compteurs calculés sur les demandes affichées ci-dessous.',
    labels: {
      toPay: 'À payer',
      inProgress: 'En traitement',
      ready: 'Prêtes',
      delivered: 'Remises',
    },
  },
  filters: {
    searchPlaceholder: 'Rechercher (N°, motif…)',
    status: 'Statut',
  },
  table: {
    columns: {
      number: 'N°',
      type: 'Type',
      fees: 'Frais',
      status: 'Statut',
      createdAt: 'Créée le',
    },
    paymentConfirmed: 'Paiement confirmé',
    trackTooltip: 'Suivre la demande',
    trackAria: 'Suivre la demande',
  },
  emptyState: {
    description:
      "Aucune demande pour ces critères. Demandez une attestation, un relevé de notes ou un duplicata : les frais et le délai s'affichent avant d'envoyer.",
  },
  cards: {
    createdOn: 'Créée le {date}',
  },
  steps: {
    payment: 'Paiement',
    paid: 'Payée',
    processing: 'Traitement',
    ready: 'Prête',
    delivered: 'Remise',
  },
  statusExplanations: {
    EN_ATTENTE_PAIEMENT:
      'Réglez les frais pour lancer le traitement. Sans paiement, la demande reste en attente.',
    PAYEE: 'Frais reçus. La scolarité va prendre votre demande en charge.',
    EN_TRAITEMENT: 'La scolarité prépare votre document.',
    PRETE: 'Votre document est prêt : présentez-vous au guichet de la scolarité avec votre carte.',
    REMISE: 'Document remis. Rien de plus à faire.',
    REJETEE:
      'Demande rejetée. Le motif est indiqué ci-dessous ; vous pouvez en déposer une nouvelle.',
  },
  paymentOptions: {
    mobileMoney: 'Mobile Money',
    cash: 'Espèces (au guichet)',
    transfer: 'Virement bancaire',
  },
  operatorOptions: {
    orangeMoney: 'Orange Money',
    mtnMomo: 'MTN MoMo',
    telecel: 'Telecel',
  },
  dialog: {
    fees: 'Frais',
    payment: 'Paiement',
    notInitiated: 'Non initié',
    createdAt: 'Créée le',
    deliveredAt: 'Remise le',
    requestReason: 'Motif de votre demande',
    registrarMessage: 'Message de la scolarité',
    rejectionReason: 'Motif du rejet',
  },
  paymentDialog: {
    mobileMoneyNote: 'Validez la demande sur votre téléphone. Le paiement reste en attente jusqu’à confirmation de l’encaissement ; votre document sera ensuite traité.',
    title: 'Payer la demande',
    mode: 'Mode de paiement',
    operator: 'Opérateur',
    phoneLabel: 'Numéro Mobile Money',
    phoneHint: 'Le numéro qui sera débité',
    pilotNote:
      "Mode pilote : aucune passerelle Mobile Money n'est connectée. Le paiement est enregistré comme réussi et la demande passe en traitement.",
    pendingNote:
      'Le paiement sera enregistré en attente : réglez au guichet de la scolarité, qui confirmera pour lancer le traitement.',
  },
  messages: {
    phoneRequired: 'Indiquez un numéro Mobile Money valide.',
    mobileMoneyPending: 'Demande de paiement enregistrée. Attendez la confirmation de l’encaissement avant le traitement du document.',
    paymentRegisteredProcessing: 'Paiement enregistré : votre demande passe en traitement.',
    paymentInitiatedPending: 'Paiement initié : présentez-vous au guichet, la scolarité confirmera.',
    paymentFailed: 'Paiement impossible',
  },
};
