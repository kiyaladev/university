import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';
import { lister } from '@/shared/services/http';
import type {
  AnneeAcademique,
  Departement,
  Enseignant,
  Matiere,
  Promotion,
  Salle,
} from '../types';

/**
 * Référentiels partagés par de nombreux écrans (années, promotions,
 * départements, enseignants, salles, matières).
 *
 * - Chargement paresseux : rien n'est demandé tant qu'un écran n'en a pas
 *   besoin, puis la liste complète (`?all=1`) est gardée en cache.
 * - Requêtes dédoublonnées : deux écrans qui demandent la même liste au même
 *   moment partagent la même requête.
 * - `rafraichir()` après une modification (création, édition, suppression),
 *   pour que les autres écrans ne servent pas une liste périmée.
 * - `vider()` à la connexion et à la déconnexion : certaines listes dépendent
 *   du compte (les enseignants d'un chef de département sont restreints à son
 *   département), elles ne doivent jamais passer d'un utilisateur à l'autre.
 *
 * Les erreurs HTTP sont notifiées par l'intercepteur de boot/axios ; le store
 * les laisse remonter à l'appelant sans rien mettre en cache.
 */
interface Listes {
  annees: AnneeAcademique[];
  promotions: Promotion[];
  departements: Departement[];
  enseignants: Enseignant[];
  salles: Salle[];
  matieres: Matiere[];
}

export type CleReferentiel = keyof Listes;

const URLS: Record<CleReferentiel, string> = {
  annees: '/annees',
  promotions: '/promotions',
  departements: '/departements',
  enseignants: '/enseignants',
  salles: '/salles',
  matieres: '/matieres',
};

const CLES = Object.keys(URLS) as CleReferentiel[];

function listesVides(): Listes {
  return { annees: [], promotions: [], departements: [], enseignants: [], salles: [], matieres: [] };
}

export const useReferentielsStore = defineStore('referentiels', () => {
  const listes = reactive<Listes>(listesVides());
  const charges = reactive<Partial<Record<CleReferentiel, boolean>>>({});
  /** Requêtes en vol, pour ne pas lancer deux fois la même. */
  const enCours = new Map<CleReferentiel, Promise<unknown>>();
  /**
   * Incrémenté à chaque `vider()` : une réponse arrivée après une déconnexion
   * (ou un changement de compte) appartient à l'ancien utilisateur et ne doit
   * pas être mise en cache.
   */
  let generation = 0;

  /** Année marquée active côté serveur (remplace les `.find(a => a.active)`). */
  const anneeCourante = computed<AnneeAcademique | null>(
    () => listes.annees.find((a) => a.active) ?? null,
  );

  /**
   * Liste complète d'un référentiel, depuis le cache si elle y est. Renvoie
   * une copie : l'écran peut la trier ou la filtrer sans toucher au cache.
   */
  async function charger<K extends CleReferentiel>(cle: K, force = false): Promise<Listes[K]> {
    if (!force && charges[cle]) return [...listes[cle]] as Listes[K];
    let requete = enCours.get(cle) as Promise<Listes[K]> | undefined;
    if (!requete || force) {
      const gen = generation;
      requete = lister<Listes[K][number]>(URLS[cle], { all: '1' })
        .then((page) => {
          const data = (page.data ?? []) as Listes[K];
          if (gen === generation) {
            listes[cle] = data;
            charges[cle] = true;
          }
          return data;
        })
        .finally(() => {
          if (enCours.get(cle) === requete) enCours.delete(cle);
        });
      enCours.set(cle, requete);
    }
    return [...(await requete)] as Listes[K];
  }

  /**
   * À appeler après une modification : recharge les référentiels désignés
   * (tous si aucun n'est précisé) qui étaient déjà en cache, et oublie les
   * autres pour que leur prochaine lecture reparte du serveur.
   */
  async function rafraichir(...cles: CleReferentiel[]): Promise<void> {
    const cibles = cles.length ? cles : CLES;
    const aRecharger = cibles.filter((c) => charges[c]);
    for (const c of cibles) {
      charges[c] = false;
      enCours.delete(c);
    }
    await Promise.all(aRecharger.map((c) => charger(c, true).catch(() => undefined)));
  }

  /** Oublie tout (connexion, déconnexion, changement de compte). */
  function vider(): void {
    generation++;
    enCours.clear();
    Object.assign(listes, listesVides());
    for (const c of CLES) charges[c] = false;
  }

  return {
    listes,
    anneeCourante,
    charger,
    rafraichir,
    vider,
    annees: (force = false) => charger('annees', force),
    promotions: (force = false) => charger('promotions', force),
    departements: (force = false) => charger('departements', force),
    enseignants: (force = false) => charger('enseignants', force),
    salles: (force = false) => charger('salles', force),
    matieres: (force = false) => charger('matieres', force),
  };
});
