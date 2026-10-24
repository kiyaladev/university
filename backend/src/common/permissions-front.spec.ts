import 'reflect-metadata';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './decorators';

/**
 * La matrice des droits de l'interface (frontend/src/navigation/permissions.ts)
 * masque les boutons ; l'API, elle, tranche par `@Roles(...)`. Ce test relie
 * chaque droit adossé à une route à ses rôles, lus par réflexion sur les
 * contrôleurs :
 * - un rôle que l'interface autorise et que l'API refuse donne un bouton qui
 *   ne mène qu'à un 403 : c'est une erreur ;
 * - un rôle que l'API admet et que l'interface masque doit être un choix
 *   assumé, inscrit dans `MASQUES_ASSUMES`.
 * Les droits absents de `ROUTES` sont contrôlés par un service (propriétaire,
 * statut), par une route publique ou par l'accès à un écran (test Vitest).
 */
const ROUTES: Record<string, string[]> = {
  'seances.pointer': ['POST /controles'],
  'seances.affecterControleur': ['PUT /seances/:id/controleur'],
  'referentiels.planifier': ['POST /seances/generer', 'POST /affectations', 'POST /matieres', 'POST /enseignants'],
  'emploiDuTemps.tenir': ['POST /creneaux', 'POST /seances'],
  'emploiDuTemps.voirRegistre': ['GET /rapports/registre'],
  'justificatifs.deposer': ['POST /justificatifs'],
  'justificatifs.arbitrer': ['PUT /justificatifs/:id/traiter'],
  'rapports.voirCouverture': ['GET /rapports/couverture-controleurs'],
  'rapports.voirEtatPaiement': ['GET /rapports/etat-paiement'],
  'rapports.signerReleve': ['POST /impression/releve-hebdomadaire'],
  'affectations.supprimer': ['DELETE /affectations/:id'],
  'structure.gerer': ['POST /annees', 'POST /departements', 'POST /filieres', 'POST /promotions'],
  'structure.supprimer': [
    'DELETE /annees/:id',
    'DELETE /departements/:id',
    'DELETE /filieres/:id',
    'DELETE /promotions/:id',
  ],
  'salles.gerer': ['POST /salles', 'PUT /salles/:id'],
  'salles.supprimer': ['DELETE /salles/:id'],
  'pointages.corriger': ['PUT /controles/:id'],
  'pointages.supprimer': ['DELETE /controles/:id'],
  'attestation.moyens': [
    'PUT /attestation/enseignants/:id/code-pin',
    'POST /attestation/enseignants/:id/code-pin/reinitialiser',
    'DELETE /attestation/enseignants/:id/code-pin',
    'PUT /attestation/enseignants/:id/empreinte',
    'DELETE /attestation/enseignants/:id/empreinte',
  ],
  'attestation.appareils': ['GET /attestation/appareils', 'DELETE /attestation/appareils/:id'],
  'etudiants.gerer': ['POST /etudiants', 'PUT /etudiants/:id'],
  'inscriptions.gerer': ['POST /inscriptions'],
  'inscriptions.valider': ['PUT /inscriptions/:id/valider'],
  'inscriptions.annuler': ['PUT /inscriptions/:id/annuler'],
  'examens.creer': ['POST /examens'],
  'examens.demarrer': ['POST /examens/:id/demarrer'],
  'examens.terminer': ['POST /examens/:id/terminer'],
  'examens.annuler': ['PUT /examens/:id/statut'],
  'tirage.gerer': ['GET /tirage', 'POST /tirage'],
  'evaluations.gerer': ['POST /evaluations', 'POST /evaluations/:id/cloturer'],
  'notes.saisir': ['PUT /notes/saisie'],
  'deliberations.saisir': ['POST /deliberations', 'POST /deliberations/:id/calculer'],
  'deliberations.juger': ['POST /deliberations/:id/valider'],
  'attestations.emettre': ['POST /attestations'],
  'attestations.revoquer': ['POST /attestations/:id/revoquer'],
  'cartes.emettre': ['POST /cartes-etudiantes'],
  'cartes.modifier': ['PUT /cartes-etudiantes/:id'],
  'cartes.revoquer': ['POST /cartes-etudiantes/:id/revoquer'],
  'demandesDocuments.traiter': ['POST /documents-demande/:id/lancer-traitement', 'POST /documents-demande/:id/rejeter'],
  'stages.creer': ['POST /travaux-encadres'],
  'stages.transitionner': ['POST /travaux-encadres/:id/transition'],
  'stages.modifierRapport': ['PUT /travaux-encadres/:id'],
  'stages.planifierSoutenance': ['POST /soutenances'],
  'stages.constaterJury': ['PUT /soutenances/:id/hota'],
  'travaux.choisirEtudiant': ['POST /travaux-encadres'],
  'paiements.creer': ['POST /paiements'],
  'paiements.voir': ['GET /paiements'],
  'paiements.simuler': ['POST /paiements/:id/simuler'],
  'paiements.annuler': ['POST /paiements/:id/annuler'],
  'recettes.gerer': ['POST /recettes', 'POST /recettes/:id/encaisser'],
  'frais.gerer': ['GET /frais/gestion', 'POST /frais', 'PUT /frais/:id'],
  'frais.supprimer': ['DELETE /frais/:id'],
  'paie.creer': ['POST /feuilles-paie'],
  'paie.imprimer': ['GET /feuilles-paie/:id/imprimer'],
  'paie.calculer': ['POST /feuilles-paie/:id/calculer'],
  'paie.valider': ['POST /feuilles-paie/:id/valider'],
  'paie.payer': ['POST /feuilles-paie/:id/payer'],
  'paie.supprimer': ['DELETE /feuilles-paie/:id'],
  'cites.gererResidences': ['POST /residences', 'PUT /residences/:id'],
  'cites.gererChambres': ['POST /chambres', 'PUT /chambres/:id'],
  'cites.decider': ['PUT /attributions-logement/:id/decider'],
  'cites.creerAttribution': ['POST /attributions-logement'],
  'resto.recharger': ['POST /resto/portefeuilles/:id/recharger'],
  'resto.annuler': ['POST /resto/consommations/:id/annuler'],
  'bibliotheque.deposer': ['POST /documents', 'PUT /documents/:id'],
  'plagiat.decider': ['GET /documents/plagiat', 'POST /documents/plagiat/:id/acquitter'],
  'vod.editer': ['POST /vod', 'PUT /vod/:id'],
  'reservations.reserver': ['POST /reservations'],
  'reservations.decider': ['POST /reservations/:id/decider'],
  'badges.editer': ['POST /badges', 'PUT /badges/:id'],
  'elections.editer': ['POST /elections', 'PUT /elections/:id'],
  'courrier.creer': ['POST /courrier'],
  'courrier.cloturer': ['POST /courrier/:id/cloturer'],
};

