<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('rapports.releveSigne.dialogTitle') }}</div>
        <div class="text-caption text-grey-7">{{ $t('rapports.releveSigne.dialogHelp') }}</div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-input v-model="semaineDebut" type="date" outlined dense :label="$t('rapports.releveSigne.weekStart')" />
        <div class="text-caption text-grey-7 q-mt-xs q-mb-md">
          {{ $t('rapports.releveSigne.weekRange', { end: dateLisible(semaineFin) }) }}
        </div>
        <zone-signature v-model="signatureChef" :label="$t('rapports.releveSigne.signatureLabel')" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          :label="$t('common.actions.cancel')"
          :disable="generation"
          @click="emit('update:modelValue', false)"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="picture_as_pdf"
          :loading="generation"
          :label="$t('rapports.releveSigne.generate')"
          @click="generer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import ZoneSignature from './ZoneSignature.vue';
import { nomFichierReleve, telechargerReleveHebdomadaire } from '../services/releve';
import { aujourdhui, dateLisible } from '@/shared/utils/libelles';

/**
 * Relevé hebdomadaire signé : le document que le chef de département dépose.
 *
 * Le dialogue porte sa propre logique : la semaine, la signature, la demande
 * du PDF et son téléchargement.
 */
const props = defineProps<{ modelValue: boolean; departementId: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; genere: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const semaineDebut = ref(lundiDe(aujourdhui()));
const signatureChef = ref<string | null>(null);
const generation = ref(false);

function lundiDe(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

const semaineFin = computed(() => {
  const d = new Date(`${semaineDebut.value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
});

async function generer() {
  if (!props.departementId || !signatureChef.value) {
    $q.notify({ type: 'warning', message: t('rapports.releveSigne.signatureRequired') });
    return;
  }
  if (lundiDe(semaineDebut.value) !== semaineDebut.value) {
    $q.notify({ type: 'warning', message: t('rapports.releveSigne.mondayRequired') });
    return;
  }
  generation.value = true;
  try {
    // Silencieux : en `blob`, le message du serveur est illisible pour
    // l'intercepteur ; le message local du catch est plus parlant.
    const fichier = await telechargerReleveHebdomadaire({
      departementId: props.departementId,
      dateDebut: semaineDebut.value,
      dateFin: semaineFin.value,
      signatureBase64: signatureChef.value,
    });
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichierReleve(semaineDebut.value);
    lien.click();
    URL.revokeObjectURL(url);
    emit('update:modelValue', false);
    signatureChef.value = null;
    emit('genere');
    $q.notify({ type: 'positive', message: t('rapports.releveSigne.success') });
  } catch {
    $q.notify({ type: 'negative', message: t('rapports.releveSigne.error') });
  } finally {
    generation.value = false;
  }
}
</script>
