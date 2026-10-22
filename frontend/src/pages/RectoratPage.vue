<template>
  <q-page class="q-pa-md">
    <section-navigation section="bilan" />
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('rectoratPage.title') }}</h1>
        <div class="page-sous-titre">
          <i18n-t keypath="rectoratPage.subtitle" tag="span">
            <template #annee>
              <strong>{{ chiffres?.annee?.libelle ?? $t('rectoratPage.subtitleFallback') }}</strong>
            </template>
          </i18n-t>
        </div>
      </div>
      <div class="col-auto row q-gutter-sm">
        <q-select
          v-model="anneeId"
          :options="optionsAnnees"
          dense
          outlined
          emit-value
          map-options
          :label="$t('rectoratPage.filters.year')"
          style="min-width: 180px"
          @update:model-value="charger"
        />
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="assessment"
          :label="$t('rectoratPage.actions.generateReport')"
          :loading="generation"
          :disable="!anneeId"
          @click="genererBilan"
        >
          <q-tooltip>
            {{ $t('rectoratPage.actions.generateReportTooltip') }}
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">{{ chiffres?.effectifTotal ?? 0 }}</div>
            <div class="pochoir text-grey-7">{{ $t('rectoratPage.kpis.totalHeadcount') }}</div>
            <div class="text-caption text-grey-6">
              {{ $t('rectoratPage.kpis.totalHeadcountDetail', { count: (chiffres?.effectifParPromotion ?? []).length }) }}
            </div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="groups" :label="$t('rectoratPage.kpis.viewStudents')" to="/etudiants" />
          </q-card-actions>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">{{ pourcentLisible(chiffres?.tauxReussite) }}</div>
            <div class="pochoir text-grey-7">{{ $t('rectoratPage.kpis.successRate') }}</div>
            <div class="text-caption text-grey-6">{{ $t('rectoratPage.kpis.successRateDetail') }}</div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="how_to_vote" :label="$t('rectoratPage.kpis.viewDeliberations')" to="/deliberations" />
          </q-card-actions>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">
              {{ montantLisible(chiffres?.masseSalariale) }} <span class="text-h6">{{ $t('statistiquesMesrs.chart.axis.gnf') }}</span>
            </div>
            <div class="pochoir text-grey-7">{{ $t('rectoratPage.kpis.payroll') }}</div>
            <div class="text-caption text-grey-6">{{ chiffres?.masseSalarialeMois ?? '—' }}</div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="payments" :label="$t('rectoratPage.kpis.viewPayroll')" to="/paie" />
          </q-card-actions>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">
              {{ chiffres?.nbReclamationsEnCours ?? 0 }}
            </div>
            <div class="pochoir text-grey-7">{{ $t('rectoratPage.kpis.pendingComplaints') }}</div>
            <div class="text-caption text-grey-6">{{ $t('rectoratPage.kpis.pendingComplaintsDetail') }}</div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="list_alt" :label="$t('rectoratPage.kpis.viewComplaints')" to="/reclamations" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-7">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">{{ $t('rectoratPage.headcountChart.title') }}</div>
              <div class="text-caption text-grey-7">{{ $t('rectoratPage.headcountChart.subtitle') }}</div>
            </div>
            <q-btn flat dense no-caps color="primary" icon="how_to_reg" :label="$t('rectoratPage.headcountChart.enrollments')" to="/inscriptions" />
          </q-card-section>
          <q-card-section>
            <chart-canvas
              v-if="aDesPromotions"
              :config="configPromotions"
              :hauteur="300"
              role="img"
              :aria-label="resumePromotions"
            />
            <div v-else class="etat-vide">
              <q-icon name="groups" size="36px" />
              <div class="text-subtitle2 q-mt-sm">{{ $t('rectoratPage.headcountChart.emptyTitle') }}</div>
              <div class="text-caption">
                {{ $t('rectoratPage.headcountChart.emptyDescription') }}
              </div>
              <q-btn flat dense no-caps color="primary" icon="how_to_reg" :label="$t('rectoratPage.headcountChart.openEnrollments')" to="/inscriptions" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-5">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">{{ $t('rectoratPage.payrollChart.title') }}</div>
              <div class="text-caption text-grey-7">{{ $t('rectoratPage.payrollChart.subtitle') }}</div>
            </div>
            <q-btn flat dense no-caps color="primary" icon="payments" :label="$t('rectoratPage.payrollChart.payroll')" to="/paie" />
          </q-card-section>
          <q-card-section>
            <chart-canvas
              v-if="configMasse"
              :config="configMasse"
              :hauteur="300"
              role="img"
              :aria-label="resumeMasse"
            />
            <div v-else class="etat-vide">
              <q-icon name="payments" size="36px" />
              <div class="text-subtitle2 q-mt-sm">{{ $t('rectoratPage.payrollChart.emptyTitle') }}</div>
              <div class="text-caption">
                {{ $t('rectoratPage.payrollChart.emptyDescription') }}
              </div>
              <q-btn flat dense no-caps color="primary" icon="payments" :label="$t('rectoratPage.payrollChart.openPayroll')" to="/paie" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-7">
        <q-card flat bordered class="carte">
          <q-card-section class="text-subtitle2">{{ $t('rectoratPage.staffIncidents.title') }}</q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-item clickable to="/enseignants">
                  <q-item-section avatar>
                    <q-avatar color="primary" text-color="white" icon="school" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('rectoratPage.staffIncidents.teachers', { count: chiffres?.nbEnseignants ?? 0 }) }}</q-item-label>
                    <q-item-label caption>
                      {{
                        $t('rectoratPage.staffIncidents.teachersDetail', {
                          vacataires: chiffres?.nbVacataires ?? 0,
                          permanents: (chiffres?.nbEnseignants ?? 0) - (chiffres?.nbVacataires ?? 0),
                        })
                      }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side><q-icon name="chevron_right" /></q-item-section>
                </q-item>
              </div>
              <div class="col-12 col-sm-6">
                <q-item clickable to="/helpdesk">
                  <q-item-section avatar>
                    <q-avatar color="negative" text-color="white" icon="support_agent" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      {{ $t('rectoratPage.staffIncidents.helpdeskIncidents', { count: chiffres?.nbIncidentsHelpdesk24h ?? 0 }) }}
                    </q-item-label>
                    <q-item-label caption>
                      {{ $t('rectoratPage.staffIncidents.helpdeskIncidentsDetail') }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side><q-icon name="chevron_right" /></q-item-section>
                </q-item>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-5">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">{{ $t('rectoratPage.assets.title') }}</div>
              <div class="text-caption text-grey-7">
                {{ $t('rectoratPage.assets.subtitle') }}
              </div>
            </div>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="inventory_2"
              :label="$t('rectoratPage.assets.link')"
              to="/patrimoine"
            />
          </q-card-section>
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ dashboard?.obsoletes ?? 0 }}</div>
            <div class="pochoir text-grey-7">{{ $t('rectoratPage.assets.obsoleteEquipment') }}</div>
            <div class="text-caption text-grey-6 q-mt-sm">
              {{
                $t('rectoratPage.assets.detail', {
                  total: dashboard?.total ?? 0,
                  enReparation: dashboard?.enReparation ?? 0,
                })
              }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-inner-loading :showing="chargement" :label="$t('rectoratPage.loading')" />
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '../components/SectionNavigation.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import ChartCanvas from '../components/ChartCanvas.vue';
import { montantLisible, nombreLisible, pourcentLisible } from '../utils/libelles';
import type { AnneeAcademique, FeuillePaie, TableauBordPatrimoine, TableauBordRectorat } from '../types';

/**
 * Les peintures des graphiques. Un même indicateur porte la même couleur ici et
 * dans Statistiques MESRS — sans quoi la lecture d'un écran à l'autre ment.
 * Effectif = encre (une masse, pas un état), réussite = vert, argent = ocre.
 */
const PEINTURE_EFFECTIF = '#1D1D1F';
const PEINTURE_ARGENT = '#8A6300';

const $q = useQuasar();
const router = useRouter();
const { t } = useI18n();

const annees = ref<AnneeAcademique[]>([]);
const anneeId = ref<string | null>(null);
const chiffres = ref<TableauBordRectorat | null>(null);
const dashboard = ref<TableauBordPatrimoine | null>(null);
const generation = ref(false);
const chargement = ref(false);

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);

