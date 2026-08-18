<template>
  <div>
    <div v-if="camera" class="relative-position">
      <video ref="video" autoplay playsinline muted class="full-width" />
      <q-btn
        class="absolute-top-right q-ma-sm"
        round
        dense
        color="white"
        text-color="dark"
        icon="close"
        aria-label="Arrêter la caméra"
        @click="arreter"
      />
    </div>

    <div v-else class="row q-col-gutter-sm items-center">
      <div class="col">
        <q-input
          :model-value="modelValue"
          outlined
          dense
          :label="label"
          :hint="hint"
          @update:model-value="(v) => emit('update:modelValue', String(v ?? ''))"
        >
          <template #prepend><q-icon name="qr_code_2" /></template>
        </q-input>
      </div>
      <div class="col-auto">
        <q-btn
          color="secondary"
          icon="photo_camera"
          :disable="!scannerDisponible"
          :aria-label="scannerDisponible ? 'Scanner avec la caméra' : 'Caméra indisponible sur cet appareil'"
          @click="demarrer"
        >
          <q-tooltip>
            {{ scannerDisponible ? 'Scanner avec la caméra' : 'Caméra indisponible sur cet appareil' }}
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <div v-if="erreur" role="alert" class="text-caption text-negative q-mt-xs">{{ erreur }}</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

/**
 * Lecture d'un QR. Utilise l'API BarcodeDetector du navigateur quand elle
 * existe ; sinon le code peut toujours être saisi à la main.
 *
 * Le composant sert à six écrans qui ne scannent pas la même chose (affiche de
 * salle, carte étudiante, badge, plateau resto, attestation) : `label` et
 * `hint` disent lequel, au lieu de parler de salle partout.
 */
withDefaults(defineProps<{ modelValue?: string; label?: string; hint?: string }>(), {
  label: 'Code QR de la salle',
  hint: 'Scannez l’affiche de la salle ou saisissez le code',
});
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const video = ref<HTMLVideoElement | null>(null);
const camera = ref(false);
const erreur = ref('');
let flux: MediaStream | null = null;
let boucle: number | null = null;

const scannerDisponible =
  'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

async function demarrer() {
  erreur.value = '';
  camera.value = true;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    await new Promise((r) => setTimeout(r, 50));
    if (video.value) {
      video.value.srcObject = flux;
      await video.value.play();
    }

    const detecteur = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    boucle = window.setInterval(async () => {
      if (!video.value) return;
      try {
        const codes = await detecteur.detect(video.value);
        if (codes.length) {
          emit('update:modelValue', codes[0].rawValue);
          arreter();
        }
      } catch {
        /* image non exploitable : on réessaie au tour suivant */
      }
    }, 400);
  } catch {
    erreur.value =
      'Accès à la caméra refusé ou indisponible — saisissez le code à la main dans le champ ci-dessus.';
    camera.value = false;
  }
}

function arreter() {
  if (boucle) window.clearInterval(boucle);
  boucle = null;
  flux?.getTracks().forEach((t) => t.stop());
  flux = null;
  camera.value = false;
}

onBeforeUnmount(arreter);
</script>
