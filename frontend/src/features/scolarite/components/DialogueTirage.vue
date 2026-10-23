<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="l"
    :titre="t('tirage.actions.schedule')"
    :sous-titre="t('tirage.dialogs.schedule.fingerprintPolicy')"
    :envoi="envoi"
    :libelle-valider="t('tirage.dialogs.schedule.submit')"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <champ-recherche
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
      <q-input v-model="form.notes" outlined dense type="textarea" rows="2" :label="t('common.fields.notes')" />
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';

const ouvert = defineModel<boolean>({ required: true });
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();

function formulaireVide() {
  return {
    examenId: null as string | null,
    dateTirage: '',
    nbExemplaires: 30,
    empreinteSource: '',
    circuitImpression: '',
    notes: '',
  };
}

const form = ref(formulaireVide());
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
    emit('enregistre');
    ouvert.value = false;
    form.value = formulaireVide();
    fichierSource.value = null;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}
</script>
