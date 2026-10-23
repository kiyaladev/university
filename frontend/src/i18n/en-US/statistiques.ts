/** Namespace `statistiques`. */
export default {
  title: 'Statistics',
  subtitle: 'What the rounds produced — room by room, teacher by teacher',
  filters: {
    recalculateAria: 'Recalculate the reports',
  },
  shortcuts: {
    d7: '7 days',
    d30: '30 days',
    d90: '90 days',
  },
  tabs: {
    salles: 'By room',
    enseignants: 'By teacher',
  },
  salles: {
    summary: {
      visited: 'Rooms visited',
      controlled: 'Sessions checked',
      absences: 'Absences recorded',
      hours: 'Hours delivered',
    },
    card: {
      controlled: 'Checked',
      occupation: 'Occupancy',
      visitedOn: 'Seen on',
      neverVisited: 'never visited',
      sessionsLink: 'Its sessions',
    },
    empty: {
      cards: 'No session scheduled in a room over this period — widen the dates.',
      table: 'No session scheduled in a room over this period.',
    },
    table: {
      loading: 'Computing the report…',
      columns: {
        controlees: 'Checked',
        effectif: 'Stud.',
        occupation: 'Occupancy',
        visite: 'Seen on',
      },
    },
    actions: {
      sessionsAria: 'View this room’s sessions',
      sessionsTooltip: 'Its sessions over the period',
    },
  },
  enseignants: {
    summary: {
      hours: 'Hours delivered',
    },
    card: {
      done: 'Delivered',
      late: 'Late',
      hoursDone: '{hours} delivered',
    },
    empty: {
      cards: 'No teacher has a session scheduled over this period — widen the dates.',
      table: 'No teacher has a session scheduled over this period.',
    },
    table: {
      loading: 'Computing the report…',
      columns: {
        matricule: 'ID',
        assurees: 'Delivered',
        retard: 'Late',
      },
    },
    actions: {
      sessionsAria: 'View their sessions in the register',
      sessionsTooltip: 'Their sessions over the period',
      printAria: 'Print their attendance record',
      printTooltip: 'Attendance record',
    },
  },
};
