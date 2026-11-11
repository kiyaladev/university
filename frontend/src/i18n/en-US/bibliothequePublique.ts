/** Namespace `bibliothequePublique`. */
export default {
  title: 'Digital library',
  subtitle: 'The university’s theses, dissertations, articles and course materials, in open access.',
  search: {
    placeholder: 'Search the whole collection (title, keywords, content…)',
  },
  filters: {
    type: 'Document type',
    editionYear: 'Publication year',
  },
  emptyState: {
    filteredTitle: 'No document matches your search.',
    filteredHint: 'Try a shorter keyword, or broaden the type and department.',
    clearSearch: 'Clear search',
    noDocsTitle: 'The collection does not contain any published document yet.',
    noDocsHint: 'Theses, dissertations and course materials will appear here as soon as the library publishes them.',
  },
  card: {
    year: 'year {year}',
    downloadsTitle: '{count} download(s)',
    sizeMo: '{size} MB',
  },
  populaires: {
    title: 'Most downloaded',
    empty: 'No document has been downloaded yet this year.',
  },
  table: {
    columns: {
      document: 'Document',
      downloads: 'Downloads',
    },
  },
  footer: 'Browsing and downloading are free and require no account.',
};
