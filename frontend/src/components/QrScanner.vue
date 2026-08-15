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
        @click="arreter"
      />
    </div>

    <div v-else class="row q-col-gutter-sm items-center">
      <div class="col">
        <q-input
          :model-value="modelValue"
          outlined
          dense
          label="Code QR de la salle"
          hint="Scannez l’affiche de la salle ou saisissez le code"
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
          @click="demarrer"
        >
          <q-tooltip>
            {{ scannerDisponible ? 'Scanner avec la caméra' : 'Caméra indisponible sur cet appareil' }}
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <div v-if="erreur" class="text-caption text-negative q-mt-xs">{{ erreur }}</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

/**
 * Lecture du QR affiché dans la salle. Utilise l'API BarcodeDetector du
 * navigateur quand elle existe ; sinon le code peut être saisi à la main.
 */
defineProps<{ modelValue?: string }>();
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
  } catch (e: any) {
    erreur.value = "Accès à la caméra refusé — saisissez le code manuellement";
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
