/** Namespace `bulletins` — page BulletinsPage.vue (individual report cards after grade board). */
export default {
  title: 'Report cards',
  subtitle:
    'Individual report cards after the grade board: overall average weighted by credits, rank in the cohort, jury decision and honors.',
  actions: {
    deliberations: 'Grade boards',
    imprimerTous: 'Print {n} report card(s)',
  },
  filters: {
    search: 'Search by name or student ID…',
    promotion: 'Cohort',
    session: 'Session',
    decision: 'Jury decision',
  },
  chips: {
    search: '"{value}"',
    annee: 'Year: {value}',
    promo: 'Cohort: {value}',
    session: 'Session: {value}',
    decision: 'Decision: {value}',
  },
  apercu: {
    retourListe: 'Back to list',
    emettreAttestation: 'Issue certificate of completion',
  },
  guidance: {
    choisirPromotion: 'Choose a cohort',
    text: 'Report cards are read cohort by cohort. Open "Advanced filters" to select the year and cohort, or start from a grade board.',
    voirDeliberations: 'View grade boards',
  },
  banners: {
    infoImprimables: '{nbImprimables} student(s) on the grade board out of {total} enrolled shown. Only students on a grade board have a report card.',
    aucuneDeliberation: 'No grade board for this filter: report cards cannot be issued.',
    creerDeliberation: 'Create the grade board',
  },
  table: {
    columns: {
      moyenne: 'Average',
      mention: 'Honors',
      rang: 'Rank',
    },
    emptyState: 'No student for these criteria.',
    nonDelibere: 'Not graded',
    tooltips: {
      voirBulletin: 'View report card',
      imprimerOfficiel: 'Print official report card',
      aucuneDeliberationEtudiant: 'No grade board for this student',
      emettreAttestation: 'Issue certificate of completion',
    },
    ariaLabels: {
      voirBulletin: 'View report card',
      imprimerBulletin: 'Print report card',
      emettreAttestation: 'Issue a certificate of completion',
    },
  },
  cards: {
    rang: 'Rank {rang}',
    bulletin: 'Report card',
    attestation: 'Certificate',
    detailOnOfficial: 'Subject details (courses, credits, assessments) appear on the printable official report card.',
    totalCredits: 'Total credits:',
    deliberatedOn: 'Grade board date:',
    overallAverage: 'Overall average:',
    honors: 'Honors:',
    columns: {
      average: 'Average /20',
    },
  },
  messages: {
    chargementImpossible: 'Unable to load report cards',
    aucuneDeliberationEtudiant: 'No grade board for this student.',
    aucunBulletinDisponible: 'No report card available: no grade board found.',
    etudiantNonIdentifie: 'Student not identified for this enrollment.',
    bulletinsOuverts: '{n} report card(s) opened.',
  },
  dialogs: {
    imprimerPromotion: {
      title: 'Print the whole cohort',
      message: '{n} report card(s) will open in as many tabs. Allow pop-ups if your browser blocks them.',
      ok: 'Open report cards',
    },
  },
};
