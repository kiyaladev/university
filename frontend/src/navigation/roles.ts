import type { Role } from '../types';

/**
 * Les rôles du personnel : tout le monde sauf l'étudiant.
 *
 * La liste était écrite deux fois — dans le manifeste de navigation et dans
 * la matrice des droits — et les deux copies avaient fini par diverger. Elle
 * n'a plus qu'un endroit.
 */
export const PERSONNEL: Role[] = ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'];
