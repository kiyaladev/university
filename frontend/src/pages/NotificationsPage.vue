<template>
  <q-page class="notifications">
    <page-header :title="$t('notifications.header.title')" :subtitle="$t('notifications.header.subtitle')">
      <template v-if="stats" #actions>
        <q-chip square color="warning" text-color="dark" icon="sms">
          {{ $t('notifications.header.queued', { n: stats.EN_ATTENTE }) }}
          <q-tooltip>
            {{ $t('notifications.header.tooltip', { envoyees: stats.ENVOYEE, echouees: stats.ECHOUE }) }}
          </q-tooltip>
        </q-chip>
      </template>
    </page-header>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="diffusion" icon="campaign" :label="$t('notifications.tabs.diffusion')" no-caps />
      <q-tab name="historique" icon="history" :label="$t('notifications.tabs.historique')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- DIFFUSION                                                         -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'diffusion'" name="diffusion" class="q-pa-none q-mt-md">
      <div class="notifications__diffusion">
        <!-- Diffusion manuelle -->
        <q-form ref="formRef" @submit.prevent="confirmerEnvoi">
          <section class="plaque notif-bloc">
            <h2 class="pochoir section-titre">{{ $t('notifications.broadcast.generalNotice.title') }}</h2>

            <q-select
              v-model="motif"
              :options="motifs"
              outlined
              dense
              emit-value
              map-options
              :label="$t('common.fields.motif')"
            />

            <p class="pochoir notif-bloc__titre">{{ $t('notifications.broadcast.generalNotice.recipientsLabel') }}</p>
            <q-option-group
              v-model="destination"
              :options="optionsDestinataires"
              dense
              class="q-mb-sm"
            />

            <q-input
              v-if="destination === 'numeros'"
              v-model="numerosSaisis"
              type="textarea"
              outlined
              dense
              :label="$t('notifications.broadcast.generalNotice.numbersLabel')"
              :rules="[
                (v) =>
                  v
                    ? v
                        .split(/[\s,;]+/)
                        .filter(Boolean)
                        .every((n: string) => /^\+?[\d\s().-]{6,20}$/.test(n))
                      || t('notifications.broadcast.generalNotice.numbersInvalid')
                    : true,
              ]"
            />

            <q-input
              v-model="message"
              type="textarea"
              outlined
              :label="$t('notifications.broadcast.generalNotice.messageLabel')"
              maxlength="160"
              counter
              :rules="[(v) => !!v || t('notifications.broadcast.generalNotice.messageRequired')]"
            >
              <template #hint>{{ $t('notifications.broadcast.generalNotice.messageHint') }}</template>
            </q-input>

            <q-banner dense class="note--info">
              <template #avatar><q-icon name="info" /></template>
              <div v-if="destination === 'tous'">
                {{ $t('notifications.broadcast.generalNotice.recipientsEstimated', { n: nbInscrits }) }}
              </div>
              <div v-else-if="destination === 'numeros'">
                {{ $t('notifications.broadcast.generalNotice.numbersEntered', { n: numerosComptes }) }}
              </div>
              <div v-else>
                {{ $t('notifications.broadcast.generalNotice.deliberationBroadcast') }}
              </div>
            </q-banner>

            <div class="row q-gutter-sm">
              <q-btn
                outline
                color="primary"
                no-caps
                icon="science"
                :label="$t('notifications.broadcast.generalNotice.testSend')"
                :loading="testEnvoi"
                @click="testerEnvoi"
              />
              <q-btn
                unelevated
                color="primary"
                no-caps
                icon="send"
                :label="$t('notifications.broadcast.generalNotice.send')"
                :loading="envoi"
                :disable="!formulaireValide"
                @click="confirmerEnvoi"
              />
            </div>
          </section>
        </q-form>

        <!-- Résultats de délibération -->
        <section class="plaque notif-bloc">
          <h2 class="section-titre">{{ $t('notifications.broadcast.deliberationResults.title') }}</h2>
          <p class="notif-bloc__aide">
            {{ $t('notifications.broadcast.deliberationResults.help') }}
          </p>
          <q-select
            v-model="deliberationId"
            :options="optionsDeliberations"
            outlined
            dense
            emit-value
            map-options
            :label="$t('notifications.broadcast.deliberationResults.selectLabel')"
            :loading="chargementDeliberations"
          />
          <q-btn
            unelevated
            color="secondary"
            no-caps
            icon="fact_check"
            :label="$t('notifications.broadcast.deliberationResults.submit')"
            :loading="envoiResultats"
            :disable="!deliberationId"
            @click="diffuserResultats"
          />
        </section>
      </div>

      <!-- Résumé du dernier envoi -->
      <div v-if="resume" class="plaque notif-resume" :class="{ 'notif-resume--partiel': resume.echouees }">
        <div class="notif-resume__cellule">
          <p class="pochoir">{{ $t('notifications.broadcast.summary.recipients') }}</p>
          <p class="lettrage chiffres">{{ resume.total }}</p>
        </div>
        <div class="notif-resume__cellule text-positive">
          <p class="pochoir">{{ $t('notifications.broadcast.summary.sent') }}</p>
          <p class="lettrage chiffres">{{ resume.envoyees }}</p>
        </div>
        <div class="notif-resume__cellule" :class="resume.echouees ? 'text-negative' : 'text-positive'">
          <p class="pochoir">{{ $t('notifications.broadcast.summary.failed') }}</p>
          <p class="lettrage chiffres">{{ resume.echouees }}</p>
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- HISTORIQUE                                                        -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'historique'" name="historique" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresHistorique"
        :placeholder="$t('notifications.history.searchPlaceholder')"
        :recherche="true"
        @reinitialiser="reinitialiserHistorique"
      >
        <template #avances>
          <q-select
            v-model="filtresHistorique.statut"
            :options="optionsStatuts"
            dense
            outlined
            clearable
            emit-value
            map-options
            :label="$t('common.fields.status')"
          />
          <champ-date v-model="filtresHistorique.dateDebut" :label="$t('common.actions.from')" />
          <champ-date v-model="filtresHistorique.dateFin" :label="$t('common.actions.to')" />
        </template>
      </filter-bar>

      <div class="text-caption text-grey-7 q-mb-sm">
        {{ $t('notifications.history.countLabel', { n: hist.total, periode: legendePeriode }) }}
      </div>

      <!-- Graphique de répartition -->
      <q-card v-if="chartConfig" flat bordered class="carte q-mb-md">
        <q-card-section>
          <div class="text-subtitle1 text-weight-medium">
            {{ $t('notifications.history.chart.title') }}
          </div>
          <div class="text-caption text-grey-7 q-mb-sm">
            {{ $t('notifications.history.chart.subtitle') }}
          </div>
          <chart-canvas
            :config="chartConfig"
            :hauteur="220"
            role="img"
            :aria-label="resumeRepartition"
          />
        </q-card-section>
      </q-card>

      <q-table
        flat
        bordered
        class="carte"
        :rows="hist.lignes"
        :columns="colonnes"
        row-key="id"
        :loading="hist.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="hist.chargement || hist.lignes.length > 0"
      >
        <template #body-cell-statut="p">
          <q-td :props="p">
            <PastilleStatut domaine="notification" :statut="p.row.statut" />
            <q-tooltip v-if="p.row.erreur" class="notif-erreur">
              {{ p.row.erreur }}
            </q-tooltip>
          </q-td>
        </template>

        <template #body-cell-message="p">
          <q-td :props="p">
            <q-btn flat dense no-caps align="left" class="notifications__message">
              <span class="notifications__message-texte">{{ p.row.message }}</span>
              <q-tooltip :offset="[0, 8]" class="notifications__message-complet">{{ p.row.message }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>

        <template #body-cell-destinataire="p">
          <q-td :props="p">
            <div class="notifications__qui">
              <span v-if="p.row.destinataireNom">{{ p.row.destinataireNom }}</span>
              <span class="pochoir pochoir--brut chiffres">{{ p.row.telephone }}</span>
              <span v-if="p.row.etudiant?.matricule" class="pochoir pochoir--brut">
                {{ p.row.etudiant.matricule }}
              </span>
            </div>
          </q-td>
        </template>

        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="p.row.statut === 'ECHOUE'"
              flat
              dense
              round
              color="primary"
              icon="refresh"
              :aria-label="t('notifications.history.table.resendAria', { telephone: p.row.telephone })"
              :loading="renvoiEnCours === p.row.id"
              @click="renvoyer(p.row)"
            >
              <q-tooltip>{{ $t('notifications.history.table.resendTooltip') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>

        <template #no-data>
          <etat-vide icone="sms" :titre="$t('notifications.history.emptyState.title')" :aide="aideVideHistorique">
            <template #action>
              <q-btn
                v-if="aDesFiltresHistorique"
                flat
                dense
                no-caps
                color="primary"
                icon="filter_alt_off"
                :label="$t('common.actions.clearFilters')"
                @click="reinitialiserHistorique"
              />
              <q-btn
                v-else
                flat
                dense
                no-caps
                color="primary"
                icon="campaign"
                :label="$t('notifications.history.emptyState.goToBroadcast')"
                @click="onglet = 'diffusion'"
              />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <pagination-bar
        v-model:page="hist.page"
        v-model:page-size="hist.pageSize"
        :total="hist.total"
        :show-all="false"
      />
    </q-tab-panel>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { ChartConfiguration } from 'chart.js';
import { api } from '../boot/axios';
import {
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_STATUT_NOTIFICATION,
  dateHeureLisible,
  dateLisible,
} from '../utils/libelles';
import type { Notification, StatutNotification } from '../types';
import { useAuthStore } from '../stores/auth';
import ChampDate from '../components/ChampDate.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ChartCanvas from '../components/ChartCanvas.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';

/**
 * Peintures des états d'envoi, identiques aux pastilles du registre :
 * attente en jaune, envoyé en vert, échec en rouge.
 */
const PEINTURE_ATTENTE = '#FCD116';
const PEINTURE_ENVOYE = '#007A4D';
const PEINTURE_ECHEC = '#CE1126';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const onglet = ref('diffusion');

const formRef = ref();

const formulaireValide = computed(() => {
  if (!message.value.trim()) return false;
  if (destination.value === 'numeros') {
    const numeros = decouperNumeros(numerosSaisis.value);
    if (!numeros.length) return false;
    const tousValides = numeros.every((n) => /^\+?[\d\s().-]{6,20}$/.test(n));
    if (!tousValides) return false;
  }
  return true;
});

// ----------------------------------------------------------------- diffusion
const motifs = computed(() => [
  { label: t('notifications.broadcast.motifs.avis'), value: 'AVIS' },
  { label: t('notifications.broadcast.motifs.resultats'), value: 'RESULTATS' },
  { label: t('notifications.broadcast.motifs.inscription'), value: 'INSCRIPTION' },
  { label: t('common.fields.payment'), value: 'PAIEMENT' },
  { label: t('notifications.broadcast.motifs.convocation'), value: 'CONVOCATION' },
  { label: t('notifications.broadcast.motifs.autre'), value: 'AUTRE' },
]);

const optionsDestinataires = computed(() => [
  { label: t('notifications.broadcast.recipientOptions.tous'), value: 'tous' },
  { label: t('notifications.broadcast.recipientOptions.numeros'), value: 'numeros' },
  { label: t('notifications.broadcast.recipientOptions.resultatsDeliberation'), value: 'resultatsDeliberation' },
]);

const motif = ref('AVIS');
const destination = ref<'tous' | 'numeros' | 'resultatsDeliberation'>('tous');
const numerosSaisis = ref('');
const message = ref('');
const envoi = ref(false);
const testEnvoi = ref(false);
const resume = ref<{ total: number; envoyees: number; echouees: number } | null>(null);

const nbInscrits = ref(0);

const numerosComptes = computed(() =>
  numerosSaisis.value
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean).length,
);

function decouperNumeros(texte: string): string[] {
  return texte
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function chargerNbInscrits() {
  try {
    const { data } = await api.get('/notifications/destinataires/estimes', {
      params: { mode: 'tousInscrits' },
    });
    nbInscrits.value = data?.total ?? 0;
  } catch {
    nbInscrits.value = 0;
  }
}

async function confirmerEnvoi() {
  const valide = await formRef.value?.validate();
  if (valide === false) return;
  const nbDestinaires = destination.value === 'tous'
    ? nbInscrits.value
    : destination.value === 'numeros'
      ? numerosComptes.value
      : 0;
  const ok = await confirmer({
    titre: t('notifications.messages.confirmSendTitle'),
    message: t('notifications.messages.confirmSendMessage', { n: nbDestinaires }),
    ok: t('notifications.messages.confirmSendOk'),
  });
  if (ok) await envoyer();
}

async function envoyer() {
  envoi.value = true;
  try {
    const numeros = destination.value === 'numeros' ? decouperNumeros(numerosSaisis.value) : [];
    if (destination.value === 'numeros' && !numeros.length) {
      $q.notify({ type: 'warning', message: t('notifications.messages.enterAtLeastOneNumber') });
      return;
    }
    const { data } = await api.post('/notifications', {
      message: message.value,
      motif: motif.value,
      tousInscrits: destination.value === 'tous',
      destinatairesTelephones: destination.value === 'numeros' ? numeros : undefined,
      mode: destination.value === 'tous' ? 'tousInscrits' : 'manuel',
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: t('notifications.messages.sentSummary', {
        envoyees: data.envoyees,
        echoueesSuffix: data.echouees
          ? t('notifications.messages.sentSummaryFailedSuffix', { n: data.echouees })
          : '',
      }),
    });
    await chargerHistorique();
    await chargerStats();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}

async function testerEnvoi() {
  if (!message.value.trim()) {
    $q.notify({ type: 'warning', message: t('notifications.messages.enterMessageBeforeTest') });
    return;
  }
  testEnvoi.value = true;
  try {
    const { data } = await api.post('/notifications', {
      message: message.value,
      motif: motif.value,
      mode: 'manuel',
      destinatairesTelephones: ['+224000000001', '+224000000002'],
      simulation: true,
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: 'info',
      message: t('notifications.messages.testSentSummary', { total: data.total, envoyees: data.envoyees }),
    });
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    testEnvoi.value = false;
  }
}

// ------------------------------------------------- délibération (résultats)
const deliberationId = ref<string | null>(null);
const deliberations = ref<{ id: string; session: string; annee: string; promotion: string; lignes: number }[]>([]);
const chargementDeliberations = ref(false);
const envoiResultats = ref(false);

const optionsDeliberations = computed(() =>
  deliberations.value.map((d) => ({
    label: `${d.annee} · ${d.promotion} · ${LIBELLE_SESSION_DELIBERATION[d.session as 'NORMALE' | 'RATTRAPAGE'] ?? d.session} (${d.lignes} lignes)`,
    value: d.id,
  })),
);

async function chargerDeliberations() {
  chargementDeliberations.value = true;
  try {
    const { data } = await api.get('/notifications/deliberations');
    deliberations.value = data;
  } catch {
    deliberations.value = [];
  } finally {
    chargementDeliberations.value = false;
  }
}

async function diffuserResultats() {
  if (!deliberationId.value) return;
  envoiResultats.value = true;
  try {
    const { data } = await api.post('/notifications/resultats-deliberation', {
      deliberationId: deliberationId.value,
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: t('notifications.messages.resultsBroadcastSummary', {
        envoyees: data.envoyees,
        echouees: data.echouees,
      }),
    });
    await chargerHistorique();
    await chargerStats();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoiResultats.value = false;
  }
}

// ------------------------------------------------------------- historique
const filtresHistorique = ref<Record<string, any>>({ recherche: '', statut: null, dateDebut: '', dateFin: '' });
const hist = reactive(
  useListePaginee<Notification>({
    filtres: filtresHistorique,
    pageSize: 25,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/notifications', {
          params: {
            ...pageApi(p),
            statut: f.statut || undefined,
            search: texteApi(f.recherche),
            dateDebut: f.dateDebut || undefined,
            dateFin: f.dateFin || undefined,
          },
        })
        .then((r) => r.data),
  }),
);
const chargerHistorique = () => hist.recharger();

const optionsStatuts = Object.entries(LIBELLE_STATUT_NOTIFICATION).map(([value, label]) => ({
  value: value as StatutNotification,
  label,
}));

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'date',
    label: t('common.fields.date'),
    field: (r: Notification) => r.createdAt,
    format: (v: string) => dateHeureLisible(v),
    align: 'left',
    sortable: true,
  },
  {
    name: 'destinataire',
    label: t('notifications.history.table.columns.destinataire'),
    field: (r: Notification) => `${r.destinataireNom ?? ''} ${r.telephone}`,
    align: 'left',
  },
  { name: 'motif', label: t('common.fields.motif'), field: (r: Notification) => r.motif ?? '—', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: (r: Notification) => r.statut, align: 'left' },
  {
    name: 'message',
    label: t('notifications.history.table.columns.message'),
    field: (r: Notification) => r.message,
    align: 'left',
  },
  {
    name: 'envoyePar',
    label: t('notifications.history.table.columns.envoyePar'),
    field: (r: Notification) => r.envoyePar?.prenom ?? '',
    align: 'left',
  },
  {
    name: 'actions',
    label: '',
    field: 'id',
    align: 'right',
  },
]);

