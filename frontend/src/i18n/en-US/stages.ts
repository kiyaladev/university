/** Namespace `stages` — Internships & theses page (supervised works + defenses). */
export default {
  title: 'Internships & theses',
  subtitle:
    "Topic proposed → approved → supervised → report submitted → defended. Tracked by the registrar and the direction; teachers manage their supervisions, students manage their own work (via the portal).",
  actions: {
    new: 'New work',
  },
  tabs: {
    works: 'Works',
    defenses: 'Defenses',
  },
  filters: {
    searchPlaceholderWorks: 'Search (title, company, location…)',
    searchPlaceholderDefenses: 'Search (title, student, room…)',
    supervisor: 'Supervisor',
    supervisorFiltered: 'Filtered supervisor',
    workStatus: 'Work status',
  },
  types: {
    memoire: 'Thesis',
    stage: 'Internship',
    rapport: 'Report',
  },
  toDesignate: 'To be assigned',
  table: {
    columns: {
      work: 'Work',
      supervisor: 'Supervisor',
      report: 'Report',
      defense: 'Defense',
    },
    emptyState: {
      title: 'No supervised work matches these criteria.',
      description: 'The process starts with a proposed topic, then approved by the registrar.',
    },
    report: {
      done: 'Submitted',
      pending: 'Pending',
    },
    defense: {
      awaitingReport: 'Result pending',
    },
    actions: {
      viewSheetTooltip: 'View sheet',
      print: 'Print the sheet',
      planDefense: 'Schedule the defense',
      juryReport: 'Enter the jury result',
    },
  },
  stats: {
    byType: 'Breakdown by type',
    byStatus: 'Breakdown by status',
    upcoming7Days: 'Defenses in the next 7 days',
    inDefensePhase: 'Works in the defense phase',
    defended: 'Defended works',
  },
  list: {
    defenseFallback: 'Defense',
    roomToBeSet: 'room to be set',
    emptyTitle: 'No defense scheduled in the next 7 days.',
    emptyDescription:
      'A defense is scheduled from the "Works" tab, for an ongoing file whose report has been submitted.',
  },
  kanban: {
    columns: {
      proposed: 'Proposed',
      validated: 'Approved',
    },
  },
  transitions: {
    validate: 'Approve',
    abandon: 'Abandon',
    startSupervision: 'Start supervision',
    moveToDefended: 'Move to DEFENDED',
    reactivate: 'Reactivate',
  },
  dialogs: {
    workDialog: {
      editTitle: 'Edit supervised work',
      newTitle: 'New supervised work',
      type: 'Type *',
      title: 'Work title *',
      supervisorHint: 'Assign supervision to a teacher',
      companyTutor: 'Company tutor',
      initialStatus: 'Initial status',
      initialStatusHint: 'PROPOSED by default; later steps follow the actions on the record',
      required: 'Title and student are required',
      updated: 'Work updated',
      created: 'Work created',
    },
    defense: {
      juryTitle: 'Jury outcome',
      scheduleTitle: 'Schedule the defense',
      juryHint: 'Grade and distinction after the defense of “{title}”.',
      date: 'Defense date *',
      time: 'Time *',
      chair: 'Jury chair',
      assessors: 'Assessors',
      assessorsHint: '“Prof. X; Dr. Y”',
      grade: 'Grade out of 20',
      saveJury: 'Save jury outcome',
      saveDefense: 'Save defense',
      jurySaved: 'Jury outcome saved',
      dateRequired: 'The defense date is required',
      saved: 'Defense recorded — work defended',
      mentionHint: 'Highest honours, High honours…',
    },
    transition: {
      title: 'Move to "{label}"',
      abandonMessage: 'The file remains viewable but leaves the process. Confirm the abandonment?',
      defendedMessage:
        'A submitted report and a recorded defense are required before moving to DEFENDED.',
      defaultMessage: 'Confirm this transition?',
    },
    delete: {
      title: 'Delete this work?',
      message:
        '{title} — file deletion reserved for administrators, PROPOSED / APPROVED states only.',
    },
  },
  notifications: {
    transitionSuccess: 'Work moved to "{label}"',
    reportMarkedDone: 'Report marked as submitted',
    reportMarkedPending: 'Report marked as not submitted',
    deleted: 'Work deleted',
  },
  detail: {
    title: 'Supervised work',
    fields: {
      supervisor: 'Supervisor',
      company: 'Company',
      companyTutor: 'Company tutor',
      place: 'Location',
      reportSubmitted: 'Report submitted',
      defense: 'Defense',
    },
    yes: 'Yes',
    no: 'No',
  },
};
