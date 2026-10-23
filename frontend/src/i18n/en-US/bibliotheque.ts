/** Namespace `bibliotheque`. */
export default {
  title: 'Digital library',
  subtitle:
    'Institutional repository management: theses, dissertations, articles and course materials — the collection backing the AUF / UNESCO grants. You are viewing the full collection here, published or not.',
  actions: {
    viewShowcase: 'View public showcase',
    viewShowcaseTooltip: 'Page seen by visitors — published documents only',
    recalculatePlagiarism: 'New plagiarism scan',
    depositDocument: 'Deposit a document',
  },
  search: {
    placeholder: 'Global search (title, author, content, keywords…)',
    noResults: 'No results',
    typeToSearch: 'Type to search',
  },
  filters: {
    departmentPlaceholder: 'Type the name or code…',
    editionYear: 'Edition year',
    publication: 'Publication',
    published: 'Published',
    unpublished: 'Unpublished',
    departmentFiltered: 'Department filtered',
    yearChip: 'Year {year}',
    searchChip: '"{value}"',
  },
  table: {
    columns: {
      document: 'Document',
      size: 'Size',
      plagiarism: 'Plagiarism',
    },
  },
  status: {
    published: 'Published',
    unpublished: 'Unpublished',
  },
  card: {
    noAuthor: 'No author provided',
    unpublished: 'Unpublished',
    depositedWithoutFile: 'Deposited without a file',
    year: 'year {year}',
    downloads: '{count} download(s)',
    plagiarismRisk: 'Risk: plagiarism score {score}',
  },
  actionsColumn: {
    downloadAria: 'Download the document',
    previewAria: 'Content preview',
    previewTooltip: 'Content preview',
    preview: 'Preview',
    editAria: 'Edit the document',
    unpublishAria: 'Remove from public showcase',
    publishAria: 'Publish to the public showcase',
    viewScoreAria: 'View plagiarism score',
    viewScoreTooltip: 'View plagiarism score',
    deleteAria: 'Delete the document',
  },
  riskHighTooltip: 'High risk — check the suspicions',
  emptyState: {
    title: 'No document matches these criteria.',
    hint: 'The collection grows through deposits: a thesis, dissertation or course material, with its PDF file.',
  },
  preview: {
    title: 'Content preview',
    empty: 'No text extracted for this document.',
  },
  dialog: {
    title: {
      edit: 'Edit document',
      deposit: 'Deposit a document',
    },
    sections: {
      document: 'Document details',
      keywords: 'Keywords',
      file: 'File (native archiving)',
    },
    fields: {
      title: 'Title *',
      titleHint: 'E.g. “Impact of mobile phones on female students’ education in Kankan”',
      type: 'Type *',
      editionYearHint: 'Leave blank to use the deposit year',
      authors: 'Authors',
      authorsHint: 'Separate multiple names with “;”, e.g. “Diallo A.; Barry M.”',
      abstract: 'Abstract',
      supervisorPlaceholder: 'Enter a name…',
      studentPlaceholder: 'Enter student number or name…',
      public: 'Visible on the public page',
      addKeyword: 'Add a keyword',
      keywordPlaceholder: 'Type, then press Enter to add',
      noKeywords: 'No keywords. Suggested: “machine learning”, “Conakry”, “sustainability”.',
    },
    file: {
      description: 'PDF up to {max}: converted to a base64 data URL and stored on the server, where its text is extracted for full-text search and plagiarism analysis.',
      attachment: 'Attached PDF',
      maxSize: 'Maximum {max}',
      maxSizeValue: '{count} MB',
      current: 'Current file: PDF ({size} MB) — choosing another file will replace it.',
      converting: 'Converting to base64…',
      extracting: 'Extracting text (full-text search)…',
      tooLarge: 'Document rejected: it exceeds the {max} limit.',
      readFailed: 'The file could not be read.',
    },
    plagiarism: {
      title: 'Potential duplicate detected',
      message: 'This document may duplicate an existing document (score: {score}%) — review it before publishing.',
      view: 'View suspicion',
    },
    validation: {
      titleRequired: 'The title is required',
    },
    messages: {
      saved: 'Document saved',
      savedPlagiarismWarning: 'Document saved — review the plagiarism warning',
    },
  },
  dialogs: {
    publish: {
      publishMessage: 'Make "{titre}" visible on the public page?',
      unpublishMessage: 'Remove "{titre}" from the public page?',
    },
    delete: {
      message: 'Delete "{titre}"? The attached file will be lost.',
    },
    recalculate: {
      title: 'Recalculate plagiarism suspicions',
      message:
        'This operation scans all documents and compares their fingerprints. It may take several minutes: a summary will be shown at the end.',
      ok: 'Run the scan',
    },
  },
  messages: {
    published: 'Document published — visible on the showcase',
    unpublished: 'Document removed from the public showcase',
    deleted: 'Document deleted from the collection',
    analysisDone: 'Plagiarism scan completed',
    analysisSummaryTitle: 'Scan completed',
    analysisSummaryLine: '{analysed} document(s) analyzed — {suspicions} suspicion(s) detected.',
  },
};
