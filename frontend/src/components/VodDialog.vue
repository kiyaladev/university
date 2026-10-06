<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { api } from '../boot/axios';
import type { CoursVOD, Enseignant, Inscription, Matiere, TypeRessourceVOD } from '../types';
import { useAuthStore } from '../stores/auth';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();

const props = defineProps<{
  modelValue: boolean;
  vod?: CoursVOD | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [v: CoursVOD] }>();

const OPTIONS_TYPE = computed(() => [
  { value: 'AUDIO' as TypeRessourceVOD, label: t('vodPage.formDialog.types.audio') },
  { value: 'VIDEO' as TypeRessourceVOD, label: t('vodPage.formDialog.types.video') },
  { value: 'NOTES' as TypeRessourceVOD, label: t('vodPage.formDialog.types.notes') },
  { value: 'TRANSCRIPTION' as TypeRessourceVOD, label: t('vodPage.formDialog.types.transcription') },
]);

const formulaire = ref({
  titre: '',
  description: '',
  type: 'VIDEO' as TypeRessourceVOD,
  matiereId: null as string | null,
  enseignantId: null as string | null,
  inscriptionId: null as string | null,
  url: '',
  thumbnailUrl: '',
  dureeSecondes: null as number | null,
  public: true,
});

const enregistrement = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      const v = props.vod;
      formulaire.value = {
        titre: v?.titre ?? '',
        description: v?.description ?? '',
        type: (v?.type as TypeRessourceVOD) ?? 'VIDEO',
        matiereId: v?.matiereId ?? null,
        enseignantId: v?.enseignantId ?? null,
        inscriptionId: v?.inscriptionId ?? null,
        url: v?.url ?? '',
        thumbnailUrl: v?.thumbnailUrl ?? '',
        dureeSecondes: v?.dureeSecondes ?? null,
        public: v?.public ?? true,
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.vod?.id));
const titre = computed(() => t(enEdition.value ? 'vodPage.formDialog.editTitle' : 'vodPage.formDialog.newTitle'));

async function soumettre() {
  if (!formulaire.value.titre || !formulaire.value.url) {
    $q.notify({ type: 'warning', message: t('vodPage.formDialog.required') });
    return;
  }
  enregistrement.value = true;
  try {
    // `api` est l'export nommé de boot/axios : l'import dynamique du default
    // (la fonction de boot) masquait l'instance et cassait l'enregistrement.
    const url = enEdition.value ? `/vod/${props.vod!.id}` : '/vod';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      titre: formulaire.value.titre,
      description: formulaire.value.description || undefined,
      type: formulaire.value.type,
      url: formulaire.value.url,
      thumbnailUrl: formulaire.value.thumbnailUrl || undefined,
      matiereId: formulaire.value.matiereId || undefined,
      enseignantId: formulaire.value.enseignantId || undefined,
      dureeSecondes: formulaire.value.dureeSecondes ?? undefined,
      public: formulaire.value.public,
      ...(auth.estAdmin ? { inscriptionId: formulaire.value.inscriptionId } : {}),
    };
    const { data } = methode === 'put' ? await api.put(url, payload) : await api.post(url, payload);
    $q.notify({ type: 'positive', message: t(enEdition.value ? 'vodPage.formDialog.updated' : 'vodPage.formDialog.created') });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? t('vodPage.formDialog.saveFailed') });
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
    <q-card style="width: 560px; max-width: 92vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ titre }}</div>
        <q-space />
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" @click="fermer" />
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <q-input
          v-model="formulaire.titre"
          :label="$t('common.fields.title')"
          outlined
          dense
        />
        <q-select
          v-model="formulaire.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          :label="$t('vodPage.filters.resourceType')"
          outlined
          dense
        />
        <q-input
          v-model="formulaire.url"
          :label="$t('vodPage.formDialog.mediaUrl')"
          outlined
          dense
          :placeholder="$t('vodPage.formDialog.mediaUrlPlaceholder')"
        />
        <q-input
          v-model="formulaire.thumbnailUrl"
          :label="$t('vodPage.formDialog.thumbnailUrl')"
          outlined
          dense
          :placeholder="$t('vodPage.formDialog.thumbnailUrlPlaceholder')"
        />
        <autocomplete-async
          v-model="formulaire.matiereId"
          endpoint="/matieres"
          :label-fn="(m: Matiere) => `${m.code} — ${m.intitule}`"
          :label="$t('common.fields.subject')"
        />
        <autocomplete-async
          v-model="formulaire.enseignantId"
          endpoint="/enseignants"
          :label-fn="(e: Enseignant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
          :label="$t('common.fields.teacher')"
        />
        <div class="row q-col-gutter-md">
          <q-input
            v-model.number="formulaire.dureeSecondes"
            type="number"
            :label="$t('vodPage.formDialog.duration')"
            outlined
            dense
            class="col-12 col-sm-6"
          />
          <q-toggle v-model="formulaire.public" :label="$t('vodPage.formDialog.publicResource')" class="col-12 col-sm-6" />
        </div>
        <template v-if="!formulaire.public">
          <autocomplete-async
            v-if="auth.estAdmin"
            v-model="formulaire.inscriptionId"
            endpoint="/inscriptions"
            server-search
            :label-fn="(i: Inscription) => `${i.numero} — ${i.etudiant?.prenom ?? ''} ${i.etudiant?.nom ?? ''} — ${i.annee?.libelle ?? ''} ${i.promotion?.nom ?? ''}`"
            :label="$t('vodPage.formDialog.privateEnrollment')"
          />
          <div class="text-caption text-grey-7">
            {{ $t(auth.estAdmin ? 'vodPage.formDialog.privateEnrollmentHint' : 'vodPage.formDialog.privateEnrollmentManaged') }}
          </div>
        </template>
        <q-input
          v-model="formulaire.description"
          :label="$t('common.fields.description')"
          outlined
          dense
          type="textarea"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="$t(enEdition ? 'common.actions.save' : 'common.actions.create')" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
