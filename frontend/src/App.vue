<template>
  <router-view />
</template>

<script setup lang="ts">
// Sur un appareil Apple, la pile de fontes attrape SF Pro par `-apple-system` :
// rien à charger, et le tracking optique du système est déjà réglé. Ailleurs —
// Android, Windows — Inter prend le relais, embarquée dans le bundle : aucun
// appel réseau au chargement, ce qui compte sur une connexion de campus
// intermittente.
import '@fontsource-variable/inter';
</script>