const promotions = computed(() => (chiffres.value?.effectifParPromotion ?? []).slice(0, 24));
const aDesPromotions = computed(() => promotions.value.length > 0);

/** Alternative textuelle du graphique : ce qu'un lecteur d'écran doit entendre. */
const resumePromotions = computed(() =>
  t('rectoratPage.headcountChart.ariaSummary', {
    details: promotions.value.map((p) => `${p.nom} ${p.effectif}`).join(', '),
  }),
);
const resumeMasse = computed(() =>
  t('rectoratPage.payrollChart.ariaSummary', {
    details: evolutionMasse.value.map((m) => `${m.mois} ${montantLisible(m.total)}`).join(', '),
  }),
);

const configPromotions = computed<ChartConfiguration>(() => ({
  type: 'bar',
  data: {
    labels: promotions.value.map((p) => p.nom),
    datasets: [
      {
        label: t('rectoratPage.headcountChart.datasetLabel'),
        data: promotions.value.map((p) => p.effectif),
        backgroundColor: PEINTURE_EFFECTIF,
        borderColor: PEINTURE_EFFECTIF,
        borderWidth: 1,
      },
    ],
  },
  options: {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: 30 } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  },
}));

const evolutionMasse = ref<{ mois: string; total: number }[]>([]);

const configMasse = computed<ChartConfiguration | null>(() => {
  // Douze mois à zéro ne sont pas une courbe : c'est un état vide, et il doit
  // se dire avec des mots plutôt qu'avec une ligne plate.
  if (!evolutionMasse.value.some((m) => m.total > 0)) return null;
  return {
    type: 'line',
    data: {
      labels: evolutionMasse.value.map((m) => m.mois),
      datasets: [
        {
          label: t('rectoratPage.payrollChart.datasetLabel'),
          data: evolutionMasse.value.map((m) => m.total),
          borderColor: PEINTURE_ARGENT,
          backgroundColor: 'rgba(201, 138, 0, 0.16)',
          borderWidth: 3,
          fill: true,
          tension: 0.05,
          pointRadius: 3,
        },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            callback: (val) => nombreLisible(Number(val), 0),
          },
        },
      },
    },
  };
});

