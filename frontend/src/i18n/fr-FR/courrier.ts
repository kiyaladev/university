/** Namespace `courrier`. */
export default {
  title: 'Courrier administratif',
  subtitle:
    'Enregistrement et circulation du courrier — chaque envoi traverse un circuit de paraphe avant d’atteindre les archives.',
  actions: {
    register: 'Enregistrer un courrier',
  },
  registrationDialog: {
    department: 'Département destinataire (facultatif)',
    departmentHint: 'Seul le chef du département choisi peut consulter et parapher. Sans département, aucun chef ne reçoit ce courrier.',
    ownDepartment: 'Ce courrier est adressé à votre département.',
    subtitle: "Si aucun circuit n'est saisi, le circuit par défaut (secrétariat → chef département → archives) est créé automatiquement.",
    number: 'Numéro (COUR-AAAA-XXXXX)',
    incoming: 'Entrant',
    outgoing: 'Sortant',
    sender: 'Expéditeur',
    receivedOn: 'Date de réception',
    sentOn: "Date d'envoi",
    archiveReference: 'Référence archive (optionnel)',
    attachment: 'Pièce jointe scannée (PDF/image)',
    routing: 'Circuit de paraphe',
    approverRole: 'Rôle du valideur',
    noRouting: 'Aucun circuit défini — un circuit par défaut sera appliqué.',
    addStep: 'Ajouter une étape',
    saved: 'Courrier enregistré',
  },
  tabs: {
    entrant: 'Entrants',
    sortant: 'Sortants',
    archive: 'Archives',
  },
  filters: {
    searchPlaceholder: 'Rechercher (numéro, objet, expéditeur, destinataire…)',
    searchChip: '« {value} »',
    statusChip: 'Statut : {value}',
  },
  summary: {
    tabLabel: 'Courriers {type}s',
    archiveLabel: 'Archives',
    period: 'du {debut} au {fin}',
    line: '{onglet} · {periode} — 90 derniers jours par défaut. {total} courrier(s).',
  },
  table: {
    columns: {
      objet: 'Objet',
      correspondant: 'Expéditeur / Destinataire',
      circuit: 'Circuit',
    },
    steps: '{count} étape(s)',
  },
  card: {
    from: 'De : {value}',
    to: 'À : {value}',
    stamps: '{count} paraphe(s)',
    print: 'Imprimer le bordereau',
  },
  detail: {
    sender: 'Expéditeur : {name}',
    recipient: 'Destinataire : {name}',
    approver: 'Valideur',
    stampedOn: 'Paraphé le',
    stamp: 'Parapher',
    noWorkflow: 'Aucun circuit défini',
    stampStep: 'Parapher l’étape {order}',
    signatureHash: 'Empreinte du paraphe (SHA-256, optionnel)',
    status: { received: 'Reçu', inWorkflow: 'En circuit', processed: 'Traité', filed: 'Classé', archived: 'Archivé' },
    stamped: 'Paraphe enregistré',
    stampOnStep: 'Le paraphe se fait sur une étape du circuit',
    closeMessage: 'Clôturer « {number} » et avancer vers {next} ?',
  },
  actionsColumn: {
    detailAria: 'Détail du courrier {numero}',
    detailTooltip: 'Détail / parapher',
    printAria: 'Imprimer le bordereau du courrier {numero}',
    printTooltip: 'Imprimer le bordereau (A4)',
    closeAria: 'Clôturer le courrier {numero}',
    closeTooltip: 'Clôturer / archiver',
  },
  emptyState: {
    archiveTitle: 'Aucun courrier archivé',
    typeTitle: 'Aucun courrier {type}',
    archiveHint:
      'Un courrier rejoint les archives une fois classé puis clôturé. Élargissez la période, ou suivez les circuits encore ouverts dans les onglets Entrants et Sortants.',
    typeHint:
      'Aucun courrier {type} {periode}. Élargissez la période ou retirez les filtres avancés.',
  },
  dialogs: {
    close: {
      title: 'Clôturer le courrier',
      message:
        'Confirmer la clôture de « {numero} » ? Cette transition avance vers les archives (CLASSE → ARCHIVE).',
    },
  },
  messages: {
    closed: 'Courrier clôturé',
  },
};
