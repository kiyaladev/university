/** Namespace `notifications` — NotificationsPage.vue (SMS broadcast). */
export default {
  header: {
    title: 'SMS Notifications',
    subtitle:
      'The only channel that reaches a student without an internet connection: general notices and deliberation results. Every send is logged, with its reason, recipient and outcome.',
    queued: 'Queued: {n}',
    tooltip: 'Sent {envoyees} · Failed {echouees}',
  },
  tabs: {
    diffusion: 'Broadcast',
    historique: 'History',
  },
  broadcast: {
    generalNotice: {
      title: 'General notice',
      recipientsLabel: 'Recipients',
      numbersLabel: 'Numbers, one per line (or comma-separated)',
      numbersInvalid: 'Some numbers look invalid',
      messageLabel: 'Message',
      messageRequired: 'The message is required',
      messageHint: 'An SMS fits in 160 characters',
      recipientsEstimated: 'Estimated number of recipients: {n}',
      numbersEntered: '{n} number(s) entered',
      deliberationBroadcast: 'Broadcasting the results of the selected deliberation',
      testSend: 'Test send',
      send: 'Send',
    },
    deliberationResults: {
      title: 'Deliberation results',
      help: 'Every student marked PASSED or DEFERRED in the deliberation receives their average and decision by SMS, at the number on file. Only deliberations validated by the board can be broadcast.',
      selectLabel: 'Validated deliberation',
      submit: 'Broadcast results',
    },
    motifs: {
      avis: 'Notice',
      resultats: 'Results',
      inscription: 'Enrollment',
      convocation: 'Summons',
      autre: 'Other',
    },
    recipientOptions: {
      tous: 'All enrolled students (current year)',
      numeros: 'Manually entered numbers',
      resultatsDeliberation: 'Deliberation results',
    },
    summary: {
      recipients: 'Recipients',
      sent: 'Sent',
      failed: 'Failed',
    },
  },
  history: {
    searchPlaceholder: 'Search (phone, name, message…)',
    countLabel: '{n} send(s) — {periode}.',
    period: {
      range: 'from {debut} to {fin}',
      since: 'since {debut}',
      until: 'until {fin}',
      all: 'entire history',
    },
    chart: {
      title: 'Breakdown of the last 30 days',
      subtitle: 'All logged sends, regardless of the filter on the register below',
      series: {
        enFile: 'Queued',
        envoyes: 'Sent',
        echoues: 'Failed',
      },
      summaryAria: 'Breakdown of sends over 30 days: {envoyes} sent, {echoues} failed, {attente} queued.',
    },
    table: {
      columns: {
        destinataire: 'Recipient',
        message: 'Message',
        envoyePar: 'Sent by',
      },
      resendAria: 'Resend the SMS to {telephone}',
      resendTooltip: 'Resend this message',
    },
    emptyState: {
      title: 'No sends logged',
      detail: 'The register keeps a trace of every SMS sent from UniPrésence.',
      noneMatchFilters: 'None match the current filters.',
      startBroadcast: 'Send a notice from the Broadcast tab to get started.',
      goToBroadcast: 'Go to broadcast',
    },
  },
  messages: {
    confirmSendTitle: 'Confirm sending',
    confirmSendMessage: 'You are about to send an SMS to {n} recipient(s). Continue?',
    confirmSendOk: 'Send',
    enterAtLeastOneNumber: 'Enter at least one number.',
    sentSummary: '{envoyees} SMS sent{echoueesSuffix}.',
    sentSummaryFailedSuffix: ', {n} failed',
    enterMessageBeforeTest: 'Enter a message before testing.',
    testSentSummary: 'Test sent to {total} number(s): {envoyees} received.',
    resultsBroadcastSummary: 'Results broadcast: {envoyees} sent, {echouees} failed.',
    resendFailedAgain: 'Resend to {telephone}: failed again.',
    resendSuccess: 'Message resent to {telephone}.',
  },
};
