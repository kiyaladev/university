<script setup lang="ts">
import { Comment, Fragment, Text, useSlots } from 'vue';
import type { VNode } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const slots = useSlots();
function presente(nodes: VNode[]): boolean {
  return nodes.some((node) =>
    node.type === Fragment ? presente((node.children as VNode[]) ?? []) : node.type !== Comment && node.type !== Text,
  );
}
</script>
<template>
  <q-btn
    v-if="presente(slots.default?.() ?? [])"
    flat
    dense
    no-caps
    icon="more_horiz"
    :label="t('common.actions.otherActions')"
    @click.stop
  >
    <q-menu auto-close>
      <div class="actions-secondaires column q-pa-xs" @click.stop><slot /></div>
    </q-menu>
  </q-btn>
</template>
<style scoped>
.actions-secondaires {
  min-width: 200px;
  max-width: min(360px, 90vw);
}
.actions-secondaires :deep(.q-btn) {
  justify-content: flex-start;
  text-align: left;
}
.actions-secondaires :deep(.q-btn__content) {
  justify-content: flex-start;
  flex-wrap: nowrap;
}
</style>
