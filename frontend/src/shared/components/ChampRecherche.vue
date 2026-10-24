<script setup lang="ts">
/**
 * Selecteur asynchrone piloté par l'API : on tape → debounce → GET → options.
 * Remplace les QSelect classiques sur les listes longues (étudiants,
 * enseignants, départements, salles, promotions, formations, équipements…).
 *
 * Utilise `use-input` + `use-chips` non ; juste un QSelect étendu avec un
 * fetch debounced. Le composant n'impose pas de contrat : l'endpoint accepte
 * { search, all } et renvoie soit `{ data: [...] }` soit un tableau direct ;
 * on s'adapte.
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';

/**
 * Un élément renvoyé par l'API.
 *
 * L'endpoint est fourni par le parent : seul lui connaît la forme exacte de
 * l'élément, qu'il transforme en libellé avec `labelFn`. On n'en retient ici
 * que les champs affichables.
 */
type ElementApi = Record<string, string | number | boolean | null | undefined>;

interface Option {
  label: string;
  value: string;
  raw?: ElementApi;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    endpoint: string;
    /** Champ de l'option à utiliser comme identifiant (par défaut id) */
    valueField?: string;
    /**
     * Fonction (item) => libellé affiché.
     *
     * La forme de l'élément est propre à l'endpoint : le parent la connaît et
     * la déclare dans sa fonction. `any` reste donc nécessaire ici — c'est le
     * seul endroit où l'écran touche la donnée brute.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la forme de l'élément est propre à l'endpoint
    labelFn: (item: any) => string;
    /** Libellé affiché au-dessus du champ */
    label?: string;
    /** Texte d'invite quand vide */
    placeholder?: string;
    /** Active le clear */
    clearable?: boolean;
    /** Désactive le champ */
    disable?: boolean;
    /** Permet de chercher en mode serveur (sinon on charge tout) */
    serverSearch?: boolean;
    /** Limite de résultats quand le serveur ne filtre pas */
    pageSize?: number;
    /** Valeur initiale : si on reçoit un id seul, on charge l'item pour avoir le label */
    preload?: boolean;
    /**
     * Route de relecture d'un élément déjà connu : par défaut `${endpoint}/{id}`.
     * Passer `false` quand cette route n'existe pas (liste dérivée, comme
     * `/examens/surveillants`) : le composant ne relit alors rien et s'appuie
     * sur `libelleInitial`.
     */
    endpointDetail?: string | false;
    /** Libellé de l'élément déjà sélectionné, quand il ne peut pas être relu. */
    libelleInitial?: string;
  }>(),
  {
    valueField: 'id',
    clearable: true,
    serverSearch: false,
    pageSize: 50,
    preload: true,
    endpointDetail: undefined,
    libelleInitial: undefined,
  },
);

const emit = defineEmits<{
  /**
   * `raw` est l'élément tel que l'API l'a renvoyé : sa forme est celle de
   * l'endpoint, connue du seul parent qui l'a demandé.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la forme de l'élément est propre à l'endpoint
  'update:modelValue': [value: string | null, raw?: any];
}>();

const options = ref<Option[]>([]);
const { t: $t } = useI18n();
const loading = ref(false);
/**
 * Message d'échec du dernier chargement. Une liste vide ne dit rien : sans
 * elle, une adresse erronée (404) ou un serveur injoignable ressemblaient à
 * un référentiel vide. On le dit sous le champ.
 */
const erreur = ref<string | null>(null);
const recherche = ref('');
const valeurCourante = ref<string | null>(props.modelValue ?? null);
let timer: ReturnType<typeof setTimeout> | null = null;
/**
 * Numéro de la demande en cours. Deux recherches peuvent se chevaucher : sans
 * ce garde-fou, une réponse lente arrivée après une réponse rapide écrasait la
 * liste et l'utilisateur voyait des résultats qui ne correspondent plus à ce
 * qu'il a tapé.
 */
let requeteCourante = 0;

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

async function charger(rechercheLibre?: string) {
  const mien = ++requeteCourante;
  loading.value = true;
  erreur.value = null;
  try {
    const params: Record<string, string | number> = { all: 1 };
    if (rechercheLibre) params.search = rechercheLibre;
    // `silencieux` : le composant affiche son propre message d'échec sous le
    // champ, la notification globale ferait doublon.
    const { data } = await api.get<ElementApi[] | { data?: ElementApi[] }>(props.endpoint, {
      params,
      silencieux: true,
    });
    if (mien !== requeteCourante) return;
    const liste: ElementApi[] = Array.isArray(data) ? data : (data.data ?? []);
    options.value = liste.map((item) => ({
      label: props.labelFn(item) || String(item?.[props.valueField] ?? '?'),
      value: String(item[props.valueField]),
      raw: item,
    }));
  } catch {
    if (mien !== requeteCourante) return;
    options.value = [];
    erreur.value = $t('common.search.loadError');
  } finally {
    if (mien === requeteCourante) loading.value = false;
  }
}

function ouvrirFiltre(val: string, miseAJour: (cb: () => void) => void) {
  recherche.value = val;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    await (props.serverSearch ? charger(val) : charger());
    miseAJour(() => {});
  }, 300);
}

watch(
  () => props.modelValue,
  async (v) => {
    valeurCourante.value = v ?? null;
    // Préchargement de l'item courant pour avoir le label affiché dans la zone
    if (!v || !props.preload) return;
    if (options.value.find((o) => o.value === v)) return;
    // `endpointDetail: false` : la route de relecture n'existe pas (liste
    // dérivée). On garde le libellé fourni par le parent, s'il y en a un.
    if (props.endpointDetail === false) {
      if (props.libelleInitial) {
        options.value = [{ label: props.libelleInitial, value: v }, ...options.value];
      }
      return;
    }
    const route = props.endpointDetail ?? props.endpoint;
    try {
      const { data } = await api.get<ElementApi[] | ElementApi>(`${route}/${v}`, { silencieux: true });
      const item = Array.isArray(data) ? data[0] : data;
      if (item && item[props.valueField]) {
        options.value = [
          {
            label: props.labelFn(item) || String(item[props.valueField]),
            value: String(item[props.valueField]),
            raw: item,
          },
          ...options.value,
        ];
      }
    } catch {
      /* silencieux : si l'item n'existe plus on l'ignore */
    }
  },
  { immediate: true },
);

watch(valeurCourante, (v) => {
  if (v !== props.modelValue) emit('update:modelValue', v ?? null, options.value.find((o) => o.value === v)?.raw);
});
</script>

<template>
  <q-select
    v-model="valeurCourante"
    :options="options"
    :label="label"
    :placeholder="placeholder"
    :clearable="clearable"
    :disable="disable"
    :loading="loading"
    use-input
    fill-input
    hide-selected
    emit-value
    map-options
    input-debounce="0"
    @filter="ouvrirFiltre"
  >
    <template #no-option>
      <q-item>
        <q-item-section :class="erreur ? 'text-negative' : 'text-grey'">
          {{ erreur ?? (loading ? $t('common.messages.loading') : $t('common.search.noResults')) }}
        </q-item-section>
      </q-item>
    </template>
  </q-select>
  <div v-if="erreur" class="text-negative text-caption q-mt-xs" role="alert">{{ erreur }}</div>
</template>
