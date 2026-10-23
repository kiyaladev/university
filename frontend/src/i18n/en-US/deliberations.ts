/** Namespace `deliberations` — DeliberationsPage.vue page (jury deliberations, admin view). */
export default {
  title: 'Deliberations',
  subtitle:
    'Jury sessions: credit-weighted averages, decisions ADMIS / AJOURNÉ / DÉFAILLANT, then transcript issuance.',
  actions: {
    newDeliberation: 'New deliberation',
    reportCards: 'Transcripts',
    validateJury: 'Validate jury',
    pv: 'Minutes',
  },
  createDialog: {
    session: 'Session *',
    sessionHint: 'For a resit, only students who failed the regular session are rescheduled.',
    draftHint: 'The deliberation starts as a draft: averages are calculated automatically, then approved by the jury (management).',
    previewTitle: 'Sample transcript preview',
    previewDecision: 'PASSED / RESIT',
    previewHint: 'Grades and the decision are entered after calculation.',
    sampleSubject: 'Subject {number}',
    sampleName: 'Sample',
    selectedPromotion: 'Selected cohort',
    selectedYear: 'Selected year',
    created: 'Deliberation created and averages calculated',
  },
  filters: {
    search: 'Search a cohort…',
    promotion: 'Cohort',
    session: 'Session',
  },
  chips: {
    search: '“{value}”',
    annee: 'Year: {value}',
    promo: 'Cohort: {value}',
    session: 'Session: {value}',
    statut: 'Status: {value}',
  },
  table: {
    columns: {
      promotion: 'Cohort',
      session: 'Session',
      taux: 'Pass rate',
    },
    detailColumns: {
      rang: 'Rank',
      moyenne: 'Average',
      mention: 'Honors',
    },
  },
  emptyState: {
    message: 'No deliberation matches these criteria.',
  },
  tooltips: {
    detail: 'Line detail',
    recalculate: 'Recalculate averages and decisions',
    reportCards: 'Transcripts for this cohort',
    printPv: 'Print the minutes',
    bulletinIndividuel: 'Individual transcript',
  },
  ariaLabels: {
    detail: 'View deliberation detail',
    recalculate: 'Recalculate averages and decisions',
    printPv: 'Print the deliberation minutes',
    reportCards: 'View transcripts for this deliberation',
    close: 'Close the detail',
    printBulletin: 'Print the individual transcript',
  },
  detail: {
    title: 'Deliberation — {promotion}',
    emptyLines: 'No lines: run the recalculation to produce averages and decisions.',
  },
  dialogs: {
    recalculate: {
      title: 'Recalculate the deliberation',
      message:
        'Course unit averages (weighted by coefficients), the overall average (weighted by credits), decisions, ranks and pass rate will be recalculated from the current grades.',
      ok: 'Recalculate',
    },
    validate: {
      title: 'Validate the jury results',
      message: `The decision follows the written rules:

        overall average = Σ(course unit average × credits) / Σ(credits);
        ADMIS (pass) if the overall average ≥ 10 and no subject below 5/20 due to absence;
        DÉFAILLANT (failing) if a subject has no grade for a closed assessment;
        AJOURNÉ (deferred) otherwise — on resit, only AJOURNÉ students are re-scheduled.

      After validation, any recalculation will be blocked and transcripts will become official. Continue?`,
      ok: 'Validate jury',
    },
  },
  messages: {
    recalculated: 'Deliberation recalculated',
    validated: 'Deliberation validated by the jury',
  },
};
