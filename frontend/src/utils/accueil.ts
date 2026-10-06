import type { Role } from '../types';

export function accueilParRole(role: Role | null): string {
  switch (role) {
    case 'CONTROLEUR': return '/controle';
    case 'ENSEIGNANT': return '/mes-seances';
    case 'ETUDIANT': return '/portail';
    case 'SCOLARITE': return '/scolarite';
    default: return '/';
  }
}
