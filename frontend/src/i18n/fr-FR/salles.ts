/** Namespace `salles` — page SallesPage.vue (salles & QR de contrôle). */
export default {
  title: 'Salles',
  subtitle:
    'Chaque salle porte un QR affiché à l’entrée : le contrôleur le scanne pour attester sa présence sur place',
  actions: {
    printPosters: 'Imprimer les affiches',
    printPostersTooltip: 'Une affiche par salle, à coller à l’entrée',
    newRoom: 'Nouvelle salle',
  },
  filters: {
    searchPlaceholder: 'Rechercher (code, nom, bâtiment)…',
    gpsMark: 'Repère GPS',
  },
  options: {
    stateUsable: 'Salles utilisables',
    stateOutOfService: 'Salles hors service',
    withGps: 'Avec repère GPS',
    withoutGps: 'Sans repère GPS',
  },
  card: {
    active: 'active',
    inactive: 'inactive',
    capacitySuffix: 'places',
    noGpsMark: 'Sans repère GPS',
    qrAria: 'QR de la salle {code}',
  },
  roomActions: {
    viewSessionsAria: 'Voir les séances de la salle',
    viewSessionsTooltip: 'Ses séances',
    printPosterAria: 'Imprimer l’affiche de la salle',
    printPosterTooltip: 'Affiche de cette salle',
    regenerateAria: 'Régénérer le QR de la salle',
    regenerateTooltip: 'Régénérer le QR',
    editAria: 'Modifier la salle',
    deleteAria: 'Supprimer la salle',
  },
  emptyState: {
    createFirst: 'Créer la première salle',
    noneForCriteria: 'Aucune salle pour ces critères.',
    noneRegistered: 'Aucune salle enregistrée.',
  },
  table: {
    columns: {
      gpsMark: 'Repère GPS',
      qrToken: 'Jeton QR',
    },
  },
  chips: {
    search: '« {value} »',
    building: 'Bâtiment : {value}',
    stateUsable: 'Utilisables',
    stateOutOfService: 'Hors service',
    withGps: 'Avec repère GPS',
    withoutGps: 'Sans repère GPS',
  },
  dialog: {
    editTitle: 'Modifier la salle',
    newTitle: 'Nouvelle salle',
    codeHint: 'ex. AMPHI-A',
    codeRequired: 'Le code est obligatoire',
    nameRequired: 'Le nom est obligatoire',
    gpsSection: 'Repère GPS (facultatif)',
    gpsHelp: 'Permet de vérifier que le contrôleur est bien sur place au moment du pointage.',
    latitudeLabel: 'Latitude',
    longitudeLabel: 'Longitude',
    radiusLabel: 'Rayon (m)',
    radiusError: 'Minimum 10 m',
    useCurrentPosition: 'Utiliser ma position actuelle',
    usableToggle: 'Salle utilisable',
  },
  confirmRegenerate: {
    title: 'Régénérer le QR',
    message: 'L’affiche actuelle de {code} deviendra invalide. Continuer ?',
    confirm: 'Régénérer',
  },
  confirmDelete: {
    title: 'Supprimer la salle',
    message: 'Supprimer « {code} — {name} » ? Son affiche QR ne vaudra plus rien.',
  },
  messages: {
    positionSet: 'Position renseignée',
    positionUnavailable: 'Position indisponible',
    saved: 'Salle enregistrée',
    regenerated: 'Nouveau QR généré — pensez à réimprimer l’affiche',
    deleted: 'Salle supprimée',
  },
};
