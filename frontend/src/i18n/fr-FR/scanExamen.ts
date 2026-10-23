/** Namespace `scanExamen` — page Scan examens. */
export default {
  title: 'Scan examens',
  subtitle:
    "Scannez le QR de la carte étudiante — ou saisissez le matricule — pour valider la présence à l'épreuve en cours.",
  actions: {
    backToExamens: 'Retour aux examens',
    seePlannedExams: 'Voir les examens planifiés',
    seeDraw: 'Tirage de cet examen',
    seeDrawTooltip: 'Voir le tirage de cet examen',
    confirmPresence: 'Confirmer la présence',
  },
  emptyState: {
    title: 'Aucun examen en cours',
    description:
      "Le scan des cartes n'est possible qu'une fois l'épreuve démarrée depuis la page Examens.",
  },
  stats: {
    presentsOverEnrolled: 'Présents / inscrits',
    rate: 'Taux {rate}',
    remaining: '{count} restant(s)',
    noEnrolled: 'aucun inscrit',
  },
  form: {
    currentExam: 'Examen en cours *',
    cardLabel: 'Carte étudiante (QR ou matricule)',
    cardHint: 'Scannez la carte du candidat ou saisissez son matricule',
  },
  summary: {
    slots: '{code} · {subject} · {promotion} · salle {room} · {start}–{end}',
  },
  result: {
    validated: 'Présence validée',
    alreadyRecorded: 'Présence déjà enregistrée',
    rejected: 'Scan rejeté',
    reason: 'Motif : {reason}',
    unknownCard: 'carte inconnue',
  },
  messages: {
    examNotStarted:
      "Cet examen n'est pas démarré : les scans seront refusés tant qu'il n'est pas lancé.",
  },
};
