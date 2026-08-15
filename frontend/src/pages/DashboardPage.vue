<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tableau de bord</div>
        <div class="page-sous-titre">
          Assiduité des enseignants — période du {{ dateLisible(dateDebut) }} au
          {{ dateLisible(dateFin) }}
        </div>
      </div>
      <div class="col-auto row q-gutter-sm">
        <champ-date v-model="dateDebut" style="width: 160px" />
        <champ-date v-model="dateFin" style="width: 160px" />
        <q-select
          v-model="departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Département"
          style="min-width: 180px"
        />
        <q-btn round color="primary" icon="refresh" :loading="chargement" @click="charger" />
      </div>
    </div>

    <!-- Situation du jour : ce que la tournée a déjà couvert -->
    <section class="bandeau jour">
      <div class="jour__etat">
        <p class="pochoir jour__mention">Journée du {{ dateLisible(d?.jour.date) }}</p>
        <p class="lettrage jour__compte chiffres">
          {{ d?.jour.controlees ?? 0 }}<span class="jour__sur">/{{ d?.jour.planifiees ?? 0 }}</span>
        </p>
        <p class="pochoir jour__legende">séances contrôlées</p>
      </div>

      <div class="jour__jauge" role="img" :aria-label="`Couverture du contrôle : ${pourcentLisible(d?.jour.tauxControle)}`">
        <div class="jour__jauge-remplie se-peint" :style="{ width: `${d?.jour.tauxControle ?? 0}%` }" />
        <span class="pochoir jour__taux chiffres">{{ pourcentLisible(d?.jour.tauxControle) }} de couverture</span>
      </div>

      <q-btn
        v-if="auth.peutPointer"
        unelevated
        no-caps
        color="white"
        text-color="primary"
        icon="fact_check"
        label="Aller à la tournée"
        to="/controle"
      />
    </section>

    <!-- Relevé du panneau : une lecture par ligne, comme sur la planche peinte -->
    <section class="plaque releve">
      <div v-for="k in kpis" :key="k.libelle" class="releve__ligne">
        <div class="releve__intitule">
          <p class="pochoir releve__libelle">{{ k.libelle }}</p>
          <p class="pochoir pochoir--brut releve__detail">{{ k.detail }}</p>
        </div>
        <p class="lettrage avec-unite chiffres releve__valeur" :class="`text-${k.couleur}`">{{ k.valeur }}</p>
      </div>
    </section>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-subtitle2">Évolution sur 14 jours</div>
            <div class="text-caption text-grey-7">Séances assurées, absences et retards</div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="d" :config="configEvolution" :hauteur="260" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-subtitle2">Répartition des constats</div>
            <div class="text-caption text-grey-7">Sur la période sélectionnée</div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="d" :config="configRepartition" :hauteur="260" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="text-subtitle2">Assiduité par département</q-card-section>
          <q-list separator>
            <q-item v-for="dep in d?.departements ?? []" :key="dep.id">
              <q-item-section>
                <q-item-label>{{ dep.nom }}</q-item-label>
                <q-item-label caption>
                  {{ dep.controlees }} contrôles · {{ dep.absent }} absence(s) ·
                  {{ heuresLisibles(dep.heuresRealisees) }} réalisées
                </q-item-label>
              </q-item-section>
              <q-item-section side style="width: 130px">
                <q-linear-progress
                  :value="dep.tauxPresence / 100"
                  size="10px"
                  rounded
                  :color="dep.tauxPresence >= 85 ? 'positive' : dep.tauxPresence >= 70 ? 'warning' : 'negative'"
                />
                <div class="text-caption text-right">{{ pourcentLisible(dep.tauxPresence) }}</div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col text-subtitle2">Enseignants les plus absents</div>
            <q-badge v-if="d?.justificatifsEnAttente" color="warning" class="q-ml-sm">
              {{ d.justificatifsEnAttente }} justificatif(s) en attente
            </q-badge>
          </q-card-section>
          <q-list separator>
            <q-item v-for="e in d?.enseignantsAbsents ?? []" :key="e.id">
              <q-item-section avatar>
                <q-avatar color="red-1" text-color="negative" size="34px">
                  {{ e.absent }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ e.nom }}</q-item-label>
                <q-item-label caption>
                  {{ e.planifiees }} séance(s) programmée(s) · présence {{ pourcentLisible(e.tauxPresence) }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!d?.enseignantsAbsents?.length">
              <q-item-section class="text-grey-6">
                Aucune absence constatée sur la période.
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref } from 'vue';
import type { ChartConfiguration } from 'chart.js';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChartCanvas from '../components/ChartCanvas.vue';
import {
  aujourdhui,
  dateLisible,
  decalerJours,
  heuresLisibles,
  pourcentLisible,
} from '../utils/libelles';
import type { Departement } from '../types';

