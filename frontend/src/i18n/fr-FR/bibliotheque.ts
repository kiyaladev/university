/** Namespace `bibliotheque`. */
export default {
  title: 'Bibliothèque numérique',
  subtitle:
    'Gestion du dépôt institutionnel : mémoires, thèses, articles et supports de cours — le fonds qui porte les subventions AUF / UNESCO. Vous voyez ici le fonds complet, publié ou non.',
  actions: {
    viewShowcase: 'Voir la vitrine publique',
    viewShowcaseTooltip: 'Page consultée par les visiteurs — documents publiés uniquement',
    recalculatePlagiarism: 'Nouvelle analyse anti-plagiat',
    depositDocument: 'Déposer un document',
  },
  search: {
    placeholder: 'Recherche globale (titre, auteur, contenu, mots-clés…)',
    noResults: 'Aucun résultat',
    typeToSearch: 'Tapez pour rechercher',
  },
  filters: {
    departmentPlaceholder: 'Tapez le nom ou le code…',
    editionYear: "Année d'édition",
    publication: 'Publication',
    published: 'Publiés',
    unpublished: 'Non publiés',
    departmentFiltered: 'Département filtré',
    yearChip: 'Année {year}',
    searchChip: '« {value} »',
  },
  table: {
    columns: {
      document: 'Document',
      size: 'Taille',
      plagiarism: 'Plagiat',
    },
  },
  status: {
    published: 'Publié',
    unpublished: 'Non publié',
  },
  card: {
    noAuthor: 'Aucun auteur renseigné',
    unpublished: 'Non publié',
    depositedWithoutFile: 'Déposé sans fichier',
    year: 'année {year}',
    downloads: '{count} téléchargement(s)',
    plagiarismRisk: 'Risque : indice de plagiat {score}',
  },
  actionsColumn: {
    downloadAria: 'Télécharger le document',
    previewAria: 'Aperçu du contenu',
    previewTooltip: 'Aperçu contenu',
    preview: 'Aperçu',
    editAria: 'Modifier le document',
    unpublishAria: 'Retirer de la vitrine publique',
    publishAria: 'Publier sur la vitrine publique',
    viewScoreAria: 'Voir le score de plagiat',
    viewScoreTooltip: 'Voir le score de plagiat',
    deleteAria: 'Supprimer le document',
  },
  riskHighTooltip: 'Risque élevé — vérifier les suspicions',
  emptyState: {
    title: 'Aucun document ne correspond à ces critères.',
    hint: 'Le fonds se remplit par dépôt : un mémoire, une thèse ou un support de cours, avec son fichier PDF.',
  },
  preview: {
    title: 'Aperçu du contenu',
    empty: 'Aucun texte extrait pour ce document.',
  },
  dialog: {
    title: {
      edit: 'Modifier le document',
      deposit: 'Déposer un document',
    },
    sections: {
      document: 'Fiche du document',
      keywords: 'Mots-clés',
      file: 'Fichier (archivage natif)',
    },
    fields: {
      title: 'Titre *',
      titleHint: 'Ex. « Impact du Téléphone mobile sur la scolarité des étudiantes à Kankan »',
      type: 'Type *',
      editionYearHint: "Vide : l'année de dépôt est retenue",
      authors: 'Auteurs',
      authorsHint: 'Plusieurs noms séparés par « ; », ex. « Diallo A. ; Barry M. »',
      abstract: 'Résumé',
      supervisorPlaceholder: 'Tapez le nom…',
      studentPlaceholder: 'Tapez le matricule ou le nom…',
      public: 'Visible sur la page publique',
      addKeyword: 'Ajouter un mot-clé',
      keywordPlaceholder: 'Tapez puis Entrée pour ajouter',
      noKeywords: 'Aucun mot-clé. Conseillé : « machine learning », « Conakry », « durabilité ».',
    },
    file: {
      description: 'PDF jusqu’à {max} : converti en data-url base64 puis stocké côté serveur, où son contenu texte sera extrait pour la recherche intégrale et l’analyse anti-plagiat.',
      attachment: 'PDF joint',
      maxSize: 'Maximum {max}',
      maxSizeValue: '{count} Mo',
      current: 'Fichier actuel : PDF ({size} Mo) — en choisir un nouveau le remplace.',
      converting: 'Conversion en base64…',
      extracting: 'Extraction du texte en cours (recherche intégrale)…',
      tooLarge: 'Document refusé : il dépasse la limite de {max}.',
      readFailed: 'La lecture du fichier a échoué.',
    },
    plagiarism: {
      title: 'Doublon potentiel détecté',
      message: 'Ce document pourrait être un doublon d’un document existant (score {score} %) — vérifiez avant de publier.',
      view: 'Voir la suspicion',
    },
    validation: {
      titleRequired: 'Le titre est obligatoire',
    },
    messages: {
      saved: 'Document enregistré',
      savedPlagiarismWarning: 'Document enregistré — vérifiez l’avertissement anti-plagiat',
    },
  },
  dialogs: {
    publish: {
      publishMessage: 'Rendre « {titre} » visible sur la page publique ?',
      unpublishMessage: 'Retirer « {titre} » de la page publique ?',
    },
    delete: {
      message: 'Supprimer « {titre} » ? Le fichier joint sera perdu.',
    },
    recalculate: {
      title: 'Recalculer les suspicions de plagiat',
      message:
        'Cette opération balaye tous les documents et compare leurs empreintes. Elle peut prendre plusieurs minutes : un compte rendu sera affiché à la fin.',
      ok: 'Lancer l’analyse',
    },
  },
  messages: {
    published: 'Document publié — visible sur la vitrine',
    unpublished: 'Document retiré de la vitrine publique',
    deleted: 'Document supprimé du fonds',
    analysisDone: 'Analyse anti-plagiat terminée',
    analysisSummaryTitle: 'Analyse terminée',
    analysisSummaryLine: '{analysed} document(s) analysés — {suspicions} suspicion(s) détectée(s).',
  },
};
