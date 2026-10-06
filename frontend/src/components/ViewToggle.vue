<script setup lang="ts">
/**
 * Bascule d'affichage : tableau / cartes / calendrier / kanban (les modes
 * calendrier et kanban sont masqués si non utilisés). Mémorise le choix par
 * clé dans le localStorage (équivalent de `useVuePreferee` mais plus général).
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{
  /** Clé de mémorisation localStorage */
  cle: string;
  modes?: Array<'tableau' | 'cartes' | 'calendrier' | 'kanban'>;
  /** Mode par défaut si rien en mémoire */
  defaut?: 'tableau' | 'cartes' | 'calendrier' | 'kanban';
}>(), {
  modes: () => ['tableau', 'cartes'],
});

const emit = defineEmits<{
  'update:mode': [v: string];
}>();

const $q = useQuasar();
const { t } = useI18n();
const modeInitial = props.defaut ?? ($q.screen.lt.md && props.modes.includes('cartes') ? 'cartes' : props.modes[0]);
const mode = ref<string>(modeInitial);
const ICONES: Record<string, string> = {
  tableau: 'view_list',
  cartes: 'view_module',
  calendrier: 'calendar_view_month',
  kanban: 'view_kanban',
};
const LABELS = computed<Record<string, string>>(() => Object.fromEntries(props.modes.map(mode => [mode, t(`layout.views.${mode}`)])));

onMounted(() => {
  let mem: string | null = null;
  try { mem = localStorage.getItem(`up:vue:${props.cle}`); } catch { /* préférence indisponible */ }
  if (mem && props.modes.includes(mem as any)) mode.value = mem;
  emit('update:mode', mode.value);
});
watch(mode, (v) => {
  try { localStorage.setItem(`up:vue:${props.cle}`, v); } catch { /* le choix reste actif */ }
  emit('update:mode', v);
});

const visible = computed(() => props.modes);
</script>

<template>
  <q-btn-toggle
    v-model="mode"
    :options="visible.map((m) => ({ value: m, slot: m, 'aria-label': LABELS[m], title: LABELS[m] }))"
    unelevated
    no-caps
    class="bascule-vue"
    role="group"
    :aria-label="t('layout.views.label')"
  >
    <template v-for="m in visible" :key="m" #[m]>
      <q-icon :name="ICONES[m]" size="17px" />
      <span class="q-ml-xs pochoir bascule-vue__mot">{{ LABELS[m] }}</span>
    </template>
  </q-btn-toggle>
</template>

<style scoped lang="scss">
/**
 * Le segmented control d'Apple : une gouttière grise, et l'option choisie
 * portée par une pastille blanche qui s'y détache par son ombre. C'était deux
 * plaques accolées dont l'active était peinte à l'encre — un aplat sombre au
 * milieu d'une barre d'actions attirait l'œil plus que l'action elle-même.
 */
.bascule-vue {
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon);
  padding: 3px;
  display: inline-flex;
  gap: 2px;
}

.bascule-vue :deep(.q-btn) {
  background: transparent;
  color: var(--up-encre-douce);
  min-height: 30px;
  padding: 4px 12px;
  border-radius: var(--up-rayon-sm);
  font-weight: 500;
  transition: background-color var(--up-transition-rapide), color var(--up-transition-rapide);
}

.bascule-vue :deep(.q-btn + .q-btn) {
  border-left: 0;
}

.bascule-vue :deep(.q-btn:hover) {
  background: rgba(0, 0, 0, 0.04);
  color: var(--up-encre);
}

// `q-btn-toggle` ne pose pas `q-btn--active` sur l'option choisie : il lui
// colle les classes utilitaires `bg-primary text-white` de Quasar, qui portent
// `!important`. C'est donc `.bg-primary` qu'il faut viser, avec le même poids,
// pour obtenir la pastille blanche du segmented control au lieu d'un aplat bleu.
.bascule-vue :deep(.q-btn.bg-primary),
.bascule-vue :deep(.q-btn.bg-primary:hover) {
  background: var(--up-plaque) !important;
  color: var(--up-encre) !important;
  box-shadow: var(--up-ombre-1);
}

// Le libellé et l'icône portent leur propre couleur : `text-white` posé sur le
// bouton ne les atteint pas par héritage, il faut les reprendre ici.
.bascule-vue :deep(.q-btn.bg-primary) .bascule-vue__mot,
.bascule-vue :deep(.q-btn.bg-primary) .q-icon {
  color: var(--up-encre) !important;
}

// Sur téléphone, l'icône suffit : le mot ferait déborder la barre d'actions.
@media (max-width: 599px) {
  .bascule-vue__mot { display: none; }
}
</style>
