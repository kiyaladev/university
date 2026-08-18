<script setup lang="ts">
/**
 * Pagination côté serveur. Le parent pilote lui-même la requête : il observe
 * `page` et `pageSize`, et rappelle l'API. On centralise ici les contrôles.
 */
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  page: number;
  pageSize: number;
  total: number;
  /** Active le mode "tout" pour exporter/imprimer d'un coup */
  showAll?: boolean;
}>(), {
  showAll: true,
});
const emit = defineEmits<{
  'update:page': [v: number];
  'update:pageSize': [v: number];
  'tous': [];
}>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const debut = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1));
const fin = computed(() => Math.min(props.page * props.pageSize, props.total));
</script>

<template>
  <div class="barre-pagination">
    <span class="pochoir chiffres barre-pagination__compte" aria-live="polite">
      {{ debut }}–{{ fin }} sur {{ total }}
    </span>
    <q-space />
    <q-pagination
      :model-value="page"
      :max="totalPages"
      :max-pages="6"
      direction-links
      boundary-links
      @update:model-value="(v) => emit('update:page', v)"
    />
    <q-select
      :model-value="pageSize"
      :options="[10, 20, 50, 100, 200]"
      emit-value
      map-options
      dense
      outlined
      label="Par page"
      aria-label="Nombre de lignes par page"
      class="barre-pagination__taille"
      @update:model-value="(v) => emit('update:pageSize', v)"
    />
    <q-btn
      v-if="showAll"
      flat
      dense
      icon="select_all"
      label="Charger tout"
      aria-label="Charger la totalité des lignes, sans pagination"
      no-caps
      @click="emit('tous')"
    />
  </div>
</template>

<style scoped>
.barre-pagination {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
/* Corps « label » du système, porté par `.pochoir` dans le gabarit. */
.barre-pagination__compte {
  color: var(--up-encre-douce);
}
.barre-pagination__taille {
  min-width: 110px;
}
</style>
