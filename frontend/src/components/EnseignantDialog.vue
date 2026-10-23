<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(enseignant ? 'enseignants.formDialog.editTitle' : 'enseignants.formDialog.newTitle')"
    :libelle-valider="$t('common.actions.register')"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('badges.table.columns.identity') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input v-model="form.matricule" outlined dense :label="$t('enseignants.formDialog.matricule')" :rules="[requis]" />
      </div>
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.statut"
          :options="STATUTS_ENSEIGNANT"
          outlined
          dense
          :label="$t('enseignants.formDialog.status')"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input v-model="form.nom" outlined dense :label="$t('inscriptionPublique.form.step1.nom.label')" :rules="[requis]" />
      </div>
      <div class="col-12 col-sm-6">
        <q-input v-model="form.prenom" outlined dense :label="$t('inscriptionPublique.form.step1.prenom.label')" :rules="[requis]" />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input v-model="form.email" outlined dense type="email" :label="$t('etudiants.table.columns.email')" />
      </div>
      <div class="col-12 col-sm-6">
        <q-input v-model="form.telephone" outlined dense :label="$t('common.fields.phone')" />
      </div>
    </div>

    <span class="section-titre">{{ $t('enseignants.formDialog.assignmentAndPay') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input v-model="form.grade" outlined dense :label="$t('enseignants.table.columns.grade')" :hint="$t('enseignants.formDialog.gradeHint')" />
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
          :label="$t('common.fields.department')"
        />
      </div>
    </div>

    <q-input
      v-model.number="form.tauxHoraire"
      type="number"
      outlined
      dense
      :label="$t('paiePage.table.lignesColumns.taux')"
      :hint="$t('enseignants.formDialog.hourlyRateHint')"
    />

    <q-toggle v-model="form.actif" :label="$t('enseignants.formDialog.active')" />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { useReferentielsStore } from '../stores/referentiels';
import { STATUTS_ENSEIGNANT } from '../utils/libelles';
import type { Departement, Enseignant } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  enseignant?: Enseignant | null;
  departements: Departement[];
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const enregistrement = ref(false);
const requis = (v: string) => !!(v ?? '').trim() || t('common.messages.errors.required');

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
  ouvert,
  (o) => {
    if (!o) return;
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
    await referentiels.rafraichir('enseignants');
    $q.notify({ type: 'positive', message: t('enseignants.formDialog.saved') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
