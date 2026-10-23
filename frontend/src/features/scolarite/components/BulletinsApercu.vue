<template>
  <div class="bulletins-apercu">
    <div class="row items-center q-col-gutter-sm q-mb-md">
      <div class="col-auto">
        <q-btn outline no-caps icon="arrow_back" :label="$t('bulletins.apercu.retourListe')" @click="emit('fermer')" />
      </div>
      <q-space />
      <div class="col-auto">
        <q-btn
          v-if="ligne?.decision === 'ADMIS'"
          outline
          color="secondary"
          no-caps
          icon="verified_user"
          :label="$t('bulletins.apercu.emettreAttestation')"
          @click="emit('aller-attestation', ligne)"
        />
      </div>
    </div>
    <fiche-bulletin v-if="bulletin" :bulletin="bulletin" :chemin-impression="cheminImpression" />
  </div>
</template>

<script setup lang="ts">
import FicheBulletin from './FicheBulletin.vue';
import type { Bulletin, LigneBulletin } from '@/features/scolarite/types';

defineProps<{
  /** Bulletin affiché ; `null` hors aperçu. */
  bulletin: Bulletin | null;
  /** Ligne du listing qui porte ce bulletin. */
  ligne: LigneBulletin | null;
  /** Chemin d'impression du relevé ; absent si aucune délibération. */
  cheminImpression?: string | undefined;
}>();

const emit = defineEmits<{
  fermer: [];
  'aller-attestation': [ligne: LigneBulletin | null];
}>();
</script>

<style scoped lang="scss">
.bulletins-apercu {
  max-width: 900px;
  margin: 0 auto;
}
</style>
