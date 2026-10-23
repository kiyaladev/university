/** Namespace `patrimoine` — page PatrimoinePage.vue (inventaire du matériel). */
export default {
  title: 'Inventaire et réparations',
  subtitle:
    "L'inventaire des équipements de l'université. Chaque pièce porte un QR d'inventaire, une valeur d'acquisition et un carnet de réparations qui la suit de sa mise en service à sa réforme.",
  actions: {
    newEquipment: 'Nouvel équipement',
    newCategory: 'Nouvelle catégorie',
  },
  equipmentDialog: {
    title: {
      edit: 'Modifier l’équipement',
      new: 'Nouvel équipement',
    },
    subtitle: {
      edit: 'Mettez à jour la fiche : numéro de série, affectation, valeur. Les réparations déjà tracées restent attachées.',
      new: 'L’équipement entre à l’inventaire. La durée d’obsolescence sert au signalement Rectorat.',
    },
    sections: {
      assignment: 'Affectation',
      acquisition: 'Acquisition & obsolescence',
    },
    fields: {
      labelHint: 'Ex. : Vidéoprojecteur Epson S41',
      serial: 'Numéro de série *',
      serialHint: 'Inscrit sur la plaque constructeur',
      inventoryNumber: 'N° d’inventaire *',
      inventoryHint: 'PAT-AAAA-NNNNN — laissez vide pour générer',
      category: 'Catégorie *',
      acquisitionDate: 'Date d’acquisition',
      value: 'Valeur (GNF)',
      valueHint: 'Coût d’achat',
      obsolescence: 'Obsolescence (mois)',
      obsolescenceHint: '60 par défaut',
      active: 'Équipement en service',
    },
    messages: {
      updated: 'Équipement mis à jour',
      created: 'Équipement enregistré à l’inventaire',
    },
  },
  summary: {
    inService: 'équipements en service',
    acquisitionValue: "valeur d'acquisition {value} GNF",
    inRepair: 'en réparation',
    inRepairCaption: 'carnet ouvert, pièce indisponible',
    obsolete: 'obsolètes',
    obsoleteCaption: "âge supérieur à la durée d'amortissement de leur catégorie",
  },
  tabs: {
    equipments: 'Équipements',
    categories: 'Catégories',
    repairs: 'Réparations',
  },
  equipments: {
    searchPlaceholder: "Rechercher (libellé, n° série, n° d'inventaire, QR…)",
    filters: {
      noDepartment: 'Sans département',
      statusInService: 'En service',
      statusOutOfService: 'Hors service',
      repairStateInRepair: 'En réparation',
      repairStateAvailable: 'Disponible',
    },
    state: {
      inRepair: 'En réparation',
      inService: 'En service',
      outOfService: 'Hors service',
    },
    table: {
      columns: {
        equipment: 'Équipement',
        value: 'Valeur',
        serial: 'N° série',
      },
      actions: {
        detailsAria: 'Détails de {name}',
        detailsTooltip: 'Détails et carnet de réparations',
        printAria: "Imprimer l'étiquette de {name}",
        printTooltip: "Étiquette d'inventaire (A4)",
        declareRepairAria: 'Déclarer une réparation sur {name}',
        declareRepairTooltip: 'Déclarer une réparation',
        editAria: 'Modifier {name}',
        deleteAria: 'Supprimer {name}',
      },
    },
    cards: {
      labelTooltip: 'Étiquette A4',
    },
    emptyState: {
      title: 'Aucun équipement',
      description: "L'inventaire recense le matériel de l'université, pièce par pièce.",
      noneMatchFilters: 'Aucune ne correspond aux filtres en cours.',
      removeFilters: 'Retirer les filtres',
      createFirst: 'Enregistrer le premier équipement',
    },
  },
  categories: {
    table: {
      columns: {
        amortization: 'Amortissement (mois)',
        equipments: 'Équipements',
      },
      actions: {
        editAria: 'Modifier la catégorie {name}',
        deleteAria: 'Supprimer la catégorie {name}',
      },
    },
    emptyState: {
      title: 'Aucune catégorie',
      description:
        "Une catégorie regroupe un type de matériel et porte sa durée d'amortissement : c'est elle qui décide quand un équipement devient obsolète. Sans catégorie, aucun équipement ne peut être enregistré.",
      createFirst: 'Créer la première catégorie',
    },
    dialog: {
      editTitle: 'Modifier la catégorie',
      newTitle: 'Nouvelle catégorie',
      codeHint: 'Ex. : VIDEO, MICRO, ORDI',
      labelHint: 'Ex. : Vidéoprojecteur',
      amortizationLabel: "Durée d'amortissement (mois)",
      amortizationHint: 'Ex. : 60 (5 ans)',
    },
    confirmDelete: {
      title: 'Supprimer la catégorie ?',
      message: '« {name} » — refusée si des équipements y sont rattachés.',
    },
  },
  repairs: {
    inProgressTitle: 'Réparations en cours',
    delayCaption: 'Badge de délai : vert < 7 jours, orange < 30 jours, rouge au-delà',
    table: {
      columns: {
        equipment: 'Équipement',
        declaredOn: 'Déclarée le',
        delay: 'Délai',
      },
      delayDays: '{count} j',
      resolveAria: 'Clore la réparation de {name}',
      resolveTooltip: 'Marquer la réparation résolue',
      fallbackEquipmentName: 'l’équipement',
    },
    status: {
      declared: 'Déclaré',
      inProgress: 'En cours',
      done: 'Terminé',
      cancelled: 'Annulé',
    },
    emptyState: {
      title: 'Aucune réparation en cours',
      description:
        "Tout le matériel en service est disponible. Une réparation se déclare depuis la fiche d'un équipement, dans l'onglet Équipements.",
      goToEquipments: 'Aller aux équipements',
    },
  },
  detailsDialog: {
    repairsTitle: 'Carnet de réparations',
  },
  deleteEquipment: {
    title: 'Supprimer l’équipement ?',
    message: '{code} — refusée si une réparation a été consignée.',
  },
  messages: {
    categoryUpdated: 'Catégorie mise à jour',
    categorySaved: 'Catégorie enregistrée',
    categoryDeleted: 'Catégorie supprimée',
    equipmentDeleted: 'Équipement supprimé',
    equipmentNotFound: 'Équipement introuvable, rechargez la page.',
  },
};
