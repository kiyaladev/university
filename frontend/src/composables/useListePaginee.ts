import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';

/**
 * Liste filtrée et paginée : un seul endroit pour l'état (lignes, total, page,
 * chargement), le rechargement quand un filtre bouge et la mémoire des filtres
 * dans l'URL.
 *
 *   const filtres = ref({ recherche: '', statut: null });
 *   const tickets = reactive(useListePaginee<TicketSupport, typeof filtres.value>({
 *     filtres,
 *     syncUrl: true,
 *     charger: ({ page, pageSize, tout, filtres: f }) =>
 *       api.get('/tickets', { params: { ...pageApi({ page, pageSize, tout }), statut: f.statut || undefined } })
 *         .then((r) => r.data),
 *   }));
 *
 *   <pagination-bar v-model:page="tickets.page" v-model:page-size="tickets.pageSize" :total="tickets.total" :show-all="false" />
 *   <q-table :rows="tickets.lignes" :loading="tickets.chargement" … />
 *
 * - `reactive(...)` déballe les refs pour le gabarit ; on peut aussi
 *   déstructurer le retour quand la page n'a qu'une liste.
 * - Un filtre qui change ramène en page 1 ; les champs texte (`clesTexte`,
 *   `recherche` par défaut) attendent 300 ms de silence avant de requêter.
 * - `syncUrl` : les filtres sont relus de `route.query` à la création et y sont
 *   réécrits par `router.replace` — ils survivent au retour arrière. Plusieurs
 *   listes sur une même page se séparent par `prefixeUrl`.
 * - API non paginée (`pageSize: 0`) : `charger` reçoit `tout: true`, la liste
 *   arrive entière et la page garde son filtrage local (`:rows-per-page-options="[0]"`
 *   ou `:pagination="{ rowsPerPage: 20 }"` du q-table). Les clés de `clesLocales`
 *   ne déclenchent alors aucune requête.
 * - `chargerTout()` rend toutes les lignes sans toucher à l'affichage (export).
 */

export interface ParamsListe<F> {
  page: number;
  pageSize: number;
  /** Vrai quand on veut tout : export, ou API non paginée. */
  tout: boolean;
  filtres: F;
}

export interface PageListe<T> {
  data: T[];
  total?: number;
}

export interface OptionsListe<T, F> {
  charger: (params: ParamsListe<F>) => Promise<PageListe<T>>;
  filtres: Ref<F>;
  /** Taille de page initiale ; 0 = l'API ne pagine pas, tout est chargé. */
  pageSize?: number;
  syncUrl?: boolean;
  /** Préfixe des clés d'URL quand la page porte plusieurs listes. */
  prefixeUrl?: string;
  /** Clés relues depuis l'URL (par défaut : celles de l'objet filtres initial). */
  clesUrl?: string[];
  /** Champs texte soumis à l'anti-rebond. */
  clesTexte?: string[];
  /** Filtres appliqués côté client : `true` pour tous, ou une liste de clés. */
  clesLocales?: string[] | true;
  /** Charge au montage (vrai par défaut). */
  immediat?: boolean;
  /** Condition de chargement (droits) : faux → aucune requête. */
  actif?: () => boolean;
}

/** Paramètres de pagination usuels du back : `page`/`pageSize`, ou `all=1`. */
export function pageApi(p: { page: number; pageSize: number; tout: boolean }) {
  return p.tout ? { all: '1' } : { page: p.page, pageSize: p.pageSize };
}

/** Texte de recherche nettoyé, `undefined` s'il est vide. */
export function texteApi(v: unknown): string | undefined {
  return (v ?? '').toString().trim() || undefined;
}

const DELAI_TEXTE = 300;

function estVide(v: unknown) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Filtres sans les valeurs vides : deux états équivalents se comparent égaux. */
function normaliser(f: object): Record<string, string> {
  const n: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (!estVide(v)) n[k] = Array.isArray(v) ? v.join(',') : String(v);
  }
  return n;
}

