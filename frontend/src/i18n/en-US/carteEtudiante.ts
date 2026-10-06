/** Namespace `carteEtudiante`. */
export default {
  title: 'Student cards',
  subtitle: 'Digital card verifiable by QR code, with a personal PIN.',
  actions: {
    issue: 'Issue a card',
  },
  formDialog: {
    titleEdit: 'Edit card',
    titleNew: 'Issue a card',
    studentRequired: 'Select a student.',
    validityLabel: 'Validity date',
    photoLabel: 'Photo (URL)',
    revokeHint: 'Revoke the card from the list. Revocation requires a reason and immediately invalidates its QR code.',
    pinHint: 'Students normally set their PIN from “My student card.” You can initialize a 4 to 6 digit PIN; only the student can change it afterwards.',
    initialPinLabel: 'Initial PIN (4 to 6 digits)',
    pinHintOptional: 'Optional: the student can reset it from their portal.',
    updated: 'Card updated.',
    issued: 'Card issued.',
    issueFailed: 'Unable to issue the card.',
  },
  studentBanner: {
    message: 'List restricted to a single student\'s cards (incoming link).',
    seeAll: 'See all cards',
  },
  filters: {
    searchPlaceholder: 'ID number, name, QR token…',
  },
  table: {
    columns: {
      student: 'Student',
      matricule: 'ID number',
      issuedOn: 'Issued on',
      validity: 'Validity',
      status: 'Status',
      actions: '',
    },
  },
  emptyState: {
    message: 'No card matches these criteria. Issue one from an enrolled student\'s record.',
  },
  card: {
    issuedOn: 'Issued on {date}',
    validUntil: 'Valid until {date}',
    revocationReason: 'Revocation reason: {motif}',
  },
  actionsColumn: {
    qrAria: 'Verification QR code',
    qrTooltip: 'Verification QR code',
    printAria: 'Print the card',
    printTooltip: 'Print',
    editAria: 'Edit the card',
    editTooltip: 'Edit',
    revokeAria: 'Revoke the card',
    revokeTooltip: 'Revoke',
  },
  cardActions: {
    qr: 'QR',
    print: 'Print',
    edit: 'Edit',
    revoke: 'Revoke',
  },
  revokeDialog: {
    title: 'Revoke the card',
    close: 'Close',
    warning:
      'Irreversible action: the card becomes unusable and any scan of its QR code will display "card not valid". The student is notified on "My student card".',
    motifLabel: 'Revocation reason',
    motifHint: 'Minimum 3 characters — it will be shown to the student.',
    cancel: 'Cancel',
    confirm: 'Revoke permanently',
  },
  detailDialog: {
    title: 'Verification QR code',
    close: 'Close',
    scanHint: 'Scan this QR code to verify the card\'s authenticity. Every check is logged.',
    copyLink: 'Copy link',
    openVerification: 'Open verification',
  },
  messages: {
    linkCopied: 'Verification link copied.',
    copyError: 'Unable to copy: select the link manually.',
    revoked: 'Card revoked.',
    revokeError: 'Unable to revoke.',
  },
};
