/** Namespace `vodPage`. */
export default {
  title: 'Video courses',
  subtitle: {
    student:
      'Replays, podcasts, notes and transcripts for your courses: what your enrollments give you access to, plus the public collection.',
    staff:
      'Replays, podcasts, notes, transcripts — access to courses on demand. You see the full catalog here, including drafts.',
  },
  actions: {
    newResource: 'New resource',
    player: 'Player',
  },
  formDialog: {
    editTitle: 'Edit video course',
    newTitle: 'New video course',
    mediaUrl: 'Media URL (Mux / S3 / CDN / local path)',
    mediaUrlPlaceholder: 'https://… or /vod/file.mp4',
    thumbnailUrl: 'Thumbnail URL (optional)',
    thumbnailUrlPlaceholder: 'https://…/preview.jpg',
    duration: 'Duration (seconds)',
    publicResource: 'Public resource',
    privateEnrollment: 'Beneficiary enrollment (optional)',
    privateEnrollmentHint:
      'An enrollment grants access to that student only. Without an enrollment, the private resource is restricted to its author, linked teacher and management.',
    privateEnrollmentManaged:
      'Administration can assign this private resource to an enrollment. Without an assignment, it is restricted to its author, linked teacher and management.',
    required: 'Title and URL are required.',
    updated: 'Resource updated.',
    created: 'Resource created.',
    types: { audio: 'Audio', video: 'Video', transcription: 'Transcript' },
  },
  filters: {
    searchPlaceholder: 'Title, description…',
    resourceType: 'Resource type',
  },
  table: {
    columns: {
      progress: 'Progress',
      views: 'Views',
    },
    noSubject: '—',
  },
  card: {
    noTeacher: 'No teacher',
    views: '{count} view(s)',
    done: 'Done',
    neverOpened: 'Never opened',
    previewAlt: 'Preview of {title}',
  },
  tooltips: {
    openPlayer: 'Open the player',
    publish: 'Publish',
  },
  aria: {
    play: 'Play "{title}"',
    publish: 'Publish the resource',
    edit: 'Edit the resource',
    archive: 'Archive the resource',
    stats: 'View viewing statistics',
  },
  emptyState: {
    filtered: 'No resource matches these criteria.',
    student: 'No online courses for your enrollments: your teachers have not published a replay yet.',
    staff: 'No resources in the catalog: upload a replay, a podcast or a transcript.',
  },
  dialogs: {
    archive: {
      title: 'Archive this resource?',
      message: '"{title}" will be removed from the catalog: no one will be able to watch it anymore.',
    },
  },
  stats: {
    title: 'Viewing statistics',
    loading: 'Loading statistics…',
    unavailable: 'Statistics are unavailable.',
    views: 'Views',
    completions: 'Completed views',
    completionRate: 'Completion rate',
    averageDuration: 'Average viewing time',
    recentViews: 'Recent views',
    noViews: 'This resource has not been opened yet.',
    anonymous: 'Unidentified viewer',
    completed: 'Finished',
    inProgress: 'In progress',
  },
  messages: {
    published: 'Resource published.',
    archived: 'Resource archived.',
  },
};
