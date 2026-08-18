<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="text-h6">Générer les séances</q-card-section>

      <q-card-section>
        <p class="text-body2">
          Les séances sont créées à partir des créneaux de l’emploi du temps, jour par jour.
          Les séances déjà existantes sont conservées telles quelles.
        </p>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <champ-date v-model="dateDebut" label="Du" />
          </div>
          <div class="col-6">
            <champ-date v-model="dateFin" label="Au" />
          </div>
        </div>

        <q-select
          v-model="anneeId"
          :options="optionsAnnees"
          outlined
          dense
          emit-value
          map-options
          label="Année académique"
          class="q-mt-md"
        />

        <q-input
          v-model="joursExclus"
          outlined
          dense
          class="q-mt-md"
          label="Jours fériés à exclure"
          hint="Dates séparées par des virgules — ex. 2026-04-07, 2026-05-01"
        />

        <q-banner v-if="resultat" class="note--valide q-mt-md">
          <template #avatar><q-icon name="check_circle" /></template>
          {{ resultat.creees }} séance(s) créée(s) sur {{ resultat.candidates }} créneaux traités
          ({{ resultat.ignorees }} déjà présente(s)).
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps label="Fermer" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="auto_awesome_motion"
          label="Générer les séances"
          :disable="!anneeId"
          :loading="chargement"
          @click="generer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import ChampDate from './ChampDate.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { aujourdhui, decalerJours } from '../utils/libelles';
import type { AnneeAcademique } from '../types';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; genere: [] }>();

const $q = useQuasar();
const annees = ref<AnneeAcademique[]>([]);
const anneeId = ref<string>('');
const dateDebut = ref(aujourdhui());
const dateFin = ref(decalerJours(aujourdhui(), 30));
const joursExclus = ref('');
const chargement = ref(false);
const resultat = ref<any>(null);

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);

async function generer() {
  // Sans année académique, le serveur refuse : on le dit ici plutôt que de
  // faire remonter une erreur de validation.
  if (!anneeId.value) {
    $q.notify({ type: 'warning', message: 'Choisissez l’année académique à générer.' });
    return;
  }
  chargement.value = true;
  try {
    const { data } = await api.post('/seances/generer', {
      anneeId: anneeId.value,
      dateDebut: dateDebut.value,
      dateFin: dateFin.value,
      joursExclus: joursExclus.value
        .split(',')
        .map((j) => j.trim())
        .filter(Boolean),
    });
    resultat.value = data;
    emit('genere');
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/annees', { params: { all: '1' } });
  annees.value = data.data;
  anneeId.value = annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '';
});
</script>