/** Rôles que l'API admet sur la route mais que l'interface masque, à dessein. */
const MASQUES_ASSUMES: Record<string, Role[]> = {
  // L'étudiant propose son sujet depuis le portail et en devient d'office le porteur.
  'stages.creer': [Role.ETUDIANT],
  'travaux.choisirEtudiant': [Role.ETUDIANT],
  // L'encadrant et l'étudiant porteur modifient aussi le travail, après contrôle du service.
  'stages.modifierRapport': [Role.ENSEIGNANT, Role.ETUDIANT],
};

const NAVIGATION_FRONT = join(__dirname, '..', '..', '..', 'frontend', 'src', 'navigation');
const FICHIER_FRONT = join(NAVIGATION_FRONT, 'permissions.ts');
// Constantes de rôles partagées (PERSONNEL…), importées par la matrice.
const FICHIER_ROLES_FRONT = join(NAVIGATION_FRONT, 'roles.ts');

/** Lit la matrice du frontend sans l'exécuter : constantes `X: Role[] = [...]` et entrées `'cle': [...]`. */
function lireMatriceFront(source: string): Record<string, string[]> {
  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const lister = (texte: string) => [...texte.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  const constantes: Record<string, string[]> = {};
  const avecRoles =
    (existsSync(FICHIER_ROLES_FRONT) ? readFileSync(FICHIER_ROLES_FRONT, 'utf8') : '') + sansCommentaires;
  for (const m of avecRoles.matchAll(/const (\w+): Role\[\] = \[([^\]]*)\]/g)) constantes[m[1]] = lister(m[2]);
  const corps = sansCommentaires.slice(sansCommentaires.indexOf('PERMISSIONS = {'));
  const matrice: Record<string, string[]> = {};
  for (const m of corps.matchAll(/'([\w.]+)':\s*(\[[^\]]*\]|\w+)/g)) {
    matrice[m[1]] = m[2].startsWith('[') ? lister(m[2]) : constantes[m[2]];
  }
  return matrice;
}

