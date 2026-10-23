/** Namespace `matieres`. */
export default {
  title: 'Matières',
  subtitle: 'Programme d’enseignement et volumes horaires de référence',
  actions: {
    new: 'Nouvelle matière',
  },
  filters: {
    searchPlaceholder: 'Rechercher (code, intitulé)…',
    departmentChip: 'Département : {value}',
  },
  table: {
    columns: {
      volume: 'Volume horaire',
    },
  },
  actionsColumn: {
    whoTeachesAria: 'Voir les charges d’enseignement de la matière',
    whoTeachesTooltip: 'Qui l’enseigne',
    editAria: 'Modifier la matière',
    deleteAria: 'Supprimer la matière',
  },
  card: {
    credits: '{count} crédits',
    noDepartment: 'Sans département',
  },
  emptyState: {
    filtered: 'Aucune matière pour ces critères.',
    empty: 'Aucune matière enregistrée.',
    create: 'Créer la première matière',
  },
  dialog: {
    editTitle: 'Modifier la matière',
    newTitle: 'Nouvelle matière',
    sectionTitle: 'Programme',
    codeHint: 'ex. INF-201',
    codeError: 'Le code est obligatoire',
    intituleLabel: 'Intitulé *',
    intituleError: 'L’intitulé est obligatoire',
    volumeLabel: 'Volume horaire (h)',
    volumeHint: 'Pré-remplit les charges d’enseignement',
  },
  deleteDialog: {
    title: 'Supprimer la matière',
    message: 'Supprimer « {intitule} » ? Les charges d’enseignement qui la portent seront également supprimées.',
  },
  messages: {
    saved: 'Matière enregistrée',
    deleted: 'Matière supprimée',
  },
};
