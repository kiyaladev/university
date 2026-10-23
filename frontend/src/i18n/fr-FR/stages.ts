/** Namespace `stages` — page Stages & mémoires (travaux encadrés + soutenances). */
export default {
  title: 'Stages & mémoires',
  subtitle:
    "Sujet proposé → validé → encadré → rapport rendu → soutenu. Suivi tenu par la scolarité et la direction ; l'enseignant pilote ses encadrements, l'étudiant ses travaux (via le portail).",
  actions: {
    new: 'Nouveau travail',
  },
  tabs: {
    works: 'Travaux',
    defenses: 'Soutenances',
  },
  filters: {
    searchPlaceholderWorks: 'Rechercher (intitulé, entreprise, lieu…)',
    searchPlaceholderDefenses: 'Rechercher (intitulé, étudiant, salle…)',
    supervisor: 'Encadrant',
    supervisorFiltered: 'Encadrant filtré',
    workStatus: 'Statut travail',
  },
  types: {
    memoire: 'Mémoire',
    stage: 'Stage',
    rapport: 'Rapport',
  },
  toDesignate: 'À désigner',
  table: {
    columns: {
      work: 'Travail',
      supervisor: 'Encadrant',
      report: 'Rapport',
      defense: 'Soutenance',
    },
    emptyState: {
      title: 'Aucun travail encadré pour ces critères.',
      description: 'Le parcours commence par un sujet proposé, puis validé par la scolarité.',
    },
    report: {
      done: 'Rendu',
      pending: 'En attente',
    },
    defense: {
      awaitingReport: 'Constat en attente',
    },
    actions: {
      viewSheetTooltip: 'Voir la fiche',
      print: 'Imprimer la fiche',
      planDefense: 'Planifier la soutenance',
      juryReport: 'Saisir le constat du jury',
    },
  },
  stats: {
    byType: 'Répartition par type',
    byStatus: 'Répartition par statut',
    upcoming7Days: 'Soutenances des 7 prochains jours',
    inDefensePhase: 'Travaux en phase de soutenance',
    defended: 'Travaux soutenus',
  },
  list: {
    defenseFallback: 'Soutenance',
    roomToBeSet: 'salle à fixer',
    emptyTitle: 'Aucune soutenance programmée dans les 7 prochains jours.',
    emptyDescription:
      "Une soutenance se planifie depuis l'onglet « Travaux », sur un dossier en cours dont le rapport est rendu.",
  },
  kanban: {
    columns: {
      proposed: 'Proposé',
      validated: 'Validé',
    },
  },
  transitions: {
    validate: 'Valider',
    abandon: 'Abandonner',
    startSupervision: "Démarrer l'encadrement",
    moveToDefended: 'Passer en SOUTENU',
    reactivate: 'Réactiver',
  },
  dialogs: {
    workDialog: {
      editTitle: 'Modifier le travail encadré',
      newTitle: 'Nouveau travail encadré',
      type: 'Type *',
      title: 'Intitulé du travail *',
      supervisorHint: 'Attribuer l’encadrement à un enseignant',
      companyTutor: 'Tuteur en entreprise',
      initialStatus: 'Statut initial',
      initialStatusHint: 'PROPOSÉ par défaut ; la suite évolue selon les actions du dossier',
      required: 'Intitulé et étudiant sont requis',
      updated: 'Travail modifié',
      created: 'Travail créé',
    },
    defense: {
      juryTitle: 'Constat du jury',
      scheduleTitle: 'Planifier la soutenance',
      juryHint: 'Note et mention après la tenue de la soutenance de « {title} ».',
      date: 'Date de la soutenance *',
      time: 'Heure *',
      chair: 'Président du jury',
      assessors: 'Assesseurs',
      assessorsHint: '« Pr. X ; Dr. Y »',
      grade: 'Note sur 20',
      saveJury: 'Enregistrer le constat',
      saveDefense: 'Enregistrer la soutenance',
      jurySaved: 'Constat du jury enregistré',
      dateRequired: 'La date de soutenance est requise',
      saved: 'Soutenance enregistrée — travail soutenu',
      mentionHint: 'Félicitations, Très bien…',
    },
    transition: {
      title: 'Passer en « {label} »',
      abandonMessage: "Le dossier reste consultable mais sort du parcours. Confirmer l'abandon ?",
      defendedMessage:
        'Rapport rendu et soutenance enregistrée sont requis avant le passage en SOUTENU.',
      defaultMessage: 'Confirmer cette transition ?',
    },
    delete: {
      title: 'Supprimer ce travail ?',
      message:
        "{title} — casse du dossier réservée à l'administration, états PROPOSE / VALIDE uniquement.",
    },
  },
  notifications: {
    transitionSuccess: 'Travail passé en « {label} »',
    reportMarkedDone: 'Rapport marqué rendu',
    reportMarkedPending: 'Rapport marqué non rendu',
    deleted: 'Travail supprimé',
  },
  detail: {
    title: 'Travail encadré',
    fields: {
      supervisor: 'Encadrant',
      company: 'Entreprise',
      companyTutor: 'Tuteur entreprise',
      place: 'Lieu',
      reportSubmitted: 'Rapport rendu',
      defense: 'Soutenance',
    },
    yes: 'Oui',
    no: 'Non',
  },
};
