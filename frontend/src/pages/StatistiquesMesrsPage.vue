<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Statistiques MESRS</div>
        <div class="page-sous-titre">
          Snapshots transmis au Ministère — figés à la date de génération, ils
          gardent la trace de ce qui a été déclaré
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
          icon="file_download"
          label="Exporter CSV"
          :disable="!snapshots.length"
          @click="exporterCsv"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ dernier?.effectifTotal ?? 0 }}</div>
            <div class="pochoir text-grey-7">Effectif (dernier snapshot)</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ pourcentLisible(dernier?.tauxReussite) }}</div>
            <div class="pochoir text-grey-7">Taux de réussite</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">
              {{ montantLisible(dernier?.masseSalariale) }} <span class="text-h6">GNF</span>
            </div>
            <div class="pochoir text-grey-7">Masse salariale</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ snapshots.length }}</div>
            <div class="pochoir text-grey-7">Snapshots archivés</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-subtitle2">Évolution sur 12 mois</div>
          <div class="text-caption text-grey-7">
            Effectif, taux de réussite et masse salariale — un point par snapshot
          </div>
        </div>
      </q-card-section>
      <q-card-section>
        <chart-canvas v-if="configEvolution" :config="configEvolution" :hauteur="320" />
      </q-card-section>
    </q-card>

    <q-card flat bordered class="carte">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-subtitle2">Snapshots MESRS</div>
          <div class="text-caption text-grey-7">
            {{ snapshots.length }} enregistrement(s) —
            <span v-if="anneeLibelle">filtré sur {{ anneeLibelle }}</span>
            <span v-else>toutes années</span>
          </div>
        </div>
      </q-card-section>
      <q-table
        flat
        bordered
        class="carte"
        :rows="snapshots"
        :columns="colonnes"
        row-key="id"
        :loading="chargement"
        :pagination="{ rowsPerPage: 20, sortBy: 'genereLe', descending: true }"
      >
        <template #body-cell-genereLe="p">
          <q-td :props="p">
            {{ dateHeureLisible(p.row.genereLe) }}
          </q-td>
        </template>
        <template #body-cell-effectif="p">
          <q-td :props="p" class="text-right chiffres">
            {{ p.row.donnees?.effectifTotal ?? '—' }}
          </q-td>
        </template>
        <template #body-cell-taux="p">
          <q-td :props="p" class="text-right">
            {{ pourcentLisible(p.row.donnees?.tauxReussite) }}
          </q-td>
        </template>
        <template #body-cell-masse="p">
          <q-td :props="p" class="text-right chiffres">
            {{ montantLisible(p.row.donnees?.masseSalariale) }}
          </q-td>
        </template>
        <template #body-cell-annee="p">
          <q-td :props="p">{{ p.row.annee?.libelle ?? '—' }}</q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense round icon="print" @click="imprimer(p.row)">
              <q-tooltip>Imprimer le bilan A4</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { QTableColumn } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChartCanvas from '../components/ChartCanvas.vue';
import { dateHeureLisible, montantLisible, pourcentLisible } from '../utils/libelles';
import type { AnneeAcademique, StatistiqueMesrs } from '../types';

const auth = useAuthStore();

const annees = ref<AnneeAcademique[]>([]);
const anneeId = ref<string | null>(null);
const snapshots = ref<StatistiqueMesrs[]>([]);
const chargement = ref(false);

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const anneeLibelle = computed(
  () => annees.value.find((a) => a.id === anneeId.value)?.libelle ?? null,
);

const dernier = computed(() => snapshots.value[0]?.donnees ?? null);

