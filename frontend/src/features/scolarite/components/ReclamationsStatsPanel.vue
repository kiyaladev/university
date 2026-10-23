<template>
  <div class="row q-col-gutter-md q-mb-md">
    <div v-for="s in plaques" :key="s.cle" class="col-6 col-md-3">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres" :class="{ 'text-warning': s.alerte }">
            {{ stats?.[s.cle] ?? 0 }}
          </div>
          <div class="pochoir text-grey-7">{{ s.libelle }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Compteurs du registre des réclamations.
 *
 * Le composant ne fait aucune requête : la page charge le tableau de bord et
 * passe les compteurs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  /** Compteurs du tableau de bord (`/reclamations/dashboard`). */
  stats: Record<string, number | undefined> | null;
}>();

const { t } = useI18n();

// Seuls les compteurs qui appellent une action sont mis en alerte.
const plaques = computed(() => [
  { cle: 'OUVERT', libelle: t('reclamations.stats.ouvertes'), alerte: false },
  { cle: 'EN_ATTENTE_REPONSE', libelle: t('reclamations.stats.attenteReponse'), alerte: false },
  { cle: 'urgentes', libelle: t('reclamations.stats.urgentes'), alerte: true },
  { cle: 'delaiDepasse', libelle: t('reclamations.stats.delaiDepasse'), alerte: true },
]);
</script>

<style scoped lang="scss">
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}
</style>
