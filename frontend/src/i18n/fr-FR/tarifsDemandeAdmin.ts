/** Namespace `tarifsDemandeAdmin`. */
export default {
  _namespace: 'tarifsDemandeAdmin',
  title: 'Tarifs des demandes',
  subtitle:
    'Chaque type de document (attestation de scolarité, relevé de notes, duplicata…) est facturé au tarif paramétré ici. Le montant et le délai annoncés à l\'étudiant au moment de sa demande en dépendent.',
  actions: {
    document_requests: 'Demandes de documents',
    new_tariff: 'Nouveau tarif',
    all_types_have_tariff: 'Tous les types de document ont déjà un tarif : modifiez-le.',
  },
  errors: {
    role_forbidden: 'Cette page est réservée à l\'administrateur. Vous êtes connecté en {role}.',
    save_error: 'Enregistrement impossible',
  },
  table: {
    empty: 'Aucun tarif enregistré. Tant qu\'un type n\'a pas de tarif, les demandes des étudiants sont créées sans frais et passent directement en traitement.',
    columns: {
      delay: 'Délai',
    },
    edit_aria: 'Modifier le tarif',
  },
  dialog: {
    edit_title: 'Modifier le tarif',
    new_title: 'Nouveau tarif',
    type_hint: 'Le type est figé après création',
    type_required: 'Type requis',
    amount_required: 'Montant requis',
    delay_label: 'Délai habituel (heures)',
    delay_required: 'Délai requis',
    cancel: 'Annuler',
  },
  messages: {
    updated: 'Tarif mis à jour',
    created: 'Tarif créé',
  },
};
