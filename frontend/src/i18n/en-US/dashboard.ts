/** Namespace `dashboard` — Dashboard page (teacher attendance). */
export default {
  title: 'Dashboard',
  subtitle: 'Teacher attendance — period from {debut} to {fin}',
  actions: {
    refreshAria: 'Recompute the dashboard',
    refreshTooltip: 'Recompute',
    goToRounds: 'Go to the round',
    prepareRound: 'Prepare offline',
    preparedAt: 'Ready at {time}',
    roundPrepared: "Today's round is ready for offline use.",
    prepareRequiresNetwork: 'Connect to the network and open the installed app to prepare the round.',
    prepareFailed: 'Could not prepare the round data.',
    viewSessionsRegistry: 'View the sessions register',
    teacherStats: 'Statistics by teacher',
  },
  today: {
    mention: 'Day of {date}',
    legend: 'sessions checked',
  },
  gauge: {
    coverageAria: 'Control coverage: {percent}',
    coverageLabel: '{percent} coverage',
  },
  charts: {
    evolutionTitle: '14-day trend',
    evolutionSubtitle: 'Sessions held, absences and delays',
    distributionTitle: 'Breakdown of findings',
    distributionSubtitle: 'Over the selected period',
    noData: 'No data for this period.',
    datasets: {
      sessionsHeld: 'Sessions held',
      delays: 'Delays',
    },
  },
  departments: {
    title: 'Attendance by department',
    subtitle: 'Click to filter the table',
    itemDetail: '{controlees} checks · {absent} absence(s) · {heures} completed',
    empty: 'No session linked to a department for this period.',
  },
  teachers: {
    title: 'Most absent teachers',
    pendingJustifications: '{count} supporting document(s) to review',
    itemDetail: '{count} scheduled session(s) · attendance {percent}',
    viewSessionsAria: "View this teacher's sessions",
    viewSessionsTooltip: 'View their sessions for the period',
    empty: 'No absence recorded for this period.',
  },
  kpis: {
    plannedSessions: 'Scheduled sessions',
    plannedSessionsDetail: '{count} checked ({percent})',
    presenceRate: 'Attendance rate',
    presenceRateDetail: '{count} session(s) held',
    absencesDetail: '{excused} excused · {late} delay(s)',
    hoursWorked: 'Hours completed',
    hoursWorkedDetail: 'out of {planned} scheduled',
  },
};
