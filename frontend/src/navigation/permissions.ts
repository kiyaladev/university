import type { Role } from '../types';

/**
 * Matrice des droits d'action de l'interface : relevé des listes de rôles
 * écrites en dur dans les `peut*` des pages. Elle ne fait que masquer des
 * boutons — l'API reste seule juge — mais elle doit refléter ses contrôles.
 *
 * Les pages lisent un droit par `useAuthStore().peut('cites.gererChambres')`.
 * Les droits qui dépendent aussi d'un état (statut, propriétaire, département)
 * combinent `peut()` avec cette condition dans la page.
 */
const PERSONNEL: Role[] = ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'];

export const PERMISSIONS = {
  // Présences et organisation
  'seances.pointer': ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  'seances.affecterControleur': ['ADMIN', 'SCOLARITE'],
  'referentiels.planifier': ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
  /** Le contrôleur constate les créneaux sur le terrain : il tient l'emploi du temps, sans autre référentiel. */
  'emploiDuTemps.tenir': ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR'],
  'emploiDuTemps.voirRegistre': PERSONNEL,
  'justificatifs.deposer': ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
  'justificatifs.arbitrer': ['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  'statistiques.voir': ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
  'rapports.voirCouverture': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  /** À combiner avec un département de rattachement. */
  'rapports.signerReleve': ['CHEF_DEPARTEMENT'],
  'affectations.supprimer': ['ADMIN', 'SCOLARITE'],
  'structure.gerer': ['ADMIN', 'SCOLARITE'],
  'structure.supprimer': ['ADMIN'],
  'salles.gerer': ['ADMIN', 'SCOLARITE'],
  'salles.supprimer': ['ADMIN'],

  // Scolarité
  'etudiants.gerer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'etudiants.voirValidation': ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  'inscriptions.gerer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'examens.creer': ['ADMIN', 'SCOLARITE'],
  'examens.demarrer': ['ADMIN', 'SCOLARITE', 'CONTROLEUR'],
  'examens.terminer': ['ADMIN', 'SCOLARITE'],
  'tirage.gerer': ['ADMIN', 'SCOLARITE'],
  'deliberations.saisir': ['ADMIN', 'SCOLARITE'],
  'deliberations.juger': ['ADMIN', 'DIRECTION'],
  'bulletins.voir': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'attestations.emettre': ['SCOLARITE', 'ADMIN'],
  'attestations.revoquer': ['ADMIN', 'DIRECTION'],
  'cartes.emettre': ['ADMIN', 'SCOLARITE'],
  'cartes.modifier': ['ADMIN', 'SCOLARITE'],
  'cartes.revoquer': ['ADMIN', 'DIRECTION'],
  'reclamations.ouvrirDossier': ['ADMIN', 'SCOLARITE'],
  'stages.creer': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'stages.transitionner': ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT'],
  'travaux.choisirEtudiant': PERSONNEL,

  // Finances
  /** Créer un paiement, c'est aussi encaisser une inscription : mêmes rôles que `POST /paiements`. */
  'paiements.creer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'paiements.voir': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  /** Simuler ou annuler le paiement d'une inscription (selon son statut). */
  'paiements.simulerInscription': ['ADMIN', 'DIRECTION'],
  'paiements.simulerReussite': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'recettes.gerer': ['ADMIN', 'SCOLARITE'],
  'paie.creer': ['ADMIN', 'DIRECTION'],
  'paie.imprimer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],

  // Campus
  'cites.gererResidences': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'cites.gererChambres': ['ADMIN', 'DIRECTION'],
  'cites.decider': ['ADMIN', 'DIRECTION'],
  'cites.creerAttribution': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'resto.guichet': ['CONTROLEUR', 'ADMIN', 'SCOLARITE'],
  'resto.recharger': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'bibliotheque.deposer': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'plagiat.decider': ['ADMIN', 'DIRECTION'],
  'vod.editer': ['ADMIN', 'ENSEIGNANT'],
  'reservations.reserver': ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'],
  'reservations.decider': ['ADMIN', 'DIRECTION'],
  'badges.editer': ['ADMIN', 'SCOLARITE'],
  'elections.editer': ['ADMIN', 'SCOLARITE'],
  /** L'administrateur est aussi électeur : il retrouve l'urne depuis la gestion. */
  'elections.voterDepuisGestion': ['ADMIN'],

  // Administration
  'courrier.creer': ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
  /** À combiner avec le statut du courrier. */
  'courrier.cloturer': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleAutorise(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
