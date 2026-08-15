<template>
  <div class="bascule" role="group" aria-label="Affichage du listing">
    <button
      type="button"
      class="bascule__bouton"
      :class="{ 'bascule__bouton--actif': modelValue === 'tableau' }"
      :aria-pressed="modelValue === 'tableau'"
      @click="emit('update:modelValue', 'tableau')"
    >
      <q-icon name="table_rows" size="17px" />
      <span class="pochoir">Tableau</span>
    </button>
    <button
      type="button"
      class="bascule__bouton"
      :class="{ 'bascule__bouton--actif': modelValue === 'cartes' }"
      :aria-pressed="modelValue === 'cartes'"
      @click="emit('update:modelValue', 'cartes')"
    >
      <q-icon name="grid_view" size="17px" />
      <span class="pochoir">Cartes</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ModeVue } from '../composables/vuePreferee';

defineProps<{ modelValue: ModeVue }>();
const emit = defineEmits<{ 'update:modelValue': [ModeVue] }>();
</script>

<style scoped lang="scss">
// Deux plaques accolées : celle qui est choisie est peinte à l'encre.
.bascule {
  display: inline-flex;
  border: var(--up-filet);
}

.bascule__bouton {
  display: inline-flex;
  align-items: center;
  gap: var(--up-1);
  appearance: none;
  background: transparent;
  color: var(--up-encre);
  border: 0;
  padding: 7px var(--up-3);
  min-height: 38px;
  cursor: pointer;
  transition: background var(--up-transition), color var(--up-transition);

  & + & { border-left: var(--up-filet); }

  &:hover { background: var(--up-craie); }
}

.bascule__bouton--actif {
  background: var(--up-encre);
  color: var(--up-craie);

  &:hover { background: var(--up-encre); }
}

// Sur téléphone, l'icône suffit : le mot ferait déborder la barre d'actions.
@media (max-width: 599px) {
  .bascule__bouton .pochoir { display: none; }
  .bascule__bouton { padding: 7px var(--up-3); }
}
</style>
