/** Namespace `notes`. */
export default {
  title: 'Grade entry',
  subtitle:
    'Spreadsheet-style bulk entry: Tab to navigate, Enter to confirm. A row that is never filled in makes the subject fail the deliberation.',
  form: {
    evaluationLabel: 'Evaluation to grade',
    evaluationPlaceholder: 'Type the exam title…',
  },
  actions: {
    allEvaluations: 'All evaluations',
    closeEvaluation: 'Close the evaluation',
    browseEvaluations: 'Browse evaluations',
  },
  loading: 'Loading…',
  semester: 'semester',
  studentsCount: '{count} students',
  emptyState: {
    title: 'Select an evaluation above to open the grade sheet.',
    hint: 'The sheet lists students whose enrollment file has been validated.',
  },
  readOnly: {
    closed: 'The evaluation is closed: grades are final.',
    forbidden: 'Grade entry is reserved for the registrar and management.',
  },
  dialogs: {
    close: {
      title: 'Close the evaluation',
      message: 'Close "{name}"? Grades become final and a deliberation recalculation will take them into account.',
    },
  },
  messages: {
    evaluationNotFound: 'Evaluation not found: it may have been deleted.',
    saved: '{count} grade(s) saved',
    savedWithIgnored: '{count} grade(s) saved · {ignored} ignored',
    closed: 'Evaluation closed',
  },
  bulk: {
    studentOne: '{count} student',
    students: '{count} students',
    gradedOne: '{count} grade',
    graded: '{count} grades',
    presentOne: '{count} present',
    present: '{count} present',
    absentOne: '{count} absent',
    absentCount: '{count} absent',
    modifiedOne: '{count} change',
    modifiedCount: '{count} changes',
    progress: '{filled} / {total} grades entered',
    registrationNumber: 'Enrollment no.',
    grade: 'Grade /20',
    attendanceFor: 'Attendance for {name}',
    gradeFor: 'Grade out of 20 for {name}',
    absent: 'absent',
    missing: 'missing',
    modified: 'modified',
    saved: 'saved',
    empty:
      'No students to grade: the sheet only lists students with validated enrollment in this class for the evaluation year.',
    markAllPresent: 'Mark all present',
    markAllAbsent: 'Mark all absent',
    saveAll: 'Save all',
    noChanges: 'No grades changed since the last save',
    readOnly: 'Grade entry is disabled for this evaluation.',
  },
};
