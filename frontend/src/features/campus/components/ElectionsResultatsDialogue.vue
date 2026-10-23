<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 560px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ $t('elections.dialogs.results.title', { title: election?.titre }) }}</div>
        <q-space />
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" @click="emit('update:modelValue', false)" />
      </q-card-section>

      <q-card-section v-if="chargement" class="etat-vide">
        <q-spinner color="primary" size="28px" />
        <span class="pochoir">{{ $t('elections.dialogs.results.loading') }}</span>
      </q-card-section>

      <q-card-section v-else-if="!resultats">
        <etat-vide icone="bar_chart" :titre="$t('elections.dialogs.results.unavailable')" />
      </q-card-section>

      <q-card-section v-else>
        <q-banner v-if="election?.statut !== 'PROCLAME'" class="note--alerte q-mb-md">
          <template #avatar><q-icon name="visibility_off" /></template>
          {{ $t('elections.dialogs.results.provisionalBanner') }}
        </q-banner>
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('elections.dialogs.results.ballots') }}</div>
            <div class="text-h6 chiffres">{{ resultats.participation.nbBulletins }}</div>
          </div>
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('elections.dialogs.results.votesExpressed') }}</div>
            <div class="text-h6 chiffres">{{ resultats.participation.voixTotales }}</div>
          </div>
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('elections.dialogs.results.seatsToFill') }}</div>
            <div class="text-h6 chiffres">{{ resultats.participation.siegesPourvoir }}</div>
          </div>
        </div>
        <q-list bordered separator>
          <q-item v-for="c in resultats.candidats" :key="c.id">
            <q-item-section avatar>
              <q-avatar :color="c.elu ? 'amber-8' : 'grey-4'" text-color="white">
                <q-icon v-if="c.elu" name="emoji_events" />
                <span v-else class="chiffres">{{ c.ordre }}</span>
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>
                <strong>{{ c.prenom }} {{ c.nom }}</strong>
                <q-chip v-if="c.elu" dense square color="amber-8" text-color="white" class="q-ml-sm">
                  {{ $t('elections.dialogs.results.elected') }}
                </q-chip>
              </q-item-label>
              <q-item-label caption class="chiffres"
                >{{ c.voix }} {{ $t('elections.dialogs.results.votesSuffix') }}</q-item-label
              >
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Résultats d'un scrutin. Le dialogue charge lui-même les résultats à son
 * ouverture.
 */
import { ref, watch } from 'vue';
import { electionsService } from '../services/elections';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { Election, ResultatElection } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  election: Election | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [ouvert: boolean] }>();

const resultats = ref<ResultatElection | null>(null);
const chargement = ref(false);

watch(
  () => [props.modelValue, props.election?.id] as const,
  async ([ouvert, id]) => {
    if (!ouvert || !id) return;
    resultats.value = null;
    chargement.value = true;
    try {
      resultats.value = await electionsService.resultats(id);
    } catch {
      /* notifié par l'intercepteur */
    } finally {
      chargement.value = false;
    }
  },
  { immediate: true },
);
</script>
