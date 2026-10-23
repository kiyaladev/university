/** Namespace `affectations` — Teaching Loads page. */
export default {
  title: 'Teaching loads',
  subtitle: 'Who teaches what, to which class, for what contractual workload',
  actions: {
    new: 'New assignment',
    createFirst: 'Create the first assignment',
    editAria: 'Edit the assignment',
    deleteAria: 'Delete the assignment',
  },
  filters: {
    searchPlaceholder: 'Search (teacher, subject, class)…',
    promotion: 'Class',
  },
  table: {
    columns: {
      promotion: 'Class',
      volume: 'Planned volume',
    },
  },
  cardView: {
    contractualVolume: 'contractual volume',
  },
  emptyState: {
    filtered: 'No teaching load for these criteria.',
    none: 'No teaching load recorded.',
  },
  chips: {
    search: '"{query}"',
    teacher: 'Teacher: {name}',
    subject: 'Subject: {name}',
    promotion: 'Class: {name}',
    year: 'Year: {name}',
  },
  dialog: {
    editTitle: 'Edit the assignment',
    newTitle: 'New assignment',
    sections: {
      who: 'Who teaches what',
      when: 'For whom, and when',
    },
    fields: {
      teacherError: 'Choose the teacher',
      subject: 'Subject *',
      subjectError: 'Choose the subject',
      promotion: 'Class *',
      promotionError: 'Choose the class',
      yearError: 'Choose the academic year',
      volume: 'Contractual workload (h)',
      volumeHint: 'Used to track "hours worked / hours owed"',
    },
    cancel: 'Cancel',
  },
  deleteDialog: {
    title: 'Delete the assignment',
    message:
      '"{subject}" assigned to {teacher}: related sessions will also be deleted. Continue?',
    cancel: 'Cancel',
  },
  messages: {
    fillRequired: 'Fill in the required fields',
    saved: 'Assignment saved',
    saveError: 'Save failed',
    deleted: 'Assignment deleted',
    deleteError: 'Deletion failed',
    loadError: 'Failed to load teaching loads',
  },
};
