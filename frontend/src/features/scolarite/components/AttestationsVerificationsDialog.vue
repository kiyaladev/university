<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('attestations.verificationsDialog.title') }}</div>
        <div class="text-caption text-grey-7">
          {{ $t('attestations.verificationsDialog.subtitle', { numero: attestation?.numero }) }}
        </div>
      </q-card-section>
      <q-card-section class="q-pa-none">
        <q-list separator dense>
          <q-item v-for="v in verifications" :key="v.id">
            <q-item-section>
              <q-item-label>
                <q-chip
                  dense
                  :color="v.resultat ? 'secondary' : 'negative'"
                  text-color="white"
                  :label="
                    v.resultat
                      ? $t('attestations.verificationsDialog.valid')
                      : $t('attestations.verificationsDialog.failed')
                  "
                  class="q-mr-sm"
                />
                {{ dateHeureLisible(v.verifieeLe) }}
              </q-item-label>
              <q-item-label caption>{{
                $t('attestations.verificationsDialog.ip', {
                  ip: v.ip ?? $t('attestations.verificationsDialog.ipUnknown'),
                })
              }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="!verifications.length">
            <q-item-section class="text-grey-7">{{ $t('attestations.verificationsDialog.empty') }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { dateHeureLisible } from '@/shared/utils/format';
import type { VerificationAttestation } from '../services/attestations';
import type { Attestation } from '@/types';

defineProps<{
  /** Attestation dont on consulte le journal des scans. */
  attestation: Attestation | null;
  /** Journal chargé ; vide tant que la requête n'a pas abouti. */
  verifications: VerificationAttestation[];
}>();

const ouvert = defineModel<boolean>({ required: true });
</script>
