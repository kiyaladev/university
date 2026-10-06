/** Namespace `mesDemandes` — My document requests page (student view). */
export default {
  title: 'My document requests',
  subtitle:
    'Request your certificates and transcripts online: pay the configured fee, track progress, and pick them up at the front desk once the status reaches "Ready".',
  actions: {
    new: 'New request',
    pay: 'Pay',
    payNow: 'Pay now',
    track: 'Track',
    close: 'Close',
    cancel: 'Cancel',
  },
  banner: {
    wrongRole:
      'This page is reserved for student accounts. You are logged in as {role} — the full registry is available under "{registry}".',
    goToRegistry: 'Document requests',
  },
  stats: {
    caption: 'Counters computed from the requests shown below.',
    labels: {
      toPay: 'To pay',
      inProgress: 'In progress',
      ready: 'Ready',
      delivered: 'Delivered',
    },
  },
  filters: {
    searchPlaceholder: 'Search (No., reason…)',
    status: 'Status',
  },
  table: {
    columns: {
      number: 'No.',
      type: 'Type',
      fees: 'Fee',
      status: 'Status',
      createdAt: 'Created on',
    },
    paymentConfirmed: 'Payment confirmed',
    trackTooltip: 'Track the request',
    trackAria: 'Track the request',
  },
  emptyState: {
    description:
      'No requests match these criteria. Request a certificate, a transcript or a duplicate: the fee and turnaround time are shown before you submit.',
  },
  cards: {
    createdOn: 'Created on {date}',
  },
  steps: {
    payment: 'Payment',
    paid: 'Paid',
    processing: 'Processing',
    ready: 'Ready',
    delivered: 'Delivered',
  },
  statusExplanations: {
    EN_ATTENTE_PAIEMENT:
      'Pay the fee to start processing. Without payment, the request stays pending.',
    PAYEE: 'Fee received. The registrar will take your request in charge.',
    EN_TRAITEMENT: 'The registrar is preparing your document.',
    PRETE: "Your document is ready: come to the registrar's front desk with your ID card.",
    REMISE: 'Document delivered. Nothing else to do.',
    REJETEE: 'Request rejected. The reason is shown below; you can submit a new one.',
  },
  paymentOptions: {
    mobileMoney: 'Mobile Money',
    cash: 'Cash (at the front desk)',
    transfer: 'Bank transfer',
  },
  operatorOptions: {
    orangeMoney: 'Orange Money',
    mtnMomo: 'MTN MoMo',
    telecel: 'Telecel',
  },
  dialog: {
    fees: 'Fee',
    payment: 'Payment',
    notInitiated: 'Not initiated',
    createdAt: 'Created on',
    deliveredAt: 'Delivered on',
    requestReason: 'Reason for your request',
    registrarMessage: 'Message from the registrar',
    rejectionReason: 'Reason for rejection',
  },
  paymentDialog: {
    mobileMoneyNote: 'Approve the request on your phone. Payment remains pending until collection is confirmed; your document will then be processed.',
    title: 'Pay for the request',
    mode: 'Payment method',
    operator: 'Operator',
    phoneLabel: 'Mobile Money number',
    phoneHint: 'The number that will be charged',
    pilotNote:
      'Pilot mode: no Mobile Money gateway is connected. The payment is recorded as successful and the request moves to processing.',
    pendingNote:
      "The payment will be recorded as pending: pay at the registrar's front desk, who will confirm it to start processing.",
  },
  messages: {
    phoneRequired: 'Enter a valid Mobile Money number.',
    mobileMoneyPending: 'Payment request recorded. Wait for collection to be confirmed before the document is processed.',
    paymentRegisteredProcessing: 'Payment recorded: your request is now being processed.',
    paymentInitiatedPending: 'Payment initiated: come to the front desk, the registrar will confirm it.',
    paymentFailed: 'Payment failed',
  },
};
