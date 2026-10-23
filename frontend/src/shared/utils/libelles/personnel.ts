/** Rôles des comptes et statuts des enseignants. */
import { traduireLibelles } from './traduire';
import type { Role } from '@/types';

export const LIBELLE_ROLE: Record<Role, string> = traduireLibelles('role', {
  ADMIN: 'Administrateur',
  DIRECTION: 'Direction des études',
  SCOLARITE: 'Scolarité',
  CHEF_DEPARTEMENT: 'Chef de département',
  CONTROLEUR: 'Contrôleur',
  ENSEIGNANT: 'Enseignant',
  ETUDIANT: 'Étudiant',
});

export const STATUTS_ENSEIGNANT = ['PERMANENT', 'VACATAIRE', 'CONTRACTUEL'];

export const LIBELLE_STATUT_ENSEIGNANT: Record<string, string> = traduireLibelles('statut_enseignant', {
  PERMANENT: 'Permanent',
  VACATAIRE: 'Vacataire',
  CONTRACTUEL: 'Contractuel',
});
