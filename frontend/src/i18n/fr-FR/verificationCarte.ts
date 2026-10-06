/** Namespace `verificationCarte` — page VerificationCartePage.vue (vérification publique de carte étudiante). */
export default {
  actions: {
    verifyAttestation: 'Vérifier une attestation',
    login: 'Se connecter',
  },
  title: 'Vérification de carte étudiante',
  subtitle:
    "Cette page publique atteste de l'authenticité d'une carte étudiante numérique délivrée par l'établissement : la carte existe, est intacte et n'a pas été révoquée. Chaque consultation est journalisée.",
  form: {
    sectionTitle: "Saisir l'identifiant et le code du QR",
    identifierLabel: 'Identifiant de la carte',
    identifierHint: 'UUID inscrit sous le QR',
    qrLabel: 'Code QR de la carte',
    qrHint: 'Scannez le QR de la carte ou saisissez le code',
    qrExplanationPrefix: 'Le QR scanné (ou collé) est une URL : ses paramètres',
    qrExplanationAnd: 'et',
    qrExplanationSuffix: 'remplissent le formulaire automatiquement.',
    verify: 'Vérifier',
  },
  result: {
    valid: 'Carte authentique',
    invalid: 'Carte non valable',
    introPrefix: 'La carte',
    introSuffix: "existe bien dans le registre de l'établissement. Mentions vérifiées :",
    table: {
      student: 'Étudiant',
      cardNumber: 'Numéro de carte',
      status: 'Statut',
      statusValue: 'Émise — non révoquée, validité en cours',
      issuedOn: 'Émise le',
      validUntil: "Valable jusqu'au",
    },
    verifiedAt: 'Vérifié le {date} — cette consultation a été enregistrée dans le journal de la carte.',
  },
  footer:
    "La vérification est gratuite et ne requiert aucun compte. Une carte révoquée ou un identifiant inconnu ne prouve rien — méfiance.",
  messages: {
    verificationFailed:
      "La vérification n'a pas pu aboutir : le service est momentanément indisponible. Réessayez dans un instant.",
  },
};
