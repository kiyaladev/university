<template>
  <!-- Relevé de la semaine affichée -->
  <section class="plaque edt__releve">
    <div class="edt__releve-cellule">
      <p class="pochoir">{{ $t('emploiDuTemps.summary.slots') }}</p>
      <p class="lettrage chiffres edt__releve-valeur">{{ creneaux }}</p>
    </div>
    <div class="edt__releve-cellule">
      <p class="pochoir">{{ $t('emploiDuTemps.summary.hoursPerWeek') }}</p>
      <p class="lettrage avec-unite chiffres edt__releve-valeur">{{ heuresLisibles(heures) }}</p>
    </div>
    <div class="edt__releve-cellule">
      <p class="pochoir">{{ $t('emploiDuTemps.summary.busiestDay') }}</p>
      <p class="lettrage edt__releve-valeur">{{ jourCharge }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { heuresLisibles } from '@/shared/utils/libelles';

/** Relevé de la semaine affichée : trois chiffres, une lecture d'un coup d'œil. */
defineProps<{ creneaux: number; heures: number; jourCharge: string }>();
</script>

<style scoped lang="scss">
.edt__releve {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: var(--up-3);
}

.edt__releve-cellule {
  padding: var(--up-3);

  & + & {
    border-left: var(--up-filet);
  }
}

.edt__releve-valeur {
  font-size: clamp(1.3rem, 1rem + 1.4vw, 1.9rem);
  margin: var(--up-1) 0 0;
}

@media (max-width: 767px) {
  .edt__releve {
    grid-template-columns: 1fr;
  }

  .edt__releve-cellule + .edt__releve-cellule {
    border-left: 0;
    border-top: var(--up-filet);
  }
}
</style>
