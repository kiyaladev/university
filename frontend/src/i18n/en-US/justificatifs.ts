/** Namespace `justificatifs` — page JustificatifsPage.vue (absence excuses). */
export default {
  title: 'Absence excuses',
  subtitle: 'A justified and validated absence becomes an "excused absence" in the statistics',
  actions: {
    record: 'Record an excuse',
  },
  banner: {
    info:
      'An excuse is recorded with the registrar’s office, upon presentation of the supporting document. Here you can track the status of your requests.',
  },
  filters: {
    sessionsFrom: 'Sessions from',
    sessionsTo: 'to',
  },
  table: {
    loadingLabel: 'Loading excuses…',
    emptyFiltered: 'No excuse matches these filters for the period.',
    emptyDefault: 'No excuse recorded for this period.',
    columns: {
      explanation: 'Explanation',
    },
    actions: {
      viewAria: 'View the excuse',
      validateAria: 'Approve this excuse',
      validateTooltip: 'Approve — the session will become an excused absence',
      rejectAria: 'Reject this excuse',
      rejectTooltip: 'Reject — the absence remains recorded',
    },
  },
  depositDialog: {
    title: 'Record an excuse',
    subtitle: 'Entered by the administration, upon presentation of the document by the teacher.',
    session: 'Related session *',
    sessionHint: 'Unassured sessions from the last 90 days',
    explanation: 'Explanation *',
    file: 'Supporting document (image or PDF)',
    submit: 'Submit the excuse',
  },
  detailDialog: {
    title: 'Excuse',
    explanation: 'Explanation',
    decisionComment: 'Decision comment',
    arbitratedBy: 'Decided by',
    fileAlt: 'Supporting document provided by the teacher',
    openAttachment: 'Open the attachment',
    viewSession: 'View the session in the register',
  },
  dialogs: {
    validateTitle: 'Approve the excuse',
    rejectTitle: 'Reject the excuse',
    validateMessage:
      'The session will become an "excused absence" in the statistics. Comment (optional):',
    rejectMessage: 'The absence will remain recorded as is. Reason for rejection (optional):',
    doNothing: 'Do nothing',
  },
  messages: {
    validated: 'Excuse approved — absence excused',
    rejected: 'Excuse rejected',
    missingFields: 'Teacher, related session and explanation are required.',
    deposited: 'Excuse submitted',
  },
};
