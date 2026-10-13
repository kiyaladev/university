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
    resume: 'Reprendre',
    player: 'Lecteur',
    publish: 'Mettre en ligne',
    edit: 'Modifier',
    archive: 'Archiver',
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
    privateEnrollmentHint: 'Une inscription donne accès à cet étudiant uniquement. Sans inscription, la ressource privée reste réservée à son auteur, à l’enseignant lié et à la gestion.',
    privateEnrollmentManaged: 'L’administration peut affecter cette ressource privée à une inscription. Sans affectation, elle reste réservée à son auteur, à l’enseignant lié et à la gestion.',
    required: 'Le titre et l’URL sont obligatoires.',
    updated: 'Ressource mise à jour.',
    created: 'Ressource créée.',
    saveFailed: 'Enregistrement impossible.',
    types: { audio: 'Audio', video: 'Vidéo', notes: 'Notes', transcription: 'Transcription' },
  },
  filters: {
    searchPlaceholder: 'Titre, description…',
    resourceType: 'Type de ressource',
    status: 'Statut',
  },
  table: {
    columns: {
      title: 'Titre',
      type: 'Type',
      subject: 'Matière',
      teacher: 'Enseignant',
      duration: 'Durée',
      progress: 'Où j’en suis',
      views: 'Vues',
      status: 'Statut',
    },
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
    edit: 'Modifier',
    archive: 'Archiver',
  },
  aria: {
    play: 'Lire « {title} »',
    publish: 'Mettre la ressource en ligne',
    edit: 'Modifier la ressource',
    archive: 'Archiver la ressource',
  },
  emptyState: {
    filtered: 'Aucune ressource ne correspond à ces critères.',
    student:
      'Aucun cours en ligne pour vos inscriptions : vos enseignants n’ont pas encore publié de replay.',
    staff: 'Aucune ressource au catalogue : déposez un replay, un podcast ou une transcription.',
  },
  dialogs: {
    archive: {
      title: 'Archiver cette ressource ?',
      message: '« {title} » sortira du catalogue : plus personne ne pourra la lire.',
      confirm: 'Archiver',
    },
  },
  messages: {
    published: 'Ressource mise en ligne.',
    publishFailed: 'Publication impossible.',
    archived: 'Ressource archivée.',
    archiveFailed: 'Archivage impossible.',
  },
};
