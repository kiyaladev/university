/** Namespace `correctionsPointages` — consultation et correction des pointages. */
export default {
  title: 'Corrections des pointages',
  subtitle: 'Les pointages consignés en salle. Une correction ne change que les champs modifiés et reste journalisée.',
  filters: {
    from: 'À partir du',
    to: "Jusqu'au",
    status: 'Statut',
    method: 'Méthode de vérification',
  },
  chips: {
    from: 'Depuis le {date}',
    to: 'Jusqu’au {date}',
    status: 'Statut : {status}',
    method: 'Méthode : {method}',
  },
  table: {
    columns: {
      status: 'Statut',
      hours: 'Horaires',
      method: 'Méthode',
    },
  },
  methods: {
    MANUEL: 'Saisie manuelle',
    QR_SALLE: 'QR de la salle',
    GEOLOCALISATION: 'Géolocalisation',
    SIGNATURE: 'Signature',
  },
  summary: '{count} pointage(s) affiché(s) sur {total}',
  emptyState: {
    title: 'Aucun pointage pour ces critères.',
  },
  actions: {
    edit: 'Corriger ce pointage',
    delete: 'Supprimer ce pointage',
  },
  formDialog: {
    title: 'Corriger le pointage',
    subtitle: 'Seuls les champs modifiés changent : le reste de la saisie est conservé.',
    status: 'Statut de présence',
    arrival: 'Heure d’arrivée',
    departure: 'Heure de fin réelle',
    headcount: 'Effectif présent',
    topic: 'Thématique traitée',
    substitute: 'Enseignant remplaçant',
    observation: 'Observation',
    proofsHint:
      'Les preuves (QR de la salle, position, signature, code personnel) ne sont pas rejouées : elles restent celles du pointage d’origine.',
    invalidTime: 'Les heures doivent être au format HH:mm.',
    invalidCount: 'L’effectif doit être un entier positif ou nul.',
  },
  deleteDialog: {
    title: 'Supprimer ce pointage ?',
    message:
      'Le pointage de {teacher} du {date} sera supprimé. La séance redeviendra non contrôlée. Cette action est irréversible.',
  },
  messages: {
    updated: 'Pointage corrigé',
    deleted: 'Pointage supprimé',
  },
};
