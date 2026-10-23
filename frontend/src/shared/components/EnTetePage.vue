<template>
  <header class="page-entete">
    <div>
      <h1 class="page-titre">{{ title }}</h1>
      <p v-if="subtitle" class="page-sous-titre">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-entete__actions"><slot name="actions" /></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>
<style scoped>
.page-entete { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 16px; margin-bottom: 20px; }
.page-titre { margin: 0; }
.page-sous-titre { margin: 8px 0 0; }
.page-entete__actions { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.page-entete__actions :deep(> div) { display: flex; flex-wrap: wrap; max-width: 100%; }
@media (max-width: 599px) { .page-entete { grid-template-columns: minmax(0, 1fr); } }
</style>
