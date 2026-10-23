/** Namespace `cites`. */
export default {
  title: 'University halls',
  subtitle:
    'Transparent room allocation — social and merit criteria, run with the rectorate (Centre for Student Affairs)',
  tabs: {
    residences: 'Halls',
    chambres: 'Rooms',
    attributions: 'Allocations',
  },
  actions: {
    newResidence: 'New hall',
    newChambre: 'New room',
    newAttribution: 'New allocation',
  },
  chips: {
    recherche: '"{q}"',
  },
  common: {
    status: {
      active: 'Active',
      inactive: 'Inactive',
    },
  },
  residences: {
    filters: {
      placeholder: 'Search (code, name, city, manager…)',
      capaciteMin: 'Min. capacity',
      etat: 'Status',
      etatToutes: 'All',
      etatActives: 'Active',
      etatInactives: 'Inactive',
      ville: 'City',
    },
    table: {
      columns: {
        ville: 'City',
        responsable: 'Manager',
        statut: 'Status',
      },
      aria: {
        voirChambres: "View this hall's rooms",
        modifier: 'Edit hall',
        supprimer: 'Delete hall',
      },
      tooltip: {
        voirChambres: 'View rooms',
      },
    },
    emptyState: {
      title: 'No halls match these criteria.',
      hint: 'A hall contains rooms; rooms carry allocations.',
    },
    card: {
      capacite: 'Capacity: {n} beds',
      libres: '{n} free',
      reservees: '{n} reserved',
      occupees: '{n} occupied',
      noResponsable: 'No manager listed',
    },
    dialogs: {
      form: {
        titleEdit: 'Edit hall',
        titleNew: 'New hall',
        capacity: 'Capacity (beds)',
        responsibilitySection: 'Location and management',
        managerHint: 'Hall manager responsible for handing over the keys',
        active: 'Hall active',
        saved: 'Hall saved',
      },
      delete: {
        title: 'Delete hall',
        message: 'Permanently delete {nom} ({code})?',
      },
      deleted: 'Hall deleted',
    },
    chips: {
      capaciteMin: '≥ {n} beds',
      ville: 'City: {ville}',
    },
  },
  chambres: {
    filters: {
      placeholder: 'Search (room code…)',
      residence: 'Hall',
    },
    table: {
      columns: {
        residence: 'Hall',
        lits: 'Beds',
        loyer: 'Rent',
      },
      aria: {
        voirAttributions: "View this room's allocations",
        modifier: 'Edit room',
        supprimer: 'Delete room',
      },
      tooltip: {
        voirAttributions: 'Who lives here? (allocations)',
      },
    },
    emptyState: {
      title: 'No rooms match these criteria.',
      hint: 'Every room belongs to a hall and carries its rent.',
    },
    card: {
      litSingular: 'bed',
      litPlural: 'beds',
    },
    dialogs: {
      form: {
        titleEdit: 'Room {code}',
        titleNew: 'New room',
        residenceLabel: 'Hall *',
        categoryLabel: 'Category *',
        statusLabel: 'Status *',
        monthlyRent: 'Monthly rent',
        currencyHint: 'Billing through Mobile Money is planned for the payment module',
        saved: 'Room saved',
      },
      delete: {
        title: 'Delete room',
        message: 'Permanently delete room {code}?',
      },
      deleted: 'Room deleted',
    },
    chips: {
      residence: 'Hall: {code}',
    },
  },
  attributions: {
    dialog: {
      note: 'The request is reviewed against supporting documents (social need and merit); only the rectorate makes the decision.',
      roomLabel: 'Room *',
      studentSearch: 'Search for a student (ID, last name, first name)',
      studentsUnavailable: 'The student register is temporarily unavailable.',
      criteriaTitle: 'Social and merit criteria',
      scoreLabel: 'Score (0 to 100)',
      proofHint: 'Social or merit supporting document (scholarship, orphan status, ranking…)',
      rentNotice: 'Monthly rent: {loyer} {devise}',
      saved: 'Request recorded — room reserved',
    },
    filters: {
      residence: 'Hall',
      etudiant: 'Search student (ID, name)',
    },
    table: {
      columns: {
        demandeLe: 'Requested on',
        chambre: 'Room',
      },
      aria: {
        decider: 'Decide on the allocation',
        retirer: 'Withdraw the allocation',
        voirEtudiant: 'View the allocated student',
      },
      tooltip: {
        decider: 'Decide',
        voirEtudiant: 'View student',
      },
    },
    emptyState: {
      title: 'No allocations match these criteria.',
      hint: 'A request starts "pending", then the panel grants or denies it.',
    },
    card: {
      chambreLabel: 'Room {code} — {residence}',
      demandeLe: 'Requested on {date}',
      score: 'Score:',
      decider: 'Decide',
      deciderTooltip: 'Grant or deny',
      retirerTooltip: 'Withdraw allocation',
      etudiantTooltip: 'View student record',
    },
    chips: {
      residence: 'Hall: {code}',
      etudiant: 'Student: {etudiant}',
    },
    dialogs: {
      decision: {
        title: 'Panel decision',
        chambreLabel: 'Room {code} ({residence})',
        scoreLabel: '· score {score}',
        optionAccorder: 'Grant the room',
        optionRefuser: 'Deny the request',
        infoAccorder: 'The room will become {statut} and the student will be notified.',
        infoRefuser: 'The room will become {statut} again and the request will be closed.',
        statutOccupee: 'OCCUPIED',
        statutLibre: 'FREE',
        motifLabel: 'Reason (optional)',
        accorder: 'Grant',
        refuser: 'Deny',
      },
      retirer: {
        title: 'Withdraw allocation',
        message: 'Withdraw the allocation for {etudiant} for room {code} ({residence})?',
        motifLabel: 'Reason for withdrawal (optional)',
      },
      etudiantDetail: {
        chambreLine: '\nRoom: {code} ({residence})',
        message: 'Student ID: {matricule}\nPhone: {telephone}\nEmail: {email}{chambre}',
      },
      accorded: 'Allocation granted — room occupied',
      refused: 'Request denied',
      withdrawn: 'Allocation withdrawn',
    },
    notify: {
      attributionsOfResidence: 'Allocations for this hall — look for room {code}',
    },
  },
};
