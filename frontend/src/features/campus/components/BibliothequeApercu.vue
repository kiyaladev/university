<template>
  <q-dialog v-model="ouvert" maximized>
    <q-card>
      <q-card-section class="row items-center q-pb-none">
        <div class="col">
          <div class="text-h6">{{ $t('bibliotheque.preview.title') }}</div>
          <div class="text-caption text-grey-7">{{ apercu?.titre }}</div>
        </div>
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
      </q-card-section>
      <q-separator class="q-my-sm" />
      <q-card-section class="apercu-contenu">
        <div v-if="chargement" class="row justify-center q-py-xl">
          <q-spinner color="primary" size="36px" />
        </div>
        <div v-else-if="!texte" class="text-center text-grey-7 q-py-xl">
          <q-icon name="description" size="38px" color="grey-5" />
          <div class="q-mt-sm">{{ $t('bibliotheque.preview.empty') }}</div>
        </div>
        <pre v-else class="apercu-texte" v-html="surligner(texte, terme)" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Aperçu du contenu extrait d'un document. La page charge le texte et garde
 * l'ouverture du dialogue ; ce composant ne fait que le présenter.
 */
import { surligner } from './BibliothequeAffiche';
import type { DocumentDepot } from '@/types';

/** Ouverture du dialogue. */
const ouvert = defineModel<boolean>({ required: true });

defineProps<{
  /** Document dont on affiche l'extrait. */
  apercu: DocumentDepot | null;
  /** Texte extrait du document. */
  texte: string;
  /** Chargement du texte en cours. */
  chargement: boolean;
  /** Texte de recherche : il surligne les occurrences. */
  terme: string;
}>();
</script>

<style scoped>
.apercu-contenu {
  max-height: calc(100vh - 80px);
  overflow: auto;
}
.apercu-texte {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.apercu-texte :deep(mark) {
  background: #fff6c2;
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
</style>
