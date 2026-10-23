<template>
  <!-- Relevé du panneau : une lecture par ligne, comme sur la planche peinte -->
  <section class="plaque releve">
    <div v-for="k in kpis" :key="k.libelle" class="releve__ligne">
      <div class="releve__intitule">
        <p class="pochoir releve__libelle">{{ k.libelle }}</p>
        <p class="pochoir pochoir--brut releve__detail">{{ k.detail }}</p>
      </div>
      <!-- Le chiffre se lit en encre, et l'encre bascule avec le thème. Une
           classe `text-secondary` figeait #1D1D1F : invisible en sombre. -->
      <p class="lettrage avec-unite chiffres releve__valeur">{{ k.valeur }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { KpiTableauBord } from '../types';

defineProps<{ kpis: KpiTableauBord[] }>();
</script>

<style scoped lang="scss">
.releve {
  margin-bottom: var(--up-3);
}

.releve__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding: var(--up-3);

  & + & {
    border-top: var(--up-filet-fin);
  }
}

.releve__libelle {
  color: var(--up-encre);
}

.releve__detail {
  color: var(--up-encre-douce);
  margin: 3px 0 0;
  font-weight: 600;
}

.releve__valeur {
  font-size: clamp(1.7rem, 1.2rem + 1.8vw, 2.3rem);
  color: var(--up-encre);
  margin: 0;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .releve {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .releve__ligne + .releve__ligne {
    border-top: 0;
  }
  .releve__ligne:nth-child(2n) {
    border-left: var(--up-filet);
  }
  .releve__ligne:nth-child(n + 3) {
    border-top: var(--up-filet);
  }
}
</style>
