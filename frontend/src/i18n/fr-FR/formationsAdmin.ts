/** Namespace `formationsAdmin` — page Formation continue (admin). */
export default {
  title: 'Formation continue',
  subtitle:
    "Gestion du hub : les formations se publient sur la vitrine, se remplissent et se confirment au guichet (mode pilote). La scolarité remet ensuite l'attestation de formation. Vous voyez ici le catalogue complet, brouillons compris.",
  actions: {
    seeShowcase: 'Voir la vitrine publique',
    seeShowcaseTooltip: 'Page consultée par les candidats — formations publiées uniquement',
    newFormation: 'Nouvelle formation',
    reload: 'Recharger',
    registrations: 'Inscriptions',
  },
  dialog: {
    title: {
      edit: 'Modifier la formation',
      create: 'Nouvelle formation',
    },
    subtitle: 'Toute formation naît en brouillon : rien ne se vend avant publication. Dès la première inscription confirmée, le titre et le prix se figent.',
    sections: {
      presentation: 'Présentation',
      price: 'Tarif',
      schedule: 'Déroulement',
    },
    fields: {
      title: 'Titre de la formation *',
      titleHint: 'Ex. : Certification professionnelle en comptabilité',
      categoryHint: 'Ex. : Informatique, Gestion, Santé…',
      location: 'Lieu / district',
      locationHint: 'Campus, salle, faculté…',
      price: 'Prix (GNF) *',
      currency: 'Devise',
      duration: 'Durée (heures)',
      capacity: 'Capacité (places)',
      capacityHint: 'Vide = accès libre',
    },
    messages: {
      updated: 'Formation mise à jour',
      created: 'Formation enregistrée — pensez à la publier',
    },
  },
  filters: {
    searchPlaceholder: 'Rechercher (titre, catégorie, lieu…)',
    status: 'Statut',
    searchChip: '« {query} »',
  },
  stats: {
    trained: 'Formés (inscriptions confirmées)',
    revenue: 'Recette encaissée',
    fillRate: 'Taux de remplissage',
    total: 'Formations',
  },
  table: {
    columns: {
      formation: 'Formation',
      status: 'Statut',
      price: 'Prix',
      duration: 'Durée',
      capacity: 'Places',
      registered: 'Inscrits',
      revenue: 'Recette',
    },
    free: 'Gratuite',
    unlimited: 'Libre',
    requestsCount: '{count} demandes',
    paidCount: '{count} payé(s)',
    tooltips: {
      publish: 'Publier la formation',
      publishShort: 'Publier',
      close: 'Clôturer',
      edit: 'Modifier',
      registrations: 'Inscriptions',
      delete: 'Supprimer le brouillon',
      deleteShort: 'Supprimer',
    },
    aria: {
      publish: 'Publier la formation',
      close: 'Clôturer la formation',
      edit: 'Modifier la formation',
      registrations: 'Voir le registre des inscriptions',
      delete: 'Supprimer le brouillon',
    },
  },
  registry: {
    title: 'Registre — {title}',
    columns: {
      fileNumber: 'N° dossier',
      registrant: 'Inscrit(e)',
      request: 'Demande',
      amount: 'Montant',
      payment: 'Paiement',
    },
    tooltips: {
      confirmPayment: 'Confirmer le paiement',
      cancelRequest: 'Annuler la demande',
      printCertificate: "Confirmation d'inscription",
    },
    aria: {
      confirmPayment: 'Confirmer le paiement',
      cancelRequest: 'Annuler la demande',
      printCertificate: "Imprimer la confirmation d'inscription",
    },
  },
  card: {
    remainingSeats: '{count} / {capacity} places',
    unlimitedSeats: 'Places illimitées',
  },
  emptyState: {
    title: 'Aucune formation pour ces critères.',
    description:
      'Une formation naît en brouillon, puis se publie pour apparaître sur la vitrine publique.',
  },
  dialogs: {
    publish: {
      title: 'Publier cette formation ?',
      message:
        '« {title} » entre en vitrine publique : les demandes et les paiements Mobile Money deviendront possibles.',
      confirm: 'Publier',
    },
    close: {
      title: 'Clôturer cette formation ?',
      message:
        "La vitrine cessera d'offrir « {title} » ; les demandes en attente ne pourront plus être confirmées. Le circuit de la promotion devient officiel.",
      confirm: 'Clôturer',
    },
    delete: {
      title: 'Supprimer ce brouillon ?',
      message: '« {title} » ne s\'est jamais vendu : sa suppression ne laisse aucune trace client.',
      confirm: 'Supprimer',
    },
    confirmPayment: {
      title: 'Confirmer le paiement ?',
      message:
        "Confirmation pilote : l'opérateur Mobile Money a encaissé — {reference} passe REUSSI et la demande {numero} passe CONFIRMEE.",
      paymentFallback: 'le paiement',
      confirm: 'Confirmer',
    },
    cancelRequest: {
      title: 'Annuler cette demande ?',
      message: 'La demande {numero} sera annulée ; sa place est libérée pour la vitrine.',
      cancel: 'Non, garder',
      confirm: 'Annuler la demande',
    },
  },
  messages: {
    published: 'Formation publiée — en vente sur la vitrine',
    closed: 'Formation close — plus aucune nouvelle demande',
    draftDeleted: 'Brouillon supprimé',
    registrationConfirmed: '{numero} confirmée — place réservée',
    registrationCancelled: '{numero} annulée',
  },
};
