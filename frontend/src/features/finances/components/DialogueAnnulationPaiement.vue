<template>
  <!-- Annulation : le motif est exigé -->
  <dialogue-formulaire
    v-model="ouvert"
    taille="s"
    :titre="$t('paiements.dialogs.cancelTitle', { reference: paiement?.reference })"
    :sous-titre="`${paiement ? LIBELLE_STATUT_PAIEMENT[paiement.statut] : ''} ${$t('common.format.emptyValue')} ${$t('paiements.dialogs.cancelSubtitle')}`"
    :envoi="envoi"
    :libelle-valider="$t('paiements.dialogs.cancelConfirm')"
    icone-valider="block"
    couleur-valider="negative"
    :desactive="motif.trim().length < 3"
    @valider="emit('valider', motif)"
  >
    <q-input
      v-model="motif"
      outlined
      dense
      type="textarea"
      rows="3"
      :label="$t('paiements.dialogs.cancelReasonLabel')"
      autofocus
    />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { LIBELLE_STATUT_PAIEMENT } from '@/shared/utils/libelles';
import type { Paiement } from '@/types';

defineProps<{
  paiement: Paiement | null;
  envoi: boolean;
}>();

const emit = defineEmits<{
  valider: [motif: string];
}>();

const ouvert = defineModel<boolean>('ouvert', { required: true });

const motif = ref('');

// Chaque annulation repart d'un motif vide.
watch(ouvert, (v) => {
  if (v) motif.value = '';
});
</script>
