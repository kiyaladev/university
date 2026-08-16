<script setup lang="ts">
/**
 * Sélecteur compact pour les valeurs cycliques : semestre (1 ou 2) ou session
 * (NORMALE ou RATTRAPAGE). Délègue à un QSelect en passant la valeur telle
 * quelle au backend (code attendu en string).
 */
import { computed } from 'vue';
import type { SessionDeliberation } from '../types';

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  type: 'semestre' | 'session';
  label?: string;
  clearable?: boolean;
  dense?: boolean;
}>(), {
  modelValue: null,
  label: '',
  clearable: false,
  dense: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const OPTIONS_SEMESTRE = [
  { label: 'Semestre 1', value: '1' },
  { label: 'Semestre 2', value: '2' },
];
const OPTIONS_SESSION = computed<Array<{ label: string; value: SessionDeliberation }>>(() => [
  { label: 'Session normale', value: 'NORMALE' },
  { label: 'Rattrapage', value: 'RATTRAPAGE' },
]);

const options = computed(() =>
  props.type === 'semestre' ? OPTIONS_SEMESTRE : OPTIONS_SESSION.value,
);
</script>

<template>
  <q-select
    :model-value="modelValue"
    :options="options"
    :label="label || (type === 'semestre' ? 'Semestre' : 'Session')"
    :clearable="clearable"
    :dense="dense"
    outlined
    emit-value
    map-options
    :display-value="modelValue ? undefined : 'Tous'"
    @update:model-value="(v) => emit('update:modelValue', v ?? null)"
  />
</template>