const colonnes: QTableColumn[] = [
  { name: 'genereLe', label: 'Généré le', field: 'genereLe', align: 'left', sortable: true },
  { name: 'annee', label: 'Année', field: 'annee', align: 'left' },
  { name: 'effectif', label: 'Effectif', field: 'effectif', align: 'right' },
  { name: 'taux', label: 'Taux', field: 'taux', align: 'right' },
  { name: 'masse', label: 'Masse salariale (GNF)', field: 'masse', align: 'right' },
  {
    name: 'generePar',
    label: 'Par',
    field: (r: StatistiqueMesrs) =>
      r.generePar ? `${r.generePar.prenom} ${r.generePar.nom}` : '—',
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const configEvolution = computed<ChartConfiguration | null>(() => {
  if (!snapshots.value.length) return null;
  const ordre = [...snapshots.value].sort(
    (a, b) => new Date(a.genereLe).getTime() - new Date(b.genereLe).getTime(),
  );
  const labels = ordre.map((s) => dateHeureLisible(s.genereLe).slice(0, 16));
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Effectif',
          data: ordre.map((s) => s.donnees?.effectifTotal ?? 0),
          borderColor: '#1565c0',
          backgroundColor: 'rgba(21,101,192,.16)',
          borderWidth: 3,
          yAxisID: 'yEffectif',
          tension: 0.05,
          pointRadius: 3,
        },
        {
          label: 'Taux de réussite (%)',
          data: ordre.map((s) => s.donnees?.tauxReussite ?? 0),
          borderColor: '#0F7A45',
          borderWidth: 2,
          borderDash: [4, 4],
          yAxisID: 'yTaux',
          tension: 0.05,
          pointRadius: 3,
        },
        {
          label: 'Masse salariale (GNF)',
          data: ordre.map((s) => s.donnees?.masseSalariale ?? 0),
          borderColor: '#EFB700',
          backgroundColor: 'rgba(239,183,0,.12)',
          borderWidth: 3,
          yAxisID: 'yMasse',
          tension: 0.05,
          pointRadius: 3,
        },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: {
        yEffectif: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: 'Effectif' },
        },
        yTaux: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          max: 100,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Taux %' },
        },
        yMasse: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { callback: (v) => Number(v).toLocaleString('fr-FR') },
          title: { display: true, text: 'GNF' },
        },
      },
    },
  };
});

function exporterCsv() {
  const lignes = [
    [
      'Date',
      'Année',
      'Effectif',
      'Taux réussite',
      'Masse salariale',
      'Mois masse',
      'Enseignants',
      'Vacataires',
      'Réclamations',
      'Incidents 24h',
      'Équipements obsolètes',
      'En réparation',
      'Généré par',
    ],
  ];
  for (const s of snapshots.value) {
    const d = s.donnees ?? {};
    lignes.push([
      s.genereLe,
      s.annee?.libelle ?? '',
      String(d.effectifTotal ?? ''),
      String(d.tauxReussite ?? ''),
      String(d.masseSalariale ?? ''),
      d.masseSalarialeMois ?? '',
      String(d.nbEnseignants ?? ''),
      String(d.nbVacataires ?? ''),
      String(d.nbReclamationsEnCours ?? ''),
      String(d.nbIncidentsHelpdesk24h ?? ''),
      String(d.patrimoine?.obsoletes ?? ''),
      String(d.patrimoine?.enReparation ?? ''),
      s.generePar ? `${s.generePar.prenom} ${s.generePar.nom}` : '',
    ]);
  }
  const csv = lignes.map((l) => l.map(echapperCsv).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `statistiques-mesrs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function echapperCsv(v: string): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function imprimer(s: StatistiqueMesrs) {
  window.open(
    `${API_URL}/rectorat/bilan-mesrs/${s.id}/imprimer?token=${auth.token}`,
    '_blank',
  );
}

async function charger() {
  chargement.value = true;
  try {
    const params = anneeId.value ? { anneeId: anneeId.value } : {};
    const { data } = await api.get('/rectorat/bilan-mesrs', { params });
    snapshots.value = Array.isArray(data) ? data : data.data ?? [];
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/annees', { params: { all: '1' } });
  annees.value = Array.isArray(data) ? data : data.data ?? [];
  await charger();
});
</script>
