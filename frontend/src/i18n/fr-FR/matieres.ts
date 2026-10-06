/** Namespace `matieres`. */
export default {
  title: 'Matières',
  subtitle: 'Programme d’enseignement et volumes horaires de référence',
  actions: {
    new: 'Nouvelle matière',
  },
  filters: {
    searchPlaceholder: 'Rechercher (code, intitulé)…',
    department: 'Département',
    departmentChip: 'Département : {value}',
  },
  table: {
    columns: {
      code: 'Code',
      intitule: 'Intitulé',
      department: 'Département',
      volume: 'Volume horaire',
      credits: 'Crédits',
      actions: 'Actions',
    },
  },
  actionsColumn: {
    whoTeachesAria: 'Voir les charges d’enseignement de la matière',
    whoTeachesTooltip: 'Qui l’enseigne',
    editAria: 'Modifier la matière',
    editTooltip: 'Modifier',
    deleteAria: 'Supprimer la matière',
    deleteTooltip: 'Supprimer',
  },
  card: {
    credits: '{count} crédits',
    noDepartment: 'Sans département',
    volume: 'Volume horaire {value} h',
  },
  emptyState: {
    filtered: 'Aucune matière pour ces critères.',
    empty: 'Aucune matière enregistrée.',
    create: 'Créer la première matière',
    reset: 'Réinitialiser les filtres',
  },
  dialog: {
    editTitle: 'Modifier la matière',
    newTitle: 'Nouvelle matière',
    sectionTitle: 'Programme',
    codeLabel: 'Code *',
    codeHint: 'ex. INF-201',
    codeError: 'Le code est obligatoire',
    departmentLabel: 'Département',
    intituleLabel: 'Intitulé *',
    intituleError: 'L’intitulé est obligatoire',
    volumeLabel: 'Volume horaire (h)',
    volumeHint: 'Pré-remplit les charges d’enseignement',
    creditsLabel: 'Crédits',
    cancel: 'Annuler',
    save: 'Enregistrer',
  },
  deleteDialog: {
    title: 'Supprimer la matière',
    message:
      'Supprimer « {intitule} » ? Les charges d’enseignement qui la portent seront également supprimées.',
    cancel: 'Annuler',
    confirm: 'Supprimer',
  },
  messages: {
    requiredFields: 'Complétez les champs obligatoires',
    saved: 'Matière enregistrée',
    saveError: 'Enregistrement impossible',
    deleted: 'Matière supprimée',
    deleteError: 'Suppression impossible',
    loadError: 'Chargement des matières impossible',
  },
};
