/** Namespace `inscriptions` — Enrollments page (yearly enrollment records). */
export default {
  subtitle:
    'Enrollment records for the year: collect fees via Mobile Money or at the front desk, validate paid records, print certificates.',
  actions: {
    new: 'New enrollment at the desk',
  },
  banner: {
    dossiersOf: 'Records for',
    allYears: '({matricule}) — all years combined.',
    viewAll: 'View all records',
  },
  filters: {
    searchPlaceholder: 'Search (record no., student name)…',
    promotion: 'Class',
    enrolledFrom: 'Enrolled since',
    enrolledUntil: 'until',
  },
  table: {
    columns: {
      number: 'Record no.',
      promotion: 'Year / Class',
      fees: 'Fees (GNF)',
      paid: 'Paid (GNF)',
      balance: 'Balance due (GNF)',
      enrolledOn: 'Enrolled on',
    },
    actions: {
      collectAria: 'Collect a payment on this record',
      collectTooltip: 'Collect — {amount} GNF remaining',
      viewPaymentsAria: 'View the payments for this record',
      viewPaymentsTooltip: 'Record payments',
      validateAria: 'Validate the record',
      validateTooltip: 'Validate the record (fees paid)',
      cancelAria: 'Cancel the record',
      cancelTooltip: 'Cancel the record',
      printAria: 'Print the enrollment certificate',
      printTooltip: 'A4 enrollment certificate',
      viewStudentAria: "View the student's record",
      viewStudentTooltip: "Student's record",
    },
  },
  cards: {
    fees: 'Fees',
    paid: 'Paid',
    balance: 'Balance due',
    actions: {
      collect: 'Collect',
      certificate: 'Certificate',
    },
  },
  emptyState: {
    noRecordsForStudent: '{name} has no enrollment record.',
    noMatch: 'No record matches these criteria.',
    none: 'No enrollment record: open one at the front desk.',
  },
  chips: {
    search: '"{value}"',
    year: 'Year: {value}',
    promotion: 'Class: {value}',
    status: 'Status: {value}',
    since: 'Since: {value}',
    until: 'Until: {value}',
  },
  studentDialog: {
    unavailable: 'Student record unavailable.',
    sex: 'Sex',
    birthDate: 'Date of birth',
    address: 'Address',
    portalAccount: 'Portal account',
    none: 'none',
    registry: 'Registry',
    hisPayments: 'Their payments',
    editRecord: 'Edit record',
  },
  createDialog: {
    title: 'New enrollment (front desk)',
    studentPlaceholder: 'Type a name or student ID…',
    inactive: 'inactive',
    officialFee: 'Official fee',
    amount: 'Enrollment fee (GNF)',
    officialFeeApplied: 'Official fee applied automatically',
    noFee: 'No fee is configured: enter the amount',
    save: 'Save enrollment',
    created: 'Enrollment created — awaiting payment',
  },
  dialogs: {
    validate: {
      title: 'Validate the record',
      message: 'Validate {numero} ({prenom} {nom})? The fees are paid, the record becomes final.',
    },
    cancel: {
      title: 'Cancel the record',
      message: 'Cancel {numero}? Payments remain tracked in the register.',
      confirm: 'Cancel the record',
    },
  },
  messages: {
    validated: 'Record validated',
    cancelled: 'Record cancelled',
    studentNotFound: 'Student not found: filter ignored.',
  },
};
