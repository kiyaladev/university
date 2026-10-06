/** Namespace `affectations` — page Charges d'enseignement. */
export default {
  title: 'Charges d’enseignement',
  subtitle: 'Qui enseigne quoi, à quelle promotion, pour quel volume horaire contractuel',
  actions: {
    new: 'Nouvelle affectation',
    createFirst: 'Créer la première affectation',
    resetFilters: 'Réinitialiser les filtres',
    edit: 'Modifier',
    editAria: 'Modifier l’affectation',
    delete: 'Supprimer',
    deleteAria: 'Supprimer l’affectation',
  },
  filters: {
    searchPlaceholder: 'Rechercher (enseignant, matière, promotion)…',
    teacher: 'Enseignant',
    subject: 'Matière',
    promotion: 'Promotion',
    year: 'Année académique',
  },
  table: {
    columns: {
      teacher: 'Enseignant',
      subject: 'Matière',
      promotion: 'Promotion',
      year: 'Année',
      volume: 'Volume prévu',
      actions: 'Actions',
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
      teacher: 'Enseignant *',
      teacherError: 'Choisissez l’enseignant',
      subject: 'Matière *',
      subjectError: 'Choisissez la matière',
      promotion: 'Promotion *',
      promotionError: 'Choisissez la promotion',
      year: 'Année académique *',
      yearError: 'Choisissez l’année académique',
      volume: 'Volume horaire contractuel (h)',
      volumeHint: 'Sert au suivi « heures réalisées / heures dues »',
    },
    cancel: 'Annuler',
    save: 'Enregistrer',
  },
  deleteDialog: {
    title: 'Supprimer l’affectation',
    message:
      '« {subject} » confiée à {teacher} : les séances liées seront également supprimées. Continuer ?',
    cancel: 'Annuler',
    confirm: 'Supprimer',
  },
  messages: {
    fillRequired: 'Complétez les champs obligatoires',
    saved: 'Affectation enregistrée',
    saveError: 'Enregistrement impossible',
    deleted: 'Affectation supprimée',
    deleteError: 'Suppression impossible',
    loadError: 'Chargement des charges impossible',
  },
};
