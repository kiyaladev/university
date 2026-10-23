<template>
  <q-page class="notifications">
    <en-tete-page :title="$t('notifications.header.title')" :subtitle="$t('notifications.header.subtitle')">
      <template v-if="stats" #actions>
        <q-chip square color="warning" text-color="dark" icon="sms">
          {{ $t('notifications.header.queued', { n: stats.EN_ATTENTE }) }}
          <q-tooltip>
            {{ $t('notifications.header.tooltip', { envoyees: stats.ENVOYE, echouees: stats.ECHOUE }) }}
          </q-tooltip>
        </q-chip>
      </template>
    </en-tete-page>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="diffusion" icon="campaign" :label="$t('notifications.tabs.diffusion')" no-caps />
      <q-tab name="historique" icon="history" :label="$t('notifications.tabs.historique')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- DIFFUSION                                                         -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'diffusion'" name="diffusion" class="q-pa-none q-mt-md">
      <panneau-diffusion-notifications @envoye="surEnvoi" />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- HISTORIQUE                                                        -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'historique'" name="historique" class="q-pa-none q-mt-md">
      <historique-notifications
        ref="historique"
        :chart-config="chartConfig"
        :resume-repartition="resumeRepartition"
        @renvoi="surRenvoi"
        @aller-diffusion="onglet = 'diffusion'"
      />
    </q-tab-panel>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChartConfiguration } from 'chart.js';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import PanneauDiffusionNotifications from '@/features/administration/components/PanneauDiffusionNotifications.vue';
import HistoriqueNotifications from '@/features/administration/components/HistoriqueNotifications.vue';
import {
  notificationsService,
  type RepartitionNotifications,
  type StatsNotifications,
} from '@/features/administration/services/notifications';

/**
 * Page des notifications : la diffusion (onglet de gauche) et l'historique des
 * envois (onglet de droite).
 *
 * La page ne garde que ce qui lui est propre — l'onglet courant, les
 * compteurs et la courbe de répartition des envois ; la saisie de la diffusion
 * et le registre de l'historique vivent dans leurs panneaux.
 */

/**
 * Peintures des états d'envoi, identiques aux pastilles du registre :
 * attente en jaune, envoyé en vert, échec en rouge.
 */
const PEINTURE_ATTENTE = '#FCD116';
const PEINTURE_ENVOYE = '#007A4D';
const PEINTURE_ECHEC = '#CE1126';

const { t } = useI18n();

const onglet = ref('diffusion');

const historique = ref<InstanceType<typeof HistoriqueNotifications> | null>(null);

// -------------------------------------------------------------------- stats
const stats = ref<StatsNotifications | null>(null);

async function chargerStats() {
  try {
    stats.value = await notificationsService.stats();
  } catch {
    stats.value = null;
  }
}

const repartition30j = ref<RepartitionNotifications[]>([]);

async function chargerRepartition() {
  try {
    const reponse = await notificationsService.repartition(30);
    repartition30j.value = Array.isArray(reponse) ? reponse : [];
  } catch {
    repartition30j.value = [];
  }
}

/** Alternative textuelle du graphique, pour qui ne voit pas les barres. */
const resumeRepartition = computed(() => {
  const totaux = repartition30j.value.reduce(
    (acc: { attente: number; envoyes: number; echouees: number }, r) => ({
      attente: acc.attente + r.EN_ATTENTE,
      envoyes: acc.envoyes + r.ENVOYE,
      echoues: acc.echouees + r.ECHOUE,
    }),
    { attente: 0, envoyes: 0, echouees: 0 },
  );
  return t('notifications.history.chart.summaryAria', {
    envoyes: totaux.envoyes,
    echouees: totaux.echouees,
    attente: totaux.attente,
  });
});

const chartConfig = computed<ChartConfiguration | null>(() => {
  if (!repartition30j.value.length) return null;
  return {
    type: 'bar',
    data: {
      labels: repartition30j.value.map((r) => r.date.slice(5)),
      datasets: [
        {
          label: t('notifications.history.chart.series.enFile'),
          data: repartition30j.value.map((r) => r.EN_ATTENTE),
          backgroundColor: PEINTURE_ATTENTE,
        },
        {
          label: t('notifications.history.chart.series.envoyes'),
          data: repartition30j.value.map((r) => r.ENVOYE),
          backgroundColor: PEINTURE_ENVOYE,
        },
        {
          label: t('notifications.history.chart.series.echoues'),
          data: repartition30j.value.map((r) => r.ECHOUE),
          backgroundColor: PEINTURE_ECHEC,
        },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    },
  };
});

/** Un envoi vient de partir : le registre et les compteurs sont à rafraîchir. */
async function surEnvoi() {
  await historique.value?.recharger();
  await chargerStats();
}

/** Un renvoi vient de partir : le registre, les compteurs et la courbe suivent. */
async function surRenvoi() {
  await historique.value?.recharger();
  await chargerStats();
  await chargerRepartition();
}

watch(onglet, (v) => {
  if (v === 'historique') {
    void chargerRepartition();
  }
});

onMounted(() => {
  void chargerStats();
  void chargerRepartition();
});
</script>

<style scoped lang="scss">
.notifications {
  padding: var(--up-4) var(--up-3) var(--up-6);
}
</style>
