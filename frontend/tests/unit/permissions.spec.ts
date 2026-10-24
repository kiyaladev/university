import { describe, expect, it } from 'vitest';
import { PERMISSIONS, roleAutorise, type Permission } from '../../src/navigation/permissions';
import { MANIFESTE } from '../../src/navigation/manifeste';
import type { Role } from '../../src/types';

const ROLES = [
  'ADMIN',
  'DIRECTION',
  'SCOLARITE',
  'CHEF_DEPARTEMENT',
  'CONTROLEUR',
  'ENSEIGNANT',
  'ETUDIANT',
] as const satisfies readonly Role[];
// Échoue à la compilation si un rôle du type `Role` manque à la liste ci-dessus.
const exhaustif: Exclude<Role, (typeof ROLES)[number]> extends never ? true : false = true;

/**
 * Droits qui mènent à un écran : leurs rôles doivent tous y être admis,
 * sinon le bouton aboutit à la page « accès refusé ».
 * La correspondance avec les routes de l'API est vérifiée côté backend
 * (src/common/permissions-front.spec.ts).
 */
const ECRANS: Partial<Record<Permission, string[]>> = {
  'statistiques.voir': ['/statistiques'],
  'etudiants.voirValidation': ['/inscriptions'],
  'paiements.voir': ['/paiements'],
  'tirage.gerer': ['/tirage'],
  'bulletins.voir': ['/bulletins'],
  'reclamations.ouvrirDossier': ['/demandes-docs', '/cartes-etudiantes'],
  'demandesDocuments.traiter': ['/demandes-docs'],
  'plagiat.decider': ['/plagiat'],
  'elections.voterDepuisGestion': ['/elections', '/elections/vote'],
  'frais.gerer': ['/frais'],
  'frais.supprimer': ['/frais'],
  'attestation.moyens': ['/moyens-attestation'],
  'attestation.appareils': ['/moyens-attestation'],
  'pointages.corriger': ['/corrections-pointages'],
  'pointages.supprimer': ['/corrections-pointages'],
};

describe('matrice des droits', () => {
  const entrees = Object.entries(PERMISSIONS) as [Permission, readonly Role[]][];

  it('liste exhaustive des rôles', () => {
    expect(exhaustif).toBe(true);
  });

  it.each(entrees)('%s : non vide, rôles valides et sans doublon', (_permission, roles) => {
    expect(roles.length).toBeGreaterThan(0);
    for (const role of roles) expect(ROLES).toContain(role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('aucun droit ne revient à un étudiant (le portail a ses propres écrans)', () => {
    const ouverts = entrees.filter(([, roles]) => roles.includes('ETUDIANT')).map(([p]) => p);
    expect(ouverts).toEqual([]);
  });

  it('roleAutorise refuse un utilisateur sans rôle', () => {
    for (const [permission] of entrees) {
      expect(roleAutorise(null, permission)).toBe(false);
      expect(roleAutorise(undefined, permission)).toBe(false);
    }
    expect(roleAutorise('ADMIN', 'courrier.cloturer')).toBe(true);
    expect(roleAutorise('SCOLARITE', 'paiements.simuler')).toBe(false);
  });

  it.each(Object.entries(ECRANS) as [Permission, string[]][])(
    "%s : rôles admis sur l'écran cible",
    (permission, chemins) => {
      for (const chemin of chemins) {
        const ecran = MANIFESTE.find((e) => e.path === chemin);
        expect(ecran, chemin).toBeDefined();
        for (const role of PERMISSIONS[permission]) expect(ecran!.roles, `${chemin} / ${role}`).toContain(role);
      }
    },
  );
});
