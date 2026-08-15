<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ chambre ? `Chambre ${chambre.code}` : 'Nouvelle chambre' }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Identification</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-5">
            <q-input v-model="form.code" outlined dense label="Code *" placeholder="R1-101" />
          </div>
          <div class="col-12 col-sm-7">
            <q-select
              v-model="form.residenceId"
              :options="optionsResidences"
              outlined
              dense
              emit-value
              map-options
              label="Résidence *"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.categorie"
              :options="optionsCategories"
              outlined
              dense
              label="Catégorie *"
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-input v-model.number="form.lits" type="number" min="1" outlined dense label="Lits" />
          </div>
          <div class="col-12 col-sm-3">
            <q-select
              v-model="form.statut"
              :options="optionsStatuts"
              outlined
              dense
              label="Statut *"
            />
          </div>
        </div>

        <span class="section-titre">Loyer</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.loyer"
              type="number"
              min="0"
              step="0.01"
              outlined
              dense
              label="Loyer par mois"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.devise"
              outlined
              dense
              label="Devise"
              hint="Facturation future via Mobile Money (module paiement)"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { LIBELLE_CATEGORIE_CHAMBRE, LIBELLE_STATUT_CHAMBRE } from '../utils/libelles';
import type { Chambre, Residence } from '../types';

const props = defineProps<{
  modelValue: boolean;
  chambre?: Chambre | null;
  residences: Residence[];
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({
  code: '',
  residenceId: null as string | null,
  categorie: 'CHAMBRE_PARTAGEE',
  lits: 2,
  loyer: 0,
  devise: 'GNF',
  statut: 'LIBRE',
});

const optionsResidences = computed(() =>
  props.residences.map((r) => ({ label: `${r.code} — ${r.nom}`, value: r.id })),
);
const optionsCategories = computed(() =>
  Object.entries(LIBELLE_CATEGORIE_CHAMBRE).map(([value, label]) => ({ value, label })),
);
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_CHAMBRE).map(([value, label]) => ({ value, label })),
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const c = props.chambre;
    form.value = {
      code: c?.code ?? '',
      residenceId: c?.residenceId ?? null,
      categorie: c?.categorie ?? 'CHAMBRE_PARTAGEE',
      lits: c?.lits ?? 1,
      loyer: c?.loyer ?? 0,
      devise: c?.devise ?? 'GNF',
      statut: c?.statut ?? 'LIBRE',
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = { ...form.value };
    if (props.chambre) await api.put(`/chambres/${props.chambre.id}`, payload);
    else await api.post('/chambres', payload);
    $q.notify({ type: 'positive', message: 'Chambre enregistrée' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>