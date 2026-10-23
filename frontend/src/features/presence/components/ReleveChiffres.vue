<template>
  <!-- Un relevé : quelques chiffres, alignés, comparables d'un onglet à l'autre -->
  <section class="plaque releve">
    <div v-for="c in chiffres" :key="c.label" class="releve__ligne">
      <p class="pochoir">{{ c.label }}</p>
      <p class="lettrage avec-unite chiffres releve__valeur">{{ c.valeur }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ChiffreReleve } from '../types';

defineProps<{ chiffres: ChiffreReleve[] }>();
</script>

<style scoped lang="scss">
.releve {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.releve__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding: var(--up-3);

  &:nth-child(2n) {
    border-left: var(--up-filet);
  }
  &:nth-child(n + 3) {
    border-top: var(--up-filet);
  }
}

.releve__valeur {
  font-size: clamp(1.4rem, 1rem + 1.6vw, 2rem);
  margin: 0;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .releve {
    grid-template-columns: 1fr;
  }
  .releve__ligne:nth-child(2n) {
    border-left: 0;
  }
  .releve__ligne + .releve__ligne {
    border-top: var(--up-filet);
  }
}
</style>
