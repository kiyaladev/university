/** Namespace `parametres`. */
export default {
  title: 'Settings',
  subtitle: 'Rules applied when checking attendance: late tolerance, required evidence, report headers',
  actions: {
    discard: 'Discard my changes',
    save: 'Save settings',
  },
  banner: {
    unsavedChanges: 'Unsaved changes — they will only apply once saved.',
  },
  groups: {
    etablissement: {
      title: 'Institution',
      hint: 'Identity used in the header of all printed reports.',
    },
    tolerances: {
      title: 'Time tolerances',
      hint: 'From when a teacher is considered late, absent, or their session not held.',
    },
    preuves: {
      title: 'Evidence required for check-in',
      hint: 'What the checker must provide for a check-in to be valid.',
    },
    autres: {
      title: 'Other settings',
      hint: 'Keys specific to this institution.',
    },
  },
  fields: {
    NOM_ETABLISSEMENT: 'Institution name',
    TOLERANCE_RETARD_MIN: 'Tolerance before lateness (minutes)',
    ABSENCE_APRES_MIN: 'Absence recorded after (minutes)',
    DUREE_MIN_VALIDE: 'Minimum duration for a held session (minutes)',
    QR_OBLIGATOIRE: 'Room QR scan required',
    GEOLOC_OBLIGATOIRE: 'GPS position required',
    ATTESTATION_OBLIGATOIRE: 'Teacher attendance statement required',
    SIGNATURE_OBLIGATOIRE: 'Handwritten signature required',
    EMPREINTE_SCORE_MIN: 'Minimum fingerprint reader score (0-100)',
    EFFECTIF_OBLIGATOIRE: 'Student headcount required',
  },
  emptyState: {
    title: 'No setting available.',
  },
  messages: {
    saved: 'Settings saved',
  },
  attendanceRules: 'Attendance rules',
};
