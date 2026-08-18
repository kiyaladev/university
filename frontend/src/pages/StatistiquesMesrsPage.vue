<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Statistiques MESRS</div>
        <div class="page-sous-titre">
          L'archive de ce qui a été déclaré au Ministère. Chaque snapshot fige
          les chiffres à sa date de génération et ne bouge plus — c'est la
          mémoire de la déclaration, pas la situation du jour. Les chiffres
          d'aujourd'hui sont sur le Tableau de bord Rectorat, qui produit
          justement ces snapshots.
        </div>
      </div>
      <div class="col-auto row q-gutter-sm">
        <q-select
          v-model="anneeId"
          :options="optionsAnnees"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Année"
          hint="Vide : toutes les années"
          style="min-width: 180px"
          @update:model-value="charger"
        />
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="file_download"
          :label="`Exporter ${snapshots.length} snapshot(s) en CSV`"
          :disable="!snapshots.length"
          @click="exporterCsv"
        >
          <q-tooltip>
            Tableur (Excel / LibreOffice) — {{ anneeLibelle ?? 'toutes les années' }}
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <liens-croises
      :liens="[
        { to: '/rectorat', libelle: 'Tableau de bord Rectorat', icone: 'dashboard', aide: 'Les mêmes indicateurs à l’instant présent — et le bouton qui génère un snapshot' },
        { to: '/rapports', libelle: 'Rapports & états', icone: 'insights', aide: 'Les états ligne à ligne derrière ces agrégats' },
        { to: '/statistiques', libelle: 'Statistiques', icone: 'query_stats', aide: 'Le suivi du contrôle des séances au jour le jour' },
      ]"
    />

    <div v-if="!snapshots.length && !chargement" class="plaque etat-vide">
      <q-icon name="analytics" size="42px" />
      <div class="text-h6 q-mt-sm">Aucun snapshot archivé</div>
      <div class="text-caption">
        Un snapshot MESRS se crée depuis le Tableau de bord Rectorat : il y fige
        les effectifs, le taux de réussite et la masse salariale de l'année
        choisie. Tant qu'aucun n'a été généré, cette archive reste vide.
      </div>
      <q-btn
        unelevated
        color="primary"
        no-caps
        icon="dashboard"
        label="Générer un bilan depuis le Rectorat"
        to="/rectorat"
        class="q-mt-sm"
      />
    </div>

    <template v-else>
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ dernier?.effectifTotal ?? 0 }}</div>
            <div class="pochoir text-grey-7">Effectif déclaré</div>
            <div class="text-caption text-grey-6">{{ legendeDernier }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ pourcentLisible(dernier?.tauxReussite) }}</div>
            <div class="pochoir text-grey-7">Taux de réussite déclaré</div>
            <div class="text-caption text-grey-6">{{ legendeDernier }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">
              {{ montantLisible(dernier?.masseSalariale) }} <span class="text-h6">GNF</span>
            </div>
            <div class="pochoir text-grey-7">Masse salariale déclarée</div>
            <div class="text-caption text-grey-6">{{ legendeDernier }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ snapshots.length }}</div>
            <div class="pochoir text-grey-7">Snapshots archivés</div>
            <div class="text-caption text-grey-6">
              {{ anneeLibelle ?? 'toutes les années' }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-subtitle2">Évolution des déclarations</div>
          <div class="text-caption text-grey-7">
            Effectif, taux de réussite et masse salariale — un point par snapshot,
            du plus ancien au plus récent
          </div>
        </div>
      </q-card-section>
      <q-card-section>
        <chart-canvas
          v-if="configEvolution"
          :config="configEvolution"
          :hauteur="320"
          role="img"
          :aria-label="resumeEvolution"
        />
      </q-card-section>
    </q-card>

    <q-card flat bordered class="carte">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-subtitle2">Snapshots archivés</div>
          <div class="text-caption text-grey-7">
            {{ snapshots.length }} enregistrement(s) —
            <span v-if="anneeLibelle">filtré sur {{ anneeLibelle }}</span>
            <span v-else>toutes les années</span>
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
            {{ p.row.donnees?.effectifTotal != null ? nombreLisible(p.row.donnees.effectifTotal, 0) : '—' }}
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
            <q-btn
              flat
              dense
              round
              icon="print"
              :aria-label="`Imprimer le bilan MESRS du ${dateHeureLisible(p.row.genereLe)}`"
              @click="imprimer(p.row)"
            >
              <q-tooltip>Imprimer le bilan (A4)</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChartCanvas from '../components/ChartCanvas.vue';
import LiensCroises from '../components/LiensCroises.vue';
import {
  dateHeureLisible,
  montantLisible,
  nombreLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { AnneeAcademique, StatistiqueMesrs } from '../types';

/**
 * Mêmes peintures que le Tableau de bord Rectorat pour les mêmes indicateurs :
 * effectif en encre, réussite en vert, argent en ocre. Un lecteur qui passe
 * d'un écran à l'autre retrouve ses repères.
 */
const PEINTURE_EFFECTIF = '#10251E';
const PEINTURE_REUSSITE = '#0F7A45';
const PEINTURE_ARGENT = '#C98A00';

const $q = useQuasar();
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

/**
 * Les snapshots rangés du plus ancien au plus récent : l'ordre de l'API n'est
 * pas garanti, et « le dernier déclaré » doit rester le plus récent quoi qu'il
 * arrive — le graphique comme les vignettes en dépendent.
 */
const ordonnes = computed(() =>
  [...snapshots.value].sort(
    (a, b) => new Date(a.genereLe).getTime() - new Date(b.genereLe).getTime(),
  ),
);

const dernierSnapshot = computed(() => ordonnes.value[ordonnes.value.length - 1] ?? null);
const dernier = computed(() => dernierSnapshot.value?.donnees ?? null);
const legendeDernier = computed(() =>
  dernierSnapshot.value
    ? `Dernier snapshot du ${dateHeureLisible(dernierSnapshot.value.genereLe)}`
    : '—',
);

/** Alternative textuelle du graphique, pour qui ne voit pas les courbes. */
const resumeEvolution = computed(() =>
  ordonnes.value.length
    ? `Évolution des déclarations MESRS sur ${ordonnes.value.length} snapshot(s) : ${ordonnes.value
        .map(
          (s) =>
            `${dateLisibleCourt(s.genereLe)} — effectif ${s.donnees?.effectifTotal ?? 0}, ` +
            `réussite ${pourcentLisible(s.donnees?.tauxReussite)}, ` +
            `masse salariale ${montantLisible(s.donnees?.masseSalariale)} GNF`,
        )
        .join(' ; ')}.`
    : 'Aucun snapshot à représenter.',
);

function dateLisibleCourt(iso: string): string {
  return dateHeureLisible(iso).slice(0, 16);
}

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
  if (!ordonnes.value.length) return null;
  const ordre = ordonnes.value;
  const labels = ordre.map((s) => dateLisibleCourt(s.genereLe));
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Effectif',
          data: ordre.map((s) => s.donnees?.effectifTotal ?? 0),
          borderColor: PEINTURE_EFFECTIF,
          backgroundColor: 'rgba(16, 37, 30, 0.16)',
          borderWidth: 3,
          yAxisID: 'yEffectif',
          tension: 0.05,
          pointRadius: 3,
        },
        {
          label: 'Taux de réussite (%)',
          data: ordre.map((s) => s.donnees?.tauxReussite ?? 0),
          borderColor: PEINTURE_REUSSITE,
          borderWidth: 2,
          borderDash: [4, 4],
          yAxisID: 'yTaux',
          tension: 0.05,
          pointRadius: 3,
        },
        {
          label: 'Masse salariale (GNF)',
          data: ordre.map((s) => s.donnees?.masseSalariale ?? 0),
          borderColor: PEINTURE_ARGENT,
          backgroundColor: 'rgba(201, 138, 0, 0.12)',
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
          ticks: { callback: (v) => nombreLisible(Number(v), 0) },
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
  for (const s of ordonnes.value) {
    const d = s.donnees ?? {};
    lignes.push([
      dateHeureLisible(s.genereLe),
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
  } catch (e: any) {
    snapshots.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des snapshots MESRS impossible.',
    });
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/annees', { params: { all: '1' } });
    annees.value = Array.isArray(data) ? data : data.data ?? [];
  } catch {
    $q.notify({ type: 'warning', message: 'Années académiques indisponibles : le filtre restera vide.' });
  }
  await charger();
});
</script>

<style scoped lang="scss">
/* Même définition que les autres tableaux de bord de l'application. */
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

</style>
