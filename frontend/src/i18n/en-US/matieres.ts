/** Namespace `matieres`. */
export default {
  title: 'Subjects',
  subtitle: 'Teaching program and reference hourly volumes',
  actions: {
    new: 'New subject',
  },
  filters: {
    searchPlaceholder: 'Search (code, title)…',
    department: 'Department',
    departmentChip: 'Department: {value}',
  },
  table: {
    columns: {
      code: 'Code',
      intitule: 'Title',
      department: 'Department',
      volume: 'Hourly volume',
      credits: 'Credits',
      actions: 'Actions',
    },
  },
  actionsColumn: {
    whoTeachesAria: 'View teaching assignments for this subject',
    whoTeachesTooltip: 'Who teaches it',
    editAria: 'Edit the subject',
    editTooltip: 'Edit',
    deleteAria: 'Delete the subject',
    deleteTooltip: 'Delete',
  },
  card: {
    credits: '{count} credits',
    noDepartment: 'No department',
    volume: 'Hourly volume {value} h',
  },
  emptyState: {
    filtered: 'No subject matches these criteria.',
    empty: 'No subject registered.',
    create: 'Create the first subject',
    reset: 'Reset filters',
  },
  dialog: {
    editTitle: 'Edit the subject',
    newTitle: 'New subject',
    sectionTitle: 'Program',
    codeLabel: 'Code *',
    codeHint: 'e.g. INF-201',
    codeError: 'Code is required',
    departmentLabel: 'Department',
    intituleLabel: 'Title *',
    intituleError: 'Title is required',
    volumeLabel: 'Hourly volume (h)',
    volumeHint: 'Pre-fills teaching assignments',
    creditsLabel: 'Credits',
    cancel: 'Cancel',
    save: 'Save',
  },
  deleteDialog: {
    title: 'Delete the subject',
    message:
      'Delete "{intitule}"? The teaching assignments carrying it will also be deleted.',
    cancel: 'Cancel',
    confirm: 'Delete',
  },
  messages: {
    requiredFields: 'Please fill in the required fields',
    saved: 'Subject saved',
    saveError: 'Unable to save',
    deleted: 'Subject deleted',
    deleteError: 'Unable to delete',
    loadError: 'Unable to load subjects',
  },
};
