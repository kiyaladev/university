/** Namespace `mesReclamations` — My complaints page (student view). */
export default {
  title: 'My complaints',
  subtitle:
    'The single point of contact for your grievances: missing grade, data entry error, registrar, teaching. Each complaint follows a tracked cycle and can be anonymous if you prefer.',
  actions: {
    new: 'New complaint',
  },
  banner: {
    wrongRole:
      'This page is reserved for student accounts. You are logged in as {role} — the full registry is available under "{registry}".',
    goToRegistry: 'Complaints & requests',
  },
  stats: {
    caption: 'Counters computed from the complaints shown below.',
    labels: {
      open: 'Open',
      inProgress: 'In progress',
      awaitingReply: 'Awaiting reply',
      resolved: 'Resolved',
    },
  },
  filters: {
    searchPlaceholder: 'Search (No., subject…)',
  },
  table: {
    columns: {
      subject: 'Subject',
    },
    openTracking: 'Open complaint tracking',
    trackingTooltip: 'Tracking and discussion thread',
  },
  emptyState: {
    description:
      'No complaints match these criteria. Open one if a grade, an enrollment or a document is causing an issue: the registrar will reply in the discussion thread.',
  },
  cards: {
    messagesCount: '{count} message(s)',
    escalatedOn: 'Escalated on {date}',
  },
};