const aDesFiltresHistorique = computed(() => {
  const f = filtresHistorique.value;
  return !!(f.recherche || f.statut || f.dateDebut || f.dateFin);
});

const aideVideHistorique = computed(
  () =>
    `${t('notifications.history.emptyState.detail')} ${
      aDesFiltresHistorique.value
        ? t('notifications.history.emptyState.noneMatchFilters')
        : t('notifications.history.emptyState.startBroadcast')
    }`,
);

const legendePeriode = computed(() => {
  const f = filtresHistorique.value;
  if (f.dateDebut && f.dateFin) {
    return t('notifications.history.period.range', {
      debut: dateLisible(f.dateDebut),
      fin: dateLisible(f.dateFin),
    });
  }
  if (f.dateDebut) return t('notifications.history.period.since', { debut: dateLisible(f.dateDebut) });
  if (f.dateFin) return t('notifications.history.period.until', { fin: dateLisible(f.dateFin) });
  return t('notifications.history.period.all');
});

function reinitialiserHistorique() {
  hist.reinitialiser([]);
}

const renvoiEnCours = ref<string | null>(null);

/**
 * Renvoyer, c'est réémettre le même message au même numéro : la passerelle ne
 * sait pas rejouer un envoi consigné, on repasse donc par la diffusion
 * manuelle. La ligne échouée reste au registre — elle est l'historique — et le
 * nouvel envoi s'y ajoute.
 */
