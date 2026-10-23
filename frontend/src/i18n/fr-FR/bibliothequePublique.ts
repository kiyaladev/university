/** Namespace `bibliothequePublique`. */
export default {
  title: 'Bibliothèque numérique',
  subtitle:
    "Mémoires, thèses, articles et supports de cours de l'université : le dépôt institutionnel accessible à tous, pour le prestige de l'établissement et son éligibilité aux programmes AUF / UNESCO.",
  search: {
    placeholder: 'Rechercher dans tout le fonds (intitulé, mots-clés, contenu…)',
  },
  filters: {
    type: 'Type de document',
    editionYear: "Année d'édition",
  },
  emptyState: {
    filteredTitle: 'Aucun document ne correspond à votre recherche.',
    filteredHint: 'Essayez un mot-clé plus court, ou élargissez le type et le département.',
    clearSearch: 'Effacer la recherche',
    noDocsTitle: 'Le fonds ne contient encore aucun document publié.',
    noDocsHint:
      'Les mémoires, thèses et supports de cours apparaîtront ici dès leur mise en ligne par la bibliothèque.',
  },
  card: {
    year: 'année {year}',
    downloadsTitle: '{count} téléchargement(s)',
    sizeMo: '{size} Mo',
  },
  table: {
    columns: {
      document: 'Document',
      downloads: 'Téléchargements',
    },
  },
  footer:
    "La consultation et le téléchargement sont libres et gratuits. La numérisation des fonds papier fait l'objet d'un marché distinct.",
};
