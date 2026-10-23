/** Namespace `examens` — page Examens. */
export default {
  title: 'Examens',
  subtitle:
    "Planification des épreuves et scan des cartes étudiantes à l'entrée de la salle. Chaque examen ouvre sur son tirage et sur son poste de scan.",
  actions: {
    schedule: 'Planifier un examen',
    scanStation: 'Poste de scan',
    draw: 'Tirage des épreuves',
    finish: 'Terminer',
    scanCards: 'Scanner les cartes',
    scanner: 'Scanner',
    drawShort: 'Tirage',
  },
  fields: {
    supervisor: 'Surveillant affecté',
    codeHint: 'Le code examen permet aux scanneurs d’identifier la session active.',
    code: 'Code (EXAM-AAAA-XXXXX)',
    examDate: "Date de l'examen *",
    startTime: 'Heure de début *',
    endTime: 'Heure de fin *',
  },
  filters: {
    searchPlaceholder: 'Rechercher (code examen, intitulé, matière…)',
    type: "Type d'épreuve",
    promotion: 'Promotion',
    dateFrom: 'Épreuves du',
    dateTo: 'au',
    searchChip: '« {query} »',
    typeChip: 'Type : {type}',
  },
  table: {
    columns: {
      slot: 'Date & heure',
      promotion: 'Promotion',
      present: 'Présents',
    },
    tooltips: {
      openSheet: "Fiche de l'examen",
      openSheetAria: "Ouvrir la fiche de l'examen",
      start: "Démarrer l'examen",
      finish: "Terminer l'examen",
      scanCards: 'Scanner les cartes de cet examen',
      scanCardsAria: 'Ouvrir le poste de scan de cet examen',
      draw: 'Tirage des épreuves de cet examen',
      drawAria: 'Voir le tirage de cet examen',
    },
  },
  emptyState: {
    noResults: 'Aucun examen ne correspond à cette recherche.',
    noneForStatus: 'Aucun examen « {status} » sur cette période.',
  },
  sheet: {
    closeAria: 'Fermer la fiche',
    presentsOverEnrolled: 'Présents / inscrits',
    chainContinuation: 'Suite de la chaîne',
    scanJournal: 'Journal des scans',
    noScans: 'Aucune carte scannée pour cet examen.',
    validated: 'Validé',
    rejected: 'Rejeté',
  },
  scansTable: {
    columns: {
      time: 'Heure',
      holder: 'Porteur',
      registrationNumber: 'Matricule saisi',
    },
  },
  confirm: {
    startTitle: "Démarrer l'examen",
    startMessage:
      "Démarrer {code} — {title} ? Le nombre d'inscrits sera recalculé depuis les inscriptions validées de la promotion, et le poste de scan s'ouvrira à cet examen.",
    finishTitle: "Terminer l'examen",
    finishMessage:
      'Clôturer {code} — {title} ? Le nombre de présents est figé : plus aucune carte ne pourra être scannée pour cette épreuve. Cette opération est définitive.',
    finishAction: 'Terminer définitivement',
  },
  messages: {
    loadFailed: 'Chargement des examens impossible',
    started: 'Examen démarré',
    startFailed: 'Démarrage impossible',
    finished: 'Examen terminé',
    finishFailed: 'Opération impossible',
    scheduled: 'Examen planifié',
  },
};
