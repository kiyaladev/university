/** Namespace `frais` — grille des frais d'inscription. */
export default {
  title: "Frais d'inscription",
  subtitle:
    'Un tarif par promotion et par année. Modifier un montant le recopie sur les dossiers en attente de paiement.',
  actions: {
    new: 'Nouveau tarif',
    edit: 'Modifier ce tarif',
    delete: 'Supprimer ce tarif',
  },
  filters: {
    promotion: 'Promotion',
  },
  chips: {
    year: 'Année : {year}',
    promotion: 'Promotion : {promotion}',
  },
  table: {
    columns: {
      promotion: 'Promotion',
    },
  },
  summary: '{count} tarif(s) affiché(s) sur {total}',
  emptyState: {
    title: 'Aucun tarif pour ces critères.',
  },
  formDialog: {
    newTitle: "Nouveau tarif d'inscription",
    editTitle: 'Modifier le tarif',
    subtitle: 'Le tarif est propre à une promotion et à une année académique.',
    promotion: 'Promotion',
    promotionHint: "La promotion doit appartenir à l'année choisie",
    propagationHint: 'Le nouveau montant sera recopié sur les dossiers en attente de paiement de cette promotion.',
  },
  deleteDialog: {
    title: 'Supprimer ce tarif ?',
    message:
      'Le tarif de {promotion} pour {year} ({amount}) sera supprimé, et les dossiers en attente de paiement de cette promotion repasseront à un montant de 0.',
  },
  messages: {
    created: 'Tarif enregistré',
    updated: 'Tarif mis à jour',
    deleted: 'Tarif supprimé',
  },
};
