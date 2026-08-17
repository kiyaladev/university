<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { api } from '../boot/axios';
import type { CoursVOD, Enseignant, Matiere, TypeRessourceVOD } from '../types';

const $q = useQuasar();

const props = defineProps<{
  modelValue: boolean;
  vod?: CoursVOD | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [v: CoursVOD] }>();

const OPTIONS_TYPE: Array<{ value: TypeRessourceVOD; label: string }> = [
  { value: 'AUDIO', label: 'Audio' },
  { value: 'VIDEO', label: 'Vidéo' },
  { value: 'NOTES', label: 'Notes' },
  { value: 'TRANSCRIPTION', label: 'Transcription' },
];

const formulaire = ref({
  titre: '',
  description: '',
  type: 'VIDEO' as TypeRessourceVOD,
  matiereId: null as string | null,
  enseignantId: null as string | null,
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
        url: v?.url ?? '',
        thumbnailUrl: v?.thumbnailUrl ?? '',
        dureeSecondes: v?.dureeSecondes ?? null,
        public: v?.public ?? true,
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.vod?.id));
const titre = computed(() => (enEdition.value ? 'Modifier la ressource VOD' : 'Nouvelle ressource VOD'));

async function soumettre() {
  if (!formulaire.value.titre || !formulaire.value.url) {
    $q.notify({ type: 'warning', message: 'Titre et URL sont obligatoires.' });
    return;
  }
  enregistrement.value = true;
  try {
    const { default: api } = await import('../boot/axios');
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
    };
    const { data } = await api[methode](url, payload);
    $q.notify({ type: 'positive', message: enEdition.value ? 'Ressource mise à jour.' : 'Ressource créée.' });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Enregistrement impossible.' });
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
    <q-card style="min-width: 560px; max-width: 92vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ titre }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="fermer" />
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <q-input
          v-model="formulaire.titre"
          label="Titre"
          outlined
          dense
        />
        <q-select
          v-model="formulaire.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          label="Type de ressource"
          outlined
          dense
        />
        <q-input
          v-model="formulaire.url"
          label="URL du média (Mux / S3 / CDN / chemin local)"
          outlined
          dense
          placeholder="https://… ou /vod/fichier.mp4"
        />
        <q-input
          v-model="formulaire.thumbnailUrl"
          label="URL de la miniature (optionnel)"
          outlined
          dense
          placeholder="https://…/apercu.jpg"
        />
        <autocomplete-async
          v-model="formulaire.matiereId"
          endpoint="/matieres"
          :label-fn="(m: Matiere) => `${m.code} — ${m.intitule}`"
          label="Matière"
        />
        <autocomplete-async
          v-model="formulaire.enseignantId"
          endpoint="/enseignants"
          :label-fn="(e: Enseignant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
          label="Enseignant"
        />
        <div class="row q-col-gutter-md">
          <q-input
            v-model.number="formulaire.dureeSecondes"
            type="number"
            label="Durée (secondes)"
            outlined
            dense
            class="col"
          />
          <q-toggle v-model="formulaire.public" label="Ressource publique" class="col" />
        </div>
        <q-input
          v-model="formulaire.description"
          label="Description"
          outlined
          dense
          type="textarea"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="enEdition ? 'Enregistrer' : 'Créer'" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>