<template>
  <!-- Sur téléphone, on choisit le jour affiché -->
  <div class="edt__jours">
    <button
      v-for="j in semaine"
      :key="j.jour"
      type="button"
      class="pochoir edt__jour-bouton"
      :class="{ 'edt__jour-bouton--actif': jourActif === j.jour }"
      @click="emit('update:jourActif', j.jour)"
    >
      {{ j.libelle.slice(0, 3) }}
      <span class="edt__jour-compte chiffres">{{ j.creneaux.length }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { JourEmploiDuTemps } from '../services/creneaux';

/** Choix du jour affiché, sur les écrans trop étroits pour une grille. */
defineProps<{ semaine: JourEmploiDuTemps[]; jourActif: number }>();
const emit = defineEmits<{ 'update:jourActif': [number] }>();
</script>

<style scoped lang="scss">
.edt__jours {
  display: flex;
  margin-bottom: var(--up-3);
  overflow-x: auto;
}

.edt__jour-bouton {
  appearance: none;
  flex: 1 0 auto;
  background: var(--up-plaque);
  color: var(--up-encre);
  border: var(--up-filet);
  padding: 8px 12px;
  min-height: 52px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  & + & {
    border-left-width: 0;
  }

  &--actif {
    background: var(--up-plaque);
    color: var(--up-encre);
    box-shadow: var(--up-ombre-1);
  }
}

.edt__jour-compte {
  font-size: 13px;
}
</style>
