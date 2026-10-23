/** Namespace `carteEtudiante`. */
export default {
  title: 'Cartes étudiantes',
  subtitle: 'Carte numérique vérifiable par QR code, avec NIP personnel.',
  actions: {
    issue: 'Émettre une carte',
  },
  formDialog: {
    titleEdit: 'Modifier la carte',
    titleNew: 'Émettre une carte',
    studentRequired: "Sélectionnez l'étudiant.",
    validityLabel: 'Date de validité',
    photoLabel: 'Photo (URL)',
    revokeHint: 'La révocation se fait depuis la liste : elle exige un motif et invalide immédiatement le QR.',
    pinHint:
      'L’étudiant définit normalement son NIP depuis « Ma carte étudiante ». Vous pouvez initialiser un NIP de 4 à 6 chiffres ; lui seul pourra ensuite le changer.',
    initialPinLabel: 'NIP initial (4 à 6 chiffres)',
    pinHintOptional: 'Facultatif : l’étudiant pourra le redéfinir depuis son portail.',
    updated: 'Carte mise à jour.',
    issued: 'Carte émise.',
  },
  studentBanner: {
    message: "Liste restreinte aux cartes d'un seul étudiant (lien entrant).",
    seeAll: 'Voir toutes les cartes',
  },
  filters: {
    searchPlaceholder: 'Matricule, nom, jeton du QR…',
  },
  table: {
    columns: {
      matricule: 'Matricule',
      validity: 'Validité',
      actions: '',
    },
  },
  emptyState: {
    message: "Aucune carte pour ces critères. Émettez-en une depuis le dossier d'un étudiant inscrit.",
  },
  card: {
    issuedOn: 'Émise le {date}',
    validUntil: "Valable jusqu'au {date}",
    revocationReason: 'Motif de révocation : {motif}',
  },
  actionsColumn: {
    qrAria: 'QR de vérification',
    qrTooltip: 'QR de vérification',
    printAria: 'Imprimer la carte',
    editAria: 'Modifier la carte',
    revokeAria: 'Révoquer la carte',
  },
  cardActions: {
    qr: 'QR',
  },
  revokeDialog: {
    title: 'Révoquer la carte',
    warning:
      "Action irréversible : la carte devient inutilisable et tout scan de son QR affichera « carte non valable ». L'étudiant en est informé sur « Ma carte étudiante ».",
    motifLabel: 'Motif de révocation',
    motifHint: "3 caractères minimum — il sera affiché à l'étudiant.",
    confirm: 'Révoquer définitivement',
  },
  detailDialog: {
    title: 'QR de vérification',
    scanHint: "Scannez ce QR pour vérifier l'authenticité de la carte. Toute consultation est journalisée.",
    copyLink: 'Copier le lien',
    openVerification: 'Ouvrir la vérification',
  },
  messages: {
    linkCopied: 'Lien de vérification copié.',
    copyError: 'Copie impossible : sélectionnez le lien à la main.',
    revoked: 'Carte révoquée.',
  },
};
