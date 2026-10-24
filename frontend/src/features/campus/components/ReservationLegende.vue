<template>
  <div class="resas__legende">
    <span
      v-for="(lib, statut) in libelles"
      :key="statut"
      class="resas__legende-entree"
      :class="`resas__legende-entree--${statut.toLowerCase()}`"
    >
      {{ lib }}
    </span>
    <span class="resas__legende-entree resas__legende-entree--seance">
      {{ $t('reservations.legend.timetable') }}
    </span>
    <q-space />
    <span class="text-caption text-grey-7">
      {{ $t('reservations.legend.count', { count: total }) }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * Légende du calendrier des réservations : une pastille par statut, la séance
 * d'emploi du temps (lecture seule) et le nombre de réservations de la période.
 *
 * Les libellés de statut viennent de `shared/utils/libelles` : une seule
 * source de vérité pour l'écran et pour la légende.
 */
defineProps<{
  /** Libellés de statut, indexés par statut (`EN_ATTENTE`, `CONFIRME`…). */
  libelles: Record<string, string>;
  /** Nombre de réservations affichées sur la période. */
  total: number;
}>();
</script>

<style scoped lang="scss">
.resas__legende {
  display: flex;
  gap: var(--up-3);
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: var(--up-2);
  font-size: 0.8rem;
}

.resas__legende-entree {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: var(--up-craie);
    border: 1px solid var(--up-encre);
  }

  &--en_attente::before {
    background: #fcd116;
  }
  &--confirmee::before {
    background: #007a4d;
  }
  &--refusee::before,
  &--annulee::before {
    background: #86868b;
  }
  &--seance::before {
    background: var(--up-encre-douce);
  }
}
</style>
