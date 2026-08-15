<template>
  <router-view />
</template>

<script setup lang="ts">
// Lettrage du panneau, embarqué dans le bundle : aucun appel réseau au chargement,
// ce qui compte sur une connexion de campus intermittente.
import '@fontsource-variable/archivo';
import '@fontsource/anton';
</script>