async function renvoyer(n: Notification) {
  renvoiEnCours.value = n.id;
  try {
    const { data } = await api.post('/notifications', {
      message: n.message,
      motif: n.motif ?? 'AUTRE',
      mode: 'manuel',
      destinatairesTelephones: [n.telephone],
    });
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: data.echouees
        ? t('notifications.messages.resendFailedAgain', { telephone: n.telephone })
        : t('notifications.messages.resendSuccess', { telephone: n.telephone }),
    });
    await chargerHistorique();
    await chargerStats();
    await chargerRepartition();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    renvoiEnCours.value = null;
  }
}

// -------------------------------------------------------------------- stats
const stats = ref<{ EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number } | null>(null);

async function chargerStats() {
  try {
    const { data } = await api.get('/notifications/stats');
    stats.value = data;
  } catch {
    stats.value = null;
  }
}

const repartition30j = ref<{ date: string; EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number }[]>([]);

async function chargerRepartition() {
  try {
    const { data } = await api.get('/notifications/stats/repartition', {
      params: { jours: 30 },
    });
    repartition30j.value = Array.isArray(data) ? data : [];
  } catch {
    repartition30j.value = [];
  }
}

/** Alternative textuelle du graphique, pour qui ne voit pas les barres. */
const resumeRepartition = computed(() => {
  const totaux = repartition30j.value.reduce(
    (acc, r) => ({
      attente: acc.attente + r.EN_ATTENTE,
      envoyes: acc.envoyes + r.ENVOYEE,
      echoues: acc.echoues + r.ECHOUE,
    }),
    { attente: 0, envoyes: 0, echoues: 0 },
  );
  return t('notifications.history.chart.summaryAria', {
    envoyes: totaux.envoyes,
    echoues: totaux.echoues,
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
        { label: t('notifications.history.chart.series.enFile'), data: repartition30j.value.map((r) => r.EN_ATTENTE), backgroundColor: PEINTURE_ATTENTE },
        { label: t('notifications.history.chart.series.envoyes'), data: repartition30j.value.map((r) => r.ENVOYEE), backgroundColor: PEINTURE_ENVOYE },
        { label: t('notifications.history.chart.series.echoues'), data: repartition30j.value.map((r) => r.ECHOUE), backgroundColor: PEINTURE_ECHEC },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    },
  };
});

