import type { Router } from 'vue-router';
import type { Role } from '../types';
import { MANIFESTE, RUBRIQUES, SERVICES_ECRANS_PUBLICS, type EntreeNavigation, type RubriqueId } from './manifeste';

/**
 * Tout ce qui se déduit du manifeste, en fonctions pures : droits des routes,
 * menu par rôle, raccourcis, tâches de l'accueil, familles et services.
 */

const PAR_CHEMIN = new Map(MANIFESTE.map(entree => [entree.path, entree]));

export function entree(path: string): EntreeNavigation | undefined {
  return PAR_CHEMIN.get(path);
}

/** `meta` d'une route du manifeste : titre et rôles admis. */
export function ecran(path: string): { titre: string; roles: Role[] } {
  const e = PAR_CHEMIN.get(path);
  if (!e) throw new Error(`navigation/manifeste : aucune entrée pour ${path}`);
  return { titre: e.titre, roles: e.roles };
}

const segment = (path: string) => path.split('?')[0].split('/')[1] ?? '';

/**
 * Service facultatif par premier segment d'adresse : `/examens/scan` et
 * `/examens` dépendent du même service, comme les pages de détail.
 */
const SERVICE_PAR_SEGMENT: Readonly<Record<string, string>> = Object.fromEntries([
  ...MANIFESTE.filter(e => e.service).map(e => [segment(e.path), e.service!]),
  ...Object.entries(SERVICES_ECRANS_PUBLICS).map(([path, service]) => [segment(path), service]),
]);

export function serviceDeRoute(path: string): string | undefined {
  return SERVICE_PAR_SEGMENT[segment(path)];
}

export interface EtatService { id: string; actif: boolean }

/** Un écran est masqué seulement si son service est connu et désactivé. */
function serviceOuvert(e: EntreeNavigation, services: readonly EtatService[]) {
  return !e.service || services.find(s => s.id === e.service)?.actif !== false;
}

function admis(e: EntreeNavigation, role: Role | null): role is Role {
  return !!role && e.roles.includes(role);
}

export interface LienMenu {
  path: string;
  /** Clé i18n du libellé. */
  titre: string;
  icone: string;
  section?: string;
  /** Surlignage exact : le lien chapeaute d'autres liens du menu (« /examens » face à « /examens/scan »). */
  exact: boolean;
}

export interface RubriqueMenu { id: RubriqueId; titre: string; icone: string; liens: LienMenu[] }

/**
 * Menu d'un rôle selon les services activés. Dans une rubrique, les liens se
 * rangent par intertitre — dans l'ordre alphabétique de la langue affichée,
 * d'où `traduire` — puis par `ordre`.
 */
export function menuPour(
  role: Role | null,
  servicesActifs: readonly EtatService[],
  traduire: (cle: string) => string = cle => cle,
): RubriqueMenu[] {
  const visibles = MANIFESTE.filter(e => e.menu !== false && admis(e, role)
    && (!e.menuRoles || e.menuRoles.includes(role!)) && serviceOuvert(e, servicesActifs));
  const libelleSection = (e: EntreeNavigation) => (e.section ? traduire(e.section) : '');
  return RUBRIQUES.map(rubrique => ({
    ...rubrique,
    liens: visibles.filter(e => e.rubrique === rubrique.id)
      .sort((a, b) => a.ordre - b.ordre)
      .sort((a, b) => libelleSection(a).localeCompare(libelleSection(b)))
      .map(e => ({
        path: e.path,
        titre: e.titrePour?.[role!] ?? e.titre,
        icone: e.icone,
        ...(e.section ? { section: e.section } : {}),
        exact: e.path === '/' || visibles.some(v => v.path.startsWith(`${e.path}/`)),
      })),
  })).filter(rubrique => rubrique.liens.length);
}

function parRang(rang: (e: EntreeNavigation) => number | undefined) {
  return MANIFESTE.filter(e => rang(e) !== undefined).sort((a, b) => rang(a)! - rang(b)!);
}

/** Adresses des raccourcis du menu pour ce rôle, dans l'ordre ; à croiser avec le menu affiché. */
export function raccourcisPour(role: Role | null): string[] {
  return role ? parRang(e => e.raccourciPour?.[role]).map(e => e.path) : [];
}

/** Tâches fréquentes de l'accueil de l'université : droits de la route et services, pas le menu. */
export function tachesAccueil(role: Role | null, servicesActifs: readonly EtatService[]): EntreeNavigation[] {
  return role ? parRang(e => e.tacheAccueilPour?.[role]).filter(e => admis(e, role) && serviceOuvert(e, servicesActifs)) : [];
}

/** Entrée du menu → écrans qu'elle regroupe (et qui l'allument). */
export const FAMILLES: Readonly<Record<string, string[]>> = MANIFESTE.reduce<Record<string, string[]>>((familles, e) => {
  if (e.famille) (familles[e.famille] ??= []).push(e.path);
  return familles;
}, {});

/** Page d'arrivée d'un rôle : son espace s'il en a un, sinon le tableau de bord. */
export function accueilParRole(role: Role | null): string {
  return (role && MANIFESTE.find(e => e.accueilDe?.includes(role))?.path) || '/';
}

/**
 * Contrôle de cohérence (lancé au démarrage en développement) : chaque entrée
 * correspond à une route qui porte son titre et ses rôles, ou à une simple
 * redirection ; les renvois internes du manifeste sont valides.
 */
export function verifierManifeste(router: Router): void {
  const erreurs: string[] = [];
  const memes = (a: readonly string[] = [], b: readonly string[] = []) =>
    a.length === b.length && a.every(x => b.includes(x));
  for (const e of MANIFESTE) {
    const resolue = router.resolve(e.path);
    const feuille = resolue.matched[resolue.matched.length - 1];
    if (!feuille || feuille.meta.public) erreurs.push(`${e.path} : aucune route connectée`);
    else if (!feuille.redirect && (resolue.meta.titre !== e.titre || !memes(resolue.meta.roles, e.roles))) {
      erreurs.push(`${e.path} : meta de la route différente du manifeste (utiliser ecran('${e.path}'))`);
    }
    if (e.service && serviceDeRoute(e.path) !== e.service) erreurs.push(`${e.path} : service ${e.service} ≠ ${serviceDeRoute(e.path)}`);
    if (!e.service && serviceDeRoute(e.path)) erreurs.push(`${e.path} : service ${serviceDeRoute(e.path)} à déclarer`);
    if (e.menuRoles?.some(r => !e.roles.includes(r))) erreurs.push(`${e.path} : menuRoles hors de roles`);
    if (e.famille && PAR_CHEMIN.get(e.famille)?.menu === false) erreurs.push(`${e.path} : famille ${e.famille} absente du menu`);
    if (e.famille && !PAR_CHEMIN.has(e.famille)) erreurs.push(`${e.path} : famille ${e.famille} inconnue`);
    for (const r of Object.keys({ ...e.raccourciPour, ...e.tacheAccueilPour, ...Object.fromEntries((e.accueilDe ?? []).map(x => [x, 0])) })) {
      if (!e.roles.includes(r as Role)) erreurs.push(`${e.path} : proposé à ${r}, qui n'y a pas accès`);
    }
  }
  const services = new Map<string, string>();
  for (const e of MANIFESTE) if (e.service) {
    const deja = services.get(segment(e.path));
    if (deja && deja !== e.service) erreurs.push(`${e.path} : deux services pour /${segment(e.path)}`);
    services.set(segment(e.path), e.service);
  }
  if (erreurs.length) throw new Error(`Manifeste de navigation incohérent :\n${erreurs.join('\n')}`);
}
