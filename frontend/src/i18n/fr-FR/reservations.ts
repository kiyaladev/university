/** Namespace `reservations` — page Salles & réservations. */
export default {
  title: 'Salles & réservations',
  subtitle:
    "Le calendrier des événements — soutenances, conférences, réunions — sur les amphis et salles de cours, superposé à l'emploi du temps.",
  actions: {
    reserve: 'Réserver une salle',
    reloadPeriod: 'Recharger la période',
    today: "Aujourd'hui",
    thisMonth: 'Ce mois-ci',
  },
  filters: {
    roomOption: '{code} — {name} ({capacity} places)',
  },
  legend: {
    timetable: 'Emploi du temps (lecture seule)',
    count: '{count} réservation(s) sur la période',
  },
  calendar: {
    reserved: 'Salle réservée',
    previousMonth: 'Afficher le mois précédent',
    nextMonth: 'Afficher le mois suivant',
  },
  table: {
    columns: {
      slot: 'Créneau',
      organization: 'Organisme',
      responsible: 'Responsable',
    },
    viewDetail: 'Voir le détail de la réservation',
    viewDetailTooltip: 'Voir le détail',
  },
  emptyState: {
    title: 'Aucune réservation sur cette période.',
    description:
      "Élargissez les dates, ou déposez une demande : elle part en « en attente » jusqu'à l'arbitrage de la scolarité.",
  },
  chips: {
    room: 'Salle : {code}',
    roomFallback: '…',
  },
  detailDialog: {
    requester: 'Demandeur',
    you: 'vous',
    refusal: 'Refus',
    requestedOn: 'Demande du',
    noAction: 'Aucune action possible sur cette réservation.',
    refusalReason: 'Motif (recommandé pour un refus)',
    editRequest: 'Modifier la demande',
    cancelReservation: 'Annuler la réservation',
    confirmed: 'Réservation confirmée',
    refused: 'Réservation refusée',
    decisionFailed: 'Décision impossible',
    updated: 'Réservation mise à jour',
    updateFailed: 'Modification impossible',
    cancelTitle: 'Annuler la réservation ?',
    cancelMessage: 'Le créneau redevient disponible immédiatement.',
    cancelled: 'Réservation annulée',
    cancelFailed: 'Annulation impossible',
  },
  createDialog: {
    roomLabel: 'Salle *',
    startLabel: 'Début *',
    endLabel: 'Fin *',
    reasonLabel: 'Motif de l’événement *',
    organizationHint: 'Ex. : direction, département, entreprise…',
    responsibleLabel: 'Responsable sur place',
    conflictTitle: 'Cette salle est déjà occupée sur ce créneau :',
    conflictHint: 'La demande partira quand même ; l’administration arbitrera.',
    submit: 'Demander la réservation',
    sent: 'Demande de réservation envoyée',
    saveFailed: 'Enregistrement impossible',
  },
};
