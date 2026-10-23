/** Namespace `inscriptionPublique` — page InscriptionPubliquePage.vue (préinscription en ligne sans compte). */
export default {
  hero: {
    overline: 'Inscriptions en ligne',
    title: 'Rejoignez l’université',
    text: 'Déposez votre dossier sans compte : choisissez votre filière, payez vos frais par Mobile Money (Orange Money, MTN MoMo ou Telecel), et la scolarité valide votre inscription.',
    facts: {
      noCash: {
        title: 'Sans cash',
        text: 'Paiement Mobile Money au numéro court de l’université',
      },
      tracking: {
        title: 'Suivi du dossier',
        text: 'Un numéro de dossier vous est remis dès le dépôt',
      },
    },
  },
  form: {
    title: 'Déposer mon dossier',
    steps: {
      ariaLabel: 'Étapes de la préinscription',
      confirmation: 'Confirmation',
    },
    step1: {
      sectionTitle: 'Identité du candidat',
      help: 'Les champs marqués d’une étoile sont obligatoires. Le reste peut être complété plus tard à la scolarité.',
      nom: {
        label: 'Nom *',
        required: 'Le nom est obligatoire',
      },
      prenom: {
        label: 'Prénom *',
        required: 'Le prénom est obligatoire',
      },
      sexe: {
        label: 'Sexe',
        masculin: 'Masculin',
        feminin: 'Féminin',
      },
      dateNaissance: {
        label: 'Date de naissance',
      },
      lieuNaissance: {
        label: 'Lieu de naissance',
      },
      telephone: {
        label: 'Téléphone *',
        placeholder: '622 00 00 00',
        hint: 'C’est ce numéro qui recevra le code d’accès à votre espace',
        required: 'Le téléphone est obligatoire',
        minLength: 'Le numéro doit comporter au moins 8 chiffres',
      },
      email: {
        label: 'Adresse e-mail',
        invalid: 'Adresse e-mail invalide',
      },
      adresse: {
        label: 'Adresse',
      },
      continue: 'Continuer — choisir ma filière',
    },
    step2: {
      sectionTitle: 'Choix de la promotion',
      loadingFilieres: 'Chargement des filières ouvertes…',
      promotionLabel: 'Promotion *',
      promotionPlaceholder: 'Choisissez votre filière et niveau',
      fraisLabel: 'Frais : {montant} {devise}',
      tarifLabel: 'Frais d’inscription',
      checkingTarif: 'Consultation du tarif officiel…',
      chooseHelp: 'Choisissez votre promotion pour pouvoir déposer votre dossier.',
      back: 'Retour',
      submit: 'Déposer mon dossier',
      depotError: 'Dépôt impossible, votre brouillon est conservé — réessayez.',
    },
    step3: {
      stampFolder: 'Dossier',
      stampDone: 'Remis',
      numeroLabel: 'N° de dossier',
      numeroHelp: 'Notez ce numéro : il vous sera demandé à la scolarité et pour tout suivi.',
      fraisLabel: 'Frais d’inscription à régler',
      message:
        'Envoyez {montant} au {numero} par Mobile Money, en mentionnant la référence {ref} en motif. Dès réception du paiement, la scolarité validera votre inscription. Vous accéderez ensuite à votre espace avec un code envoyé par SMS au numéro que vous avez indiqué.',
      print: 'Imprimer ce récépissé',
      another: 'Préinscrire un autre candidat',
      validatedIntro: 'Une fois votre inscription validée :',
      enterSpace: 'entrez dans votre espace étudiant →',
    },
  },
  services: {
    ariaLabel: 'Autres services publics',
    title: 'Autres services',
    portal: 'Portail étudiant (connexion par SMS) →',
    formationContinue: 'Formation continue →',
    bibliotheque: 'Bibliothèque numérique →',
    connexionPersonnel: 'Connexion du personnel →',
  },
};
