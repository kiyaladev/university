/** Namespace `verificationCarte` — page VerificationCartePage.vue (public student card verification). */
export default {
  actions: {
    verifyAttestation: 'Verify a certificate',
  },
  title: 'Student card verification',
  subtitle:
    'This public page attests to the authenticity of a digital student card issued by the institution: the card exists, is intact, and has not been revoked. Every check is logged.',
  form: {
    sectionTitle: 'Enter the card ID and QR code',
    identifierLabel: 'Card ID',
    identifierHint: 'UUID printed under the QR code',
    qrLabel: 'Card QR code',
    qrHint: 'Scan the card QR code or enter the code',
    qrExplanationPrefix: 'The scanned (or pasted) QR code is a URL: its parameters',
    qrExplanationAnd: 'and',
    qrExplanationSuffix: 'fill in the form automatically.',
  },
  result: {
    valid: 'Authentic card',
    invalid: 'Invalid card',
    introPrefix: 'Card',
    introSuffix: "is indeed found in the institution's register. Verified details:",
    table: {
      cardNumber: 'Card number',
      statusValue: 'Issued — not revoked, currently valid',
      validUntil: 'Valid until',
    },
    verifiedAt: 'Verified on {date} — this check has been recorded in the card log.',
  },
  footer:
    'Verification is free and requires no account. A revoked card or an unknown ID proves nothing — be cautious.',
  messages: {
    verificationFailed:
      'The verification could not be completed: the service is temporarily unavailable. Please try again shortly.',
  },
};
