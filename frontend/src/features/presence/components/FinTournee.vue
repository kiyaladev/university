<template>
  <!-- Fin de tournée : le panneau se referme sur ce qui reste à faire -->
  <footer class="plaque fin-tournee">
    <div>
      <p class="lettrage fin-tournee__titre">
        {{
          restantes
            ? $t('controle.footer.titleRemaining', {
                n: restantes,
                room: restantes > 1 ? $t('controle.footer.roomPlural') : $t('controle.footer.roomSingular'),
              })
            : $t('controle.footer.titleComplete')
        }}
      </p>
      <p class="pochoir pochoir--brut fin-tournee__detail">
        {{ $t('controle.footer.detail', { pointees, total, jour: jourLisible }) }}
      </p>
    </div>
    <div class="fin-tournee__actions">
      <q-btn flat no-caps icon="event_note" :label="$t('controle.footer.registre')" :to="lienRegistreJour" />
      <q-btn outline no-caps icon="print" :label="$t('controle.footer.imprimer')" @click="emit('imprimer')" />
    </div>
  </footer>
</template>

<script setup lang="ts">
/**
 * Fin de tournée : le panneau se referme sur ce qui reste à faire, et propose
 * le registre du jour.
 */
defineProps<{
  restantes: number;
  pointees: number;
  total: number;
  jourLisible: string;
  lienRegistreJour: { name: string; query: Record<string, string> };
}>();
const emit = defineEmits<{ imprimer: [] }>();
</script>

<style scoped lang="scss">
.fin-tournee {
  margin: 0 var(--up-3) var(--up-4);
  padding: var(--up-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.fin-tournee__titre {
  font-size: 1.15rem;
  margin: 0;
}

.fin-tournee__detail {
  margin: 4px 0 0;
  color: var(--up-encre-douce);
  font-weight: 600;
}

.fin-tournee__actions {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  flex-wrap: wrap;
}

// Sur grand écran, le pied de tournée se cale sur la largeur de lecture du panneau.
@media (min-width: 1024px) {
  .fin-tournee {
    max-width: 1180px;
    margin-inline: var(--up-4);
  }
}
</style>
