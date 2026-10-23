<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="m"
    :titre="t('tirage.actions.confirmPrint')"
    :sous-titre="t('tirage.transitions.IMPRIME')"
    :envoi="envoi"
    :libelle-valider="t('common.actions.print')"
    icone-valider="print"
    @valider="imprimer"
  >
    <div class="q-gutter-md">
      <q-file
        v-model="fichier"
        outlined
        dense
        clearable
        :label="t('tirage.dialogs.print.fileLabel')"
        :hint="t('tirage.dialogs.print.fileHint')"
        accept="application/pdf,.pdf"
        @update:model-value="calculer"
      >
        <template #prepend><q-icon name="attach_file" /></template>
      </q-file>
      <q-input
        v-model="empreinte"
        outlined
        dense
        class="empreinte-saisie"
        autocomplete="off"
        :label="t('tirage.dialogs.print.fingerprintLabel')"
        :hint="t('tirage.dialogs.print.fingerprintHint')"
        :loading="calcul"
      />
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
/**
 * Passage PROGRAMME → IMPRIME. L'imprimeur dépose le fichier qu'il va
 * réellement imprimer (l'empreinte SHA-256 est calculée dans le navigateur)
 * ou saisit lui-même son empreinte. Le champ part VIDE : l'empreinte attendue
 * n'est jamais envoyée au client avant impression, c'est le serveur qui
 * compare et refuse en cas de différence.
 */
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { empreinteSha256Fichier } from '../utils/empreinte';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ tirageId: string | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const fichier = ref<File | null>(null);
const empreinte = ref('');
const calcul = ref(false);
const envoi = ref(false);

watch(ouvert, (o) => {
  if (o) {
    fichier.value = null;
    empreinte.value = '';
  }
});

async function calculer() {
  const f = fichier.value;
  if (!f) return;
  calcul.value = true;
  try {
    empreinte.value = await empreinteSha256Fichier(f);
  } finally {
    calcul.value = false;
  }
}

async function imprimer() {
  const saisie = empreinte.value.trim().toLowerCase();
  if (!saisie) {
    $q.notify({ type: 'warning', message: t('tirage.messages.fingerprintRequired') });
    return;
  }
  if (!/^[0-9a-f]{64}$/.test(saisie)) {
    $q.notify({ type: 'warning', message: t('tirage.dialogs.schedule.invalidFingerprint') });
    return;
  }
  if (!props.tirageId) return;
  envoi.value = true;
  try {
    await api.post(`/tirage/${props.tirageId}/imprimer`, { empreinteSource: saisie });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* refus (empreinte différente…) notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}
</script>

<style scoped lang="scss">
.empreinte-saisie :deep(input) {
  font-family: monospace;
}
</style>
