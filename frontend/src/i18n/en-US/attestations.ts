/** Namespace `attestations`. */
export default {
  title: 'Attestations',
  subtitle:
    "Official documents verifiable via QR code — every public scan is logged, nothing is erased, everything can be revoked.",
  actions: {
    bulletins: 'Transcripts',
    issue: 'Issue an attestation',
    qr: 'QR',
  },
  issueDialog: {
    subtitle: 'Official document verifiable by QR code — only one active attestation is allowed for the same student, type, and academic year.',
    studentHint: 'Type at least 2 letters: name, first name, or student ID',
    studentEmpty: 'No student found',
    type: 'Attestation type *',
    reason: 'Reason (scholarship, bank, passport…)',
    track: 'Academic track',
    enrollment: 'Linked enrollment (optional)',
    enrollmentHint: 'Identifies the student’s exact academic path',
    submit: 'Issue',
    issued: 'Attestation issued — remember to print it with its QR code',
  },
  filters: {
    searchPlaceholder: 'Search (number, name, student ID)…',
    type: 'Document type',
    promotion: 'Class',
    searchChip: '"{value}"',
    typeChip: 'Type: {value}',
    statusChip: 'Status: {value}',
    yearChip: 'Year: {value}',
    promotionChip: 'Class: {value}',
  },
  table: {
    columns: {
      parcours: 'Year / class',
      verifications: 'Verifications',
    },
  },
  actionsColumn: {
    verificationsAria: 'Verification log for this document',
    verificationsTooltip: 'Verification log for this document',
    detailAria: 'View document detail and QR code',
    detailTooltip: 'Document detail and QR code',
    printAria: 'Print the document',
    printTooltip: 'Print the A4 document',
    revokeAria: 'Revoke the document',
    revokeTooltip: 'Revoke the document',
  },
  card: {
    issuedOn: 'Issued on {date} · {count} verification(s)',
  },
  emptyState: {
    title: 'No attestation matches these criteria.',
  },
  detail: {
    bulletin: 'Transcript',
    motif: 'Reason: {motif}',
    parcours: 'Track: {annee}{promotion}',
    issuedOnBy: 'Issued on {date} by {who}',
    revokedOnBy: 'Revoked on {date} — {motif}',
    matricule: '— student ID {matricule}',
  },
  revocation: {
    title: 'Revoke {numero}',
    warning:
      "The QR code will no longer vouch for the document: the authenticity of the revocation is itself verifiable online. This action is final.",
    motifLabel: 'Revocation reason *',
    motifHint: 'Minimum three characters — this reason is shown during public verifications',
    confirm: 'Revoke permanently',
  },
  verificationsDialog: {
    title: 'Verification log',
    subtitle: '{numero} — every QR scan, anywhere in the world, leaves a trace.',
    valid: 'valid',
    failed: 'failed',
    ip: 'IP: {ip}',
    ipUnknown: 'unknown',
    empty: 'No verification recorded.',
  },
  messages: {
    revoked: 'Attestation revoked — the QR code will no longer be valid',
  },
};
