/** Namespace `mesReclamations` — page Mes réclamations (vue étudiante). */
export default {
  title: 'Mes réclamations',
  subtitle:
    'Le guichet unique pour vos doléances : note manquante, erreur de saisie, scolarité, enseignement. Chaque réclamation suit un cycle tracé et peut être anonyme si vous préférez.',
  actions: {
    new: 'Nouvelle réclamation',
  },
  banner: {
    wrongRole:
      'Cette page est réservée aux comptes étudiants. Vous êtes connecté en {role} — le registre complet se trouve sur « {registry} ».',
    goToRegistry: 'Réclamations & requêtes',
  },
  stats: {
    caption: 'Compteurs calculés sur les réclamations affichées ci-dessous.',
    labels: {
      open: 'Ouvertes',
      inProgress: 'En cours',
      awaitingReply: 'Attente réponse',
      resolved: 'Résolues',
    },
  },
  filters: {
    searchPlaceholder: 'Rechercher (N°, sujet…)',
    status: 'Statut',
    type: 'Type',
    priority: 'Priorité',
  },
  table: {
    columns: {
      number: 'N°',
      subject: 'Sujet',
      type: 'Type',
      priority: 'Priorité',
      status: 'Statut',
      createdAt: 'Créée le',
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
    detail: 'Détail',
  },
};
