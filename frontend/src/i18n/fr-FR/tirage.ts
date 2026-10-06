/** Namespace `tirage` — page TiragePage.vue (tirage des épreuves, vue admin). */
export default {
  title: 'Tirage des épreuves',
  subtitle:
    "Entre l'examen planifié et la salle : l'empreinte SHA-256 du sujet est revérifiée à l'impression pour bloquer toute substitution de fichier.",
  actions: {
    schedule: 'Programmer un tirage',
    exams: 'Examens',
    viewAll: 'Voir tous les tirages',
    bordereau: 'Bordereau',
    print: 'Imprimer',
    cancel: 'Annuler',
    back: 'Revenir',
    cancelDraw: 'Annuler le tirage',
    confirmPrint: 'Confirmer l’impression',
  },
  banner: {
    prefix: 'Tirages de l’examen',
  },
  search: {
    placeholder: 'Rechercher (code examen, intitulé…)',
  },
  filters: {
    examen: 'Examen',
    stade: 'Stade',
  },
  chips: {
    search: '« {value} »',
    stade: 'Stade : {value}',
    examen: 'Examen : {value}',
  },
  table: {
    columns: {
      examen: 'Examen',
      date: 'Date du tirage',
      exemplaires: 'Exemplaires',
      empreinte: 'Empreinte SHA-256',
      imprimeur: 'Imprimeur',
      stade: 'Stade',
    },
  },
  tooltips: {
    bordereau: 'Bordereau',
    voirExamen: 'Voir l’examen',
    annulerTirage: 'Annuler le tirage',
  },
  ariaLabels: {
    imprimerBordereau: 'Imprimer le bordereau du tirage',
    voirExamen: 'Voir l’examen de ce tirage',
    annulerTirage: 'Annuler le tirage',
  },
  emptyState: {
    message: 'Aucun tirage pour ces critères.',
  },
  transitions: {
    IMPRIME:
      'Confirmez l’empreinte SHA-256 du fichier source. Si elle ne correspond pas à celle enregistrée à la programmation, l’impression sera refusée.',
    MIS_SOUS_PLI:
      'Les exemplaires sont déclarés mis sous pli et scellés. Cette étape est enregistrée au journal et ne peut pas être annulée.',
    DISTRIBUE:
      'Les plis sont déclarés remis au centre d’examen. Cette étape est enregistrée au journal et ne peut pas être annulée.',
    RECUPERE:
      'Les copies sont déclarées récupérées : le tirage est clos. Cette étape est définitive.',
  },
  dialogs: {
    schedule: {
      fingerprintPolicy: 'L’empreinte SHA-256 du fichier source sera exigée à l’impression pour bloquer toute substitution.',
      examLabel: 'Examen *',
      dateLabel: 'Date du tirage *',
      copiesLabel: 'Nombre d’exemplaires *',
      fingerprintLabel: 'Empreinte SHA-256 du fichier source *',
      fingerprintHint: '64 caractères hexadécimaux ; l’empreinte devra correspondre au moment de l’impression.',
      calculateFingerprint: 'Calculer l’empreinte depuis le fichier chargé',
      calculateFromFile: 'Calculer depuis un fichier',
      fileLabel: 'Ou charger le fichier pour calculer',
      printRouteLabel: 'Circuit d’impression (ex. : Salle 1 → Salle 2 → …)',
      submit: 'Programmer',
      required: 'Examen, date, nombre d’exemplaires et empreinte sont obligatoires.',
      invalidFingerprint: 'L’empreinte doit être un SHA-256 de 64 caractères hexadécimaux. Chargez le fichier pour la calculer.',
      saveFailed: 'Enregistrement impossible',
    },
    advance: {
      title: 'Passer au stade « {stade} »',
    },
    cancel: {
      title: 'Annuler le tirage',
      message:
        'Annuler définitivement le tirage de {examen} ? Les exemplaires programmés ne seront pas imprimés.',
      thisExam: 'cet examen',
    },
  },
  messages: {
    loadError: 'Chargement des tirages impossible',
    scheduled: 'Tirage programmé',
    fingerprintRequired: 'Empreinte requise pour imprimer',
    stageChanged: 'Stade → {stade}',
    transitionError: 'Transition impossible',
    cancelled: 'Tirage annulé',
    cancelError: 'Annulation impossible',
  },
};
