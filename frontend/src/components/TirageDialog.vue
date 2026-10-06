<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('tirage.actions.schedule') }}</div>
        <div class="text-caption text-grey-7">
          {{ t('tirage.dialogs.schedule.fingerprintPolicy') }}
        </div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <autocomplete-async
          v-model="form.examenId"
          endpoint="/examens"
          :label="t('tirage.dialogs.schedule.examLabel')"
          :label-fn="(e) => `${e.codeExamen} — ${e.intitule}`"
        />
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <champ-date v-model="form.dateTirage" :label="t('tirage.dialogs.schedule.dateLabel')" />
          </div>
          <div class="col-6">
            <q-input v-model.number="form.nbExemplaires" type="number" min="1" outlined dense :label="t('tirage.dialogs.schedule.copiesLabel')" />
          </div>
        </div>
        <q-input
          v-model="form.empreinteSource"
          outlined
          dense
          :label="t('tirage.dialogs.schedule.fingerprintLabel')"
          :hint="t('tirage.dialogs.schedule.fingerprintHint')"
        >
          <template #append>
            <q-btn
              round
              dense
              flat
              icon="calculate"
              :aria-label="t('tirage.dialogs.schedule.calculateFingerprint')"
              @click="calculerDepuisFichier"
            />
            <q-tooltip>{{ t('tirage.dialogs.schedule.calculateFromFile') }}</q-tooltip>
          </template>
        </q-input>
        <q-file v-model="fichierSource" outlined dense :label="t('tirage.dialogs.schedule.fileLabel')" accept="application/pdf,.pdf" @update:model-value="calculerDepuisFichier" />
        <q-input v-model="form.circuitImpression" outlined dense :label="t('tirage.dialogs.schedule.printRouteLabel')" />
        <q-input v-model="form.notes" outlined dense type="textarea" rows="2" :label="$t('common.fields.notes')" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn unelevated no-caps color="primary" :label="t('tirage.dialogs.schedule.submit')" :loading="envoi" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

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
    $q.notify({ type: 'warning', message: t('tirage.dialogs.schedule.required') });
    return;
  }
  if (!/^[0-9a-f]{64}$/i.test(form.value.empreinteSource.trim())) {
    $q.notify({
      type: 'warning',
      message: t('tirage.dialogs.schedule.invalidFingerprint'),
    });
    return;
  }
  envoi.value = true;
  try {
    await api.post('/tirage', { ...form.value, empreinteSource: form.value.empreinteSource.trim().toLowerCase() });
    $q.notify({ type: 'positive', message: t('tirage.messages.scheduled') });
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
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? t('tirage.dialogs.schedule.saveFailed') });
  } finally {
    envoi.value = false;
  }
}
</script>
