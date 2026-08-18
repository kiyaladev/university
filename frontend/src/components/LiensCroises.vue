<script setup lang="ts">
/**
 * « Voir aussi » : la rangée de renvois d'un tableau de bord vers les écrans
 * qui produisent ses chiffres.
 *
 * Trois écrans de pilotage se recouvrent (Rapports, Statistiques MESRS,
 * Tableau de bord Rectorat). Plutôt que de les fondre, chacun annonce son
 * périmètre en tête de page et pointe vers les autres : le lecteur sait d'un
 * coup d'œil où va la suite de sa question.
 *
 * Chaque cible doit être une route déclarée dans `router/routes.ts`.
 */
defineProps<{
  liens: Array<{ to: string; libelle: string; icone?: string; aide?: string }>;
}>();
</script>

<template>
  <nav class="liens-croises" aria-label="Écrans liés">
    <span class="pochoir liens-croises__intitule">Voir aussi</span>
    <q-btn
      v-for="l in liens"
      :key="l.to"
      flat
      dense
      no-caps
      color="primary"
      :icon="l.icone"
      :label="l.libelle"
      :to="l.to"
      class="liens-croises__lien"
    >
      <q-tooltip v-if="l.aide">{{ l.aide }}</q-tooltip>
    </q-btn>
  </nav>
</template>

<style scoped lang="scss">
.liens-croises {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--up-2);
  padding: var(--up-2) var(--up-3);
  margin-bottom: var(--up-3);
  background: var(--up-plaque);
  border: var(--up-filet);
}

.liens-croises__intitule {
  color: var(--up-encre-douce);
}

.liens-croises__lien + .liens-croises__lien {
  border-left: var(--up-filet-fin);
}
</style>
