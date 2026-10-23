/** Namespace `verification`. */
export default {
  nav: {
    verifyCard: 'Verify a student card',
  },
  title: 'Certificate verification',
  subtitle:
    'This public page confirms the authenticity of a certificate issued by the institution: the document exists, is intact, and has not been revoked. Every check is logged.',
  form: {
    sectionTitle: 'Enter the number and QR code',
    numeroLabel: 'Certificate number',
    numeroHint: 'E.g. ATT-2026-00001',
    qrLabel: 'Certificate QR code',
    qrHint: 'Scan the document QR code or enter the code',
    qrParamsHint:
      'The scanned (or pasted) QR code is a URL: its {ref} and {k} parameters fill in the form automatically.',
  },
  result: {
    valid: 'Genuine certificate',
    invalid: 'Invalid certificate',
    intro:
      'Certificate {numero} does indeed exist in the institution\'s register. Verified details:',
    table: {
      attestation: 'Certificate',
      attestationValue: '— no. {numero}',
      etudiantValue: '— student ID {matricule}',
      parcours: 'Program',
      reference: 'Verification reference',
    },
    checkedAt:
      'Verified on {date} — this check has been recorded in the document log.',
  },
  footer:
    'Verification is free and requires no account. A revoked certificate or an unknown number proves nothing — be cautious.',
  errors: {
    serviceUnavailable:
      'The verification could not be completed: the service is temporarily unavailable. Please try again shortly.',
  },
};