watch(onglet, (v) => {
  if (v === 'historique') {
    void chargerRepartition();
  }
});

onMounted(() => {
  void chargerStats();
  void chargerNbInscrits();
  void chargerRepartition();
  if (auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) void chargerDeliberations();
});
</script>

<style scoped lang="scss">
.notifications {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.notifications__diffusion {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--up-4);
  align-items: start;
}

.notif-bloc {
  background: var(--up-plaque);
  border: var(--up-filet);
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-3);

  .section-titre {
    margin: 0;
  }
}

.notif-bloc__titre {
  margin: var(--up-2) 0 0;
  color: var(--up-encre-douce);
}

.notif-bloc__aide {
  margin: 0;
  font-size: 0.88rem;
  color: var(--up-encre-douce);
}

.notif-resume {
  margin-top: var(--up-4);
  display: grid;
  grid-template-columns: repeat(3, 1fr);

  & > * + * { border-left: var(--up-filet); }

  &--partiel { border-color: $rouge; }
}

.notif-resume__cellule {
  padding: var(--up-3);
  text-align: center;

  p { margin: 0; }
  .lettrage { font-size: 1.8rem; }
}

.notifications__qui {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notifications__message {
  max-width: 340px;
  font-size: 0.86rem;
  text-transform: none;
  letter-spacing: 0;
}

.notifications__message-texte {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.notifications__message-complet {
  max-width: 420px;
  white-space: pre-wrap;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
}

</style>
