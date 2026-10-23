/** Namespace `tarifsDemandeAdmin`. */
export default {
  title: 'Request fees',
  subtitle:
    'Each document type (enrollment certificate, transcript, duplicate…) is billed at the fee configured here. The amount and delay shown to the student when they submit a request depend on it.',
  actions: {
    document_requests: 'Document requests',
    new_tariff: 'New fee',
    all_types_have_tariff: 'All document types already have a fee: edit it instead.',
  },
  errors: {
    role_forbidden: 'This page is reserved for administrators. You are logged in as {role}.',
  },
  table: {
    empty: 'No fee registered. As long as a type has no fee, student requests are created free of charge and go directly into processing.',
    columns: {
      delay: 'Delay',
    },
    edit_aria: 'Edit fee',
  },
  dialog: {
    edit_title: 'Edit fee',
    new_title: 'New fee',
    type_hint: 'The type is fixed after creation',
    type_required: 'Type required',
    amount_required: 'Amount required',
    delay_label: 'Usual delay (hours)',
    delay_required: 'Delay required',
  },
  messages: {
    updated: 'Fee updated',
    created: 'Fee created',
  },
};
