/** Namespace `rapports` — page RapportsPage.vue (line-by-line reports from the attendance register). */
export default {
  title: 'Attendance reports',
  subtitle:
    "Line-by-line statements from the attendance register, over a chosen period: who taught what, how many hours, how much to pay. This is the supporting document — printable and exportable. Day-to-day tracking indicators are in Statistics, the annual summary in the Rectorat dashboard.",
  crossLinks: {
    statistiques: { label: 'Statistics', help: 'Day-to-day attendance indicators' },
    rectorat: { label: 'Rectorat dashboard', help: 'Annual summary: headcount, success rate, payroll' },
    paie: { label: 'Adjunct payroll', help: 'Monthly sheets generated from these checked hours' },
  },
  filters: {
    promotion: 'Class',
  },
  actions: {
    reloadAria: 'Reload the statements for the period',
    reloadTooltip: 'Reload statements',
    export: 'Export {onglet} to CSV',
    exportTooltip: 'Spreadsheet (Excel / LibreOffice) — {onglet}, {periode}',
    printPaiement: 'Print the payment statement (A4)',
    printRegistre: 'Print the register (A4)',
    printFicheAria: 'Print the individual record for {nom}',
    printFicheTooltip: 'Individual record (A4)',
  },
  releveSigne: {
    title: 'Signed weekly report',
    description: 'Generate and sign the PDF of sessions in your department.',
    action: 'Prepare report',
    dialogTitle: 'Sign the weekly report',
    dialogHelp: 'The report covers a full week, Monday through Sunday.',
    weekStart: 'Monday of the week',
    weekRange: 'Period ends on {end}',
    signatureLabel: 'Handwritten signature of the department head',
    generate: 'Sign and download PDF',
    signatureRequired: 'Add your signature before generating the report.',
    mondayRequired: 'Choose a Monday as the first day of the week.',
    success: 'The signed report was downloaded.',
    error: 'The report could not be generated. Check the week and try again.',
  },
  period: {
    analyzed: 'Period analyzed: {periode} — last 30 days by default.',
    range: 'from {debut} to {fin}',
  },
  tabs: {
    assiduite: 'Teacher attendance',
    volume: 'Teaching hours',
    controleurs: 'Round coverage',
    paiement: 'Payment statement',
    registre: 'Register',
  },
  controleurs: {
    title: 'Controller round tracking',
    help: 'A session counts as visited when a check is recorded. The own rate measures sessions completed by the assigned controller.',
    unassigned: '{count} past session(s) without an assigned controller',
    emptyTitle: 'No rounds assigned for this period',
    emptyHelp: 'Assign sessions to controllers from their details in the session register.',
    emptyAction: 'Open sessions',
    columns: {
      controller: 'Controller',
      assigned: 'Past assigned sessions',
      visited: 'Visited',
      missed: 'Not visited',
      byAssigned: 'By assigned controller',
      coveredByPeer: 'By another controller',
      coverage: 'Coverage',
      ownRate: 'Own rate',
    },
  },
  onglets: {
    assiduite: 'teacher attendance',
    volume: 'teaching hours',
    paiement: 'the payment statement',
    registre: 'the register',
    defaut: 'the displayed tab',
  },
  assiduite: {
    total: 'Total: {planifiees} sessions · attendance {presence} · {heures} completed',
    table: {
      columns: {
        matricule: 'ID',
        departement: 'Dept.',
        planifiees: 'Sched.',
        controlees: 'Checked',
        assurees: 'Held',
        retard: 'Late',
      },
    },
    emptyState: {
      title: 'No session scheduled for the period',
      message:
        'Attendance is calculated from the timetable sessions. Widen the period or clear the department / class filters.',
      action: 'Open the timetable',
    },
  },
  volume: {
    table: {
      columns: {
        promotion: 'Class',
        prevu: 'Contract (h)',
        realise: 'Completed (h)',
        reste: 'Remaining (h)',
        avancement: 'Progress',
      },
    },
    emptyState: {
      title: 'No teaching load for the period',
      message:
        'Teaching hours compare completed hours against each assignment contract. With no assignment, there is nothing to compare.',
      action: 'Open teaching loads',
    },
  },
  paiement: {
    heuresPayables: 'Payable hours for the period',
    montantTotal: 'Total amount',
    detailLine: '{libelle}: {heures} ({seances} sessions)',
    table: {
      columns: {
        matricule: 'ID',
        departement: 'Dept.',
        taux: 'Hourly rate',
        montant: 'Amount (GNF)',
      },
    },
    emptyState: {
      title: 'No payable hours for the period',
      message: 'Only hours recorded during an inspection are payable. Check the period, or the status filter above.',
      action: 'Open session checks',
    },
  },
  registre: {
    subtitle: 'Transcript of the attendance register for the selected period',
    summary: '{total} session(s) · {controlees} checked · {absences} absence(s)',
    table: {
      columns: {
        promotion: 'Class',
        statut: 'Record',
        arrivee: 'Arrival',
        effectif: 'Students',
        theme: 'Topic covered',
      },
    },
    emptyState: {
      title: 'Register empty for the period',
      message: 'The register transcribes scheduled sessions, checked or not. Widen the period to find entries.',
      action: 'Open sessions',
    },
  },
  messages: {
    loadError: 'Unable to load the statements.',
    referenceDataError: 'Departments and classes unavailable: the filters will remain empty.',
  },
};
