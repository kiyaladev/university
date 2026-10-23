<template>
  <canvas ref="canvas" :style="{ height: `${hauteur}px` }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, ref } from 'vue';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

// Les graphiques suivent la même grammaire que le reste : fonte système, gris
// #6E6E73 pour les échelles, grille d'un cheveu, pastilles de légende arrondies.
// Sans cela ils rejouent le style par défaut de la librairie.
const FONTE =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", Inter, "Helvetica Neue", Arial, sans-serif';

Chart.defaults.font.family = FONTE;
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6E6E73';
Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.08)';
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.legend.labels.borderRadius = 5;
Chart.defaults.plugins.legend.labels.useBorderRadius = true;
Chart.defaults.plugins.legend.labels.padding = 16;
// L'infobulle est la même matière que `.q-tooltip` : encre à 92 %, coins doux.
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(29, 29, 31, 0.92)';
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.titleFont = { family: FONTE, size: 13, weight: 600 };
Chart.defaults.plugins.tooltip.bodyFont = { family: FONTE, size: 12 };
Chart.defaults.elements.line.borderJoinStyle = 'round';
Chart.defaults.elements.line.tension = 0.35;
Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.point.hitRadius = 12;
Chart.defaults.elements.bar.borderRadius = 6;

/** Enveloppe minimale de Chart.js : le graphique se reconstruit à chaque
 *  changement de configuration. */
const props = withDefaults(defineProps<{ config: ChartConfiguration; hauteur?: number }>(), { hauteur: 240 });

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