async function charger() {
  chargement.value = true;
  const params = anneeId.value ? { anneeId: anneeId.value } : {};
  try {
    const [c, d, masses] = await Promise.all([
      api.get('/rectorat/chiffres', { params }),
      api.get('/patrimoine/dashboard', { params }),
      evolutionMasseSalariale(),
    ]);
    chiffres.value = c.data;
    dashboard.value = d.data;
    evolutionMasse.value = masses;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

/**
 * L'API n'expose pas l'évolution mensuelle : on l'agrège à partir des feuilles
 * de paie sur les 12 derniers mois, plutôt que d'ouvrir une route de plus. Une
 * feuille compte à partir du moment où elle est validée — c'est là que son
 * montant est figé — et se range au mois de sa validation.
 */
async function evolutionMasseSalariale(): Promise<{ mois: string; total: number }[]> {
  const maintenant = new Date();
  const mois: { key: string; label: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      total: 0,
    });
  }
  try {
    const r = await api.get('/feuilles-paie', { params: { all: '1' } });
    const feuilles: FeuillePaie[] = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
    for (const f of feuilles) {
      const reference = f.valideeLe ?? f.payeeLe;
      if (!reference) continue;
      const dateRef = new Date(reference);
      if (Number.isNaN(dateRef.getTime())) continue;
      const key = `${dateRef.getFullYear()}-${String(dateRef.getMonth() + 1).padStart(2, '0')}`;
      const m = mois.find((x) => x.key === key);
      if (m) m.total += f.montantTotal ?? 0;
    }
  } catch {
    // La courbe reste plate : l'écran de paie dira pourquoi.
  }
  return mois.map((m) => ({ mois: m.label, total: m.total }));
}

async function genererBilan() {
  if (!anneeId.value) return;
  generation.value = true;
  try {
    await api.post('/rectorat/bilan-mesrs/generer', { anneeId: anneeId.value });
    // Le snapshot ne vit pas ici : on dit où il est parti, et on y emmène.
    $q.notify({
      type: 'positive',
      icon: 'assessment',
      message: t('rectoratPage.messages.reportGenerated', { annee: chiffres.value?.annee?.libelle ?? '' }),
      actions: [
        {
          label: t('rectoratPage.messages.viewSnapshots'),
          color: 'white',
          noCaps: true,
          handler: () => void router.push('/statistiques-mesrs'),
        },
      ],
    });
    await charger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    generation.value = false;
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/annees', { params: { all: '1' } });
    annees.value = Array.isArray(data) ? data : data.data ?? [];
    if (annees.value.length) {
      anneeId.value = annees.value.find((a) => a.active)?.id ?? annees.value[0].id;
    }
  } catch {
    /* notifié par l'intercepteur */
  }
  await charger();
});
</script>

<style scoped lang="scss">
/* Le chiffre qu'on cherche en levant les yeux. Même définition que sur les
   autres tableaux de bord de l'application (Helpdesk, Réclamations, Stages). */
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}

</style>