const auth = useAuthStore();

const dateDebut = ref(decalerJours(aujourdhui(), -29));
const dateFin = ref(aujourdhui());
const departementId = ref<string | null>(null);
const departements = ref<Departement[]>([]);
const d = ref<any>(null);
const chargement = ref(false);

const optionsDepartements = computed(() =>
  departements.value.map((x) => ({ label: x.nom, value: x.id })),
);

const kpis = computed(() => {
  const g = d.value?.global;
  return [
    {
      libelle: 'Séances programmées',
      valeur: g?.planifiees ?? 0,
      detail: `${g?.controlees ?? 0} contrôlées (${pourcentLisible(g?.tauxControle)})`,
      couleur: 'primary',
    },
    {
      libelle: 'Taux de présence',
      valeur: pourcentLisible(g?.tauxPresence),
      detail: `${g?.assurees ?? 0} séance(s) assurée(s)`,
      couleur: 'positive',
    },
    {
      libelle: 'Absences',
      valeur: g?.absent ?? 0,
      detail: `${g?.excuse ?? 0} excusée(s) · ${g?.retard ?? 0} retard(s)`,
      couleur: 'negative',
    },
    {
      libelle: 'Heures réalisées',
      valeur: heuresLisibles(g?.heuresRealisees),
      detail: `sur ${heuresLisibles(g?.heuresPrevues)} programmées`,
      couleur: 'secondary',
    },
  ];
});

const configEvolution = computed<ChartConfiguration>(() => ({
  type: 'line',
  data: {
    labels: (d.value?.evolution ?? []).map((e: any) => e.date.slice(5)),
    datasets: [
      {
        label: 'Séances assurées',
        data: (d.value?.evolution ?? []).map((e: any) => e.assurees),
        borderColor: '#0F7A45',
        backgroundColor: 'rgba(15,122,69,.16)',
        borderWidth: 3,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: 'Absences',
        data: (d.value?.evolution ?? []).map((e: any) => e.absences),
        borderColor: '#C4122E',
        borderWidth: 3,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: 'Retards',
        data: (d.value?.evolution ?? []).map((e: any) => e.retards),
        borderColor: '#EFB700',
        borderWidth: 3,
        tension: 0,
        pointRadius: 0,
      },
    ],
  },
  options: {
    plugins: { legend: { position: 'bottom' } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  },
}));

const configRepartition = computed<ChartConfiguration>(() => ({
  type: 'doughnut',
  data: {
    labels: (d.value?.repartition ?? []).map((r: any) => r.statut),
    datasets: [
      {
        data: (d.value?.repartition ?? []).map((r: any) => r.valeur),
        backgroundColor: [
          '#0F7A45',
          '#EFB700',
          '#C4122E',
          '#E0574F',
          '#3E9E6C',
          '#C98A00',
          '#33463F',
        ],
        borderColor: '#10251E',
        borderWidth: 2,
      },
    ],
  },
  options: {
    cutout: '52%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
  },
}));

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/rapports/dashboard', {
      params: {
        dateDebut: dateDebut.value,
        dateFin: dateFin.value,
        departementId: departementId.value || undefined,
      },
    });
    d.value = data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/departements', { params: { all: '1' } });
  departements.value = data.data;
  await charger();
});
</script>

<style scoped lang="scss">
.jour {
  display: flex;
  align-items: center;
  gap: var(--up-4);
  padding: var(--up-4);
  margin-bottom: var(--up-3);
  flex-wrap: wrap;
}

.jour__mention { color: rgba(255, 255, 255, 0.74); }

.jour__compte {
  font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem);
  color: #fff;
  margin: 2px 0 0;
}

.jour__sur {
  font-size: 0.5em;
  color: rgba(255, 255, 255, 0.7);
}

.jour__legende { color: rgba(255, 255, 255, 0.8); }

.jour__jauge {
  flex: 1 1 240px;
  position: relative;
  height: 34px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
}

.jour__jauge-remplie {
  position: absolute;
  inset: 0 auto 0 0;
  background: $vert;
}

.jour__taux {
  position: relative;
  padding-left: var(--up-2);
  color: #fff;
}

.releve { margin-bottom: var(--up-3); }

.releve__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding: var(--up-3);

  & + & { border-top: var(--up-filet-fin); }
}

.releve__libelle { color: var(--up-encre); }

.releve__detail {
  color: var(--up-encre-douce);
  margin: 3px 0 0;
  font-weight: 600;
}

.releve__valeur {
  font-size: clamp(1.7rem, 1.2rem + 1.8vw, 2.3rem);
  margin: 0;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .releve {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .releve__ligne + .releve__ligne { border-top: 0; }
  .releve__ligne:nth-child(2n) { border-left: var(--up-filet); }
  .releve__ligne:nth-child(n + 3) { border-top: var(--up-filet); }
}
</style>
