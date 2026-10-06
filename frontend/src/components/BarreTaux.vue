<template>
  <div class="taux">
    <div class="taux__rail">
      <span class="taux__remplie" :class="`taux__remplie--${ton}`" :style="{ width: `${largeur}%` }" />
    </div>
    <span class="pochoir pochoir--brut chiffres taux__valeur">{{ pourcentLisible(valeur) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { pourcentLisible } from '../utils/libelles';

/** Lecture d'un taux : la même barre partout, aux couleurs des états. */
const props = withDefaults(defineProps<{ valeur?: number | null; seuilBas?: number; seuilHaut?: number }>(), {
  valeur: 0,
  seuilBas: 70,
  seuilHaut: 85,
});

const largeur = computed(() => Math.max(0, Math.min(100, props.valeur ?? 0)));
const ton = computed(() =>
  (props.valeur ?? 0) >= props.seuilHaut
    ? 'vert'
    : (props.valeur ?? 0) >= props.seuilBas
      ? 'jaune'
      : 'rouge',
);
</script>

<style scoped lang="scss">
.taux {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  min-width: 128px;
}

// La barre de progression d'Apple : un rail gris en pilule, un remplissage en
// pilule. Le rail cerné d'encre et l'aplat saturé à l'intérieur appartenaient
// au panneau peint — sur une liste de dix salles, dix rectangles rouges et
// verts se disputaient l'œil plus fort que les chiffres eux-mêmes.
.taux__rail {
  flex: 1;
  height: 6px;
  min-width: 64px;
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-pilule);
  overflow: hidden;
}

.taux__remplie {
  display: block;
  height: 100%;
  border-radius: var(--up-pilule);

  &--vert { background: $vert; }
  &--jaune { background: $jaune; }
  &--rouge { background: $rouge; }
}

.taux__valeur {
  width: 48px;
  text-align: right;
  color: var(--up-encre);
}
</style>
