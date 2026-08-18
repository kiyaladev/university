<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">Programmer un tirage</div>
        <div class="text-caption text-grey-7">
          L'empreinte SHA-256 du fichier source sera exigée à l'impression pour bloquer
          toute substitution.
        </div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <autocomplete-async
          v-model="form.examenId"
          endpoint="/examens"
          label="Examen *"
          :label-fn="(e) => `${e.codeExamen} — ${e.intitule}`"
        />
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <champ-date v-model="form.dateTirage" label="Date du tirage *" />
          </div>
          <div class="col-6">
            <q-input v-model.number="form.nbExemplaires" type="number" min="1" outlined dense label="Nombre d'exemplaires *" />
          </div>
        </div>
        <q-input
          v-model="form.empreinteSource"
          outlined
          dense
          label="Empreinte SHA-256 du fichier source *"
          hint="64 caractères hexadécimaux — cette empreinte sera réclamée à l'identique au moment d'imprimer."
        >
          <template #append>
            <q-btn
              round
              dense
              flat
              icon="calculate"
              aria-label="Calculer l'empreinte depuis le fichier chargé"
              @click="calculerDepuisFichier"
            />
            <q-tooltip>Calculer depuis un fichier</q-tooltip>
          </template>
        </q-input>
        <q-file v-model="fichierSource" outlined dense label="Ou charger le fichier pour calculer" accept="application/pdf,.pdf" @update:model-value="calculerDepuisFichier" />
        <q-input v-model="form.circuitImpression" outlined dense label="Circuit d'impression (ex : Salle 1 → Salle 2 → …)" />
        <q-input v-model="form.notes" outlined dense type="textarea" rows="2" label="Notes" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps label="Annuler" v-close-popup />
        <q-btn unelevated no-caps color="primary" label="Programmer" :loading="envoi" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import ChampDate from './ChampDate.vue';

defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  cree: [];
}>();

const $q = useQuasar();

const form = ref({
  examenId: null as string | null,
  dateTirage: '',
  nbExemplaires: 30,
  empreinteSource: '',
  circuitImpression: '',
  notes: '',
});

const fichierSource = ref<File | null>(null);
const envoi = ref(false);

async function calculerDepuisFichier() {
  const f = fichierSource.value;
  if (!f) return;
  const buffer = await f.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  form.value.empreinteSource = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function enregistrer() {
  if (!form.value.examenId || !form.value.dateTirage || !form.value.nbExemplaires || !form.value.empreinteSource) {
    $q.notify({ type: 'warning', message: 'Examen, date, nombre d’exemplaires et empreinte sont obligatoires' });
    return;
  }
  if (!/^[0-9a-f]{64}$/i.test(form.value.empreinteSource.trim())) {
    $q.notify({
      type: 'warning',
      message: 'L’empreinte doit être un SHA-256 (64 caractères hexadécimaux) — chargez le fichier pour la calculer.',
    });
    return;
  }
  envoi.value = true;
  try {
    await api.post('/tirage', form.value);
    $q.notify({ type: 'positive', message: 'Tirage programmé' });
    emit('update:modelValue', false);
    emit('cree');
    form.value = {
      examenId: null,
      dateTirage: '',
      nbExemplaires: 30,
      empreinteSource: '',
      circuitImpression: '',
      notes: '',
    };
    fichierSource.value = null;
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Enregistrement impossible' });
  } finally {
    envoi.value = false;
  }
}
</script>
