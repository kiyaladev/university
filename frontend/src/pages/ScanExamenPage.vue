<template>
  <q-page class="scan-page q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Scan des examens</div>
        <div class="page-sous-titre">
          Saisissez le QR de la carte, le matricule ou l'identifiant étudiant pour valider la présence.
        </div>
      </div>
      <div class="col-auto">
        <q-btn flat no-caps icon="arrow_back" label="Retour" @click="$router.push('/examens')" />
      </div>
    </div>

    <q-card flat bordered class="ratio-carte q-mb-md">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-caption text-grey-7">Présents / Inscrits</div>
          <div class="text-h3 text-weight-bold ratio-chiffre">
            {{ examenCourant?.nbPresents ?? 0 }} / {{ examenCourant?.nbInscrits ?? '—' }}
          </div>
          <div class="text-caption text-grey-7">
            Taux {{ tauxPresence }} %
            · {{ examenCourant?.nbInscrits ? `${nbRestant} restant(s)` : 'aucun inscrit' }}
          </div>
        </div>
        <div class="col-auto">
          <q-knob
            :model-value="tauxPresence"
            :max="100"
            :thickness="0.18"
            size="120px"
            :color="tauxPresence >= 80 ? 'positive' : 'primary'"
            track-color="grey-3"
          >
            <div class="text-h5 text-weight-bold">{{ Math.round(tauxPresence) }}%</div>
          </q-knob>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row q-col-gutter-md items-end">
        <div class="col-12 col-md">
          <q-select
            v-model="examenId"
            :options="optionsExamens"
            outlined
            dense
            emit-value
            map-options
            label="Examen *"
            @update:model-value="selectionnerExamen"
          />
        </div>
        <div class="col-12 col-md-auto">
          <q-knob readonly size="48px" :model-value="examenCourant?.nbInscrits ?? 0" :max="Math.max(examenCourant?.nbInscrits ?? 0, 1)" color="primary" track-color="grey-3" />
        </div>
      </q-card-section>
      <q-card-section class="row q-col-gutter-md items-end">
        <div class="col-12 col-md">
          <qr-scanner v-model="reference" />
        </div>
        <div class="col-12 col-md-auto">
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="check"
            label="Confirmer la présence"
            :disable="!reference || !examenCourant"
            :loading="envoiScan"
            @click="confirmer"
          />
        </div>
      </q-card-section>
      <q-card-section v-if="dernierResultat" class="q-pt-none">
        <q-banner
          :class="dernierResultat.valide ? 'bg-positive text-white' : 'bg-negative text-white'"
          rounded
        >
          <template #avatar>
            <q-icon :name="dernierResultat.valide ? 'check_circle' : 'cancel'" size="md" />
          </template>
          <div class="text-weight-bold">
            {{ dernierResultat.valide ? 'Présence validée' : 'Scan rejeté' }}
            <span v-if="dernierResultat.matriculeSaisi"> · {{ dernierResultat.matriculeSaisi }}</span>
          </div>
          <div v-if="dernierResultat.valide">
            {{ dernierResultat.prenomPorteur }} {{ dernierResultat.nomPorteur }}
          </div>
          <div v-else>
            Motif : {{ dernierResultat.motifRejet ?? 'carte inconnue' }}
          </div>
        </q-banner>
      </q-card-section>
    </q-card>

    <q-card v-if="dernierResultat?.valide" flat bordered class="carte-identite q-mb-md">
      <q-card-section class="text-center">
        <q-avatar size="120px" color="primary" text-color="white" class="q-mb-md">
          <q-icon name="person" size="80px" />
        </q-avatar>
        <div class="text-h4 text-weight-bold">
          {{ dernierResultat.prenomPorteur }} {{ dernierResultat.nomPorteur }}
        </div>
        <div class="text-h6 text-grey-7 q-mt-sm">
          {{ dernierResultat.matriculeSaisi ?? dernierResultat.inscription?.etudiant?.matricule ?? '—' }}
        </div>
        <div v-if="dernierResultat.inscription?.etudiant" class="text-caption text-grey-7 q-mt-sm">
          {{ dernierResultat.inscription.etudiant.nom }} {{ dernierResultat.inscription.etudiant.prenom }}
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import QrScanner from '../components/QrScanner.vue';
import { LIBELLE_TYPE_EXAMEN, dateLisible } from '../utils/libelles';
import type { Examen } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const examens = ref<Examen[]>([]);
const examenId = ref<string | null>(null);
const examenCourant = ref<Examen | null>(null);
const reference = ref('');
const envoiScan = ref(false);
const dernierResultat = ref<any | null>(null);

const optionsExamens = computed(() =>
  examens.value.map((e) => ({
    value: e.id,
    label: `${e.codeExamen} — ${e.intitule} (${LIBELLE_TYPE_EXAMEN[e.type] ?? e.type}, ${dateLisible(e.dateExamen)})`,
  })),
);

const tauxPresence = computed(() => {
  if (!examenCourant.value || !examenCourant.value.nbInscrits) return 0;
  return Math.min(100, (examenCourant.value.nbPresents / examenCourant.value.nbInscrits) * 100);
});

const nbRestant = computed(() => {
  if (!examenCourant.value) return 0;
  return Math.max(0, examenCourant.value.nbInscrits - examenCourant.value.nbPresents);
});

async function chargerExamens() {
  const { data } = await api.get('/examens', {
    params: {
      all: 1,
      statut: 'EN_COURS',
      pageSize: 200,
    },
  });
  examens.value = data.data;
  if (!examenId.value && examens.value.length) {
    await selectionnerExamen(examens.value[0].id);
  }
}

async function selectionnerExamen(id: string) {
  examenId.value = id;
  if (!id) {
    examenCourant.value = null;
    return;
  }
  const { data } = await api.get(`/examens/${id}/stats`);
  examenCourant.value = { id, ...examenCourant.value, ...data };
  const full = await api.get(`/examens/${id}`);
  examenCourant.value = full.data;
}

async function confirmer() {
  if (!examenCourant.value || !reference.value.trim()) return;
  envoiScan.value = true;
  try {
    const { data } = await api.post('/examens/scan', {
      examenId: examenCourant.value.id,
      reference: reference.value.trim(),
      scanneurId: auth.utilisateur?.id,
    });
    dernierResultat.value = data;
    reference.value = '';
    await selectionnerExamen(examenCourant.value.id);
    await chargerExamens();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Scan impossible' });
  } finally {
    envoiScan.value = false;
  }
}

onMounted(chargerExamens);
</script>

<style scoped lang="scss">
.scan-page {
  min-height: 100vh;
  background: var(--up-fond, #f6f5ee);
}
.ratio-carte .ratio-chiffre {
  font-family: "Inter", sans-serif;
  color: var(--up-encre);
}
.carte-identite {
  background: linear-gradient(135deg, var(--up-craie), #fff);
}
</style>
