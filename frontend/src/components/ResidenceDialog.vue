<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ residence ? 'Modifier la résidence' : 'Nouvelle résidence' }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Identité</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-input v-model="form.code" outlined dense label="Code *" placeholder="C1" />
          </div>
          <div class="col-12 col-sm-8">
            <q-input v-model="form.nom" outlined dense label="Nom *" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.ville" outlined dense label="Ville" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.capacite"
              type="number"
              min="0"
              outlined
              dense
              label="Capacité (lits)"
            />
          </div>
        </div>

        <span class="section-titre">Localisation et responsabilité</span>
        <q-input v-model="form.adresse" outlined dense label="Adresse" />
        <q-input
          v-model="form.responsable"
          outlined
          dense
          label="Responsable"
          hint="Gestionnaire de la résidence, chargé de la remise des clés"
          class="q-mt-md"
        />

        <q-toggle v-model="form.actif" label="Résidence active" class="q-mt-sm" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import type { Residence } from '../types';

const props = defineProps<{
  modelValue: boolean;
  residence?: Residence | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({
  code: '',
  nom: '',
  ville: '',
  adresse: '',
  capacite: 0,
  responsable: '',
  actif: true,
});

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const r = props.residence;
    form.value = {
      code: r?.code ?? '',
      nom: r?.nom ?? '',
      ville: r?.ville ?? '',
      adresse: r?.adresse ?? '',
      capacite: r?.capacite ?? 0,
      responsable: r?.responsable ?? '',
      actif: r?.actif ?? true,
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      ...form.value,
      ville: form.value.ville || undefined,
      adresse: form.value.adresse || undefined,
      responsable: form.value.responsable || undefined,
    };
    if (props.residence) await api.put(`/residences/${props.residence.id}`, payload);
    else await api.post('/residences', payload);
    $q.notify({ type: 'positive', message: 'Résidence enregistrée' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>