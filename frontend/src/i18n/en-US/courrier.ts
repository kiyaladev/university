/** Namespace `courrier`. */
export default {
  title: 'Administrative mail',
  subtitle:
    'Recording and routing of mail — every item goes through a countersigning workflow before reaching the archives.',
  actions: {
    register: 'Register a mail item',
  },
  registrationDialog: {
    department: 'Recipient department (optional)',
    departmentHint:
      'Only the head of the selected department can read and countersign. Without a department, no department head receives this item.',
    ownDepartment: 'This mail item is addressed to your department.',
    subtitle:
      'If no routing is entered, the default route (secretariat → department chair → archives) is created automatically.',
    number: 'Number (COUR-YYYY-XXXXX)',
    incoming: 'Incoming',
    outgoing: 'Outgoing',
    sender: 'Sender',
    receivedOn: 'Received on',
    sentOn: 'Sent on',
    archiveReference: 'Archive reference (optional)',
    attachment: 'Scanned attachment (PDF/image)',
    routing: 'Countersigning route',
    approverRole: 'Approver role',
    noRouting: 'No route defined — a default route will be applied.',
    addStep: 'Add a step',
    saved: 'Mail item saved',
  },
  tabs: {
    entrant: 'Incoming',
    sortant: 'Outgoing',
    archive: 'Archives',
  },
  filters: {
    searchPlaceholder: 'Search (number, subject, sender, recipient…)',
    searchChip: '"{value}"',
    statusChip: 'Status: {value}',
  },
  summary: {
    tabLabel: '{type} mail',
    archiveLabel: 'Archives',
    period: 'from {debut} to {fin}',
    line: '{onglet} · {periode} — last 90 days by default. {total} mail item(s).',
  },
  table: {
    columns: {
      objet: 'Subject',
      correspondant: 'Sender / Recipient',
      circuit: 'Routing',
    },
    steps: '{count} step(s)',
  },
  card: {
    from: 'From: {value}',
    to: 'To: {value}',
    stamps: '{count} signature(s)',
    print: 'Print the slip',
  },
  detail: {
    sender: 'Sender: {name}',
    recipient: 'Recipient: {name}',
    approver: 'Approver',
    stampedOn: 'Countersigned on',
    stamp: 'Countersign',
    noWorkflow: 'No approval workflow defined',
    stampStep: 'Countersign step {order}',
    signatureHash: 'Countersignature hash (SHA-256, optional)',
    status: {
      received: 'Received',
      inWorkflow: 'In workflow',
      processed: 'Processed',
      filed: 'Filed',
      archived: 'Archived',
    },
    stamped: 'Countersignature recorded',
    stampOnStep: 'Countersigning is performed on a workflow step',
    closeMessage: 'Close “{number}” and move it to {next}?',
  },
  actionsColumn: {
    detailAria: 'Details of mail {numero}',
    detailTooltip: 'Details / countersign',
    printAria: 'Print the slip for mail {numero}',
    printTooltip: 'Print the slip (A4)',
    closeAria: 'Close mail {numero}',
    closeTooltip: 'Close / archive',
  },
  emptyState: {
    archiveTitle: 'No archived mail',
    typeTitle: 'No {type} mail',
    archiveHint:
      'A mail item joins the archives once filed and closed. Widen the period, or track routings still open in the Incoming and Outgoing tabs.',
    typeHint: 'No {type} mail {periode}. Widen the period or clear the advanced filters.',
  },
  dialogs: {
    close: {
      title: 'Close the mail item',
      message: 'Confirm closing "{numero}"? This transition moves it to the archives (FILED → ARCHIVED).',
    },
  },
  messages: {
    closed: 'Mail closed',
  },
};
