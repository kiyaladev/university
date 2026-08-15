<template>
  <span class="champ champ-statut" :class="[`champ--${classe}`, dense && 'champ-statut--dense']">
    <q-icon v-if="!dense" :name="ICONE_STATUT_PRESENCE[statut] ?? 'help_outline'" size="16px" />
    <span class="pochoir">{{ LIBELLE_STATUT_PRESENCE[statut] ?? statut }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ICONE_STATUT_PRESENCE, LIBELLE_STATUT_PRESENCE } from '../utils/libelles';

/**
 * Un statut de présence est un champ peint, jamais une pastille posée sur du
 * blanc : même grammaire dans la tournée, les registres et les relevés.
 */
const props = withDefaults(defineProps<{ statut: string; dense?: boolean }>(), {
  dense: false,
});

const classe = computed(
  () =>
    ({
      PRESENT: 'present',
      RETARD: 'retard',
      ABSENT: 'absent',
      EXCUSE: 'excuse',
      REMPLACE: 'remplace',
      DEPART_ANTICIPE: 'depart',
      NON_CONTROLE: 'neutre',
    })[props.statut] ?? 'neutre',
);
</script>

<style scoped lang="scss">
.champ-statut {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  gap: 5px;
  padding: 5px 9px;
  min-height: 28px;
  border: 2px solid var(--up-encre);
}

.champ-statut--dense {
  padding: 3px 7px;
  min-height: 24px;
}

.champ--neutre {
  background: transparent;
  color: var(--up-encre-douce);
  border-style: dashed;
}
</style>
