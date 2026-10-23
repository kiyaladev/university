/** Namespace `examens` — Exams page. */
export default {
  title: 'Exams',
  subtitle:
    'Scheduling of exams and scanning of student cards at the room entrance. Each exam opens onto its draw and its scan station.',
  actions: {
    schedule: 'Schedule an exam',
    scanStation: 'Scan station',
    draw: 'Draw for exams',
    finish: 'Finish',
    scanCards: 'Scan cards',
    scanner: 'Scan',
    drawShort: 'Draw',
  },
  fields: {
    supervisor: 'Assigned proctor',
    codeHint: 'The exam code lets scanners identify the active session.',
    code: 'Code (EXAM-YYYY-XXXXX)',
    examDate: 'Exam date *',
    startTime: 'Start time *',
    endTime: 'End time *',
  },
  filters: {
    searchPlaceholder: 'Search (exam code, title, subject…)',
    type: 'Exam type',
    promotion: 'Class',
    dateFrom: 'Exams from',
    dateTo: 'to',
    searchChip: '"{query}"',
    typeChip: 'Type: {type}',
  },
  table: {
    columns: {
      slot: 'Date & time',
      promotion: 'Class',
      present: 'Present',
    },
    tooltips: {
      openSheet: 'Exam sheet',
      openSheetAria: 'Open the exam sheet',
      start: 'Start the exam',
      finish: 'Finish the exam',
      scanCards: 'Scan cards for this exam',
      scanCardsAria: 'Open the scan station for this exam',
      draw: 'Draw for this exam',
      drawAria: 'View the draw for this exam',
    },
  },
  emptyState: {
    noResults: 'No exam matches this search.',
    noneForStatus: 'No "{status}" exam over this period.',
  },
  sheet: {
    closeAria: 'Close the sheet',
    presentsOverEnrolled: 'Present / enrolled',
    chainContinuation: 'Next steps',
    scanJournal: 'Scan log',
    noScans: 'No card scanned for this exam yet.',
    validated: 'Validated',
    rejected: 'Rejected',
  },
  scansTable: {
    columns: {
      time: 'Time',
      holder: 'Holder',
      registrationNumber: 'ID number entered',
    },
  },
  confirm: {
    startTitle: 'Start the exam',
    startMessage:
      'Start {code} — {title}? The number of enrolled students will be recalculated from the class\'s validated registrations, and the scan station will open on this exam.',
    finishTitle: 'Finish the exam',
    finishMessage:
      'Close {code} — {title}? The number of present students is now locked: no more cards can be scanned for this exam. This operation is final.',
    finishAction: 'Finish permanently',
  },
  messages: {
    loadFailed: 'Unable to load exams',
    started: 'Exam started',
    startFailed: 'Unable to start',
    finished: 'Exam finished',
    finishFailed: 'Operation failed',
    scheduled: 'Exam scheduled',
  },
};
