/** Namespace `scanExamen` — Scan exams page. */
export default {
  title: 'Scan exams',
  subtitle: 'Scan the student card QR code — or enter the ID number — to confirm attendance at the current exam.',
  actions: {
    backToExamens: 'Back to exams',
    seePlannedExams: 'View scheduled exams',
    seeDraw: 'Draw for this exam',
    seeDrawTooltip: 'View the draw for this exam',
    confirmPresence: 'Confirm attendance',
  },
  emptyState: {
    title: 'No exam in progress',
    description: 'Scanning cards is only possible once the exam has been started from the Exams page.',
  },
  stats: {
    presentsOverEnrolled: 'Present / enrolled',
    rate: 'Rate {rate}',
    remaining: '{count} remaining',
    noEnrolled: 'no one enrolled',
  },
  form: {
    currentExam: 'Current exam *',
    cardLabel: 'Student card (QR or ID number)',
    cardHint: "Scan the candidate's card or enter their ID number",
  },
  summary: {
    slots: '{code} · {subject} · {promotion} · room {room} · {start}–{end}',
  },
  result: {
    validated: 'Attendance confirmed',
    alreadyRecorded: 'Attendance already recorded',
    rejected: 'Scan rejected',
    reason: 'Reason: {reason}',
    unknownCard: 'unknown card',
  },
  messages: {
    examNotStarted: 'This exam has not started: scans will be refused until it is launched.',
  },
};
