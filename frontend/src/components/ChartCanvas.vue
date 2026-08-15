<template>
  <canvas ref="canvas" :style="{ height: `${hauteur}px` }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, ref } from 'vue';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

// Les graphiques appartiennent au panneau : lettrage Archivo, filets d'encre,
// pastilles carrées. Sans cela ils rejouent le style par défaut de la librairie.
Chart.defaults.font.family = "'Archivo Variable', Archivo, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#33463F';
Chart.defaults.borderColor = 'rgba(16, 37, 30, 0.16)';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.boxHeight = 12;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.tooltip.backgroundColor = '#10251E';
Chart.defaults.plugins.tooltip.cornerRadius = 0;
Chart.defaults.plugins.tooltip.titleFont = { family: "'Anton', sans-serif", size: 13 };
Chart.defaults.elements.line.borderJoinStyle = 'miter';
Chart.defaults.elements.bar.borderRadius = 0;

/** Enveloppe minimale de Chart.js : le graphique se reconstruit à chaque
 *  changement de configuration. */
const props = withDefaults(
  defineProps<{ config: ChartConfiguration; hauteur?: number }>(),
  { hauteur: 240 },
);

const canvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

function dessiner() {
  chart?.destroy();
  if (!canvas.value) return;
  chart = new Chart(canvas.value, {
    ...props.config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...(props.config.options ?? {}),
    },
  });
}

onMounted(dessiner);
watch(() => props.config, dessiner, { deep: true });
onBeforeUnmount(() => chart?.destroy());
</script>
