/** Namespace `formationsPubliques` — page FormationsPubliquesPage.vue (public storefront for continuing education). */
export default {
  hero: {
    overline: 'Continuing education & certifications',
    title: 'Skills for tomorrow',
    text: 'The university opens its evening courses and certifications to professionals and the general public. Choose your course, submit your request without an account, pay via Mobile Money — and receive your training certificate.',
    facts: {
      noAccount: {
        title: 'No account needed',
        text: 'Name, phone, email — the request is filed in two minutes',
      },
      mobileMoney: {
        title: 'Mobile Money payment',
        text: 'Orange Money, MTN MoMo, Telecel — confirmation at the front desk',
      },
      attestation: {
        title: 'Training certificate',
        text: 'Signed A4 document, delivered at the end of the course',
      },
    },
  },
  catalogue: {
    title: 'Open courses',
    count: '{count} course(s) available',
    loading: 'Loading the storefront…',
    empty: 'No course is available for enrollment at the moment — check back soon.',
    card: {
      categorieDefaut: 'Course',
      placesRestantes: '{n} spots remaining',
      complet: 'Full',
      dureeValeur: '{n} h',
      dates: 'Dates',
      lieu: 'Location',
      investissement: 'Investment',
      inscrirePayant: 'Enroll — pay via Mobile Money',
      inscrireGratuit: 'Enroll for free',
    },
  },
  dialog: {
    step1: {
      title: 'Enroll in the course',
      nomComplet: {
        label: 'Full name *',
        hint: 'As it will appear on your certificate',
      },
      telephone: {
        label: 'Phone (Mobile Money) *',
        hint: 'The number that will pay the course fees',
      },
      email: {
        label: 'Email address (optional)',
      },
      matricule: {
        label: 'Student number (INE number, optional)',
        hint: 'Already a student? Enter your student number to link the course to your record',
      },
      voirRecap: 'View summary',
      renseignerAbord: 'Please fill in your name and phone number first',
    },
    step2: {
      title: 'Request summary',
      formation: 'Course',
      participant: 'Participant',
      montantARegler: 'Amount due',
      note: 'By submitting this request, you agree to pay the course fees via Mobile Money. Payment confirmation is handled at the registrar\'s office.',
      retour: 'Back',
      deposer: 'Submit my enrollment request',
    },
    step3: {
      demande: 'Request',
      deposee: 'Submitted',
      numeroDossier: 'Reference number',
      aReglerMobileMoney: 'To pay via Mobile Money',
      paiementTexte: 'Go to the registrar\'s office to pay this amount (reference {numero}). Once payment is received, your enrollment will become {confirmee} and your spot will be reserved.',
      confirmee: 'confirmed',
      statutInfo: 'Current status of your request: {statut} — you will receive your training certificate at the end of the course.',
      enAttentePaiement: 'awaiting payment',
      inscrireAutre: 'Enroll another participant',
    },
  },
  messages: {
    identiteObligatoire: 'Full name and phone number are required',
    depotImpossible: 'Submission failed, please try again',
  },
};
