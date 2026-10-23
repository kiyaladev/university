/** Namespace `notifications` — page NotificationsPage.vue (diffusion de SMS). */
export default {
  header: {
    title: 'Notifications SMS',
    subtitle:
      'Le seul canal qui atteint un étudiant sans connexion : avis généraux et résultats de délibération. Chaque envoi est consigné, avec son motif, son destinataire et son sort.',
    queued: 'En file : {n}',
    tooltip: 'Envoyées {envoyees} · Échouées {echouees}',
  },
  tabs: {
    diffusion: 'Diffusion',
    historique: 'Historique',
  },
  broadcast: {
    generalNotice: {
      title: 'Avis général',
      recipientsLabel: 'Destinataires',
      numbersLabel: 'Numéros, un par ligne (ou séparés par une virgule)',
      numbersInvalid: 'Certains numéros semblent invalides',
      messageLabel: 'Message',
      messageRequired: 'Le message est requis',
      messageHint: 'Un SMS tient en 160 caractères',
      recipientsEstimated: 'Nombre de destinataires estimé : {n}',
      numbersEntered: '{n} numéro(s) saisi(s)',
      deliberationBroadcast: 'Diffusion des résultats de la délibération sélectionnée',
      testSend: "Tester l'envoi",
      send: 'Envoyer',
    },
    deliberationResults: {
      title: 'Résultats de délibération',
      help:
        'Chaque étudiant ADMIS ou AJOURNÉ inscrit dans la délibération reçoit sa moyenne et sa décision par SMS, sur le numéro de sa fiche. Seules les délibérations validées par le jury peuvent être diffusées.',
      selectLabel: 'Délibération validée',
      submit: 'Diffuser les résultats',
    },
    motifs: {
      avis: 'Avis',
      resultats: 'Résultats',
      inscription: 'Inscription',
      convocation: 'Convocation',
      autre: 'Autre',
    },
    recipientOptions: {
      tous: 'Tous les étudiants inscrits (année en cours)',
      numeros: 'Numéros saisis manuellement',
      resultatsDeliberation: 'Résultats de délibération',
    },
    summary: {
      recipients: 'Destinataires',
      sent: 'Envoyés',
      failed: 'Échoués',
    },
  },
  history: {
    searchPlaceholder: 'Rechercher (téléphone, nom, message…)',
    countLabel: '{n} envoi(s) — {periode}.',
    period: {
      range: 'du {debut} au {fin}',
      since: 'depuis le {debut}',
      until: "jusqu'au {fin}",
      all: 'tout l’historique',
    },
    chart: {
      title: 'Répartition des 30 derniers jours',
      subtitle: 'Tous les envois consignés, quel que soit le filtre du registre ci-dessous',
      series: {
        enFile: 'En file',
        envoyes: 'Envoyés',
        echoues: 'Échoués',
      },
      summaryAria:
        'Répartition des envois sur 30 jours : {envoyes} envoyé(s), {echoues} échoué(s), {attente} en file.',
    },
    table: {
      columns: {
        destinataire: 'Destinataire',
        message: 'Message',
        envoyePar: 'Émis par',
      },
      resendAria: 'Renvoyer le SMS au {telephone}',
      resendTooltip: 'Renvoyer ce message',
    },
    emptyState: {
      title: 'Aucun envoi consigné',
      detail: "Le registre garde la trace de chaque SMS parti d'UniPrésence.",
      noneMatchFilters: 'Aucun ne correspond aux filtres en cours.',
      startBroadcast: 'Diffusez un avis depuis l’onglet Diffusion pour commencer.',
      goToBroadcast: 'Aller à la diffusion',
    },
  },
  messages: {
    confirmSendTitle: "Confirmer l'envoi",
    confirmSendMessage: 'Vous allez envoyer un SMS à {n} destinataire(s). Continuer ?',
    confirmSendOk: 'Envoyer',
    enterAtLeastOneNumber: 'Saisissez au moins un numéro.',
    sentSummary: '{envoyees} SMS envoyé(s){echoueesSuffix}.',
    sentSummaryFailedSuffix: ', {n} échoué(s)',
    enterMessageBeforeTest: 'Saisissez un message avant de tester.',
    testSentSummary: 'Test envoyé à {total} numéro(s) : {envoyees} reçu(s).',
    resultsBroadcastSummary: 'Résultats diffusés : {envoyees} envoyé(s), {echouees} échoué(s).',
    resendFailedAgain: 'Renvoi au {telephone} : échec à nouveau.',
    resendSuccess: 'Message renvoyé au {telephone}.',
  },
};
