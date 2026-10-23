/** Namespace `affectations` — page Charges d'enseignement. */
export default {
  title: 'Charges d’enseignement',
  subtitle: 'Qui enseigne quoi, à quelle promotion, pour quel volume horaire contractuel',
  actions: {
    new: 'Nouvelle affectation',
    createFirst: 'Créer la première affectation',
    editAria: 'Modifier l’affectation',
    deleteAria: 'Supprimer l’affectation',
  },
  filters: {
    searchPlaceholder: 'Rechercher (enseignant, matière, promotion)…',
  },
  table: {
    columns: {
      promotion: 'Promotion',
      volume: 'Volume prévu',
    },
  },
  cardView: {
    contractualVolume: 'volume contractuel',
  },
  emptyState: {
    filtered: 'Aucune charge d’enseignement pour ces critères.',
    none: 'Aucune charge d’enseignement enregistrée.',
  },
  chips: {
    search: '« {query} »',
    teacher: 'Enseignant : {name}',
    subject: 'Matière : {name}',
    promotion: 'Promotion : {name}',
    year: 'Année : {name}',
  },
  dialog: {
    editTitle: 'Modifier l’affectation',
    newTitle: 'Nouvelle affectation',
    sections: {
      who: 'Qui enseigne quoi',
      when: 'Pour qui, et quand',
    },
    fields: {
      teacherError: 'Choisissez l’enseignant',
      subjectError: 'Choisissez la matière',
      promotionError: 'Choisissez la promotion',
      yearError: 'Choisissez l’année académique',
      volume: 'Volume horaire contractuel (h)',
      volumeHint: 'Sert au suivi « heures réalisées / heures dues »',
    },
  },
  deleteDialog: {
    title: 'Supprimer l’affectation',
    message:
      '« {subject} » confiée à {teacher} : les séances liées seront également supprimées. Continuer ?',
  },
  messages: {
    saved: 'Affectation enregistrée',
    deleted: 'Affectation supprimée',
  },
};
