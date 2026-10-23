/** Namespace `attestations`. */
export default {
  title: 'Attestations',
  subtitle:
    "Documents officiels vérifiables par QR code — tout scan public est journalisé, rien ne s'efface, tout se révoque.",
  actions: {
    bulletins: 'Bulletins',
    issue: 'Émettre une attestation',
    qr: 'QR',
  },
  issueDialog: {
    subtitle: "Document officiel vérifiable par QR code — la même année, le même type et le même étudiant ne donnent qu'une attestation active.",
    studentHint: 'Tapez au moins 2 lettres : nom, prénom ou matricule',
    studentEmpty: 'Aucun étudiant trouvé',
    type: "Type d'attestation *",
    reason: 'Motif (bourse, banque, passeport…)',
    track: 'Rattachement',
    enrollment: 'Inscription liée (facultatif)',
    enrollmentHint: "Précise le parcours exact de l'étudiant",
    submit: 'Émettre',
    issued: "Attestation émise — pensez à l'imprimer avec son QR",
  },
  filters: {
    searchPlaceholder: 'Rechercher (numéro, nom, matricule)…',
    type: 'Type de document',
    promotion: 'Promotion',
    searchChip: '« {value} »',
    typeChip: 'Type : {value}',
    statusChip: 'Statut : {value}',
    yearChip: 'Année : {value}',
    promotionChip: 'Promo : {value}',
  },
  table: {
    columns: {
      parcours: 'Année / promotion',
      verifications: 'Vérifications',
    },
  },
  actionsColumn: {
    verificationsAria: 'Journal des vérifications de ce document',
    verificationsTooltip: 'Journal des vérifications de ce document',
    detailAria: 'Voir le détail et le QR du document',
    detailTooltip: 'Détail et QR du document',
    printAria: 'Imprimer le document',
    printTooltip: 'Imprimer le document A4',
    revokeAria: 'Révoquer le document',
    revokeTooltip: 'Révoquer le document',
  },
  card: {
    issuedOn: 'Émise le {date} · {count} vérification(s)',
  },
  emptyState: {
    title: 'Aucune attestation pour ces critères.',
  },
  detail: {
    bulletin: 'Bulletin',
    motif: 'Motif : {motif}',
    parcours: 'Parcours : {annee}{promotion}',
    issuedOnBy: 'Émise le {date} par {who}',
    revokedOnBy: 'Révoquée le {date} — {motif}',
    matricule: '— matricule {matricule}',
  },
  revocation: {
    title: 'Révoquer {numero}',
    warning:
      "Le QR cessera de garantir le document : l'authenticité de la révocation est elle-même vérifiable en ligne. L'opération est définitive.",
    motifLabel: 'Motif de révocation *',
    motifHint: 'Trois caractères minimum — ce motif est affiché lors des vérifications publiques',
    cancel: 'Annuler',
    confirm: 'Révoquer définitivement',
  },
  verificationsDialog: {
    title: 'Journal des vérifications',
    subtitle: '{numero} — chaque scan du QR, partout dans le monde, laisse une trace.',
    valid: 'valide',
    failed: 'échec',
    ip: 'IP : {ip}',
    ipUnknown: 'inconnue',
    empty: 'Aucune vérification enregistrée.',
  },
  messages: {
    revoked: 'Attestation révoquée — le QR ne sera plus valable',
    revokeError: 'Révocation impossible',
    loadError: 'Chargement des attestations impossible',
  },
};
