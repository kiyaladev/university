<script setup lang="ts">
/**
 * « Rien à afficher », dit partout de la même façon : icône, phrase, aide,
 * puis l'action qui sort de l'impasse. Porte la classe globale `.etat-vide`
 * (app.scss), qui tient aussi toute la largeur d'une grille de cartes.
 *
 *   <template #no-data>
 *     <etat-vide icone="apartment" :titre="$t('…emptyState.title')" :aide="$t('…emptyState.hint')">
 *       <template #action><q-btn flat no-caps color="primary" icon="add" … /></template>
 *     </etat-vide>
 *   </template>
 */
defineProps<{
  icone: string;
  titre: string;
  aide?: string | undefined;
}>();
</script>

<template>
  <div class="etat-vide" role="status">
    <q-icon :name="icone" size="36px" />
    <div class="text-subtitle2">{{ titre }}</div>
    <div v-if="aide" class="text-caption">{{ aide }}</div>
    <slot name="action" />
  </div>
</template>
