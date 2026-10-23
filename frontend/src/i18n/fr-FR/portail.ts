/** Namespace `portail` — page PortailPage.vue (espace étudiant : dossier, résultats, portefeuille resto). */
export default {
  actions: {
    home: 'Retour à mon accueil',
    logout: 'Se déconnecter',
    view: 'Voir',
    recharge: 'Recharger',
  },
  otherRole: {
    title: 'Espace étudiant',
    message:
      'Cette vue est réservée aux comptes étudiants, ouverts par connexion par SMS depuis le portail étudiant.',
  },
  errorState: {
    title: 'Dossier indisponible',
  },
  header: {
    subtitle: 'Mon espace',
    greeting: 'Bonjour, {prenom}',
    matricule: 'Matricule {matricule}',
  },
  nav: {
    title: 'Accès utiles',
  },
  services: {
    maCarte: { label: 'Ma carte étudiante', help: 'Carte numérique, QR code et code personnel' },
    demandesDocuments: { help: 'Documents scolaires et réclamations' },
    vote: { label: 'Voter', help: 'Élections des délégués et résultats proclamés' },
    bibliotheque: { label: 'Bibliothèque numérique', help: 'Mémoires, thèses et supports de cours' },
    formations: { label: 'Formation continue', help: 'Catalogue des formations ouvertes à l’inscription' },
  },
  sections: {
    inscription: {
      title: 'Inscription',
      promotion: 'Promotion',
      empty: 'Aucune inscription enregistrée.',
    },
    frais: {
      title: "Frais d'inscription",
      paye: 'Payé',
      restant: 'Restant',
      empty: 'Aucun frais pour cette année.',
    },
    paiements: {
      empty: 'Aucun paiement enregistré.',
    },
    resultat: {
      rankTooltip: 'Rang dans la promotion',
      rank: 'rang {rang}',
      empty: 'Aucun résultat publié pour le moment. Les délibérations validées par le jury apparaîtront ici.',
    },
    attestations: {
      title: 'Attestations',
      revoked: 'révoquée',
      viewTooltip: "Ouvrir l'impression de l'attestation (nouvel onglet)",
      empty: 'Aucune attestation émise. Demandez un certificat de scolarité ou un relevé depuis',
      emptyLink: 'Mes demandes de documents',
      note: "Chaque attestation porte un QR code : n'importe qui peut en vérifier l'authenticité sur la page",
      noteLink: "Vérification d'attestation",
    },
    resto: {
      title: 'Portefeuille resto',
      description:
        'Le solde sert au restaurant universitaire : scannez votre carte au guichet à chaque repas. Rechargez par Mobile Money et le solde est crédité après confirmation du guichet.',
      empty: 'Aucune activité pour le moment.',
      rechargeLabel: 'Recharge — {statut}',
    },
  },
  dialogResto: {
    title: 'Recharger le portefeuille resto',
    montantLabel: 'Montant (GNF)',
    montantHint: 'Minimum 500 GNF',
    montantError: "Saisissez un montant d'au moins 500 GNF",
    operateurLabel: 'Opérateur Mobile Money',
    note:
      'Vous paierez par Mobile Money : une référence vous sera communiquée pour le transfert. Le solde est crédité après confirmation du guichet.',
    submit: 'Demander le paiement',
  },
  loading: 'Chargement de votre dossier…',
  messages: {
    loadError: 'Votre dossier n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez.',
    rechargeInfo: 'Recharge {reference} en attente — suivez les instructions de paiement',
  },
  paymentHistory: 'Historique des paiements',
  otherServices: 'Autres services',
};
