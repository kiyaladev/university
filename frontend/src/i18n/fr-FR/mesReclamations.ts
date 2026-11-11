/** Namespace `mesReclamations` — page Mes réclamations (vue étudiante). */
export default {
  title: 'Mes réclamations',
  subtitle: 'Déposez une réclamation (note manquante, erreur de saisie…), anonyme si vous le souhaitez, et suivez son traitement.',
  actions: {
    new: 'Nouvelle réclamation',
  },
  banner: {
    wrongRole:
      'Cette page est réservée aux comptes étudiants. Vous êtes connecté en {role} — le registre complet se trouve sur « {registry} ».',
    goToRegistry: 'Réclamations & requêtes',
  },
  stats: {
    labels: {
      open: 'Ouvertes',
      inProgress: 'En cours',
      awaitingReply: 'Attente réponse',
      resolved: 'Résolues',
    },
  },
  filters: {
    searchPlaceholder: 'Rechercher (N°, sujet…)',
  },
  table: {
    columns: {
      subject: 'Sujet',
    },
    openTracking: 'Ouvrir le suivi de la réclamation',
    trackingTooltip: 'Suivi et fil de discussion',
  },
  emptyState: {
    description:
      'Aucune réclamation pour ces critères. Ouvrez-en une si une note, une inscription ou un document pose problème : la scolarité vous répond dans le fil de discussion.',
  },
  cards: {
    messagesCount: '{count} message(s)',
    escalatedOn: 'Escaladée le {date}',
  },
};
