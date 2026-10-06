/** Namespace `maCarte` — page Ma carte étudiante. */
export default {
  title: 'Ma carte étudiante',
  subtitle:
    'Votre carte numérique, vérifiable en ligne par QR code, avec un NIP personnel pour le resto U, la cité et les contrôles.',
  loading: 'Chargement de votre carte…',
  noCard: {
    title: 'Aucune carte émise',
    description:
      'La scolarité génère votre carte à partir de votre inscription. Si votre inscription est validée depuis plusieurs jours, demandez un duplicata ou ouvrez une réclamation.',
    requestDocument: 'Demander un document',
    openComplaint: 'Ouvrir une réclamation',
  },
  card: {
    matricule: 'Matricule',
    revoked: {
      text: 'Cette carte a été révoquée par l’établissement : elle n’est plus valable et son QR affiche « carte non valable ».',
      reasonSuffix: ' Motif : {reason}.',
      requestDuplicate: 'Demandez un duplicata à la scolarité.',
    },
    issuedOn: 'Émise le',
    validUntil: 'Valable jusqu’au',
    qrHint: 'Scannez ce QR pour vérifier votre carte. Toute consultation est journalisée.',
    copyLink: 'Copier le lien',
    openVerification: 'Ouvrir la vérification',
    setNip: 'Définir un NIP',
    print: 'Imprimer A4',
  },
  dialog: {
    title: 'Définir votre NIP',
    description:
      'Le NIP est un code personnel à 4 à 6 chiffres qui authentifie votre carte pour les partenaires (resto U, cité, contrôles à distance).',
    nipLabel: 'NIP (4 à 6 chiffres)',
    nipHint: 'Saisissez 4 à 6 chiffres.',
    confirmLabel: 'Confirmation',
    cancel: 'Annuler',
    save: 'Enregistrer',
  },
  messages: {
    linkCopied: 'Lien de vérification copié.',
    copyError: 'Copie impossible : sélectionnez le lien à la main.',
    nipLength: 'Le NIP doit comporter 4 à 6 chiffres.',
    nipMismatch: 'Les deux NIP ne correspondent pas.',
    nipSaved: 'NIP enregistré.',
    nipSaveError: 'Impossible d’enregistrer le NIP.',
  },
};
