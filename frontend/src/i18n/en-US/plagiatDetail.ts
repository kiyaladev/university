/** Namespace `plagiatDetail`. */
export default {
  title: 'Suspicion detail',
  subtitle: 'Automatic comparison by fingerprint + Jaccard similarity.',
  notFound: {
    message: 'Suspicion not found or deleted.',
    backToQueue: 'Back to the review queue',
  },
  actions: {
    backToList: 'List of suspicions',
    viewDocument: 'View document record',
  },
  score: {
    suspicion: 'Suspicion',
    label: 'Similarity score',
    detectedOn: 'Detected on',
  },
  documents: {
    documentA: 'Document A',
    documentB: 'Document B',
    otherType: 'Other',
    sizeInMo: '{size} MB',
  },
  diff: {
    title: 'Simplified diff (Jaccard similarity)',
    description: 'Blocks common to both documents are highlighted.',
    documentA: 'Document A',
    documentB: 'Document B',
    noText: 'No extracted text to compare.',
  },
  decision: {
    alreadyTaken: 'Decision already made — the suspicion can no longer be modified.',
    acquit: 'Acquit the suspicion',
    confirm: 'Confirm plagiarism',
    confirmWarning:
      'Confirming opens a disciplinary procedure — the reason will be recorded in the log.',
    motifLabel: 'Reason / comment',
    motifRequired: 'Reason required',
    acquitAction: 'Acquit',
    confirmAction: 'Confirm plagiarism',
  },
  journal: {
    title: 'Log',
    autoDetection: 'Automatic detection',
    createdByEngine: 'Suspicion created by the anti-plagiarism engine (score {score}%).',
    acquittal: 'Acquittal',
    confirmation: 'Plagiarism confirmation',
    by: 'By {name}',
    noDecisionYet: 'No decision recorded yet.',
  },
  messages: {
    motifRequiredForConfirm: 'A reason is required to confirm',
    acquitted: 'Suspicion acquitted',
    confirmed: 'Plagiarism confirmed — procedure opened',
  },
};
