/** Namespace `cites`. */
export default {
  title: 'Cités universitaires',
  subtitle:
    'Attribution transparente des chambres — critères sociaux et mérite, pilotée avec le rectorat (Centre des Œuvres Universitaires)',
  tabs: {
    residences: 'Résidences',
    chambres: 'Chambres',
    attributions: 'Attributions',
  },
  actions: {
    newResidence: 'Nouvelle résidence',
    newChambre: 'Nouvelle chambre',
    newAttribution: 'Nouvelle attribution',
  },
  chips: {
    recherche: '« {q} »',
  },
  common: {
    status: {
      active: 'Active',
      inactive: 'Inactive',
    },
  },
  residences: {
    filters: {
      placeholder: 'Rechercher (code, nom, ville, responsable…)',
      capaciteMin: 'Capacité min',
      etat: 'État',
      etatToutes: 'Toutes',
      etatActives: 'Actives',
      etatInactives: 'Inactives',
      ville: 'Ville',
    },
    table: {
      columns: {
        ville: 'Ville',
        responsable: 'Responsable',
        statut: 'État',
      },
      aria: {
        voirChambres: 'Voir les chambres de cette résidence',
        modifier: 'Modifier la résidence',
        supprimer: 'Supprimer la résidence',
      },
      tooltip: {
        voirChambres: 'Voir ses chambres',
      },
    },
    emptyState: {
      title: 'Aucune résidence pour ces critères.',
      hint: 'Une résidence porte les chambres ; les chambres portent les attributions.',
    },
    card: {
      capacite: 'Capacité : {n} lits',
      libres: '{n} libres',
      reservees: '{n} réservées',
      occupees: '{n} occupées',
      noResponsable: 'Aucun responsable renseigné',
    },
    dialogs: {
      form: {
        titleEdit: 'Modifier la résidence',
        titleNew: 'Nouvelle résidence',
        capacity: 'Capacité (lits)',
        responsibilitySection: 'Localisation et responsabilité',
        managerHint: 'Gestionnaire chargé de la résidence et de la remise des clés',
        active: 'Résidence active',
        saved: 'Résidence enregistrée',
      },
      delete: {
        title: 'Supprimer la résidence',
        message: 'Supprimer définitivement {nom} ({code}) ?',
      },
      deleted: 'Résidence supprimée',
    },
    chips: {
      capaciteMin: '≥ {n} lits',
      ville: 'Ville : {ville}',
    },
  },
  chambres: {
    filters: {
      placeholder: 'Rechercher (code de chambre…)',
      residence: 'Résidence',
    },
    table: {
      columns: {
        residence: 'Résidence',
        lits: 'Lits',
        loyer: 'Loyer',
      },
      aria: {
        voirAttributions: 'Voir les attributions de cette chambre',
        modifier: 'Modifier la chambre',
        supprimer: 'Supprimer la chambre',
      },
      tooltip: {
        voirAttributions: "Qui l'occupe ? (attributions)",
      },
    },
    emptyState: {
      title: 'Aucune chambre pour ces critères.',
      hint: 'Chaque chambre appartient à une résidence et porte son loyer.',
    },
    card: {
      litSingular: 'lit',
      litPlural: 'lits',
    },
    dialogs: {
      form: {
        titleEdit: 'Chambre {code}',
        titleNew: 'Nouvelle chambre',
        residenceLabel: 'Résidence *',
        categoryLabel: 'Catégorie *',
        statusLabel: 'Statut *',
        monthlyRent: 'Loyer par mois',
        currencyHint: 'Facturation future via Mobile Money (module paiement)',
        saved: 'Chambre enregistrée',
      },
      delete: {
        title: 'Supprimer la chambre',
        message: 'Supprimer définitivement la chambre {code} ?',
      },
      deleted: 'Chambre supprimée',
    },
    chips: {
      residence: 'Résidence : {code}',
    },
  },
  attributions: {
    dialog: {
      note: 'La demande est étudiée sur justificatif (critères sociaux et mérite) ; seule la direction prend la décision.',
      roomLabel: 'Chambre *',
      studentSearch: 'Rechercher un étudiant (matricule, nom, prénom)',
      studentsUnavailable: 'Le registre des étudiants est momentanément indisponible.',
      criteriaTitle: 'Critères sociaux et mérite',
      scoreLabel: 'Score (0 à 100)',
      proofHint: 'Justificatif social ou de mérite (bourse, orphelinat, classement…)',
      rentNotice: 'Loyer mensuel : {loyer} {devise}',
      saved: 'Demande enregistrée — chambre réservée',
    },
    filters: {
      residence: 'Résidence',
      etudiant: 'Recherche étudiant (matricule, nom)',
    },
    table: {
      columns: {
        demandeLe: 'Demandé le',
        chambre: 'Chambre',
      },
      aria: {
        decider: "Décider de l'attribution",
        retirer: "Retirer l'attribution",
        voirEtudiant: "Voir l'étudiant attributaire",
      },
      tooltip: {
        decider: 'Décider',
        voirEtudiant: "Voir l'étudiant",
      },
    },
    emptyState: {
      title: 'Aucune attribution pour ces critères.',
      hint: "Une demande naît « en attente », puis le jury l'accorde ou la refuse.",
    },
    card: {
      chambreLabel: 'Chambre {code} — {residence}',
      demandeLe: 'Demandé le {date}',
      score: 'Score :',
      decider: 'Décider',
      deciderTooltip: 'Accorder ou refuser',
      retirerTooltip: "Retirer l'attribution",
      etudiantTooltip: "Voir la fiche de l'étudiant",
    },
    chips: {
      residence: 'Résidence : {code}',
      etudiant: 'Étudiant : {etudiant}',
    },
    dialogs: {
      decision: {
        title: 'Décision du jury',
        chambreLabel: 'Chambre {code} ({residence})',
        scoreLabel: '· score {score}',
        optionAccorder: 'Accorder la chambre',
        optionRefuser: 'Refuser la demande',
        infoAccorder: "La chambre passera {statut} et l'étudiant sera notifié.",
        infoRefuser: 'La chambre redeviendra {statut} et la demande sera classée.',
        statutOccupee: 'OCCUPÉE',
        statutLibre: 'LIBRE',
        motifLabel: 'Motif (optionnel)',
        accorder: 'Accorder',
        refuser: 'Refuser',
      },
      retirer: {
        title: 'Retirer l’attribution',
        message: 'Retirer l’attribution de {etudiant} pour la chambre {code} ({residence}) ?',
        motifLabel: 'Motif du retrait (facultatif)',
      },
      etudiantDetail: {
        chambreLine: '\nChambre : {code} ({residence})',
        message: 'Matricule : {matricule}\nTéléphone : {telephone}\nE-mail : {email}{chambre}',
      },
      accorded: 'Attribution accordée — chambre occupée',
      refused: 'Demande refusée',
      withdrawn: 'Attribution retirée',
    },
    notify: {
      attributionsOfResidence: 'Attributions de la résidence — repérez la chambre {code}',
    },
  },
};
