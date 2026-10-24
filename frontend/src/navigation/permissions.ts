import type { Role } from '../types';
import { PERSONNEL } from './roles';

/**
 * Matrice des droits d'action de l'interface. Elle ne fait que masquer des
 * boutons — l'API reste seule juge — mais elle doit refléter ses contrôles :
 * un bouton offert à un rôle que l'API refuse ne mène qu'à un 403.
 *
 * Les pages lisent un droit par `useAuthStore().peut('cites.gererChambres')`.
 * Les droits qui dépendent aussi d'un état (statut, propriétaire, département)
 * combinent `peut()` avec cette condition dans la page.
 *
 * Correspondance avec l'API, vérifiée par des tests :
 * - backend/src/common/permissions-front.spec.ts relie chaque droit adossé à
 *   une route à son `@Roles(...)` (lu par réflexion sur les contrôleurs) ;
 * - frontend/tests/unit/permissions.spec.ts relie les droits qui ouvrent un
 *   écran aux rôles de cet écran dans le manifeste de navigation.
 * Un droit qui n'apparaît dans aucun des deux est contrôlé par un service
 * (propriétaire, statut) ou par une route publique : son commentaire le dit.
 */

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
  'rapports.voirEtatPaiement': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  /** À combiner avec un département de rattachement. */
  'rapports.signerReleve': ['CHEF_DEPARTEMENT'],
  'affectations.supprimer': ['ADMIN', 'SCOLARITE'],
  'structure.gerer': ['ADMIN', 'SCOLARITE'],
  'structure.supprimer': ['ADMIN'],
  'salles.gerer': ['ADMIN', 'SCOLARITE'],
  'salles.supprimer': ['ADMIN'],
  /**
   * Correction d'un pointage (`PUT /controles/:id`) : administration, direction,
   * chef de département et contrôleur — les mêmes rôles que le pointage.
   */
  'pointages.corriger': ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  /** La suppression d'un pointage (`DELETE /controles/:id`) est plus rare que sa correction. */
  'pointages.supprimer': ['ADMIN', 'DIRECTION'],
  /**
   * Moyens d'attestation d'un enseignant : code personnel et empreinte. Le
   * contrôleur n'en est pas propriétaire : l'établissement les administre.
   */
  'attestation.moyens': ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'],
  /**
   * Appareils de contrôle : leur liste et leur révocation. L'enrôlement
   * (`POST /attestation/appareils`) n'est pas un droit d'écran : c'est
   * l'appareil lui-même qui le réclame à sa première connexion.
   */
  'attestation.appareils': ['ADMIN', 'DIRECTION'],

  // Scolarité
  'etudiants.gerer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'etudiants.voirValidation': ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  'inscriptions.gerer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  /** À combiner avec le statut du dossier. */
  'inscriptions.valider': ['SCOLARITE', 'ADMIN'],
  'inscriptions.annuler': ['ADMIN', 'DIRECTION'],
  'examens.creer': ['ADMIN', 'SCOLARITE'],
  'examens.demarrer': ['ADMIN', 'SCOLARITE', 'CONTROLEUR'],
  'examens.terminer': ['ADMIN', 'SCOLARITE'],
  /** Miroir du `@Roles` de `PUT /examens/:id/statut` (PLANIFIE → ANNULE). */
  'examens.annuler': ['ADMIN', 'SCOLARITE'],
  'tirage.gerer': ['ADMIN', 'SCOLARITE'],
  'evaluations.gerer': ['ADMIN', 'SCOLARITE'],
  'notes.saisir': ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
  'deliberations.saisir': ['ADMIN', 'SCOLARITE'],
  'deliberations.juger': ['ADMIN', 'DIRECTION'],
  'bulletins.voir': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'attestations.emettre': ['SCOLARITE', 'ADMIN'],
  'attestations.revoquer': ['ADMIN', 'DIRECTION'],
  'cartes.emettre': ['ADMIN', 'SCOLARITE'],
  'cartes.modifier': ['ADMIN', 'SCOLARITE'],
  'cartes.revoquer': ['ADMIN', 'DIRECTION'],
  /**
   * L'API lit aussi les demandes pour la direction (`GET /documents-demande`),
   * mais l'écran est réservé à la scolarité : la direction passe par les attestations.
   */
  'demandesDocuments.traiter': ['ADMIN', 'SCOLARITE'],
  'reclamations.ouvrirDossier': ['ADMIN', 'SCOLARITE'],
  /** L'étudiant propose son sujet depuis le portail, pas depuis cet écran. */
  'stages.creer': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  /** L'enseignant ne fait avancer que les travaux qu'il encadre (contrôle du service). */
  'stages.transitionner': ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT'],
  /** Hors de ces rôles, seul l'encadrant du travail le modifie. */
  'stages.modifierRapport': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'stages.planifierSoutenance': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'stages.constaterJury': ['ADMIN', 'DIRECTION'],
  /**
   * Choisir l'étudiant d'un travail, à sa création : l'étudiant qui propose
   * devient d'office le porteur, et la `PUT` refuse de changer de porteur.
   */
  'travaux.choisirEtudiant': ['ADMIN', 'DIRECTION', 'SCOLARITE'],

  // Finances
  /** Créer un paiement, c'est aussi encaisser une inscription : mêmes rôles que `POST /paiements`. */
  'paiements.creer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'paiements.voir': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  /** Simuler le retour du prestataire (`POST /paiements/:id/simuler`), à combiner avec le statut. */
  'paiements.simuler': ['ADMIN', 'DIRECTION'],
  'paiements.annuler': ['ADMIN', 'DIRECTION'],
  'recettes.gerer': ['ADMIN', 'SCOLARITE'],
  /**
   * Grille des tarifs d'inscription (`GET /frais/gestion`) et leur écriture
   * (`POST /frais`, `PUT /frais/:id`) : administration et scolarité.
   */
  'frais.gerer': ['ADMIN', 'SCOLARITE'],
  /** La suppression d'un tarif (`DELETE /frais/:id`) est réservée à l'administration. */
  'frais.supprimer': ['ADMIN'],
  'paie.creer': ['ADMIN', 'DIRECTION'],
  'paie.imprimer': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  /** Les quatre droits suivants se combinent avec le statut de la feuille. */
  'paie.calculer': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'paie.valider': ['ADMIN', 'DIRECTION'],
  'paie.payer': ['ADMIN'],
  'paie.supprimer': ['ADMIN'],

  // Campus
  'cites.gererResidences': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'cites.gererChambres': ['ADMIN', 'DIRECTION'],
  'cites.decider': ['ADMIN', 'DIRECTION'],
  'cites.creerAttribution': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  /** Le guichet appelle `POST /resto/valider`, route publique de la borne : choix d'interface. */
  'resto.guichet': ['CONTROLEUR', 'ADMIN', 'SCOLARITE'],
  'resto.recharger': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'resto.annuler': ['ADMIN', 'SCOLARITE', 'DIRECTION'],
  'bibliotheque.deposer': ['ADMIN', 'DIRECTION', 'SCOLARITE'],
  'plagiat.decider': ['ADMIN', 'DIRECTION'],
  'vod.editer': ['ADMIN', 'ENSEIGNANT'],
  /** Hors de ce rôle, on ne gère que les ressources qu'on a créées (contrôle du service). */
  'vod.gererToutes': ['ADMIN'],
  'reservations.reserver': ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'],
  'reservations.decider': ['ADMIN', 'DIRECTION'],
  /** Hors de ce rôle, on ne modifie que ses propres demandes (contrôle du service). */
  'reservations.modifierToutes': ['ADMIN'],
  'badges.editer': ['ADMIN', 'SCOLARITE'],
  'elections.editer': ['ADMIN', 'SCOLARITE'],
  /** L'administrateur est aussi électeur : il retrouve l'urne depuis la gestion. */
  'elections.voterDepuisGestion': ['ADMIN'],

  // Administration
  'courrier.creer': ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
  /** À combiner avec le statut du courrier. */
  'courrier.cloturer': ['ADMIN'],
  /** Parapher n'importe quelle étape du circuit ; les autres rôles, seulement la leur (contrôle du service). */
  'courrier.parapherTout': ['ADMIN', 'DIRECTION'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleAutorise(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
