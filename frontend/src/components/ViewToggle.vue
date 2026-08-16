<script setup lang="ts">
/**
 * Bascule d'affichage : tableau / cartes / calendrier / kanban (les modes
 * calendrier et kanban sont masqués si non utilisés). Mémorise le choix par
 * clé dans le localStorage (équivalent de `useVuePreferee` mais plus général).
 */
import { computed, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** Clé de mémorisation localStorage */
  cle: string;
  modes?: Array<'tableau' | 'cartes' | 'calendrier' | 'kanban'>;
  /** Mode par défaut si rien en mémoire */
  defaut?: 'tableau' | 'cartes' | 'calendrier' | 'kanban';
}>(), {
  modes: () => ['tableau', 'cartes'],
  defaut: 'tableau',
});

const emit = defineEmits<{
  'update:mode': [v: string];
}>();

const mode = ref<string>(props.defaut);
const ICONES: Record<string, string> = {
  tableau: 'view_list',
  cartes: 'view_module',
  calendrier: 'calendar_view_month',
  kanban: 'view_kanban',
};
const LABELS: Record<string, string> = {
  tableau: 'Tableau',
  cartes: 'Cartes',
  calendrier: 'Calendrier',
  kanban: 'Kanban',
};

onMounted(() => {
  const mem = localStorage.getItem(`up:vue:${props.cle}`);
  if (mem && props.modes.includes(mem as any)) mode.value = mem;
});
watch(mode, (v) => {
  localStorage.setItem(`up:vue:${props.cle}`, v);
  emit('update:mode', v);
});

const visible = computed(() => props.modes);
</script>

<template>
  <q-btn-toggle
    v-model="mode"
    :options="visible.map((m) => ({ value: m, slot: m }))"
    unelevated
    no-caps
    toggle-color="primary"
    color="white"
    text-color="primary"
    class="bascule-vue"
  >
    <template v-for="m in visible" :key="m" #[m]>
      <q-icon :name="ICONES[m]" />
      <span class="q-ml-xs">{{ LABELS[m] }}</span>
    </template>
  </q-btn-toggle>
</template>

<style scoped>
.bascule-vue :deep(.q-btn) {
  padding: 4px 12px;
}
</style>
