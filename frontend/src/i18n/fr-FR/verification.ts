/** Namespace `verification`. */
export default {
  nav: {
    verifyCard: 'Vérifier une carte étudiante',
    login: 'Se connecter',
  },
  title: 'Vérification d’attestation',
  subtitle:
    "Cette page publique atteste de l'authenticité d'une attestation délivrée par l'établissement : le document existe, est intact et n'a pas été révoqué. Chaque consultation est journalisée.",
  form: {
    sectionTitle: 'Saisir le numéro et le code du QR',
    numeroLabel: "Numéro d'attestation",
    numeroHint: 'Ex. ATT-2026-00001',
    qrLabel: 'Code QR de l’attestation',
    qrHint: 'Scannez le QR du document ou saisissez le code',
    qrParamsHint:
      'Le QR scanné (ou collé) est une URL : ses paramètres {ref} et {k} remplissent le formulaire automatiquement.',
    submit: 'Vérifier',
  },
  result: {
    valid: 'Attestation authentique',
    invalid: 'Attestation non valable',
    intro:
      "L'attestation {numero} existe bien dans le registre de l'établissement. Mentions vérifiées :",
    table: {
      attestation: 'Attestation',
      attestationValue: '— n° {numero}',
      etudiant: 'Étudiant',
      etudiantValue: '— matricule {matricule}',
      parcours: 'Parcours',
      motif: 'Motif',
      emiseLe: 'Émise le',
      reference: 'Référence de contrôle',
    },
    checkedAt:
      'Vérifié le {date} — cette consultation a été enregistrée dans le journal du document.',
  },
  footer:
    'La vérification est gratuite et ne requiert aucun compte. Une attestation révoquée ou un numéro inconnu ne prouve rien — méfiance.',
  errors: {
    serviceUnavailable:
      "La vérification n'a pas pu aboutir : le service est momentanément indisponible. Réessayez dans un instant.",
  },
};
