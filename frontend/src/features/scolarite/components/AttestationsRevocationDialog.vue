<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="s"
    :titre="$t('attestations.revocation.title', { numero: attestation?.numero })"
    :sous-titre="$t('attestations.revocation.warning')"
    :envoi="envoi"
    :desactive="motif.trim().length < 3"
    couleur-valider="negative"
    icone-valider="block"
    :libelle-valider="$t('attestations.revocation.confirm')"
    @valider="emit('valider')"
  >
    <q-input
      v-model="motif"
      outlined
      dense
      type="textarea"
      rows="3"
      :label="$t('attestations.revocation.motifLabel')"
      :hint="$t('attestations.revocation.motifHint')"
      autofocus
    />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import type { Attestation } from '@/types';

defineProps<{
  /** Attestation à révoquer ; `null` hors révocation. */
  attestation: Attestation | null;
  /** Vrai pendant l'envoi de la révocation. */
  envoi: boolean;
}>();

const emit = defineEmits<{
  valider: [];
}>();

const ouvert = defineModel<boolean>({ required: true });
/** Motif de la révocation : exigé par l'API, il est porté par la page. */
const motif = defineModel<string>('motif', { required: true });
</script>
