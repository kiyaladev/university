<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 660px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ $t(travail ? 'stages.workDialog.editTitle' : 'stages.workDialog.newTitle') }}
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="form.type"
              :options="optionsTypes"
              outlined
              dense
              emit-value
              map-options
              :label="$t('stages.workDialog.type')"
            />
          </div>
          <div class="col-12 col-sm-8">
            <q-input v-model="form.intitule" outlined dense :label="$t('stages.workDialog.title')" />
          </div>
        </div>

        <q-input
          v-model="form.description"
          outlined
          dense
          type="textarea"
          rows="2"
          :label="$t('common.fields.description')"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.etudiantId"
              :options="optionsEtudiants"
              outlined
              dense
              emit-value
              map-options
              use-input
              input-debounce="300"
              :label="$t('stages.workDialog.student')"
              :disable="!peutChoisirEtudiant"
              @filter="filtrerEtudiants"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.encadrantId"
              :options="optionsEncadrants"
              outlined
              dense
              emit-value
              map-options
              use-input
              input-debounce="300"
              clearable
              :label="$t('stages.detail.fields.supervisor')"
              :hint="$t('stages.workDialog.supervisorHint')"
              @filter="filtrerEncadrants"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.entreprise" outlined dense :label="$t('stages.detail.fields.company')" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.tuteurEntreprise" outlined dense :label="$t('stages.workDialog.companyTutor')" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-input v-model="form.lieu" outlined dense :label="$t('common.fields.location')" />
          </div>
          <div class="col-12 col-sm-4">
            <champ-date v-model="form.dateDebut" :label="$t('structure.dialogs.annee.debut')" />
          </div>
          <div class="col-12 col-sm-4">
            <champ-date v-model="form.dateFin" :label="$t('common.messages.end')" />
          </div>
        </div>

        <q-select
          v-if="!travail"
          v-model="form.statut"
          :options="optionsStatutsInitiaux"
          outlined
          dense
          emit-value
          map-options
          :label="$t('stages.workDialog.initialStatus')"
          :hint="$t('stages.workDialog.initialStatusHint')"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          :label="$t('common.actions.register')"
          :loading="enregistrement"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import ChampDate from './ChampDate.vue';
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import type { Enseignant, Etudiant, TravailEncadre } from '../types';

const props = defineProps<{
  modelValue: boolean;
  travail?: TravailEncadre | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const enregistrement = ref(false);

const form = ref({
  type: 'MEMOIRE',
  intitule: '',
  description: '',
  etudiantId: '',
  encadrantId: null as string | null,
  entreprise: '',
  tuteurEntreprise: '',
  lieu: '',
  dateDebut: '',
  dateFin: '',
  statut: 'PROPOSE',
});

const optionsTypes = computed(() => [
  { label: t('stages.types.memoire'), value: 'MEMOIRE' },
  { label: t('stages.types.stage'), value: 'STAGE' },
  { label: t('stages.types.rapport'), value: 'RAPPORT' },
]);
const optionsStatutsInitiaux = computed(() => [
  { label: t('stages.kanban.columns.proposed'), value: 'PROPOSE' },
  { label: t('stages.kanban.columns.validated'), value: 'VALIDE' },
]);

const optionsEtudiants = ref<{ label: string; value: string }[]>([]);
const optionsEncadrants = ref<{ label: string; value: string }[]>([]);
const encadrantsTous = ref<Enseignant[]>([]);

/** Un étudiant connecté est toujours le porteur : le champ se verrouille. */
const peutChoisirEtudiant = computed(() => auth.role !== 'ETUDIANT');

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const t = props.travail;
    form.value = {
      type: t?.type ?? 'MEMOIRE',
      intitule: t?.intitule ?? '',
      description: t?.description ?? '',
      etudiantId: t?.etudiantId ?? '',
      encadrantId: t?.encadrantId ?? null,
      entreprise: t?.entreprise ?? '',
      tuteurEntreprise: t?.tuteurEntreprise ?? '',
      lieu: t?.lieu ?? '',
      dateDebut: t?.dateDebut?.slice(0, 10) ?? '',
      dateFin: t?.dateFin?.slice(0, 10) ?? '',
      statut: t?.statut ?? 'PROPOSE',
    };
    if (!t && auth.role === 'ETUDIANT') {
      form.value.type = 'RAPPORT';
    }
    if (!encadrantsTous.value.length) {
      api.get('/enseignants', { params: { all: '1' } }).then(({ data }) => {
        encadrantsTous.value = data.data;
        optionsEncadrants.value = encadrantsTous.value.map((e) => ({
          label: `${e.nom} ${e.prenom} (${e.matricule})`,
          value: e.id,
        }));
      });
    }
  },
);

async function filtrerEtudiants(saisie: string, maj: (fn: () => void) => void) {
  const { data } = await api.get('/etudiants', {
    params: { search: saisie || undefined, all: '1', pageSize: 30 },
  });
  maj(() => {
    optionsEtudiants.value = data.data.map((e: Etudiant) => ({
      label: `${e.nom} ${e.prenom} (${e.matricule})`,
      value: e.id,
    }));
  });
}

function filtrerEncadrants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEncadrants.value = encadrantsTous.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

async function enregistrer() {
  if (!form.value.intitule.trim() || !form.value.etudiantId) {
    $q.notify({ type: 'warning', message: t('stages.workDialog.required') });
    return;
  }
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      type: form.value.type,
      intitule: form.value.intitule.trim(),
      description: form.value.description || undefined,
      etudiantId: form.value.etudiantId,
      encadrantId: form.value.encadrantId || undefined,
      entreprise: form.value.entreprise || undefined,
      tuteurEntreprise: form.value.tuteurEntreprise || undefined,
      lieu: form.value.lieu || undefined,
      dateDebut: form.value.dateDebut || undefined,
      dateFin: form.value.dateFin || undefined,
    };
    if (!props.travail) payload.statut = form.value.statut;

    if (props.travail) await api.put(`/travaux-encadres/${props.travail.id}`, payload);
    else await api.post('/travaux-encadres', payload);

    $q.notify({ type: 'positive', message: t(props.travail ? 'stages.workDialog.updated' : 'stages.workDialog.created') });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
