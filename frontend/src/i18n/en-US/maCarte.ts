/** Namespace `maCarte` — My Student Card page. */
export default {
  title: 'My student card',
  subtitle:
    'Your digital card, verifiable online via QR code, with a personal PIN for the cafeteria, halls of residence, and checks.',
  loading: 'Loading your card…',
  noCard: {
    title: 'No card issued',
    description:
      'The registrar generates your card from your enrollment. If your enrollment has been validated for several days, request a duplicate or open a complaint.',
    requestDocument: 'Request a document',
    openComplaint: 'Open a complaint',
  },
  card: {
    revoked: {
      text: 'This card has been revoked by the institution: it is no longer valid and its QR code displays "invalid card".',
      reasonSuffix: ' Reason: {reason}.',
      requestDuplicate: 'Request a duplicate from the registrar.',
    },
    validUntil: 'Valid until',
    qrHint: 'Scan this QR code to verify your card. Every check is logged.',
    copyLink: 'Copy the link',
    openVerification: 'Open verification',
    setNip: 'Set a PIN',
    print: 'Print A4',
  },
  dialog: {
    title: 'Set your PIN',
    description:
      'The PIN is a personal 4- to 6-digit code that authenticates your card for partners (cafeteria, halls of residence, remote checks).',
    nipLabel: 'PIN (4 to 6 digits)',
    nipHint: 'Enter 4 to 6 digits.',
    confirmLabel: 'Confirmation',
  },
  messages: {
    linkCopied: 'Verification link copied.',
    copyError: 'Copy failed: select the link manually.',
    nipLength: 'The PIN must be 4 to 6 digits.',
    nipMismatch: 'The two PINs do not match.',
    nipSaved: 'PIN saved.',
  },
};
