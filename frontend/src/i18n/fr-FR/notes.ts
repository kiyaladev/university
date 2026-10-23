/** Namespace `notes`. */
export default {
  title: 'Saisie des notes',
  subtitle:
    'Saisie en lot, type tableur : Tab pour naviguer, Enter pour valider. Une ligne jamais saisie rend la matière défaillante à la délibération.',
  form: {
    evaluationLabel: 'Évaluation à noter',
    evaluationPlaceholder: 'Tapez l’intitulé de l’épreuve…',
  },
  actions: {
    allEvaluations: 'Toutes les évaluations',
    closeEvaluation: 'Clôturer l’évaluation',
    browseEvaluations: 'Parcourir les évaluations',
  },
  loading: 'Chargement…',
  semester: 'semestre',
  studentsCount: '{count} étudiants',
  emptyState: {
    title: 'Sélectionnez une évaluation ci-dessus pour ouvrir la feuille de notes.',
    hint: 'La feuille reprend les étudiants dont le dossier d’inscription est validé.',
  },
  readOnly: {
    closed: 'L’évaluation est clôturée : les notes sont définitives.',
    forbidden: 'La saisie est réservée à la scolarité et à la direction.',
  },
  dialogs: {
    close: {
      title: 'Clôturer l’évaluation',
      message:
        'Clôturer « {name} » ? Les notes deviennent définitives et un recalage de délibération les prendra en compte.',
    },
  },
  messages: {
    evaluationNotFound: 'Évaluation introuvable : elle a pu être supprimée.',
    saved: '{count} note(s) enregistrée(s)',
    savedWithIgnored: '{count} note(s) enregistrée(s) · {ignored} ignorée(s)',
    closed: 'Évaluation clôturée',
  },
  bulk: {
    studentOne: '{count} étudiant',
    students: '{count} étudiants',
    gradedOne: '{count} noté',
    graded: '{count} notés',
    presentOne: '{count} présent',
    present: '{count} présents',
    absentOne: '{count} absent',
    absentCount: '{count} absents',
    modifiedOne: '{count} modification',
    modifiedCount: '{count} modifications',
    progress: '{filled} / {total} notes saisies',
    registrationNumber: 'N° inscription',
    grade: 'Note /20',
    attendanceFor: 'Présence de {name}',
    gradeFor: 'Note sur 20 de {name}',
    absent: 'absent',
    missing: 'manquante',
    modified: 'modifié',
    saved: 'enregistré',
    empty:
      'Aucun étudiant à noter : la feuille ne reprend que les dossiers d’inscription validés de cette promotion pour l’année de l’évaluation.',
    markAllPresent: 'Tous présents',
    markAllAbsent: 'Tous absents',
    saveAll: 'Enregistrer tout',
    noChanges: 'Aucune note modifiée depuis le dernier enregistrement',
    readOnly: 'Saisie désactivée pour cette évaluation.',
  },
};
