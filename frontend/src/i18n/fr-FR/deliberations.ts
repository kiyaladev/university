/** Namespace `deliberations` — page DeliberationsPage.vue (jurys de délibération, vue admin). */
export default {
  title: 'Délibérations',
  subtitle:
    'Sessions du jury : moyennes pondérées par les crédits, décisions ADMIS / AJOURNÉ / DÉFAILLANT, puis édition des bulletins.',
  actions: {
    newDeliberation: 'Nouvelle délibération',
    reportCards: 'Bulletins',
    recalculate: 'Recalculer',
    validateJury: 'Valider le jury',
    pv: 'PV',
    back: 'Revenir',
  },
  createDialog: {
    session: 'Session *',
    sessionHint: 'En rattrapage, seuls les étudiants ajournés à la session normale sont repositionnés.',
    draftHint: 'La délibération est créée en brouillon : les moyennes sont calculées automatiquement, puis le jury (direction) les valide.',
    previewTitle: 'Aperçu du bulletin type',
    previewDecision: 'ADMIS / AJOURNÉ',
    previewHint: 'Les notes et la décision sont renseignées après calcul.',
    sampleSubject: 'Matière {number}',
    sampleName: 'Exemple',
    selectedPromotion: 'Promotion sélectionnée',
    selectedYear: 'Année sélectionnée',
    created: 'Délibération créée, moyennes calculées',
    createFailed: 'Création impossible — une délibération existe peut-être déjà pour cette promotion et cette session.',
  },
  filters: {
    search: 'Rechercher une promotion…',
    promotion: 'Promotion',
    session: 'Session',
  },
  chips: {
    search: '« {value} »',
    annee: 'Année : {value}',
    promo: 'Promo : {value}',
    session: 'Session : {value}',
    statut: 'Statut : {value}',
  },
  table: {
    columns: {
      promotion: 'Promotion',
      session: 'Session',
      taux: 'Taux de réussite',
    },
    detailColumns: {
      rang: 'Rang',
      moyenne: 'Moyenne',
      mention: 'Mention',
    },
  },
  emptyState: {
    message: 'Aucune délibération pour ces critères.',
  },
  tooltips: {
    detail: 'Détail des lignes',
    recalculate: 'Recalculer moyennes et décisions',
    reportCards: 'Bulletins de cette promotion',
    printPv: 'Imprimer le PV',
    bulletinIndividuel: 'Bulletin individuel',
  },
  ariaLabels: {
    detail: 'Voir le détail de la délibération',
    recalculate: 'Recalculer moyennes et décisions',
    printPv: 'Imprimer le procès-verbal',
    reportCards: 'Voir les bulletins de cette délibération',
    close: 'Fermer le détail',
    printBulletin: 'Imprimer le bulletin individuel',
  },
  detail: {
    title: 'Délibération — {promotion}',
    emptyLines: 'Aucune ligne : lancez le recalcul pour produire les moyennes et les décisions.',
  },
  kanban: {
    columns: {
      propose: 'Proposées (brouillon)',
      valide: 'Validées (jury)',
      soutenu: 'Rattrapages validés',
      abandonne: 'Rattrapages en attente',
    },
    cardMeta: '{count} étudiant(s) · créée le {date}',
  },
  dialogs: {
    recalculate: {
      title: 'Recalculer la délibération',
      message:
        'Les moyennes d’UE (pondérées par les coefficients), la moyenne générale (pondérée par les crédits), les décisions, rangs et taux de réussite seront recalculés sur les notes actuelles.',
      ok: 'Recalculer',
    },
    validate: {
      title: 'Valider les résultats du jury',
      message: `La décision est prise selon les règles écrites :

        moyenne générale = Σ(moyenne UE × crédits) / Σ(crédits) ;
        ADMIS si moyenne générale ≥ 10 et aucune matière sous 5/20 pour défaut d’absence ;
        DÉFAILLANT si une matière n’a aucune note à une épreuve clôturée ;
        AJOURNÉ sinon — en rattrapage, seuls les AJOURNÉ sont repositionnés.

      Après validation, tout recalcul sera bloqué et les bulletins deviendront officiels. Continuer ?`,
      ok: 'Valider le jury',
    },
  },
  messages: {
    detailError: 'Détail indisponible',
    recalculated: 'Délibération recalculée',
    recalculateError: 'Recalcul impossible',
    validated: 'Délibération validée par le jury',
    validateError: 'Validation impossible',
    loadError: 'Chargement des délibérations impossible',
  },
};
