<template>
  <div>
    <div class="row items-center justify-between q-mb-xs">
      <div class="text-caption text-grey-7">{{ label }}</div>
      <q-btn flat dense size="sm" icon="restart_alt" label="Effacer" @click="effacer" />
    </div>
    <canvas
      ref="canvas"
      class="signature-pad"
      @pointerdown="debuter"
      @pointermove="tracer"
      @pointerup="terminer"
      @pointerleave="terminer"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

/** Capture la signature manuscrite de l'enseignant (souris ou tactile). */
const props = withDefaults(defineProps<{ modelValue?: string | null; label?: string }>(), {
  modelValue: null,
  label: "Signature de l'enseignant",
});
const emit = defineEmits<{ 'update:modelValue': [string | null] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let dessine = false;
let vide = true;

onMounted(() => {
  const c = canvas.value!;
  // Résolution réelle du canvas (évite le flou sur mobile)
  c.width = c.offsetWidth * 2;
  c.height = c.offsetHeight * 2;
  ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(2, 2);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111';
  if (props.modelValue) {
    const img = new Image();
    img.onload = () => ctx!.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight);
    img.src = props.modelValue;
    vide = false;
  }
});

function position(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function debuter(e: PointerEvent) {
  dessine = true;
  const { x, y } = position(e);
  ctx?.beginPath();
  ctx?.moveTo(x, y);
}

function tracer(e: PointerEvent) {
  if (!dessine || !ctx) return;
  const { x, y } = position(e);
  ctx.lineTo(x, y);
  ctx.stroke();
  vide = false;
}

function terminer() {
  if (!dessine) return;
  dessine = false;
  emit('update:modelValue', vide ? null : canvas.value!.toDataURL('image/png'));
}

function effacer() {
  if (!ctx || !canvas.value) return;
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  vide = true;
  emit('update:modelValue', null);
}
</script>
