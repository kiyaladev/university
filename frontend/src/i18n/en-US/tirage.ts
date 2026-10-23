/** Namespace `tirage` — TiragePage.vue page (exam paper printing/draw runs, admin view). */
export default {
  title: 'Exam paper draws',
  subtitle:
    'Between a scheduled exam and the room: the paper’s SHA-256 fingerprint is re-checked at print time to block any file substitution.',
  actions: {
    schedule: 'Schedule a draw',
    exams: 'Exams',
    viewAll: 'View all draws',
    bordereau: 'Slip',
    print: 'Print',
    cancel: 'Cancel',
    back: 'Go back',
    cancelDraw: 'Cancel the draw',
    confirmPrint: 'Confirm printing',
  },
  banner: {
    prefix: 'Draws for exam',
  },
  search: {
    placeholder: 'Search (exam code, title…)',
  },
  filters: {
    examen: 'Exam',
    stade: 'Stage',
  },
  chips: {
    search: '“{value}”',
    stade: 'Stage: {value}',
    examen: 'Exam: {value}',
  },
  table: {
    columns: {
      examen: 'Exam',
      date: 'Draw date',
      exemplaires: 'Copies',
      empreinte: 'SHA-256 fingerprint',
      imprimeur: 'Printed by',
      stade: 'Stage',
    },
  },
  tooltips: {
    bordereau: 'Slip',
    voirExamen: 'View exam',
    annulerTirage: 'Cancel the draw',
  },
  ariaLabels: {
    imprimerBordereau: 'Print the draw slip',
    voirExamen: 'View the exam for this draw',
    annulerTirage: 'Cancel the draw',
  },
  emptyState: {
    message: 'No draws match these criteria.',
  },
  transitions: {
    IMPRIME:
      'Load the file you are actually going to print, or enter its SHA-256 fingerprint yourself. If it does not match the one recorded at scheduling, printing will be refused.',
    MIS_SOUS_PLI:
      'The copies are declared sealed in envelopes. This step is logged and cannot be undone.',
    DISTRIBUE:
      'The envelopes are declared delivered to the exam center. This step is logged and cannot be undone.',
    RECUPERE:
      'The scripts are declared collected: the draw is closed. This step is final.',
  },
  dialogs: {
    schedule: {
      fingerprintPolicy: 'The source file’s SHA-256 fingerprint is required at print time to prevent substitution.',
      examLabel: 'Exam *',
      dateLabel: 'Draw date *',
      copiesLabel: 'Number of copies *',
      fingerprintLabel: 'Source file SHA-256 fingerprint *',
      fingerprintHint: '64 hexadecimal characters; the fingerprint must match when printing.',
      calculateFingerprint: 'Calculate the fingerprint from the loaded file',
      calculateFromFile: 'Calculate from a file',
      fileLabel: 'Or load the file to calculate it',
      printRouteLabel: 'Printing route (e.g. Room 1 → Room 2 → …)',
      submit: 'Schedule',
      required: 'Exam, date, number of copies, and fingerprint are required.',
      invalidFingerprint: 'The fingerprint must be a 64-character SHA-256 hexadecimal value. Load the file to calculate it.',
      saveFailed: 'Unable to save the draw',
    },
    print: {
      fileLabel: 'File to print',
      fileHint: 'The fingerprint is calculated on your device; the file is not uploaded.',
      fingerprintLabel: 'SHA-256 fingerprint of the printed file *',
      fingerprintHint: 'Calculated from the loaded file, or entered from the printing tool.',
    },
    advance: {
      title: 'Move to stage “{stade}”',
    },
    cancel: {
      title: 'Cancel the draw',
      message:
        'Permanently cancel the draw for {examen}? The scheduled copies will not be printed.',
      thisExam: 'this exam',
    },
  },
  messages: {
    loadError: 'Unable to load draws',
    scheduled: 'Draw scheduled',
    fingerprintRequired: 'Fingerprint required to print',
    stageChanged: 'Stage → {stade}',
    transitionError: 'Transition failed',
    cancelled: 'Draw cancelled',
    cancelError: 'Cancellation failed',
  },
};
