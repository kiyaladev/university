/** Namespace `rapports` — page RapportsPage.vue (états ligne à ligne du registre de contrôle). */
export default {
  title: 'Rapports de présence',
  subtitle:
    "Les états ligne à ligne du registre de contrôle, sur une période choisie : qui a assuré quoi, combien d'heures, combien à payer. C'est la pièce justificative — imprimable et exportable. Les indicateurs de suivi quotidien sont dans Statistiques, la synthèse annuelle dans le Tableau de bord Rectorat.",
  filters: {
    promotion: 'Promotion',
  },
  actions: {
    reloadAria: 'Recharger les états sur la période',
    reloadTooltip: 'Recharger les états',
    export: 'Exporter {onglet} en CSV',
    exportTooltip: 'Tableur (Excel / LibreOffice) — {onglet}, {periode}',
    printPaiement: 'Imprimer l’état de paiement (A4)',
    printRegistre: 'Imprimer le registre (A4)',
    printFicheAria: 'Imprimer la fiche individuelle de {nom}',
    printFicheTooltip: 'Fiche individuelle (A4)',
  },
  releveSigne: {
    title: 'Relevé hebdomadaire signé',
    description: 'Générez le PDF des séances de votre département et signez-le.',
    action: 'Préparer le relevé',
    dialogTitle: 'Signer le relevé hebdomadaire',
    dialogHelp: 'Le relevé couvre une semaine complète, du lundi au dimanche.',
    weekStart: 'Lundi de la semaine',
    weekRange: 'Période couverte jusqu’au {end}',
    signatureLabel: 'Signature manuscrite du chef de département',
    generate: 'Signer et télécharger le PDF',
    signatureRequired: 'Ajoutez votre signature avant de générer le relevé.',
    mondayRequired: 'Choisissez un lundi comme premier jour de la semaine.',
    success: 'Le relevé signé a été téléchargé.',
    error: 'Le relevé n’a pas pu être généré. Vérifiez la semaine et réessayez.',
  },
  period: {
    analyzed: 'Période analysée : {periode} — 30 derniers jours par défaut.',
    range: 'du {debut} au {fin}',
  },
  tabs: {
    assiduite: 'Assiduité des enseignants',
    volume: 'Volume horaire',
    controleurs: 'Couverture des tournées',
    paiement: 'État de paiement',
    registre: 'Registre',
  },
  controleurs: {
    title: 'Suivi des tournées de contrôle',
    help: 'Une séance compte comme visitée dès qu’un contrôle est saisi. Le taux propre mesure celles réalisées par le contrôleur prévu.',
    unassigned: '{count} séance(s) passée(s) sans contrôleur attribué',
    emptyTitle: 'Aucune tournée attribuée sur cette période',
    emptyHelp: 'Attribuez les séances aux contrôleurs depuis leur fiche dans le registre des séances.',
    emptyAction: 'Ouvrir les séances',
    columns: {
      controller: 'Contrôleur',
      assigned: 'Séances passées attribuées',
      visited: 'Visitées',
      missed: 'Non visitées',
      byAssigned: 'Par le contrôleur prévu',
      coveredByPeer: 'Par un collègue',
      coverage: 'Couverture',
      ownRate: 'Taux propre',
    },
  },
  onglets: {
    assiduite: 'l’assiduité des enseignants',
    volume: 'le volume horaire',
    paiement: 'l’état de paiement',
    registre: 'le registre',
    defaut: 'l’onglet affiché',
  },
  assiduite: {
    total: 'Total : {planifiees} séances · présence {presence} · {heures} réalisées',
    table: {
      columns: {
        matricule: 'Matricule',
        departement: 'Départ.',
        planifiees: 'Progr.',
        controlees: 'Contr.',
        assurees: 'Assur.',
        retard: 'Retards',
      },
    },
    emptyState: {
      title: 'Aucune séance programmée sur la période',
      message:
        "L'assiduité se calcule à partir des séances de l'emploi du temps. Élargissez la période ou retirez les filtres département / promotion.",
      action: "Ouvrir l'emploi du temps",
    },
  },
  volume: {
    table: {
      columns: {
        promotion: 'Promotion',
        prevu: 'Contrat (h)',
        realise: 'Réalisé (h)',
        reste: 'Reste (h)',
        avancement: 'Avancement',
      },
    },
    emptyState: {
      title: "Aucune charge d'enseignement sur la période",
      message:
        "Le volume horaire compare les heures réalisées au contrat de chaque affectation. Sans affectation, rien à comparer.",
      action: "Ouvrir les charges d'enseignement",
    },
  },
  paiement: {
    heuresPayables: 'Heures payables sur la période',
    montantTotal: 'Montant total',
    detailLine: '{libelle} : {heures} ({seances} séances)',
    table: {
      columns: {
        matricule: 'Matricule',
        departement: 'Départ.',
        taux: 'Taux horaire',
        montant: 'Montant (GNF)',
      },
    },
    emptyState: {
      title: 'Aucune heure payable sur la période',
      message: "Seules les heures constatées lors d'un contrôle sont payables. Vérifiez la période, ou le filtre de statut ci-dessus.",
      action: 'Ouvrir le contrôle des séances',
    },
  },
  registre: {
    subtitle: 'Transcription du registre de contrôle sur la période sélectionnée',
    summary: '{total} séance(s) · {controlees} contrôlée(s) · {absences} absence(s)',
    table: {
      columns: {
        promotion: 'Promotion',
        statut: 'Constat',
        arrivee: 'Arrivée',
        effectif: 'Étud.',
        theme: 'Thème déroulé',
      },
    },
    emptyState: {
      title: 'Registre vide sur la période',
      message: 'Le registre transcrit les séances programmées, contrôlées ou non. Élargissez la période pour retrouver des lignes.',
      action: 'Ouvrir les séances',
    },
  },
};
