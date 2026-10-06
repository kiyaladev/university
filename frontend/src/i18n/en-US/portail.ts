/** Namespace `portail` — page PortailPage.vue (student area: record, results, canteen wallet). */
export default {
  actions: {
    home: 'Back to my home',
    logout: 'Log out',
    retry: 'Retry',
    view: 'View',
    recharge: 'Top up',
    cancel: 'Cancel',
  },
  otherRole: {
    title: 'Student area',
    message:
      'This view is reserved for student accounts, opened via SMS login from the student portal.',
  },
  errorState: {
    title: 'Record unavailable',
  },
  header: {
    subtitle: 'My space',
    greeting: 'Hello, {prenom}',
    matricule: 'Student ID {matricule}',
  },
  nav: {
    title: 'My services',
  },
  services: {
    maCarte: { label: 'My student card', help: 'Digital card, QR code and personal code' },
    demandesDocuments: { label: 'My document requests', help: 'Certificates, transcripts and attestations to request' },
    reclamations: { label: 'My complaints', help: 'Dispute a grade, report a record error' },
    vote: { label: 'Vote', help: 'Delegate elections and announced results' },
    bibliotheque: { label: 'Digital library', help: 'Theses, dissertations and course materials' },
    formations: { label: 'Continuing education', help: 'Catalog of training courses open for enrollment' },
  },
  sections: {
    inscription: {
      title: 'Enrollment',
      statut: 'Status',
      promotion: 'Class',
      annee: 'Year',
      filiere: 'Program',
      empty: 'No enrollment recorded.',
    },
    frais: {
      title: 'Enrollment fees',
      paye: 'Paid',
      restant: 'Remaining',
      empty: 'No fees for this year.',
    },
    paiements: {
      title: 'Recent payments',
      empty: 'No payment recorded.',
    },
    resultat: {
      title: 'Result',
      rankTooltip: 'Rank in the class',
      rank: 'rank {rang}',
      empty: 'No result published yet. Deliberations validated by the board will appear here.',
    },
    attestations: {
      title: 'Attestations',
      revoked: 'revoked',
      viewTooltip: 'Open the attestation printout (new tab)',
      empty: 'No attestation issued. Request a certificate of enrollment or a transcript from',
      emptyLink: 'My document requests',
      note: 'Every attestation carries a QR code: anyone can verify its authenticity on the',
      noteLink: 'Attestation verification',
    },
    resto: {
      title: 'Canteen wallet',
      description:
        'The balance is used at the university canteen: scan your card at the counter at every meal. Top up via Mobile Money and the balance is credited once confirmed at the counter.',
      empty: 'No activity yet.',
      rechargeLabel: 'Top-up — {statut}',
    },
  },
  dialogResto: {
    title: 'Top up the canteen wallet',
    montantLabel: 'Amount (GNF)',
    montantHint: 'Minimum 500 GNF',
    montantError: 'Enter an amount of at least 500 GNF',
    operateurLabel: 'Mobile Money operator',
    note:
      'You will pay via Mobile Money: a reference will be given to you for the transfer. The balance is credited once confirmed at the counter.',
    submit: 'Request payment',
  },
  loading: 'Loading your record…',
  messages: {
    popupBlocked: 'Allow pop-ups to open the attestation.',
    loadError: 'Your record could not be loaded. Check your connection, then try again.',
    rechargeInfo: 'Top-up {reference} pending — follow the payment instructions',
  },
};
