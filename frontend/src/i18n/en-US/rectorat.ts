/** Namespace `rectorat` — Rectorate dashboard page. */
export default {
  title: "Institution overview",
  subtitle:
    "Current institution figures · year {annee}.",
  subtitleFallback: '—',
  actions: {
    generateReport: 'Generate MESRS report',
    generateReportTooltip:
      "Save the current figures in archived reports.",
  },
  kpis: {
    totalHeadcount: 'Total headcount',
    totalHeadcountDetail: '{count} class(es) · non-cancelled enrollments',
    viewStudents: 'View students',
    successRate: 'Overall success rate',
    successRateDetail: 'Regular session · validated deliberations',
    viewDeliberations: 'View deliberations',
    payroll: 'Payroll',
    viewPayroll: 'View payroll',
    pendingComplaints: 'Pending complaints',
    pendingComplaintsDetail: 'All reasons · not closed',
    viewComplaints: 'View complaints',
  },
  headcountChart: {
    title: 'Headcount by class',
    subtitle: 'Non-cancelled enrollments · first 24 classes',
    emptyTitle: 'No enrollments for this year',
    emptyDescription:
      'Headcount is based on non-cancelled enrollments. Change the year, or open enrollments to record some.',
    openEnrollments: 'Open enrollments',
    ariaSummary: 'Headcount by class: {details}.',
  },
  payrollChart: {
    title: 'Monthly payroll',
    subtitle: 'Last 12 months — validated or paid payslips',
    payroll: 'Payroll',
    datasetLabel: 'Payroll (GNF)',
    emptyTitle: 'No validated payslip',
    emptyDescription:
      'The curve aggregates monthly payslips once validated by management. Until at least one is, payroll stays at zero.',
    openPayroll: 'Open payroll',
    ariaSummary: 'Payroll for the last 12 months, in Guinean francs: {details}.',
  },
  staffIncidents: {
    title: 'Staff & incidents',
    teachers: '{count} teachers',
    teachersDetail: '{vacataires} part-time · {permanents} permanent',
    helpdeskIncidents: '{count} helpdesk incident(s)',
    helpdeskIncidentsDetail: 'over the last 24h — all statuses combined',
  },
  assets: {
    title: 'Assets — obsolescence',
    subtitle: 'Equipment whose age exceeds the expected obsolescence period',
    link: 'Assets & equipment',
    obsoleteEquipment: 'obsolete equipment',
    detail: '{total} active equipment · {enReparation} under repair',
  },
  loading: 'Loading dashboard…',
  messages: {
    reportGenerated: 'MESRS report {annee} generated and archived.',
    viewSnapshots: "View archived reports",
  },
};
