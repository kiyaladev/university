<template>
  <div class="row q-col-gutter-md q-mb-md">
    <div class="col-12 col-md-3">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">{{ stats.nbFormes }}</div>
          <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.trained') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-md-3">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">
            {{ montantLisible(stats.recette) }} <span class="text-h6">{{ $t('common.units.gnf') }}</span>
          </div>
          <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.revenue') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-md-3">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">{{ stats.tauxRemplissage }} %</div>
          <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.fillRate') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-md-3">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">{{ stats.total }}</div>
          <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.total') }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Tableau de bord de l'écran d'administration des formations : combien de
 * formations payantes, quelle recette, quel taux de remplissage.
 *
 * La page fournit le tableau de bord du serveur et les formations affichées ;
 * ce composant en tire les chiffres.
 */
import { computed } from 'vue';
import { montantLisible } from '@/shared/utils/format';
import type { FormationDashboard } from '@/shared/services/formations';
import type { Formation } from '@/types';

const props = defineProps<{
  /** Chiffres du serveur (`/formations/dashboard`). */
  dashboard: FormationDashboard | null;
  /** Formations affichées dans la liste (pour le taux de remplissage). */
  formations: Formation[];
}>();

const stats = computed(() => {
  const d = props.dashboard;
  if (!d) {
    return { nbFormes: 0, recette: 0, tauxRemplissage: 0, total: props.formations.length };
  }
  const totalPlaces = props.formations.reduce((acc, f) => acc + (f.capacite ?? 0), 0);
  const placesOccupees = props.formations.reduce((acc, f) => {
    if (!f.capacite) return acc;
    const occupe = d.parFormation.find((p) => p.id === f.id)?.nbInscrits ?? 0;
    return acc + Math.min(occupe, f.capacite);
  }, 0);
  const tauxRemplissage = totalPlaces > 0 ? Math.round((placesOccupees / totalPlaces) * 100) : 0;
  return {
    nbFormes: d.totaux.payes,
    recette: d.totaux.recette,
    tauxRemplissage,
    total: d.total,
  };
});
</script>

<style scoped lang="scss">
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}
</style>
