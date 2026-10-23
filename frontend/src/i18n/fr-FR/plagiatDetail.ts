/** Namespace `plagiatDetail`. */
export default {
  title: 'Détail suspicion',
  subtitle: 'Comparaison automatique par empreinte + similarité Jaccard.',
  notFound: {
    message: 'Suspicion introuvable ou supprimée.',
    backToQueue: "Retour à la file d'arbitrage",
  },
  actions: {
    backToList: 'Liste des suspicions',
    viewDocument: 'Voir la fiche du document',
  },
  score: {
    suspicion: 'Suspicion',
    label: 'Score de similarité',
    detectedOn: 'Détecté le',
  },
  documents: {
    documentA: 'Document A',
    documentB: 'Document B',
    otherType: 'Autre',
    sizeInMo: '{size} Mo',
  },
  diff: {
    title: 'Diff simplifié (similarité Jaccard)',
    description: 'Les blocs communs aux deux documents sont surlignés.',
    documentA: 'Document A',
    documentB: 'Document B',
    noText: 'Aucun texte extrait à comparer.',
  },
  decision: {
    alreadyTaken: "Décision déjà prise — la suspicion n'est plus modifiable.",
    acquit: 'Acquitter la suspicion',
    confirm: 'Confirmer le plagiat',
    confirmWarning:
      'Confirmer ouvre une procédure disciplinaire — le motif sera inscrit au journal.',
    motifLabel: 'Motif / commentaire',
    motifRequired: 'Motif obligatoire',
    acquitAction: 'Acquitter',
    confirmAction: 'Confirmer le plagiat',
  },
  journal: {
    title: 'Journal',
    autoDetection: 'Détection automatique',
    createdByEngine: 'Suspicion créée par le moteur anti-plagiat (score {score} %).',
    acquittal: 'Acquittement',
    confirmation: 'Confirmation de plagiat',
    by: 'Par {name}',
    noDecisionYet: "Aucune décision enregistrée pour l'instant.",
  },
  messages: {
    motifRequiredForConfirm: 'Le motif est obligatoire pour une confirmation',
    acquitted: 'Suspicion acquittée',
    confirmed: 'Plagiat confirmé — procédure ouverte',
  },
};
