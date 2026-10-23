/** Namespace `loginPage` — page LoginPage.vue (écran de connexion du personnel). */
export default {
  signage: {
    overline: 'Personnel de l’université',
    brand: 'University',
    tagline:
      'Le registre du contrôleur, salle par salle : il relève la séance, fait signer ou poser le doigt à l’enseignant, et l’heure est consignée.',
    facts: {
      offline: {
        label: 'Sur le terrain',
        text: 'Pointage hors ligne, synchronisé au retour du réseau',
      },
      opposable: {
        label: 'Opposable',
        text: 'Horodatage serveur, moyen d’attestation consigné, corrections tracées',
      },
    },
  },
  access: {
    title: 'Connexion',
    intro:
      'Réservée au personnel de l’université — contrôleurs, scolarité, enseignants, direction. Vous êtes étudiant ?',
    studentPortalLink: 'Entrez par le portail étudiant',
  },
  form: {
    emailLabel: 'Adresse e-mail',
    emailRequired: 'Saisissez votre adresse e-mail',
    passwordLabel: 'Mot de passe',
    passwordRequired: 'Saisissez votre mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    submit: 'Se connecter',
  },
  services: {
    ariaLabel: 'Services accessibles sans compte',
    title: 'Sans compte',
    links: {
      portailSms: 'Portail étudiant (connexion par SMS) →',
      preinscription: 'Se préinscrire en ligne →',
      formationContinue: 'Formation continue →',
      bibliotheque: 'Bibliothèque numérique →',
      verifierAttestation: 'Vérifier une attestation →',
      verifierCarte: 'Vérifier une carte étudiante →',
    },
  },
  errors: {
    default: 'Adresse e-mail ou mot de passe incorrect.',
  },
};
