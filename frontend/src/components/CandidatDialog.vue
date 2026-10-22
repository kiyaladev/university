<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { api } from '../boot/axios';
import type { CandidatElection, Election, Enseignant, Etudiant } from '../types';

const $q = useQuasar();
const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  election: Election;
  candidat?: CandidatElection | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [c: CandidatElection] }>();

const formulaire = ref({
  nom: '',
  prenom: '',
  etudiantId: null as string | null,
  enseignantId: null as string | null,
  photoUrl: '',
  programme: '',
  ordre: 0,
});

const enregistrement = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      const c = props.candidat;
      formulaire.value = {
        nom: c?.nom ?? '',
        prenom: c?.prenom ?? '',
        etudiantId: c?.etudiantId ?? null,
        enseignantId: c?.enseignantId ?? null,
        photoUrl: c?.photoUrl ?? '',
        programme: c?.programme ?? '',
        ordre: c?.ordre ?? (props.election.candidats?.length ?? 0),
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.candidat?.id));
const titre = computed(() => (enEdition.value ? t('elections.dialogs.candidateForm.titleEdit') : t('elections.dialogs.candidateForm.titleNew')));

async function soumettre() {
  if (!formulaire.value.nom || !formulaire.value.prenom) {
    $q.notify({ type: 'warning', message: t('elections.dialogs.candidateForm.requiredName') });
    return;
  }
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      nom: formulaire.value.nom,
      prenom: formulaire.value.prenom,
      ordre: formulaire.value.ordre,
    };
    if (formulaire.value.etudiantId) payload.etudiantId = formulaire.value.etudiantId;
    if (formulaire.value.enseignantId) payload.enseignantId = formulaire.value.enseignantId;
    if (formulaire.value.photoUrl) payload.photoUrl = formulaire.value.photoUrl;
    if (formulaire.value.programme) payload.programme = formulaire.value.programme;
    const { data: res } = await api.post(`/elections/${props.election.id}/candidats`, payload);
    $q.notify({ type: 'positive', message: enEdition.value ? t('elections.dialogs.candidateForm.saved') : t('elections.dialogs.candidateForm.added') });
    emit('enregistre', res);
    emit('update:modelValue', false);
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

function fermer() {
  emit('update:modelValue', false);
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="min-width: 520px; max-width: 92vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ titre }}</div>
        <q-space />
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" @click="fermer" />
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.prenom" :label="$t('common.fields.firstName')" outlined dense class="col" />
          <q-input v-model="formulaire.nom" :label="$t('common.fields.lastName')" outlined dense class="col" />
        </div>
        <autocomplete-async
          v-model="formulaire.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e: Etudiant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
          :label="$t('elections.dialogs.candidateForm.linkedStudent')"
        />
        <autocomplete-async
          v-model="formulaire.enseignantId"
          endpoint="/enseignants"
          :label-fn="(e: Enseignant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
          :label="$t('elections.dialogs.candidateForm.linkedTeacher')"
        />
        <q-input
          v-model.number="formulaire.ordre"
          type="number"
          :label="$t('elections.dialogs.candidateForm.order')"
          outlined
          dense
        />
        <q-input
          v-model="formulaire.photoUrl"
          :label="$t('elections.dialogs.candidateForm.photoUrl')"
          outlined
          dense
          :placeholder="$t('elections.dialogs.candidateForm.photoPlaceholder')"
        />
        <q-input
          v-model="formulaire.programme"
          :label="$t('matieres.dialog.sectionTitle')"
          outlined
          dense
          type="textarea"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="enEdition ? $t('elections.dialogs.candidateForm.save') : $t('elections.dialogs.candidates.add')" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
