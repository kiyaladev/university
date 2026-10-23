/** Namespace `demandeDocuments`. */
export default {
  title: 'Document requests',
  subtitle:
    'The student submits their request online, pays the configured fee, the registrar processes it, marks the document as ready, and hands it over at the counter.',
  studentBanner: {
    message: 'Register restricted to a single student\'s requests (incoming link).',
    seeAll: 'See all requests',
  },
  plaques: {
    awaitingPayment: 'To pay',
    processing: 'Processing',
    ready: 'Ready',
    readyOverdue: 'Ready > 7 days',
  },
  filters: {
    searchPlaceholder: 'Search (No., reason, ID number…)',
  },
  table: {
    columns: {
      frais: 'Fee',
      actions: '',
    },
    paymentConfirmed: 'Payment confirmed',
    paymentPending: 'Payment pending',
  },
  emptyState: {
    message:
      'No request matches these criteria. Requests are created by students from "My document requests".',
  },
  actionsColumn: {
    confirmPayment: 'Confirm payment',
    startProcessing: 'Start processing',
    markReady: 'Mark ready',
    handOver: 'Hand over',
  },
  cardActions: {
    process: 'Process',
    ready: 'Ready',
  },
  steps: {
    paid: 'Paid',
    processing: 'Processing',
    ready: 'Ready',
    handedOver: 'Handed over',
  },
  detail: {
    theirCard: 'Their card',
    enrollment: 'Enrollment',
    fees: 'Fee',
    paymentNotStarted: 'Not started',
    processedBy: 'Processed by',
    handedOverOn: 'Handed over on',
    smsNotification: 'SMS notification',
  },
  createDialog: {
    title: 'New document request',
    documentType: 'Document type *',
    delay: 'processing time: {hours} h',
    fees: 'Fee:',
    usualDelay: 'usual processing time: {hours} h',
    noFeeConfigured: 'No fee is configured for this type, so the request will be free. Contact the registrar if needed.',
    reasonLabel: 'Reason for the request',
    reasonPlaceholder: 'E.g. needed for a scholarship application',
    enrollmentSection: 'Related enrollment',
    noEnrollment: 'No enrollment is recorded; the request will be linked only to your student record.',
    created: 'Request {number} created',
    createFailed: 'Unable to create the request',
  },
  markReadyDialog: {
    title: 'Mark ready',
    message: 'An SMS will be sent to the student. Custom message (optional):',
    confirm: 'Mark ready',
  },
  handOverDialog: {
    title: 'Confirm hand-over',
    message: 'Hand-over note (optional):',
    confirm: 'Hand over',
  },
  rejectDialog: {
    title: 'Reject the request',
    message: 'Reason for rejection (required):',
  },
  messages: {
    paymentConfirmed: 'Payment confirmed',
    processingStarted: 'Processing started',
    markedReady: 'Request marked ready, student notified',
    handedOver: 'Document handed over',
    rejected: 'Request rejected',
  },
};
