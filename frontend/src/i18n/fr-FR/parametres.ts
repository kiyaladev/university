/** Namespace `parametres`. */
export default {
  title: 'Paramètres',
  subtitle: 'Règles appliquées lors du pointage : tolérance de retard, preuves exigées, en-tête des états',
  actions: {
    discard: 'Annuler mes modifications',
    save: 'Enregistrer les paramètres',
  },
  banner: {
    unsavedChanges: 'Modifications non enregistrées — elles ne s’appliqueront qu’après enregistrement.',
  },
  groups: {
    etablissement: {
      title: 'Établissement',
      hint: 'Identité reprise en en-tête de tous les états imprimés.',
    },
    tolerances: {
      title: 'Tolérances horaires',
      hint: 'À partir de quand un enseignant est en retard, absent, ou sa séance non tenue.',
    },
    preuves: {
      title: 'Preuves exigées au pointage',
      hint: 'Ce que le contrôleur doit fournir pour qu’un pointage soit recevable.',
    },
    autres: {
      title: 'Autres réglages',
      hint: 'Clés propres à cet établissement.',
    },
  },
  fields: {
    NOM_ETABLISSEMENT: 'Nom de l’établissement',
    TOLERANCE_RETARD_MIN: 'Tolérance avant retard (minutes)',
    ABSENCE_APRES_MIN: 'Absence constatée après (minutes)',
    DUREE_MIN_VALIDE: 'Durée minimale d’une séance tenue (minutes)',
    QR_OBLIGATOIRE: 'Scan du QR de la salle obligatoire',
    GEOLOC_OBLIGATOIRE: 'Position GPS obligatoire',
    ATTESTATION_OBLIGATOIRE: 'Attestation de présence de l’enseignant obligatoire',
    SIGNATURE_OBLIGATOIRE: 'Signature manuscrite obligatoire',
    EMPREINTE_SCORE_MIN: 'Score minimal du lecteur d’empreintes (0-100)',
    EFFECTIF_OBLIGATOIRE: 'Comptage des étudiants obligatoire',
  },
  emptyState: {
    title: 'Aucun paramètre disponible.',
  },
  messages: {
    saved: 'Paramètres enregistrés',
  },
  attendanceRules: 'Règles de présence',
};
