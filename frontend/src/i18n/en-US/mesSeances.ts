/** Namespace `mesSeances` — MesSeancesPage.vue (log of the teacher's sessions). */
export default {
  title: 'My sessions',
  subtitle: 'Overview of my classes and the attendance checks concerning me',
  actions: {
    myJustificatifs: 'My justifications',
    printAttendance: 'Print my attendance sheet',
  },
  kpis: {
    planned: 'Scheduled sessions',
    ensured: 'Sessions held',
    hoursDone: 'Hours completed',
  },
  table: {
    columns: {
      promotion: 'Cohort',
      statut: 'Outcome',
      theme: 'Topic covered',
    },
    loadingLabel: 'Loading your sessions…',
  },
  emptyState: {
    seances: 'No session for this period. Widen the date range to see further back.',
  },
  messages: {
    noTeacherFile: 'Your account is not linked to any teacher record: the sheet is unavailable.',
  },
};
