/** Namespace `loginPage` — LoginPage.vue (staff sign-in screen). */
export default {
  signage: {
    overline: 'University staff',
    brand: 'University',
    tagline:
      'The controller’s register, room by room: it logs the session, gets the teacher to sign or place a finger, and the time is recorded.',
    facts: {
      offline: {
        label: 'In the field',
        text: 'Offline check-ins, synced once the network is back',
      },
      opposable: {
        label: 'Evidentiary',
        text: 'Server timestamp, recorded proof of attendance, tracked corrections',
      },
    },
  },
  access: {
    title: 'Sign in',
    intro: 'Reserved for university staff — controllers, registrar, teachers, management. Are you a student?',
    studentPortalLink: 'Enter through the student portal',
  },
  form: {
    emailLabel: 'Email address',
    emailRequired: 'Enter your email address',
    passwordLabel: 'Password',
    passwordRequired: 'Enter your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submit: 'Sign in',
  },
  services: {
    ariaLabel: 'Services accessible without an account',
    title: 'No account needed',
    links: {
      portailSms: 'Student portal (SMS sign-in) →',
      preinscription: 'Pre-register online →',
      formationContinue: 'Continuing education →',
      bibliotheque: 'Digital library →',
      verifierAttestation: 'Verify a certificate →',
      verifierCarte: 'Verify a student card →',
    },
  },
  errors: {
    default: 'Incorrect email address or password.',
  },
};
