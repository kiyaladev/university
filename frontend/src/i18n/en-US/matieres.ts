/** Namespace `matieres`. */
export default {
  title: 'Subjects',
  subtitle: 'Teaching program and reference hourly volumes',
  actions: {
    new: 'New subject',
  },
  filters: {
    searchPlaceholder: 'Search (code, title)…',
    departmentChip: 'Department: {value}',
  },
  table: {
    columns: {
      volume: 'Hourly volume',
    },
  },
  actionsColumn: {
    whoTeachesAria: 'View teaching assignments for this subject',
    whoTeachesTooltip: 'Who teaches it',
    editAria: 'Edit the subject',
    deleteAria: 'Delete the subject',
  },
  card: {
    credits: '{count} credits',
    noDepartment: 'No department',
  },
  emptyState: {
    filtered: 'No subject matches these criteria.',
    empty: 'No subject registered.',
    create: 'Create the first subject',
  },
  dialog: {
    editTitle: 'Edit the subject',
    newTitle: 'New subject',
    sectionTitle: 'Program',
    codeHint: 'e.g. INF-201',
    codeError: 'Code is required',
    intituleLabel: 'Title *',
    intituleError: 'Title is required',
    volumeLabel: 'Hourly volume (h)',
    volumeHint: 'Pre-fills teaching assignments',
  },
  deleteDialog: {
    title: 'Delete the subject',
    message:
      'Delete "{intitule}"? The teaching assignments carrying it will also be deleted.',
  },
  messages: {
    saved: 'Subject saved',
    deleted: 'Subject deleted',
  },
};
