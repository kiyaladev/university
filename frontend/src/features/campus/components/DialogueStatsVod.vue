<script setup lang="ts">
/**
 * Statistiques de consultation d'une ressource VOD.
 *
 * Le dialogue charge lui-même les agrégats à son ouverture : la ressource
 * choisie peut changer pendant que le panneau est fermé, et l'affichage ne
 * doit jamais montrer les chiffres d'une autre ressource.
 */
import { computed, ref, watch } from 'vue';
import { vodService, type StatsVod } from '../services/vod';
import EtatVide from '@/shared/components/EtatVide.vue';

const props = defineProps<{
  modelValue: boolean;
  /** Identifiant de la ressource observée. */
  vodId: string | null;
  /** Titre de la ressource, affiché en en-tête. */
  titre?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [ouvert: boolean] }>();

const stats = ref<StatsVod | null>(null);
const chargement = ref(false);

watch(
  () => [props.modelValue, props.vodId] as const,
  async ([ouvert, id]) => {
    if (!ouvert || !id) return;
    stats.value = null;
    chargement.value = true;
    try {
      stats.value = await vodService.statistiques(id);
    } catch {
      /* notifié par l'intercepteur */
    } finally {
      chargement.value = false;
    }
  },
  { immediate: true },
);

/** Une durée en secondes, lisible : 1 h 05 ou 3 min 20. */
function duree(secondes: number | null | undefined): string {
  const total = Math.max(0, Math.round(secondes ?? 0));
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  if (minutes === 0) return `${reste} s`;
  return `${minutes} min ${String(reste).padStart(2, '0')}`;
}

/** Position atteinte par le lecteur, exprimée en pourcentage de la durée. */
function progression(vue: { positionSecondes?: number | null; dureeSecondes?: number | null }): number {
  const totale = vue.dureeSecondes ?? 0;
  if (totale <= 0) return 0;
  return Math.min(100, Math.round(((vue.positionSecondes ?? 0) / totale) * 100));
}

const taux = computed(() => stats.value?.calcules.tauxComplet ?? 0);
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 560px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ $t('vodPage.stats.title') }}</div>
        <q-space />
        <q-btn
          flat
          round
          dense
          icon="close"
          :aria-label="$t('common.actions.close')"
          @click="emit('update:modelValue', false)"
        />
      </q-card-section>

      <q-card-section v-if="chargement" class="etat-vide">
        <q-spinner color="primary" size="28px" />
        <span class="pochoir">{{ $t('vodPage.stats.loading') }}</span>
      </q-card-section>

      <q-card-section v-else-if="!stats">
        <etat-vide icone="bar_chart" :titre="$t('vodPage.stats.unavailable')" />
      </q-card-section>

      <q-card-section v-else>
        <div v-if="stats.vod.titre" class="text-subtitle2 q-mb-md">{{ stats.vod.titre }}</div>

        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('vodPage.stats.views') }}</div>
            <div class="text-h6 chiffres">{{ stats.calcules.nbVues }}</div>
          </div>
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('vodPage.stats.completions') }}</div>
            <div class="text-h6 chiffres">{{ stats.calcules.nbComplets }}</div>
          </div>
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('vodPage.stats.completionRate') }}</div>
            <div class="text-h6 chiffres">{{ taux }} %</div>
          </div>
        </div>

        <q-linear-progress :value="taux / 100" color="primary" rounded class="q-mb-md" />

        <div class="text-caption text-grey-7 q-mb-sm">
          {{ $t('vodPage.stats.averageDuration') }} : {{ duree(stats.calcules.dureeMoyenneSecondes) }}
        </div>

        <div class="text-subtitle2 q-mt-md q-mb-xs">{{ $t('vodPage.stats.recentViews') }}</div>
        <q-list v-if="stats.dernieres.length" bordered separator>
          <q-item v-for="vue in stats.dernieres" :key="vue.id">
            <q-item-section>
              <q-item-label>
                {{ vue.etudiant ? `${vue.etudiant.prenom} ${vue.etudiant.nom}` : $t('vodPage.stats.anonymous') }}
              </q-item-label>
              <q-item-label caption>{{ vue.dateDebut }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip dense square :color="vue.termine ? 'positive' : 'grey-6'" text-color="white">
                {{ vue.termine ? $t('vodPage.stats.completed') : $t('vodPage.stats.inProgress') }}
              </q-chip>
              <div class="text-caption text-grey-7">{{ progression(vue) }} %</div>
            </q-item-section>
          </q-item>
        </q-list>
        <etat-vide v-else icone="visibility" :titre="$t('vodPage.stats.noViews')" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
