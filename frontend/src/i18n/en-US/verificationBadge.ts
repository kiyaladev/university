/** Namespace `verificationBadge`. */
export default {
  nav: {
    verifyCard: 'Verify a card',
    verifyAttestation: 'Verify a certificate',
  },
  title: 'Access badge verification',
  subtitle:
    'This public page confirms that a badge presented at the entrance was indeed issued by the institution, has not been cancelled, and is still valid. Every check is logged.',
  form: {
    sectionTitle: 'Enter the identifier and QR code',
    identifiantLabel: 'Badge identifier',
    identifiantHint: 'UUID printed under the QR code',
    qrLabel: 'Badge QR code',
    qrHint: 'Scan the badge QR code or enter the code',
    qrParamsHint:
      'The scanned (or pasted) QR code is a URL: its {badge} and {k} parameters fill in the form automatically.',
    submit: 'Verify',
  },
  result: {
    valid: 'Genuine badge',
    invalid: 'Invalid badge',
    intro:
      'Badge {numero} does indeed exist in the institution\'s register. Verified details:',
    table: {
      porteur: 'Holder',
      numero: 'Number',
      type: 'Type',
      qualite: 'Role',
      statut: 'Status',
      statutValue: 'Active — not cancelled, currently valid',
      zones: 'Authorized zones',
      delivreLe: 'Issued on',
      valableJusquau: 'Valid until',
    },
    checkedAt:
      'Verified on {date} — this check has been recorded in the badge log.',
  },
  footer:
    'Verification is free and requires no account. A cancelled badge or an unknown identifier proves nothing — be cautious.',
  errors: {
    serviceUnavailable:
      'The verification could not be completed: the service is temporarily unavailable. Please try again shortly.',
  },
};
