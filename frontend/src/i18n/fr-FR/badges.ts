/** Namespace `badges`. */
export default {
  title: 'Badges & visiteurs',
  subtitle:
    'Visiteurs, intervenants, techniciens, personnalités — badge imprimable avec QR et validité paramétrable, prolongeable ou annulable.',
  actions: {
    issueBadge: 'Émettre un badge',
    edit: 'Éditer',
    extend: 'Rallonger',
  },
  filters: {
    searchPlaceholder: 'Nom, organisation, numéro…',
  },
  table: {
    columns: {
      organization: 'Organisation',
      validity: 'Validité',
    },
  },
  card: {
    issuedOn: "Délivré le {date}",
    validUntil: "Valable jusqu'au {date}",
    cancelReason: "Motif d'annulation : {reason}",
  },
  tooltips: {
    extend: 'Prolonger la validité',
  },
  aria: {
    printBadge: 'Imprimer le badge',
    editBadge: 'Modifier le badge',
    extendBadge: 'Prolonger la validité',
    cancelBadge: 'Annuler le badge',
    close: 'Fermer',
  },
  emptyState: {
    message:
      'Aucun badge pour ces critères. Émettez-en un pour un visiteur ou un intervenant attendu.',
  },
  dialogs: {
    form: {
      titleEdit: 'Modifier le badge',
      titleNew: 'Émettre un badge',
      typeLabel: 'Type de badge',
      functionLabel: 'Fonction',
      idTypeLabel: 'Type de pièce',
      idNumberLabel: 'Numéro de pièce',
      zonesLabel: 'Zones autorisées (CSV)',
      photoLabel: 'Photo (URL)',
      reasonHint: "Renseigné automatiquement lors de l'annulation du badge.",
      nameRequired: 'Le nom et le prénom sont obligatoires.',
      validityRequired: 'Indiquez une date de validité.',
      updated: 'Badge mis à jour.',
      issued: 'Badge émis.',
      issueFailed: 'Émission impossible.',
    },
    cancel: {
      title: 'Annuler le badge',
      warning:
        "Action irréversible : un badge annulé ne peut plus être réactivé ni prolongé. Émettez-en un nouveau si besoin.",
      reasonLabel: "Motif d'annulation",
      reasonHint: '3 caractères minimum.',
      cancelAction: 'Annuler',
      confirmAction: 'Annuler définitivement',
    },
    extend: {
      title: 'Prolonger la validité',
      info: 'Le badge repassera en statut « Actif » et conservera son numéro et son QR : inutile de le réimprimer.',
      newValidityDateLabel: 'Nouvelle date de validité',
      cancelAction: 'Annuler',
      confirmAction: 'Prolonger',
    },
  },
  messages: {
    cancelled: 'Badge annulé.',
    cancelFailed: 'Annulation impossible.',
    extended: 'Validité prolongée.',
    extendFailed: 'Prolongation impossible.',
  },
};
