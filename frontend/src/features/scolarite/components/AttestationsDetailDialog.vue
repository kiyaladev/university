<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 460px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ attestation?.numero }}</div>
        <div class="page-sous-titre q-mt-xs">
          {{ attestation ? (LIBELLE_TYPE_ATTESTATION[attestation.type] ?? attestation.type) : '' }}
          {{ $t('common.format.emptyValue') }}
          {{ attestation ? (LIBELLE_STATUT_ATTESTATION[attestation.statut] ?? attestation.statut) : '' }}
        </div>
      </q-card-section>
      <q-card-section class="text-center">
        <canvas ref="canvasQr" style="width: 210px; height: 210px" />
        <div class="text-caption text-grey-7 q-mt-sm q-break-all">{{ urlVerification }}</div>
      </q-card-section>
      <q-card-section class="text-caption">
        <div v-if="attestation">
          <div>
            <strong>{{ attestation.etudiant?.nom }} {{ attestation.etudiant?.prenom }}</strong>
            {{ $t('attestations.detail.matricule', { matricule: attestation.etudiant?.matricule }) }}
          </div>
          <div v-if="attestation.motif">{{ $t('attestations.detail.motif', { motif: attestation.motif }) }}</div>
          <div>
            {{
              $t('attestations.detail.parcours', {
                annee: attestation.annee?.libelle ?? '—',
                promotion: attestation.promotion?.nom ? ` · ${attestation.promotion.nom}` : '',
              })
            }}
          </div>
          <div class="q-mt-sm">
            {{
              $t('attestations.detail.issuedOnBy', {
                date: dateLisible(attestation.emiseLe),
                who: attestation.emisePar ? `${attestation.emisePar.prenom} ${attestation.emisePar.nom}` : '—',
              })
            }}
          </div>
          <div v-if="attestation.statut === 'REVOQUE'" class="text-negative">
            {{
              $t('attestations.detail.revokedOnBy', {
                date: dateLisible(attestation.revoqueeLe),
                motif: attestation.motifRevocation,
              })
            }}
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
        <q-btn
          v-if="attestation?.anneeId && attestation?.promotionId"
          flat
          no-caps
          color="secondary"
          icon="school"
          :label="$t('attestations.detail.bulletin')"
          @click="emit('bulletin', attestation)"
        />
        <q-btn
          v-if="attestation"
          flat
          no-caps
          color="primary"
          icon="print"
          :label="$t('common.actions.print')"
          @click="emit('imprimer', attestation)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { LIBELLE_STATUT_ATTESTATION, LIBELLE_TYPE_ATTESTATION } from '@/shared/utils/libelles';
import { dateLisible } from '@/shared/utils/format';
import type { Attestation } from '@/types';

const props = defineProps<{
  /** Attestation affichée ; `null` tant qu'aucune n'est ouverte. */
  attestation: Attestation | null;
}>();

const emit = defineEmits<{
  bulletin: [attestation: Attestation];
  imprimer: [attestation: Attestation];
}>();

const ouvert = defineModel<boolean>({ required: true });

const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');

/**
 * Origine de la SPA affichée dans le navigateur : c'est elle que le scan du
 * QR doit atteindre (l'hôte de l'API ne sert pas l'application).
 */
function prochainUrl(): string {
  return window.location.origin + '/#';
}

/** Le QR est peint à l'ouverture, quand le canvas est dans le DOM. */
async function dessiner() {
  for (let i = 0; i < 3 && !canvasQr.value; i++) {
    await nextTick();
  }
  if (canvasQr.value) peindre(canvasQr.value);
}

function peindre(canvas: HTMLCanvasElement) {
  if (!urlVerification.value) return;
  void QRCode.toCanvas(canvas, urlVerification.value, {
    width: 210,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

watch(
  () => ouvert.value,
  (estOuvert) => {
    if (!estOuvert || !props.attestation) return;
    const a = props.attestation;
    urlVerification.value = `${prochainUrl()}/verification?ref=${encodeURIComponent(a.numero)}&k=${encodeURIComponent(a.qrToken)}`;
    void dessiner();
  },
);

// Le canvas n'existe qu'une fois le dialogue rendu : on peint dès qu'il apparaît.
watch(canvasQr, (canvas) => {
  if (canvas) peindre(canvas);
});
</script>
