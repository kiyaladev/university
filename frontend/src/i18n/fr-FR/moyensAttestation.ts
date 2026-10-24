/** Namespace `moyensAttestation` — moyens de preuve de présence des enseignants. */
export default {
  title: 'Moyens de preuve',
  subtitle: "Appareils de contrôle enrôlés et moyens d'attestation des enseignants : code personnel et empreinte.",
  devices: {
    title: 'Appareils de contrôle',
    subtitle: 'Un appareil enrôlé signe les lectures d’empreinte. On révoque celui qui est perdu.',
    emptyState: 'Aucun appareil enrôlé.',
    active: 'Actif',
    revoked: 'Révoqué',
    columns: {
      device: 'Appareil',
      lastUsed: 'Dernier usage',
      status: 'État',
    },
  },
  teacher: {
    title: "Moyens d'un enseignant",
    subtitle: 'Le code personnel et l’empreinte sont définis par l’établissement, jamais par l’enseignant.',
    teacher: 'Enseignant',
    codePin: 'Code personnel',
    codePinSet: 'Défini',
    codePinUnset: 'Non défini : l’enseignant ne pourra pas attester par code.',
    empreinte: 'Empreinte',
    empreinteSet: 'Empreinte enrôlée',
    empreinteUnset: 'Aucune empreinte enrôlée.',
  },
  actions: {
    revoke: 'Révoquer cet appareil',
    defineCode: 'Définir le code',
    resetCode: 'Réinitialiser le code',
    removeCode: 'Retirer le code',
    removeEmpreinte: 'Retirer l’empreinte',
  },
  codeDialog: {
    title: 'Définir le code personnel',
    subtitle: 'Le code est connu de l’enseignant seul. Il sert à attester sa présence au pointage.',
    code: 'Code (4 à 6 chiffres)',
    hint: 'À communiquer à l’enseignant par un canal sûr.',
    invalid: 'Le code doit comporter 4 à 6 chiffres.',
    generatedTitle: 'Nouveau code personnel',
    generatedSubtitle: 'Ce code n’est affiché qu’une fois : communiquez-le à l’enseignant.',
  },
  revokeDialog: {
    title: 'Révoquer cet appareil ?',
    message:
      'Les lectures d’empreinte produites par « {device} » ne seront plus acceptées. Les autres appareils continuent de fonctionner.',
  },
  resetDialog: {
    title: 'Réinitialiser le code ?',
    message: 'Le code actuel est remplacé. Le nouveau code ne sera affiché qu’une fois.',
  },
  removeCodeDialog: {
    title: 'Retirer le code personnel ?',
    message:
      'L’enseignant ne pourra plus attester sa présence par code. Il pourra encore le faire par signature ou par empreinte.',
  },
  removeEmpreinteDialog: {
    title: 'Retirer l’empreinte ?',
    message: 'L’empreinte enrôlée est effacée. L’enseignant ne pourra plus attester sa présence par biométrie.',
  },
  messages: {
    deviceRevoked: 'Appareil révoqué',
    codeSaved: 'Code personnel enregistré',
    codeRemoved: 'Code personnel retiré',
    empreinteRemoved: 'Empreinte retirée',
  },
};
