/** Namespace `inscriptionPublique` — InscriptionPubliquePage.vue page (online pre-registration, no account). */
export default {
  hero: {
    overline: 'Online registration',
    title: 'Join the university',
    text: 'Submit your application without an account: choose your program, pay your fees via Mobile Money (Orange Money, MTN MoMo or Telecel), and the registrar’s office validates your enrollment.',
    facts: {
      noCash: {
        title: 'No cash needed',
        text: 'Mobile Money payment to the university’s short code',
      },
      tracking: {
        title: 'Application tracking',
        text: 'An application number is given to you as soon as you submit',
      },
    },
  },
  form: {
    title: 'Submit my application',
    steps: {
      ariaLabel: 'Pre-registration steps',
      confirmation: 'Confirmation',
    },
    step1: {
      sectionTitle: 'Applicant identity',
      help: 'Fields marked with a star are required. The rest can be completed later at the registrar’s office.',
      nom: {
        label: 'Last name *',
        required: 'Last name is required',
      },
      prenom: {
        label: 'First name *',
        required: 'First name is required',
      },
      sexe: {
        label: 'Gender',
        masculin: 'Male',
        feminin: 'Female',
      },
      dateNaissance: {
        label: 'Date of birth',
      },
      lieuNaissance: {
        label: 'Place of birth',
      },
      telephone: {
        label: 'Phone *',
        placeholder: '622 00 00 00',
        hint: 'This number will receive the access code to your account',
        required: 'Phone number is required',
        minLength: 'The number must have at least 8 digits',
      },
      email: {
        label: 'Email address',
        invalid: 'Invalid email address',
      },
      adresse: {
        label: 'Address',
      },
      continue: 'Continue — choose my program',
    },
    step2: {
      sectionTitle: 'Choice of program',
      loadingFilieres: 'Loading open programs…',
      promotionLabel: 'Program *',
      promotionPlaceholder: 'Choose your program and level',
      fraisLabel: 'Fees: {montant} {devise}',
      tarifLabel: 'Registration fees',
      checkingTarif: 'Checking the official rate…',
      chooseHelp: 'Choose your program to be able to submit your application.',
      back: 'Back',
      submit: 'Submit my application',
      depotError: 'Submission failed, your draft has been kept — please try again.',
    },
    step3: {
      stampFolder: 'Application',
      stampDone: 'Submitted',
      numeroLabel: 'Application number',
      numeroHelp: 'Write down this number: you will be asked for it at the registrar’s office and for any follow-up.',
      fraisLabel: 'Registration fees to pay',
      message: 'Send {montant} to {numero} via Mobile Money, mentioning reference {ref} as the memo. As soon as the payment is received, the registrar’s office will validate your enrollment. You will then be able to access your account with a code sent by SMS to the number you provided.',
      print: 'Print this receipt',
      another: 'Register another applicant',
      validatedIntro: 'Once your enrollment is validated:',
      enterSpace: 'go to your student account →',
    },
  },
  services: {
    ariaLabel: 'Other public services',
    title: 'Other services',
    portal: 'Student portal (SMS sign-in) →',
    formationContinue: 'Continuing education →',
    bibliotheque: 'Digital library →',
    connexionPersonnel: 'Staff sign-in →',
  },
};
