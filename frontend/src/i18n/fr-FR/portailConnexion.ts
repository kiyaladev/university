/** Namespace `portailConnexion`. */
export default {
  banner: {
    overTitle: 'Espace étudiant',
    tagline:
      'Le portail étudiant : votre inscription, vos paiements, vos résultats et vos attestations — sans mot de passe, juste votre numéro de téléphone enregistré à la scolarité.',
    facts: {
      noPassword: {
        title: 'Sans mot de passe',
        text: 'Un code reçu par SMS à chaque connexion, valable quelques minutes',
      },
      confidential: {
        title: 'Confidentiel',
        text: 'Vos résultats ne sont jamais montrés à un autre étudiant',
      },
      verifiable: {
        title: 'Vérifiable',
        text: "Vos attestations portent un QR code contrôlable par n'importe qui",
      },
    },
  },
  panel: {
    titleCode: 'Code de vérification',
    titlePortal: 'Portail étudiant',
  },
  step1: {
    intro: 'Réservé aux étudiants inscrits. Vous êtes membre du personnel ?',
    introLink: 'Connectez-vous avec votre e-mail',
    phoneLabel: 'Numéro de téléphone',
    phoneRule: 'Saisissez votre numéro de téléphone',
    phoneHint: "Le numéro porté sur votre fiche d'inscription (ex. 622 000 001)",
    submit: 'Recevoir un code par SMS',
  },
  step2: {
    smsSent: "Si ce numéro figure au registre, un code à 6 chiffres vient d'être envoyé au {telephone}.",
    codeLabel: 'Code reçu par SMS',
    codeRule: 'Saisissez le code à 6 chiffres reçu par SMS',
    codeHint: 'Le code ne se réutilise pas et expire après quelques minutes',
    submit: 'Entrer dans mon espace',
    changeNumber: 'Changer de numéro',
    resendCode: 'Renvoyer le code',
  },
  otherAccess: {
    ariaLabel: 'Autres accès',
    title: 'Autres accès',
    staffLogin: 'Connexion du personnel (e-mail + mot de passe) →',
    preregister: 'Pas encore étudiant ? Se préinscrire en ligne →',
    library: 'Bibliothèque numérique →',
    verifyAttestation: 'Vérifier une attestation →',
  },
  messages: {
    codeResent: 'Un nouveau code vient d’être envoyé par SMS.',
    genericError: 'Impossible de terminer, réessayez.',
    invalidCode: 'Code incorrect ou expiré — demandez un nouveau code.',
  },
};
