<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ existant ? 'Modifier la recette' : 'Émettre une recette' }}</div>
        <div class="text-caption text-grey-7">
          Le numéro suit le pattern REC-AAAA-NNNNN — utilisé sur la facture ou le reçu.
        </div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input v-model="form.numero" :disable="!!existant" outlined dense label="Numéro (REC-AAAA-XXXXX)" />
          </div>
          <div class="col-6">
            <q-select
              v-model="form.type"
              :options="optionsTypes"
              outlined
              dense
              emit-value
              map-options
              label="Type"
            />
          </div>
        </div>
        <q-input v-model="form.libelle" outlined dense label="Libellé *" />
        <q-input v-model="form.description" outlined dense type="textarea" rows="2" label="Description" />
        <div class="row q-col-gutter-md">
          <div class="col-4">
            <champ-date v-model="form.date" label="Date *" />
          </div>
          <div class="col-4">
            <q-input v-model.number="form.montant" type="number" min="0" outlined dense label="Montant *" />
          </div>
          <div class="col-4">
            <q-input v-model="form.devise" outlined dense label="Devise" />
          </div>
        </div>
        <q-input v-model="form.client" outlined dense label="Client" />
        <q-input v-model="form.factureNum" outlined dense label="N° de facture" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn unelevated color="primary" :label="existant ? 'Enregistrer' : 'Émettre'" :loading="envoi" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';
import { LIBELLE_TYPE_RECETTE, aujourdhui } from '../utils/libelles';

const props = defineProps<{
  modelValue: boolean;
  existant: any | null;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  cree: [];
}>();

const $q = useQuasar();

const optionsTypes = (['ANALYSE_LABO', 'LOCATION_AMPHI', 'PRESTATION_FORMATION', 'PRESTATION_CONSEIL', 'AUTRE'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_RECETTE[value],
}));

const form = ref({
  numero: '',
  type: 'PRESTATION_FORMATION',
  libelle: '',
  description: '',
  montant: 0,
  devise: 'GNF',
  date: aujourdhui(),
  client: '',
  factureNum: '',
});

const envoi = ref(false);

watch(
  () => props.modelValue,
  (v) => {
    if (v && props.existant) {
      form.value = {
        numero: props.existant.numero,
        type: props.existant.type,
        libelle: props.existant.libelle,
        description: props.existant.description ?? '',
        montant: props.existant.montant,
        devise: props.existant.devise ?? 'GNF',
        date: props.existant.date?.slice(0, 10) ?? aujourdhui(),
        client: props.existant.client ?? '',
        factureNum: props.existant.factureNum ?? '',
      };
    } else if (v && !props.existant) {
      form.value = {
        numero: '',
        type: 'PRESTATION_FORMATION',
        libelle: '',
        description: '',
        montant: 0,
        devise: 'GNF',
        date: aujourdhui(),
        client: '',
        factureNum: '',
      };
    }
  },
);

async function enregistrer() {
  if (!form.value.numero || !form.value.libelle || !form.value.montant || !form.value.date) {
    $q.notify({ type: 'warning', message: 'Champs obligatoires manquants' });
    return;
  }
  envoi.value = true;
  try {
    if (props.existant) {
      await api.put(`/recettes/${props.existant.id}`, form.value);
      $q.notify({ type: 'positive', message: 'Recette modifiée' });
    } else {
      await api.post('/recettes', form.value);
      $q.notify({ type: 'positive', message: 'Recette émise' });
    }
    emit('update:modelValue', false);
    emit('cree');
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Enregistrement impossible' });
  } finally {
    envoi.value = false;
  }
}
</script>