export function useListePaginee<T, F extends object = Record<string, any>>(options: OptionsListe<T, F>) {
  const route = useRoute();
  const router = useRouter();
  const prefixe = options.prefixeUrl ?? '';
  const clesTexte = options.clesTexte ?? ['recherche'];
  const paginee = (options.pageSize ?? 20) > 0;
  const filtresInitiaux = { ...options.filtres.value };

  const lignes = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const chargement = ref(false);
  const etat = ref({ page: 1, pageSize: options.pageSize || 20 });

  // ------------------------------------------------------------ URL → filtres
  if (options.syncUrl) {
    const cles = options.clesUrl ?? Object.keys(filtresInitiaux);
    const lus: Record<string, unknown> = {};
    for (const cle of cles) {
      const v = route.query[prefixe + cle];
      if (typeof v === 'string' && v !== '') lus[cle] = v;
    }
    const page = Number(route.query[`${prefixe}page`]);
    if (paginee && page > 1) etat.value.page = page;
    if (Object.keys(lus).length) options.filtres.value = { ...options.filtres.value, ...lus };
  }

  // --------------------------------------------------------------- requêtes
  let jeton = 0;
  async function requeter(): Promise<void> {
    if (options.actif && !options.actif()) return;
    const courant = ++jeton;
    chargement.value = true;
    try {
      const res = await options.charger({
        page: paginee ? etat.value.page : 1,
        pageSize: paginee ? etat.value.pageSize : 0,
        tout: !paginee,
        filtres: options.filtres.value,
      });
      if (courant !== jeton) return;
      lignes.value = res.data ?? [];
      total.value = res.total ?? lignes.value.length;
    } catch {
      /* l'intercepteur axios a déjà affiché le motif */
    } finally {
      if (courant === jeton) chargement.value = false;
    }
  }

  async function chargerTout(): Promise<T[]> {
    const res = await options.charger({
      page: 1,
      pageSize: Math.max(total.value, 1),
      tout: true,
      filtres: options.filtres.value,
    });
    return res.data ?? [];
  }

  /** Clés d'URL que cette liste possède : on les réécrit, on laisse les autres. */
  const clesGerees = new Set([...Object.keys(filtresInitiaux), ...(options.clesUrl ?? []), 'page']);

  const cheminPage = route.path;

  function ecrireUrl() {
    // Rien à écrire si la page a déjà été quittée (rechargement tardif).
    if (!options.syncUrl || route.path !== cheminPage) return;
    const filtres = normaliser(options.filtres.value);
    Object.keys(filtres).forEach((k) => clesGerees.add(k));
    const query: LocationQuery = { ...route.query };
    clesGerees.forEach((k) => delete query[prefixe + k]);
    for (const [k, v] of Object.entries(filtres)) query[prefixe + k] = v;
    if (paginee && etat.value.page > 1) query[`${prefixe}page`] = String(etat.value.page);
    if (JSON.stringify(query) === JSON.stringify(route.query)) return;
    // Le `scrollBehavior` du routeur remonte en haut à chaque navigation, même
    // un simple `replace` de query : on rend la position une fois la
    // navigation faite (avant la peinture suivante, donc sans saut visible).
    const y = window.scrollY;
    void router
      .replace({ query })
      .then(() => requestAnimationFrame(() => window.scrollTo({ top: y })))
      .catch(() => undefined);
  }

  function recharger() {
    ecrireUrl();
    return requeter();
  }

  // ------------------------------------------------------ filtres → requête
  let precedent = normaliser(options.filtres.value);
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  const estLocale = (cle: string) =>
    options.clesLocales === true || (options.clesLocales ?? []).includes(cle);

  watch(
    options.filtres,
    (f) => {
      const nouveau = normaliser(f);
      const cles = new Set([...Object.keys(nouveau), ...Object.keys(precedent)]);
      const changees = [...cles].filter((k) => nouveau[k] !== precedent[k]);
      precedent = nouveau;
      if (!changees.length) return;
      if (minuterie) clearTimeout(minuterie);
      if (changees.every(estLocale)) {
        ecrireUrl();
        return;
      }
      const relancer = () => {
        minuterie = null;
        etat.value.page = 1;
        void recharger();
      };
      if (changees.every((k) => clesTexte.includes(k))) minuterie = setTimeout(relancer, DELAI_TEXTE);
      else relancer();
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    if (minuterie) clearTimeout(minuterie);
  });
  if (options.immediat !== false) onMounted(() => void requeter());

  // ------------------------------------------------------------- pagination
  const page = computed({
    get: () => etat.value.page,
    set: (v: number) => {
      etat.value.page = v;
      void recharger();
    },
  });
  const pageSize = computed({
    get: () => etat.value.pageSize,
    set: (v: number) => {
      etat.value = { page: 1, pageSize: v };
      void recharger();
    },
  });

  /** Forme attendue par `v-model:pagination` d'un q-table piloté par `@request`. */
  const pagination = computed({
    get: () => ({ page: etat.value.page, rowsPerPage: etat.value.pageSize, rowsNumber: total.value }),
    set: (p: { page: number; rowsPerPage: number }) => {
      etat.value = { page: p.rowsPerPage !== etat.value.pageSize ? 1 : p.page, pageSize: p.rowsPerPage };
      void recharger();
    },
  });

  /** Remet les filtres à leur état initial, en gardant les clés de `conserver`. */
  function reinitialiser(conserver: string[] = ['recherche']) {
    const garde = Object.fromEntries(
      conserver.map((k) => [k, (options.filtres.value as Record<string, unknown>)[k]]),
    );
    options.filtres.value = { ...filtresInitiaux, ...garde } as F;
  }

  return {
    lignes,
    total,
    page,
    pageSize,
    chargement,
    pagination,
    recharger,
    chargerTout,
    reinitialiser,
  };
}
