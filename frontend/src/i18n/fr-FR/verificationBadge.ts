/** Namespace `verificationBadge`. */
export default {
  nav: {
    verifyCard: 'Vérifier une carte',
    verifyAttestation: 'Vérifier une attestation',
  },
  title: 'Vérification de badge d’accès',
  subtitle:
    'Cette page publique atteste qu’un badge présenté à l’entrée a bien été délivré par l’établissement, qu’il n’a pas été annulé et que sa validité court toujours. Chaque consultation est journalisée.',
  form: {
    sectionTitle: 'Saisir l’identifiant et le code du QR',
    identifiantLabel: 'Identifiant du badge',
    identifiantHint: 'UUID inscrit sous le QR',
    qrLabel: 'Code QR du badge',
    qrHint: 'Scannez le QR du badge ou saisissez le code',
    qrParamsHint:
      'Le QR scanné (ou collé) est une URL : ses paramètres {badge} et {k} remplissent le formulaire automatiquement.',
  },
  result: {
    valid: 'Badge authentique',
    invalid: 'Badge non valable',
    intro: 'Le badge {numero} figure bien au registre de l’établissement. Mentions vérifiées :',
    table: {
      porteur: 'Porteur',
      numero: 'Numéro',
      qualite: 'Qualité',
      statutValue: 'Actif — non annulé, validité en cours',
      zones: 'Zones autorisées',
      delivreLe: 'Délivré le',
      valableJusquau: 'Valable jusqu’au',
    },
    checkedAt: 'Vérifié le {date} — cette consultation a été enregistrée dans le journal du badge.',
  },
  footer:
    'La vérification est gratuite et ne requiert aucun compte. Un badge annulé ou un identifiant inconnu ne prouve rien — méfiance.',
  errors: {
    serviceUnavailable:
      "La vérification n'a pas pu aboutir : le service est momentanément indisponible. Réessayez dans un instant.",
  },
};
