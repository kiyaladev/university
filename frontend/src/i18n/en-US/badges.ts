/** Namespace `badges`. */
export default {
  title: 'Badges & visitors',
  subtitle:
    'Visitors, guest speakers, technicians, dignitaries — printable badge with QR code and configurable validity, extendable or revocable.',
  actions: {
    issueBadge: 'Issue a badge',
    print: 'Print',
    edit: 'Edit',
    extend: 'Extend',
    cancel: 'Cancel',
  },
  filters: {
    searchPlaceholder: 'Name, organization, number…',
    type: 'Type',
    status: 'Status',
  },
  table: {
    columns: {
      number: 'No.',
      type: 'Type',
      identity: 'Identity',
      organization: 'Organization',
      validity: 'Validity',
      status: 'Status',
    },
  },
  card: {
    issuedOn: 'Issued on {date}',
    validUntil: 'Valid until {date}',
    cancelReason: 'Cancellation reason: {reason}',
  },
  tooltips: {
    print: 'Print',
    edit: 'Edit',
    extend: 'Extend validity',
    cancel: 'Cancel',
  },
  aria: {
    printBadge: 'Print the badge',
    editBadge: 'Edit the badge',
    extendBadge: 'Extend the validity',
    cancelBadge: 'Cancel the badge',
    close: 'Close',
  },
  emptyState: {
    message:
      'No badges match these criteria. Issue one for an expected visitor or guest speaker.',
  },
  dialogs: {
    form: {
      titleEdit: 'Edit badge',
      titleNew: 'Issue a badge',
      typeLabel: 'Badge type',
      functionLabel: 'Role',
      emailLabel: 'Email',
      idTypeLabel: 'ID type',
      idNumberLabel: 'ID number',
      zonesLabel: 'Allowed areas (CSV)',
      photoLabel: 'Photo (URL)',
      reasonHint: 'Filled in automatically when the badge is cancelled.',
      nameRequired: 'First and last name are required.',
      validityRequired: 'Enter a validity date.',
      updated: 'Badge updated.',
      issued: 'Badge issued.',
      issueFailed: 'Could not issue the badge.',
    },
    cancel: {
      title: 'Cancel the badge',
      warning:
        'Irreversible action: a cancelled badge can no longer be reactivated or extended. Issue a new one if needed.',
      reasonLabel: 'Cancellation reason',
      reasonHint: 'Minimum 3 characters.',
      cancelAction: 'Cancel',
      confirmAction: 'Cancel permanently',
    },
    extend: {
      title: 'Extend the validity',
      info: 'The badge will return to "Active" status and keep its number and QR code: no need to reprint it.',
      newValidityDateLabel: 'New validity date',
      cancelAction: 'Cancel',
      confirmAction: 'Extend',
    },
  },
  messages: {
    cancelled: 'Badge cancelled.',
    cancelFailed: 'Cancellation failed.',
    extended: 'Validity extended.',
    extendFailed: 'Extension failed.',
  },
};
