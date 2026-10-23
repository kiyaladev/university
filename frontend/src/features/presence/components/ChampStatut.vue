<template>
  <span class="champ champ-statut" :class="[`champ--${classe}`, dense && 'champ-statut--dense']">
    <q-icon v-if="!dense" :name="ICONE_STATUT_PRESENCE[statut] ?? 'help_outline'" size="16px" />
    <span class="pochoir">{{ LIBELLE_STATUT_PRESENCE[statut] ?? statut }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ICONE_STATUT_PRESENCE, LIBELLE_STATUT_PRESENCE } from '@/shared/utils/libelles';
import { CLASSE_CHAMP_PRESENCE } from '@/shared/utils/statuts';
import type { StatutPresence } from '@/types';

/**
 * Un statut de présence est un champ peint, jamais une pastille posée sur du
 * blanc : même grammaire dans la tournée, les registres et les relevés.
 */
const props = withDefaults(defineProps<{ statut: string; dense?: boolean }>(), {
  dense: false,
});

const classe = computed(
  () => CLASSE_CHAMP_PRESENCE[props.statut as StatutPresence] ?? 'neutre',
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
  border: var(--up-filet);
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