function fichiersTs(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersTs(chemin);
    return nom.endsWith('.ts') && !nom.endsWith('.spec.ts') ? [chemin] : [];
  });
}

/** `'POST /controles'` → rôles exigés (`null` : tout utilisateur connecté, ou route publique). */
function lireRoutesBack(): Map<string, Role[] | null> {
  const routes = new Map<string, Role[] | null>();
  for (const fichier of fichiersTs(join(__dirname, '..', 'modules'))) {
    if (!readFileSync(fichier, 'utf8').includes('@Controller')) continue;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    for (const classe of Object.values(require(fichier)) as any[]) {
      if (typeof classe !== 'function') continue;
      const base = Reflect.getMetadata(PATH_METADATA, classe);
      if (base === undefined) continue;
      const rolesClasse = Reflect.getMetadata(ROLES_KEY, classe) ?? null;
      for (const nom of Object.getOwnPropertyNames(classe.prototype)) {
        const methode = classe.prototype[nom];
        if (nom === 'constructor' || typeof methode !== 'function') continue;
        const chemin = Reflect.getMetadata(PATH_METADATA, methode);
        if (chemin === undefined) continue;
        const verbe = RequestMethod[Reflect.getMetadata(METHOD_METADATA, methode)];
        const url = `/${base}/${chemin}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
        routes.set(`${verbe} ${url}`, Reflect.getMetadata(ROLES_KEY, methode) ?? rolesClasse);
      }
    }
  }
  return routes;
}

const describeSiFront = existsSync(FICHIER_FRONT) ? describe : describe.skip;

describeSiFront("matrice des droits du frontend face aux @Roles de l'API", () => {
  const front = existsSync(FICHIER_FRONT) ? lireMatriceFront(readFileSync(FICHIER_FRONT, 'utf8')) : {};
  let back: Map<string, Role[] | null>;
  beforeAll(() => {
    back = lireRoutesBack();
  }, 60_000);

  it('lit la matrice du frontend', () => {
    expect(Object.keys(front).length).toBeGreaterThan(50);
    for (const roles of Object.values(front)) expect(roles?.length).toBeGreaterThan(0);
  });

  it('chaque droit relié existe côté frontend', () => {
    expect(Object.keys(ROUTES).filter((p) => !(p in front))).toEqual([]);
  });

  it.each(Object.entries(ROUTES))('%s', (permission, routes) => {
    const rolesFront = front[permission] as Role[];
    for (const route of routes) {
      expect(back.has(route) ? route : `route introuvable : ${route}`).toBe(route);
      const rolesBack = back.get(route);
      expect(rolesBack).not.toBeNull(); // une route sans @Roles ne justifie pas un droit restreint
      // Un rôle autorisé par l'interface mais refusé par l'API mène à un 403.
      expect({ route, refuses: rolesFront.filter((r) => !rolesBack!.includes(r)) }).toEqual({ route, refuses: [] });
      // Un rôle admis par l'API mais masqué par l'interface doit être assumé.
      const masques = rolesBack!.filter(
        (r) => !rolesFront.includes(r) && !(MASQUES_ASSUMES[permission] ?? []).includes(r),
      );
      expect({ route, masques }).toEqual({ route, masques: [] });
    }
  });
});
