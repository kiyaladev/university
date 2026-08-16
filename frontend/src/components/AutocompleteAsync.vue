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
import { ref, watch, computed } from 'vue';
import { api } from '../boot/axios';

interface Option {
  label: string;
  value: string;
  raw?: any;
}

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  endpoint: string;
  /** Champ de l'option à utiliser comme identifiant (par défaut id) */
  valueField?: string;
  /** Fonction (item) => libellé affiché */
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
}>(), {
  valueField: 'id',
  clearable: true,
  serverSearch: false,
  pageSize: 50,
  preload: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | null, raw?: any];
}>();

const options = ref<Option[]>([]);
const loading = ref(false);
const recherche = ref('');
const valeurCourante = ref<any>(props.modelValue ?? null);
let timer: any = null;

async function charger(rechercheLibre?: string) {
  loading.value = true;
  try {
    const params: any = { all: 1 };
    if (rechercheLibre) params.search = rechercheLibre;
    const { data } = await api.get(props.endpoint, { params });
    const liste: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    options.value = liste.map((item) => ({
      label: props.labelFn(item) || item?.[props.valueField] || '?',
      value: item[props.valueField],
      raw: item,
    }));
  } catch {
    options.value = [];
  } finally {
    loading.value = false;
  }
}

function ouvrirFiltre(val: string, miseAJour: (cb: () => void) => void) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (props.serverSearch) charger(val);
    else charger();
    miseAJour(() => {});
  }, 300);
}

watch(() => props.modelValue, async (v) => {
  valeurCourante.value = v;
  // Préchargement de l'item courant pour avoir le label affiché dans la zone
  if (v && props.preload && !options.value.find((o) => o.value === v)) {
    try {
      const { data } = await api.get(`${props.endpoint}/${v}`);
      const item = Array.isArray(data) ? data[0] : data;
      if (item && item[props.valueField]) {
        options.value = [{
          label: props.labelFn(item) || item[props.valueField],
          value: item[props.valueField],
          raw: item,
        }, ...options.value];
      }
    } catch { /* silencieux : si l'item n'existe plus on l'ignore */ }
  }
});

watch(options, () => {
  if (props.modelValue && !options.value.find((o) => o.value === props.modelValue)) {
    // L'option n'existe plus : on ne la retire pas visuellement
  }
}, { deep: false });

const valeurAffichee = computed(() => props.modelValue ?? null);
</script>

<template>
  <q-select
    :model-value="valeurAffichee"
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
    @update:model-value="(v) => emit('update:modelValue', v ?? null, options.find((o) => o.value === v)?.raw)"
    @focus="charger(recherche)"
    @clear="() => emit('update:modelValue', null, undefined)"
  >
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey">
          {{ loading ? 'Chargement…' : 'Aucun résultat' }}
        </q-item-section>
      </q-item>
    </template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>
