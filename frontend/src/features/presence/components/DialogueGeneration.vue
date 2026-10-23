<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="text-h6">{{ $t('emploiDuTemps.actions.generateSessions') }}</q-card-section>

      <q-card-section>
        <p class="text-body2">
          {{ $t('emploiDuTemps.generationDialog.description') }}
        </p>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <champ-date v-model="dateDebut" :label="$t('common.actions.from')" />
          </div>
          <div class="col-6">
            <champ-date v-model="dateFin" :label="$t('common.actions.to')" />
          </div>
        </div>

        <q-select
          v-model="anneeId"
          :options="optionsAnnees"
          outlined
          dense
          emit-value
          map-options
          :label="$t('common.fields.academicYear')"
          class="q-mt-md"
        />

        <q-input
          v-model="joursExclus"
          outlined
          dense
          class="q-mt-md"
          :label="$t('emploiDuTemps.generationDialog.excludedDays')"
          :hint="$t('emploiDuTemps.generationDialog.excludedDaysHint')"
        />

        <q-banner v-if="resultat" class="note--valide q-mt-md">
          <template #avatar><q-icon name="check_circle" /></template>
          {{
            $t('emploiDuTemps.generationDialog.result', {
              created: resultat.creees,
              candidates: resultat.candidates,
              skipped: resultat.ignorees,
            })
          }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="auto_awesome_motion"
          :label="$t('emploiDuTemps.actions.generateSessions')"
          :disable="!anneeId"
          :loading="chargement"
          @click="generer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import ChampDate from '@/shared/components/ChampDate.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { seancesService, type ResultatGeneration } from '../services/seances';
import { useReferentielsStore } from '@/stores/referentiels';
import { aujourdhui, decalerJours } from '@/shared/utils/libelles';
import type { AnneeAcademique } from '@/types';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const annees = ref<AnneeAcademique[]>([]);
const anneeId = ref<string>('');
const dateDebut = ref(aujourdhui());
const dateFin = ref(decalerJours(aujourdhui(), 30));
const joursExclus = ref('');
const chargement = ref(false);
const resultat = ref<ResultatGeneration | null>(null);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

async function generer() {
  // Sans année académique, le serveur refuse : on le dit ici plutôt que de
  // faire remonter une erreur de validation.
  if (!anneeId.value) {
    $q.notify({ type: 'warning', message: t('emploiDuTemps.generationDialog.yearRequired') });
    return;
  }
  chargement.value = true;
  try {
    resultat.value = await seancesService.generer({
      anneeId: anneeId.value,
      dateDebut: dateDebut.value,
      dateFin: dateFin.value,
      joursExclus: joursExclus.value
        .split(',')
        .map((j) => j.trim())
        .filter(Boolean),
    });
    emit('enregistre');
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  annees.value = await referentiels.annees();
  anneeId.value = referentiels.anneeCourante?.id ?? annees.value[0]?.id ?? '';
});
</script>
