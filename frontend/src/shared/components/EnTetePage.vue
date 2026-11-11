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
.page-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 20px;
}
/* Le bloc titre garde au moins 20 rem : si les actions sont trop larges
   (tablette), elles passent sous le titre au lieu de l'écraser. */
.page-entete > :first-child {
  flex: 1 1 20rem;
  min-width: 0;
}
.page-titre {
  margin: 0;
}
.page-sous-titre {
  margin: 8px 0 0;
}
.page-entete__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.page-entete__actions :deep(> div) {
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
}
@media (max-width: 599px) {
  .page-entete > :first-child {
    flex-basis: 100%;
  }
}
</style>
