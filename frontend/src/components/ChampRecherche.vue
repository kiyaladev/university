<template>
  <q-input
    v-model="modelValue"
    dense
    outlined
    clearable
    :placeholder="placeholder"
    class="champ-recherche"
  >
    <template #prepend><q-icon name="search" /></template>
  </q-input>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ placeholder?: string }>(), {
  placeholder: 'Rechercher…',
});

const modelValue = defineModel<string>({ default: '' });
</script>
