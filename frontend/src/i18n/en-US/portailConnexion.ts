/** Namespace `portailConnexion`. */
export default {
  banner: {
    overTitle: 'Student portal',
    tagline:
      'The student portal: your enrollment, your payments, your results and your attestations — no password, just your phone number registered with the registrar.',
    facts: {
      noPassword: {
        title: 'No password',
        text: 'A code sent by SMS on every sign-in, valid for a few minutes',
      },
      confidential: {
        title: 'Confidential',
        text: 'Your results are never shown to another student',
      },
      verifiable: {
        title: 'Verifiable',
        text: 'Your attestations carry a QR code that anyone can check',
      },
    },
  },
  panel: {
    titleCode: 'Verification code',
    titlePortal: 'Student portal',
  },
  step1: {
    intro: 'Reserved for enrolled students. Are you a staff member?',
    introLink: 'Sign in with your email',
    phoneLabel: 'Phone number',
    phoneRule: 'Enter your phone number',
    phoneHint: 'The number on your enrollment file (e.g. 622 000 001)',
    submit: 'Receive a code by SMS',
  },
  step2: {
    smsSent: 'If this number is on record, a 6-digit code has just been sent to {telephone}.',
    codeLabel: 'Code received by SMS',
    codeRule: 'Enter the 6-digit code received by SMS',
    codeHint: 'The code cannot be reused and expires after a few minutes',
    submit: 'Enter my space',
    changeNumber: 'Change number',
    resendCode: 'Resend code',
  },
  otherAccess: {
    ariaLabel: 'Other access',
    title: 'Other access',
    staffLogin: 'Staff sign-in (email + password) →',
    preregister: 'Not a student yet? Pre-register online →',
    library: 'Digital library →',
    verifyAttestation: 'Verify an attestation →',
  },
  messages: {
    codeResent: 'A new code has just been sent by SMS.',
    genericError: 'Unable to complete, please try again.',
    invalidCode: 'Incorrect or expired code — request a new one.',
  },
};
