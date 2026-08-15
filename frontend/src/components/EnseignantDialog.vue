<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ enseignant ? 'Modifier l’enseignant' : 'Nouvel enseignant' }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Identité</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.matricule" outlined dense label="Matricule *" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.statut"
              :options="STATUTS_ENSEIGNANT"
              outlined
              dense
              label="Statut *"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.nom" outlined dense label="Nom *" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.prenom" outlined dense label="Prénom *" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.email" outlined dense type="email" label="E-mail" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.telephone" outlined dense label="Téléphone" />
          </div>
        </div>

        <span class="section-titre">Rattachement et rémunération</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.grade" outlined dense label="Grade" hint="Assistant, Professeur…" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.departementId"
              :options="optionsDepartements"
              outlined
              dense
              clearable
              emit-value
              map-options
              label="Département"
            />
          </div>
        </div>

        <q-input
          v-model.number="form.tauxHoraire"
          type="number"
          outlined
          dense
          label="Taux horaire (GNF)"
          hint="Utilisé pour l’état de paiement des vacataires"
        />

        <q-toggle v-model="form.actif" label="Enseignant en activité" />
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
import { STATUTS_ENSEIGNANT } from '../utils/libelles';
import type { Departement, Enseignant } from '../types';

const props = defineProps<{
  modelValue: boolean;
  enseignant?: Enseignant | null;
  departements: Departement[];
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({
  matricule: '',
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  grade: '',
  statut: 'PERMANENT',
  tauxHoraire: 0,
  departementId: null as string | null,
  actif: true,
});

const optionsDepartements = computed(() =>
  props.departements.map((d) => ({ label: d.nom, value: d.id })),
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const e = props.enseignant;
    form.value = {
      matricule: e?.matricule ?? '',
      nom: e?.nom ?? '',
      prenom: e?.prenom ?? '',
      email: e?.email ?? '',
      telephone: e?.telephone ?? '',
      grade: e?.grade ?? '',
      statut: e?.statut ?? 'PERMANENT',
      tauxHoraire: e?.tauxHoraire ?? 0,
      departementId: e?.departementId ?? null,
      actif: e?.actif ?? true,
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      ...form.value,
      email: form.value.email || undefined,
      telephone: form.value.telephone || undefined,
      grade: form.value.grade || undefined,
      departementId: form.value.departementId || undefined,
    };
    if (props.enseignant) await api.put(`/enseignants/${props.enseignant.id}`, payload);
    else await api.post('/enseignants', payload);
    $q.notify({ type: 'positive', message: 'Enseignant enregistré' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
