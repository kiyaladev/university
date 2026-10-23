/** Namespace `frais` — grille des frais d'inscription. */
export default {
  title: 'Tuition fees',
  subtitle:
    'One fee per promotion and per academic year. Changing an amount copies it over to the enrollments still awaiting payment.',
  actions: {
    new: 'New fee',
    edit: 'Edit this fee',
    delete: 'Delete this fee',
  },
  filters: {
    promotion: 'Promotion',
  },
  chips: {
    year: 'Year: {year}',
    promotion: 'Promotion: {promotion}',
  },
  table: {
    columns: {
      promotion: 'Promotion',
    },
  },
  summary: '{count} fee(s) shown out of {total}',
  emptyState: {
    title: 'No fee for these criteria.',
  },
  formDialog: {
    newTitle: 'New tuition fee',
    editTitle: 'Edit the fee',
    subtitle: 'A fee applies to one promotion and one academic year.',
    promotion: 'Promotion',
    promotionHint: 'The promotion must belong to the selected year',
    propagationHint: 'The new amount will be copied over to the enrollments of this promotion awaiting payment.',
  },
  deleteDialog: {
    title: 'Delete this fee?',
    message:
      'The fee of {promotion} for {year} ({amount}) will be deleted, and the enrollments of this promotion awaiting payment will go back to an amount of 0.',
  },
  messages: {
    created: 'Fee saved',
    updated: 'Fee updated',
    deleted: 'Fee deleted',
  },
};
