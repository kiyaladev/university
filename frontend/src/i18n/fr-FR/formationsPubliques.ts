/** Namespace `formationsPubliques` — page FormationsPubliquesPage.vue (vitrine publique de la formation continue). */
export default {
  hero: {
    overline: 'Formation continue & certifications',
    title: 'Compétences pour demain',
    text: "L'université ouvre ses cours du soir et ses certifications aux professionnels et au grand public. Choisissez votre formation, déposez votre demande sans compte, réglez par Mobile Money — et recevez votre attestation de formation.",
    facts: {
      noAccount: {
        title: 'Sans compte',
        text: 'Nom, téléphone, e-mail — le dossier se dépose en deux minutes',
      },
      mobileMoney: {
        title: 'Paiement Mobile Money',
        text: 'Orange Money, MTN MoMo, Telecel — confirmation au guichet',
      },
      attestation: {
        title: 'Attestation de formation',
        text: 'Document A4 signé, remis à la fin du parcours',
      },
    },
  },
  catalogue: {
    title: 'Formations ouvertes',
    count: '{count} formation(s) en vente',
    loading: 'Chargement de la vitrine…',
    empty: "Aucune formation n'est en vente pour le moment — repassez bientôt.",
    card: {
      categorieDefaut: 'Formation',
      placesRestantes: '{n} places restantes',
      complet: 'Complet',
      dureeValeur: '{n} h',
      dates: 'Dates',
      lieu: 'Lieu',
      investissement: 'Investissement',
      inscrirePayant: "S'inscrire — payer par Mobile Money",
      inscrireGratuit: "S'inscrire gratuitement",
    },
  },
  dialog: {
    step1: {
      title: "S'inscrire à la formation",
      nomComplet: {
        label: 'Nom et prénom *',
        hint: "Tel qu'il figurera sur votre attestation",
      },
      telephone: {
        label: 'Téléphone (Mobile Money) *',
        hint: 'Le numéro qui paiera les frais de la formation',
      },
      email: {
        label: 'Adresse e-mail (facultatif)',
      },
      matricule: {
        label: 'Numéro étudiant (matricule INE, facultatif)',
        hint: 'Déjà étudiant ? Indiquez votre matricule pour rattacher la formation à votre dossier',
      },
      voirRecap: 'Voir le récapitulatif',
      renseignerAbord: "Renseignez d'abord votre nom et votre téléphone",
    },
    step2: {
      title: 'Récapitulatif de la demande',
      formation: 'Formation',
      participant: 'Participant(e)',
      montantARegler: 'Montant à régler',
      note: 'En déposant cette demande, vous vous engagez à régler les frais de la formation par Mobile Money. La confirmation du paiement se fait au guichet de la scolarité.',
      retour: 'Retour',
      deposer: "Déposer ma demande d'inscription",
    },
    step3: {
      demande: 'Demande',
      deposee: 'Déposée',
      numeroDossier: 'N° de dossier',
      aReglerMobileMoney: 'À régler par Mobile Money',
      paiementTexte:
        'Rendez-vous au guichet de la scolarité pour régler ce montant ({numero} en motivation). Dès réception du paiement, votre inscription passe {confirmee} et votre place est réservée.',
      confirmee: 'confirmée',
      statutInfo:
        'Statut actuel de votre demande : {statut} — vous recevrez votre attestation de formation en fin de parcours.',
      enAttentePaiement: 'en attente de paiement',
      inscrireAutre: 'Inscrire un autre participant',
    },
  },
  messages: {
    identiteObligatoire: 'Le nom complet et le téléphone sont obligatoires',
    depotImpossible: 'Dépôt impossible, réessayez',
  },
};
