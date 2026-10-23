/** Namespace `patrimoine` — page PatrimoinePage.vue (equipment inventory). */
export default {
  title: "Inventory and repairs",
  subtitle:
    "The university's equipment inventory. Every item carries an inventory QR code, an acquisition value and a repair log that follows it from commissioning to retirement.",
  actions: {
    newEquipment: 'New equipment',
    newCategory: 'New category',
  },
  equipmentDialog: {
    title: {
      edit: 'Edit equipment',
      new: 'New equipment',
    },
    subtitle: {
      edit: 'Update the record: serial number, assignment, and value. Existing repair records remain attached.',
      new: 'The equipment is added to the inventory. Its obsolescence period feeds the Rectorate report.',
    },
    sections: {
      assignment: 'Assignment',
      acquisition: 'Acquisition & obsolescence',
    },
    fields: {
      labelHint: 'E.g. Epson S41 projector',
      serial: 'Serial number *',
      serialHint: 'Printed on the manufacturer’s plate',
      inventoryNumber: 'Inventory no. *',
      inventoryHint: 'PAT-YYYY-NNNNN — leave blank to generate',
      category: 'Category *',
      acquisitionDate: 'Acquisition date',
      value: 'Value (GNF)',
      valueHint: 'Purchase cost',
      obsolescence: 'Obsolescence (months)',
      obsolescenceHint: '60 by default',
      active: 'Equipment in service',
    },
    messages: {
      updated: 'Equipment updated',
      created: 'Equipment added to the inventory',
    },
  },
  links: {
    rectoratLabel: 'Rectorate dashboard',
    rectoratHelp: 'The obsolescences below, in the leadership overview',
    helpdeskLabel: 'IT support',
    helpdeskHelp: 'Incidents reported on these same equipment items',
    sallesLabel: 'Rooms',
    sallesHelp: 'The places where the equipment is assigned',
  },
  summary: {
    inService: 'equipment in service',
    acquisitionValue: 'acquisition value {value} GNF',
    inRepair: 'under repair',
    inRepairCaption: 'log open, item unavailable',
    obsolete: 'obsolete',
    obsoleteCaption: 'age beyond their category\'s amortization period',
  },
  tabs: {
    equipments: 'Equipment',
    categories: 'Categories',
    repairs: 'Repairs',
  },
  equipments: {
    searchPlaceholder: 'Search (name, serial no., inventory no., QR…)',
    filters: {
      noDepartment: 'No department',
      statusInService: 'In service',
      statusOutOfService: 'Out of service',
      repairStateInRepair: 'Under repair',
      repairStateAvailable: 'Available',
    },
    state: {
      inRepair: 'Under repair',
      inService: 'In service',
      outOfService: 'Out of service',
    },
    table: {
      columns: {
        equipment: 'Equipment',
        value: 'Value',
        serial: 'Serial no.',
      },
      actions: {
        detailsAria: 'Details of {name}',
        detailsTooltip: 'Details and repair log',
        printAria: 'Print the label for {name}',
        printTooltip: 'Inventory label (A4)',
        declareRepairAria: 'Report a repair for {name}',
        declareRepairTooltip: 'Report a repair',
        editAria: 'Edit {name}',
        deleteAria: 'Delete {name}',
      },
    },
    cards: {
      labelTooltip: 'A4 label',
    },
    emptyState: {
      title: 'No equipment',
      description: "The inventory lists the university's equipment, item by item.",
      noneMatchFilters: 'None match the current filters.',
      removeFilters: 'Remove filters',
      createFirst: 'Register the first equipment',
    },
  },
  categories: {
    table: {
      columns: {
        amortization: 'Amortization (months)',
        equipments: 'Equipment',
      },
      actions: {
        editAria: 'Edit category {name}',
        deleteAria: 'Delete category {name}',
      },
    },
    emptyState: {
      title: 'No category',
      description:
        "A category groups a type of equipment and carries its amortization period: it is what decides when an equipment item becomes obsolete. Without a category, no equipment can be registered.",
      createFirst: 'Create the first category',
    },
    dialog: {
      editTitle: 'Edit category',
      newTitle: 'New category',
      codeHint: 'E.g.: VIDEO, MICRO, ORDI',
      labelHint: 'E.g.: Projector',
      amortizationLabel: 'Amortization period (months)',
      amortizationHint: 'E.g.: 60 (5 years)',
      cancel: 'Cancel',
    },
    confirmDelete: {
      title: 'Delete this category?',
      message: '"{name}" — will be refused if equipment items are still attached to it.',
    },
  },
  repairs: {
    inProgressTitle: 'Ongoing repairs',
    delayCaption: 'Delay badge: green < 7 days, orange < 30 days, red beyond',
    table: {
      columns: {
        equipment: 'Equipment',
        declaredOn: 'Declared on',
        delay: 'Delay',
      },
      delayDays: '{count} d',
      resolveAria: 'Close the repair for {name}',
      resolveTooltip: 'Mark the repair as resolved',
      fallbackEquipmentName: 'the equipment',
    },
    status: {
      declared: 'Declared',
      inProgress: 'In progress',
      done: 'Done',
      cancelled: 'Cancelled',
    },
    emptyState: {
      title: 'No ongoing repairs',
      description:
        "All equipment in service is available. A repair is reported from an equipment record, in the Equipment tab.",
      goToEquipments: 'Go to equipment',
    },
  },
  detailsDialog: {
    repairsTitle: 'Repair log',
  },
  deleteEquipment: {
    title: 'Delete this equipment?',
    message: '{code} — will be refused if a repair has been logged.',
  },
  messages: {
    loadInventoryError: 'Unable to load the inventory.',
    loadCategoriesError: 'Unable to load the categories.',
    loadRepairsError: 'Unable to load the repairs.',
    categoryUpdated: 'Category updated',
    categorySaved: 'Category saved',
    categorySaveError: 'Unable to save the category',
    categoryDeleted: 'Category deleted',
    deleteError: 'Unable to delete',
    equipmentDeleted: 'Equipment deleted',
    equipmentNotFound: 'Equipment not found, please reload the page.',
    repairsUnavailable: 'Repair log unavailable.',
  },
};
