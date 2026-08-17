<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tableau de bord du Rectorat</div>
        <div class="page-sous-titre">
          Vue d'ensemble pour la direction : effectifs, réussite, masse salariale et
          bruit de fond courant — année académique
          <strong>{{ chiffres?.annee?.libelle ?? '—' }}</strong>
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
          label="Année"
          style="min-width: 180px"
          @update:model-value="charger"
        />
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="assessment"
          label="Générer le bilan MESRS"
          :loading="generation"
          :disable="!anneeId"
          @click="genererBilan"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ chiffres?.effectifTotal ?? 0 }}</div>
            <div class="pochoir text-grey-7">Effectif total</div>
            <div class="text-caption text-grey-6">
              {{ (chiffres?.effectifParPromotion ?? []).length }} promotion(s)
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ pourcentLisible(chiffres?.tauxReussite) }}</div>
            <div class="pochoir text-grey-7">Taux de réussite global</div>
            <div class="text-caption text-grey-6">Session normale · délibérations validées</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">
              {{ montantLisible(chiffres?.masseSalariale) }} <span class="text-h6">GNF</span>
            </div>
            <div class="pochoir text-grey-7">Masse salariale</div>
            <div class="text-caption text-grey-6">{{ chiffres?.masseSalarialeMois ?? '—' }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres text-warning">
              {{ chiffres?.nbReclamationsEnCours ?? 0 }}
            </div>
            <div class="pochoir text-grey-7">Réclamations en attente</div>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="list_alt"
              label="Voir les réclamations"
              to="/reclamations"
              class="q-mt-sm"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-7">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">Effectif par promotion</div>
              <div class="text-caption text-grey-7">Inscriptions non annulées</div>
            </div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="chiffres" :config="configPromotions" :hauteur="300" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-5">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">Masse salariale mensuelle</div>
              <div class="text-caption text-grey-7">12 derniers mois — feuilles validées</div>
            </div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="configMasse" :config="configMasse" :hauteur="300" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-7">
        <q-card flat bordered class="carte">
          <q-card-section class="text-subtitle2">Personnel & incidents</q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-item>
                  <q-item-section avatar>
                    <q-avatar color="primary" text-color="white" icon="school" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ chiffres?.nbEnseignants ?? 0 }} enseignants</q-item-label>
                    <q-item-label caption>
                      {{ chiffres?.nbVacataires ?? 0 }} vacataire(s) ·
                      {{ (chiffres?.nbEnseignants ?? 0) - (chiffres?.nbVacataires ?? 0) }} permanent(s)
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </div>
              <div class="col-6">
                <q-item>
                  <q-item-section avatar>
                    <q-avatar color="negative" text-color="white" icon="support_agent" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      {{ chiffres?.nbIncidentsHelpdesk24h ?? 0 }} incident(s) helpdesk
                    </q-item-label>
                    <q-item-label caption>
                      sur les dernières 24h — tous statuts confondus
                    </q-item-label>
                  </q-item-section>
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
              <div class="text-subtitle2">Patrimoine — obsolescences</div>
              <div class="text-caption text-grey-7">
                Équipements dont l'âge dépasse la durée d'obsolescence prévue
              </div>
            </div>
            <q-btn
              flat
              dense
              no-caps
              icon="inventory_2"
              label="Patrimoine"
              to="/patrimoine"
            />
          </q-card-section>
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres text-warning">{{ dashboard?.obsoletes ?? 0 }}</div>
            <div class="pochoir text-grey-7">équipements obsolètes</div>
            <div class="text-caption text-grey-6 q-mt-sm">
              {{ dashboard?.total ?? 0 }} équipements actifs ·
              {{ dashboard?.enReparation ?? 0 }} en réparation
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChartCanvas from '../components/ChartCanvas.vue';
import { montantLisible, pourcentLisible } from '../utils/libelles';
import type { AnneeAcademique, TableauBordPatrimoine, TableauBordRectorat } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const annees = ref<AnneeAcademique[]>([]);
const anneeId = ref<string | null>(null);
const chiffres = ref<TableauBordRectorat | null>(null);
const dashboard = ref<TableauBordPatrimoine | null>(null);
const generation = ref(false);

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);

const configPromotions = computed<ChartConfiguration>(() => ({
  type: 'bar',
  data: {
    labels: (chiffres.value?.effectifParPromotion ?? []).slice(0, 24).map((p) => p.nom),
    datasets: [
      {
        label: 'Effectif',
        data: (chiffres.value?.effectifParPromotion ?? []).slice(0, 24).map((p) => p.effectif),
        backgroundColor: '#1565c0',
        borderColor: '#0d47a1',
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
  if (!evolutionMasse.value.length) return null;
  return {
    type: 'line',
    data: {
      labels: evolutionMasse.value.map((m) => m.mois),
      datasets: [
        {
          label: 'Masse salariale (GNF)',
          data: evolutionMasse.value.map((m) => m.total),
          borderColor: '#0F7A45',
          backgroundColor: 'rgba(15,122,69,.16)',
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
            callback: (val) => Number(val).toLocaleString('fr-FR'),
          },
        },
      },
    },
  };
});

async function charger() {
  const params = anneeId.value ? { anneeId: anneeId.value } : {};
  const [c, d, masses] = await Promise.all([
    api.get('/rectorat/chiffres', { params }),
    api.get('/patrimoine/dashboard', { params }),
    api.get('/rectorat/chiffres', { params }).then(async () => {
      // L'API n'expose pas l'évolution mensuelle : on l'agrège à partir des
      // feuilles de paie validées sur les 12 derniers mois. Calcul local
      // pour ne pas multiplier les routes.
      const r = await api.get('/paie', { params: { all: '1' } });
      const feuilles: any[] = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
      const maintenant = new Date();
      const mois: { key: string; label: string; total: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mois.push({
          key,
          label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          total: 0,
        });
      }
      for (const f of feuilles) {
        if (!f.valideLe && f.statut !== 'PAYEE') continue;
        const dateRef = f.valideLe ? new Date(f.valideLe) : new Date(f.payeeLe ?? f.valideLe);
        const key = `${dateRef.getFullYear()}-${String(dateRef.getMonth() + 1).padStart(2, '0')}`;
        const m = mois.find((x) => x.key === key);
        if (m) m.total += f.montantTotal ?? 0;
      }
      return mois.map((m) => ({ mois: m.label, total: m.total }));
    }),
  ]);
  chiffres.value = c.data;
  dashboard.value = d.data;
  evolutionMasse.value = masses;
}

async function genererBilan() {
  if (!anneeId.value) return;
  generation.value = true;
  try {
    const { data } = await api.post('/rectorat/bilan-mesrs/generer', { anneeId: anneeId.value });
    $q.notify({
      type: 'positive',
      message: `Bilan MESRS ${chiffres.value?.annee?.libelle ?? ''} généré — ${data.id.slice(0, 8)}…`,
      icon: 'assessment',
    });
    await charger();
  } finally {
    generation.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/annees', { params: { all: '1' } });
  annees.value = Array.isArray(data) ? data : data.data ?? [];
  if (annees.value.length) {
    anneeId.value = annees.value.find((a) => a.active)?.id ?? annees.value[0].id;
  }
  await charger();
  void auth;
});
</script>
