/** Namespace `paie` — page PaiePage.vue (paie des vacataires, vue admin). */
export default {
  title: 'Paie des vacataires',
  subtitle:
    "Le chemin d'une feuille mensuelle : elle agrège les heures constatées lors des contrôles, la direction la valide — les montants sont alors figés —, puis l'administration la marque payée.",
  actions: {
    newSheet: 'Nouvelle feuille',
    markPaid: 'Marquer payée',
    printSheet: 'Imprimer la feuille (A4)',
    createFirst: 'Créer la première feuille',
  },
  filters: {
    statutChip: 'Statut : {value}',
    anneeChip: 'Année : {value}',
  },
  summary: {
    sheetsCount: '{count} feuille(s)',
    allStatuses: 'tous statuts',
    allYears: 'toutes années',
    totalShown: 'total affiché',
  },
  table: {
    columns: {
      libelle: 'Feuille',
      lignes: 'Lignes',
      montantTotal: 'Montant total (GNF)',
    },
    lignesColumns: {
      taux: 'Taux horaire (GNF)',
      heures: 'Heures réalisées',
      volume: 'Volume prévu',
      brut: 'Brut (GNF)',
      retenue: 'Retenue (GNF)',
      montant: 'Net (GNF)',
      commentaire: 'Commentaire',
    },
  },
  card: {
    totalAmount: 'Montant total',
    lignesCount: '{count} ligne(s)',
  },
  tooltips: {
    detail: 'Détail des lignes',
    recalculate: 'Recalculer les heures contrôlées',
    validate: 'Valider et figer les montants',
    markPaid: 'Marquer payée',
    print: 'Imprimer la feuille (A4)',
  },
  ariaLabels: {
    reload: 'Recharger les feuilles de paie',
    detail: 'Détail des lignes de {libelle}',
    recalculate: 'Recalculer {libelle}',
    validate: 'Valider {libelle}',
    markPaid: 'Marquer {libelle} payée',
    print: 'Imprimer {libelle}',
    delete: 'Supprimer {libelle}',
  },
  emptyState: {
    title: 'Aucune feuille de paie',
    description:
      'Une feuille couvre un mois : elle rassemble les heures contrôlées de la période et les convertit en montants au taux de chaque enseignant.',
    filtered: 'Aucune ne correspond aux filtres en cours.',
  },
  detail: {
    lineEmptyTitle: 'Feuille sans ligne',
    lineEmptyMessage:
      'Aucune heure contrôlée n’a été trouvée sur la période. Lancez un recalcul, ou vérifiez que les séances du mois ont bien été pointées.',
    total: 'Total — {count} enseignant(s)',
    completed: 'réalisées',
  },
  dialogs: {
    createDialog: {
      title: 'Nouvelle feuille de paie',
      month: 'Mois *',
      year: 'Année *',
      periodHint:
        'La feuille « {label} » couvre du premier au dernier jour du mois. Les heures contrôlées dans University sont ensuite agrégées ligne par ligne.',
      create: 'Créer la feuille',
      draftHint:
        'La feuille est en brouillon : recalculez-la pour agréger les heures contrôlées, puis faites-la valider par la direction.',
      recalculateNow: 'Recalculer maintenant',
      created: 'Feuille « {label} » créée',
      createFailed: 'Création impossible',
    },
    recalculate: {
      title: 'Recalculer',
      message:
        'Agréger les heures contrôlées dans University sur la feuille « {libelle} » ? Les lignes seront recréées (les commentaires sont conservés).',
      ok: 'Recalculer',
    },
    validate: {
      title: 'Valider la feuille',
      message: 'Valider « {libelle} » pour {montant} GNF ? Les montants seront figés : plus aucun recalcul possible.',
      ok: 'Valider',
    },
    markPaid: {
      title: 'Marquer payée',
      message: 'Marquer « {libelle} » comme payée ({montant} GNF) ?',
      ok: 'Marquer payée',
    },
    delete: {
      title: 'Supprimer',
      message: 'Supprimer définitivement la feuille « {libelle} » ?',
      ok: 'Supprimer',
    },
  },
  messages: {
    recalculated: 'Feuille recalculée',
    validated: 'Feuille validée',
    paid: 'Feuille payée',
    deleted: 'Feuille supprimée',
  },
};
