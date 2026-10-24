<template>
  <!-- Relevé de la période affichée -->
  <section class="plaque registre__releve">
    <div class="registre__releve-cellule">
      <p class="pochoir">{{ $t('common.fields.sessions') }}</p>
      <p class="lettrage chiffres registre__releve-valeur">{{ total }}</p>
    </div>
    <div class="registre__releve-cellule">
      <p class="pochoir">{{ $t('seances.summary.checked') }}</p>
      <p class="lettrage chiffres registre__releve-valeur">{{ controlees }}</p>
    </div>
    <div class="registre__releve-cellule">
      <p class="pochoir">{{ $t('common.fields.absences') }}</p>
      <p class="lettrage chiffres registre__releve-valeur">{{ absences }}</p>
    </div>
    <div class="registre__releve-cellule">
      <p class="pochoir">{{ $t('seances.summary.unchecked') }}</p>
      <p class="lettrage chiffres registre__releve-valeur">{{ sansControle }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Relevé de la période affichée : quatre chiffres, une lecture d'un coup d'œil.
 *
 * Les séances annulées ne comptent pas : une séance annulée n'a pas été
 * contrôlée, elle n'a pas eu lieu.
 */
defineProps<{ total: number; controlees: number; absences: number; sansControle: number }>();
</script>

<style scoped lang="scss">
.registre__releve {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: var(--up-3) 0;
}

.registre__releve-cellule {
  padding: var(--up-3);

  & + & {
    border-left: var(--up-filet);
  }
}

.registre__releve-valeur {
  font-size: clamp(1.4rem, 1rem + 1.6vw, 2rem);
  margin: var(--up-1) 0 0;
}

@media (max-width: 767px) {
  .registre__releve {
    grid-template-columns: repeat(2, 1fr);
  }
  .registre__releve-cellule:nth-child(2n + 1) {
    border-left: 0;
  }
  .registre__releve-cellule:nth-child(n + 3) {
    border-top: var(--up-filet);
  }
}
</style>
