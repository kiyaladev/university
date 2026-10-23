/** Namespace `correctionsPointages` — consultation et correction des pointages. */
export default {
  title: 'Attendance corrections',
  subtitle:
    'The attendance records taken in the room. A correction only changes the edited fields and stays logged.',
  filters: {
    from: 'From',
    to: 'To',
    status: 'Status',
    method: 'Verification method',
  },
  chips: {
    from: 'From {date}',
    to: 'Until {date}',
    status: 'Status: {status}',
    method: 'Method: {method}',
  },
  table: {
    columns: {
      status: 'Status',
      hours: 'Hours',
      method: 'Method',
    },
  },
  methods: {
    MANUEL: 'Manual entry',
    QR_SALLE: 'Room QR code',
    GEOLOCALISATION: 'Geolocation',
    SIGNATURE: 'Signature',
  },
  summary: '{count} attendance record(s) shown out of {total}',
  emptyState: {
    title: 'No attendance record for these criteria.',
  },
  actions: {
    edit: 'Correct this record',
    delete: 'Delete this record',
  },
  formDialog: {
    title: 'Correct the attendance record',
    subtitle: 'Only the edited fields change: the rest of the entry is kept.',
    status: 'Attendance status',
    arrival: 'Arrival time',
    departure: 'Actual end time',
    headcount: 'Students present',
    topic: 'Topic covered',
    substitute: 'Substitute teacher',
    observation: 'Observation',
    proofsHint:
      'The proofs (room QR code, position, signature, personal code) are not replayed: they remain those of the original record.',
    invalidTime: 'Times must use the HH:mm format.',
    invalidCount: 'The headcount must be a positive integer or zero.',
  },
  deleteDialog: {
    title: 'Delete this attendance record?',
    message:
      'The attendance record of {teacher} on {date} will be deleted. The session goes back to not being checked. This cannot be undone.',
  },
  messages: {
    updated: 'Attendance record corrected',
    deleted: 'Attendance record deleted',
  },
};
