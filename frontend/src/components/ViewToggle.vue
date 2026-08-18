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
  emit('update:mode', mode.value);
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
    class="bascule-vue"
    role="group"
    aria-label="Affichage du listing"
  >
    <template v-for="m in visible" :key="m" #[m]>
      <q-icon :name="ICONES[m]" size="17px" />
      <span class="q-ml-xs pochoir bascule-vue__mot">{{ LABELS[m] }}</span>
    </template>
  </q-btn-toggle>
</template>

<style scoped lang="scss">
/**
 * Deux plaques accolées, celle qui est choisie peinte à l'encre : même
 * grammaire que toutes les bascules du panneau, pas le bleu Material par
 * défaut de Quasar.
 */
.bascule-vue {
  border: var(--up-filet);
}

.bascule-vue :deep(.q-btn) {
  background: transparent;
  color: var(--up-encre);
  min-height: 38px;
  padding: 4px 12px;
}

.bascule-vue :deep(.q-btn + .q-btn) {
  border-left: var(--up-filet);
}

.bascule-vue :deep(.q-btn:hover) {
  background: var(--up-craie);
}

.bascule-vue :deep(.q-btn--active) {
  background: var(--up-encre);
  color: var(--up-craie);
}

.bascule-vue :deep(.q-btn--active:hover) {
  background: var(--up-encre);
}

// Sur téléphone, l'icône suffit : le mot ferait déborder la barre d'actions.
@media (max-width: 599px) {
  .bascule-vue__mot { display: none; }
}
</style>
