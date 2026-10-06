/** Namespace `statistiques`. */
export default {
  title: 'Statistics',
  subtitle: 'What the rounds produced — room by room, teacher by teacher',
  filters: {
    from: 'From',
    to: 'To',
    recalculateAria: 'Recalculate the reports',
    recalculateTooltip: 'Recalculate',
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
      sessions: 'Sessions',
      controlled: 'Checked',
      absences: 'Absences',
      students: 'Students',
      occupation: 'Occupancy',
      presence: 'Attendance',
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
        salle: 'Room',
        planifiees: 'Sessions',
        controlees: 'Checked',
        absent: 'Absences',
        effectif: 'Stud.',
        occupation: 'Occupancy',
        presence: 'Attendance',
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
      sessions: 'Sessions',
      presence: 'Attendance',
      absences: 'Absences',
      hours: 'Hours delivered',
    },
    card: {
      sessions: 'Sessions',
      done: 'Delivered',
      late: 'Late',
      absences: 'Absences',
      presence: 'Attendance',
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
        nom: 'Teacher',
        departement: 'Department',
        planifiees: 'Sessions',
        assurees: 'Delivered',
        retard: 'Late',
        absent: 'Absences',
        heures: 'Hours',
        presence: 'Attendance',
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
