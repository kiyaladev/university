<template>
  <span class="pastille-statut" :class="`pastille-statut--${ton}`">
    <q-icon v-if="icone" :name="icone" size="14px" />
    <span>{{ texte }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { libelleStatut, tonStatut, type DomaineStatut } from '@/shared/utils/statuts';

/**
 * Pastille de statut, la même dans tous les registres : le libellé vient de
 * shared/utils/libelles, le ton de la table unique shared/utils/statuts. La couleur vit dans
 * le texte, sur un fond très dilué (DESIGN.md, « la règle du fond dilué »).
 *
 * `libelle` ne sert qu'aux rares écrans qui disent le statut autrement (une
 * phrase plus longue) ; la couleur, elle, suit toujours la table.
 */
const props = defineProps<{
  domaine: DomaineStatut;
  statut?: string | null;
  libelle?: string;
  icone?: string;
}>();

const ton = computed(() => tonStatut(props.domaine, props.statut));
const texte = computed(() => props.libelle ?? libelleStatut(props.domaine, props.statut));
</script>

<style lang="scss">
@use '@/css/quasar.variables' as *;

.pastille-statut {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 3px 10px;
  border-radius: var(--up-pilule);
  font-size: 12px;
  font-weight: 590;
  letter-spacing: -0.003em;
  line-height: 1.3;
  white-space: nowrap;
  vertical-align: middle;

  .q-icon {
    color: inherit;
  }
}

.pastille-statut--positif {
  background: var(--up-vert-fond);
  color: #{$vert};
}
.pastille-statut--attention {
  background: var(--up-jaune-fond);
  color: $jaune-texte;
}
.pastille-statut--negatif {
  background: var(--up-rouge-fond);
  color: #{$rouge};
}
.pastille-statut--neutre {
  background: var(--up-gris-inerte);
  color: var(--up-encre-douce);
}
// Clos : gris, mais l'encre pleine — un dossier rangé, pas un brouillon.
.pastille-statut--info {
  background: var(--up-gris-inerte);
  color: var(--up-encre);
}

body.body--dark {
  .pastille-statut--positif {
    color: #35c88a;
  }
  .pastille-statut--attention {
    color: #f5ce3c;
  }
  .pastille-statut--negatif {
    color: #f2637a;
  }
}
</style>
