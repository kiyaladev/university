/** Namespace `vodPage`. */
export default {
  title: 'Cours en vidéo',
  subtitle: {
    student:
      'Replays, podcasts, notes et transcriptions de vos cours : ce que vos inscriptions vous ouvrent, plus le fonds public.',
    staff:
      "Replays, podcasts, notes, transcriptions — l'accès aux cours en différé. Vous voyez ici le catalogue complet, brouillons compris.",
  },
  actions: {
    newResource: 'Nouvelle ressource',
    player: 'Lecteur',
  },
  formDialog: {
    editTitle: 'Modifier la cours en vidéo',
    newTitle: 'Nouvelle cours en vidéo',
    mediaUrl: 'URL du média (Mux / S3 / CDN / chemin local)',
    mediaUrlPlaceholder: 'https://… ou /vod/fichier.mp4',
    thumbnailUrl: 'URL de la miniature (optionnel)',
    thumbnailUrlPlaceholder: 'https://…/apercu.jpg',
    duration: 'Durée (secondes)',
    publicResource: 'Ressource publique',
    privateEnrollment: 'Inscription bénéficiaire (facultatif)',
    privateEnrollmentHint:
      'Une inscription donne accès à cet étudiant uniquement. Sans inscription, la ressource privée reste réservée à son auteur, à l’enseignant lié et à la gestion.',
    privateEnrollmentManaged:
      'L’administration peut affecter cette ressource privée à une inscription. Sans affectation, elle reste réservée à son auteur, à l’enseignant lié et à la gestion.',
    required: 'Le titre et l’URL sont obligatoires.',
    updated: 'Ressource mise à jour.',
    created: 'Ressource créée.',
    types: { audio: 'Audio', video: 'Vidéo', transcription: 'Transcription' },
  },
  filters: {
    searchPlaceholder: 'Titre, description…',
    resourceType: 'Type de ressource',
  },
  table: {
    columns: {
      progress: 'Où j’en suis',
      views: 'Vues',
    },
    noSubject: '—',
  },
  card: {
    noTeacher: 'Sans enseignant',
    views: '{count} vue(s)',
    done: 'Terminé',
    neverOpened: 'Jamais ouvert',
    previewAlt: 'Aperçu de {title}',
  },
  tooltips: {
    openPlayer: 'Ouvrir le lecteur',
    publish: 'Mettre en ligne',
  },
  aria: {
    play: 'Lire « {title} »',
    publish: 'Mettre la ressource en ligne',
    edit: 'Modifier la ressource',
    archive: 'Archiver la ressource',
    stats: 'Voir les statistiques de consultation',
  },
  emptyState: {
    filtered: 'Aucune ressource ne correspond à ces critères.',
    student: 'Aucun cours en ligne pour vos inscriptions : vos enseignants n’ont pas encore publié de replay.',
    staff: 'Aucune ressource au catalogue : déposez un replay, un podcast ou une transcription.',
  },
  dialogs: {
    archive: {
      title: 'Archiver cette ressource ?',
      message: '« {title} » sortira du catalogue : plus personne ne pourra la lire.',
    },
  },
  stats: {
    title: 'Statistiques de consultation',
    loading: 'Chargement des statistiques…',
    unavailable: 'Statistiques indisponibles.',
    views: 'Vues',
    completions: 'Lectures complètes',
    completionRate: 'Taux de complétion',
    averageDuration: 'Durée moyenne de lecture',
    recentViews: 'Dernières vues',
    noViews: 'Cette ressource n’a encore été ouverte par personne.',
    anonymous: 'Lecteur non identifié',
    completed: 'Terminé',
    inProgress: 'En cours',
  },
  messages: {
    published: 'Ressource mise en ligne.',
    archived: 'Ressource archivée.',
  },
};
