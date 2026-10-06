/** Namespace `bulletins` — page BulletinsPage.vue (relevés individuels après délibération). */
export default {
  title: 'Bulletins',
  subtitle:
    'Relevés individuels après délibération : moyenne générale pondérée par les crédits, rang dans la promotion, décision et mention du jury.',
  actions: {
    deliberations: 'Délibérations',
    imprimerTous: 'Imprimer les {n} bulletins',
  },
  filters: {
    search: 'Rechercher par nom ou matricule…',
    annee: 'Année académique',
    promotion: 'Promotion',
    session: 'Session',
    decision: 'Décision du jury',
  },
  chips: {
    search: '« {value} »',
    annee: 'Année : {value}',
    promo: 'Promo : {value}',
    session: 'Session : {value}',
    decision: 'Décision : {value}',
  },
  apercu: {
    retourListe: 'Retour à la liste',
    emettreAttestation: "Émettre l'attestation de réussite",
  },
  guidance: {
    choisirPromotion: 'Choisissez une promotion',
    text: 'Les bulletins se lisent promotion par promotion. Ouvrez « Filtres avancés » pour sélectionner l\'année et la promotion, ou partez d\'une délibération.',
    voirDeliberations: 'Voir les délibérations',
  },
  banners: {
    infoImprimables: '{nbImprimables} étudiant(s) délibéré(s) sur {total} inscrit(s) affiché(s). Seuls les étudiants portés à une délibération ont un bulletin.',
    aucuneDeliberation: 'Aucune délibération pour ce filtre : les bulletins ne pourront pas être édités.',
    creerDeliberation: 'Créer la délibération',
  },
  table: {
    columns: {
      matricule: 'Matricule',
      etudiant: 'Étudiant',
      moyenne: 'Moyenne',
      decision: 'Décision',
      mention: 'Mention',
      rang: 'Rang',
    },
    emptyState: 'Aucun étudiant pour ces critères.',
    nonDelibere: 'Non délibéré',
    tooltips: {
      voirBulletin: 'Voir le bulletin',
      imprimerOfficiel: 'Imprimer le bulletin officiel',
      aucuneDeliberationEtudiant: 'Aucune délibération pour cet étudiant',
      emettreAttestation: "Émettre l'attestation de réussite",
    },
    ariaLabels: {
      voirBulletin: 'Voir le bulletin',
      imprimerBulletin: 'Imprimer le bulletin',
      emettreAttestation: 'Émettre une attestation de réussite',
    },
  },
  cards: {
    rang: 'Rang {rang}',
    bulletin: 'Bulletin',
    imprimer: 'Imprimer',
    attestation: 'Attestation',
    detailOnOfficial: 'Le détail par matière (UE, crédits, épreuves) figure sur le bulletin officiel imprimable.',
    totalCredits: 'Total crédits :',
    deliberatedOn: 'Délibéré le',
    overallAverage: 'Moyenne générale :',
    honors: 'Mention :',
    columns: {
      subject: 'Matière',
      code: 'Code',
      credits: 'Crédits',
      average: 'Moyenne /20',
    },
  },
  messages: {
    chargementImpossible: 'Chargement des bulletins impossible',
    aucuneDeliberationEtudiant: 'Aucune délibération pour cet étudiant.',
    aucunBulletinDisponible: 'Aucun bulletin disponible : aucune délibération trouvée.',
    etudiantNonIdentifie: 'Étudiant non identifié pour cette inscription.',
    bulletinsOuverts: '{n} bulletin(s) ouvert(s).',
  },
  dialogs: {
    imprimerPromotion: {
      title: 'Imprimer toute la promotion',
      message: "{n} bulletin(s) vont s'ouvrir dans autant d'onglets. Autorisez les fenêtres surgissantes si votre navigateur les bloque.",
      ok: 'Ouvrir les bulletins',
    },
  },
};
