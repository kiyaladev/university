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
        <champ-date v-model="dateDebut" label="Du" style="width: 160px" />
        <champ-date v-model="dateFin" label="Au" style="width: 160px" />
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
        <q-btn
          round
          color="primary"
          icon="refresh"
          aria-label="Recalculer le tableau de bord"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>Recalculer</q-tooltip>
        </q-btn>
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
      <q-btn
        v-else
        unelevated
        no-caps
        color="white"
        text-color="primary"
        icon="event_note"
        label="Voir le registre des séances"
        :to="lienSeancesJour"
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
            <div class="text-caption">Séances assurées, absences et retards</div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="d" :config="configEvolution" :hauteur="260" />
            <p v-else class="pochoir carte__vide">Aucune donnée sur la période.</p>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-subtitle2">Répartition des constats</div>
            <div class="text-caption">Sur la période sélectionnée</div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="d" :config="configRepartition" :hauteur="260" />
            <p v-else class="pochoir carte__vide">Aucune donnée sur la période.</p>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col text-subtitle2">Assiduité par département</div>
            <div class="text-caption">Cliquez pour filtrer le tableau</div>
          </q-card-section>
          <q-list separator>
            <!-- « Sans département » n'est pas un identifiant : la ligne se lit
                 mais ne filtre pas. -->
            <q-item
              v-for="dep in d?.departements ?? []"
              :key="dep.id"
              :clickable="dep.id !== 'sans'"
              :active="departementId === dep.id"
              @click="basculerDepartement(dep.id)"
            >
              <q-item-section>
                <q-item-label>{{ dep.nom }}</q-item-label>
                <q-item-label caption>
                  {{ dep.controlees }} contrôles · {{ dep.absent }} absence(s) ·
                  {{ heuresLisibles(dep.heuresRealisees) }} réalisées
                </q-item-label>
              </q-item-section>
              <q-item-section side style="width: 140px">
                <barre-taux :valeur="dep.tauxPresence" />
              </q-item-section>
            </q-item>
            <q-item v-if="!d?.departements?.length">
              <q-item-section class="pochoir carte__vide">
                Aucune séance rattachée à un département sur la période.
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-gutter-sm">
            <div class="col text-subtitle2">Enseignants les plus absents</div>
            <q-btn
              v-if="d?.justificatifsEnAttente"
              outline
              dense
              no-caps
              icon="assignment_late"
              :label="`${d.justificatifsEnAttente} justificatif(s) à arbitrer`"
              :to="{ name: 'justificatifs', query: { statut: 'EN_ATTENTE' } }"
            />
          </q-card-section>
          <q-list separator>
            <q-item v-for="e in d?.enseignantsAbsents ?? []" :key="e.id">
              <q-item-section avatar>
                <span class="champ champ--absent tableau-de-bord__compte">
                  <span class="lettrage chiffres">{{ e.absent }}</span>
                </span>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ e.nom }}</q-item-label>
                <q-item-label caption>
                  {{ e.planifiees }} séance(s) programmée(s) · présence {{ pourcentLisible(e.tauxPresence) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="event_note"
                  aria-label="Voir les séances de cet enseignant"
                  :to="lienSeancesEnseignant(e.id)"
                >
                  <q-tooltip>Voir ses séances sur la période</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
            <q-item v-if="!d?.enseignantsAbsents?.length">
              <q-item-section class="pochoir carte__vide">
                Aucune absence constatée sur la période.
              </q-item-section>
            </q-item>
          </q-list>
          <q-card-actions align="right">
            <q-btn
              v-if="peutVoirStatistiques"
              flat
              no-caps
              icon="query_stats"
              label="Statistiques par enseignant"
              :to="lienStatistiques"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <q-inner-loading :showing="chargement" />
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import type { ChartConfiguration } from 'chart.js';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChartCanvas from '../components/ChartCanvas.vue';
import BarreTaux from '../components/BarreTaux.vue';
import {
  LIBELLE_STATUT_PRESENCE,
  aujourdhui,
  dateLisible,
  decalerJours,
  heuresLisibles,
  pourcentLisible,
} from '../utils/libelles';
import type { Departement } from '../types';

const auth = useAuthStore();

/**
 * Les peintures du panneau, reprises de `css/quasar.variables.scss` : Chart.js
 * ne lit pas les variables Sass, la liste doit donc rester alignée à la main.
 */
const VERT = '#0F7A45';
const JAUNE = '#EFB700';
const ROUGE = '#C4122E';
const VERT_CLAIR = '#3E9E6C';
const JAUNE_FONCE = '#C98A00';
const ROUGE_CLAIR = '#E0574F';
const ENCRE = '#10251E';
const ENCRE_DOUCE = '#33463F';

/**
 * Une peinture par statut, indexée par la clé d'énumération et non par la
 * position : le serveur renvoie désormais les clés (`PRESENT`, `EXCUSE`…) et
 * c'est l'écran qui les traduit, comme partout ailleurs dans l'application.
 */
const PEINTURE_STATUT: Record<string, string> = {
  PRESENT: VERT,
  RETARD: JAUNE,
  ABSENT: ROUGE,
  EXCUSE: ROUGE_CLAIR,
  REMPLACE: VERT_CLAIR,
  DEPART_ANTICIPE: JAUNE_FONCE,
  NON_CONTROLE: ENCRE_DOUCE,
};

const dateDebut = ref(decalerJours(aujourdhui(), -29));
const dateFin = ref(aujourdhui());
const departementId = ref<string | null>(null);
const departements = ref<Departement[]>([]);
const d = ref<any>(null);
const chargement = ref(false);

const optionsDepartements = computed(() =>
  departements.value.map((x) => ({ label: x.nom, value: x.id })),
);

const peutVoirStatistiques = computed(() =>
  auth.aRole(['CONTROLEUR', 'ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT']),
);

/** Les liens sortants transportent la période lue ici : on retrouve le même
 *  cadrage sur le registre et sur les relevés, pas les valeurs par défaut. */
const lienStatistiques = computed(() => ({
  name: 'statistiques',
  query: { onglet: 'enseignants', dateDebut: dateDebut.value, dateFin: dateFin.value },
}));

const lienSeancesJour = computed(() => ({
  name: 'seances',
  query: { dateDebut: dateDebut.value, dateFin: dateFin.value },
}));

function basculerDepartement(id: string) {
  if (id === 'sans') return;
  departementId.value = departementId.value === id ? null : id;
}

const lienSeancesEnseignant = (enseignantId: string) => ({
  name: 'seances',
  query: { enseignantId, dateDebut: dateDebut.value, dateFin: dateFin.value },
});

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
        borderColor: VERT,
        backgroundColor: 'rgba(15,122,69,.16)',
        borderWidth: 3,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: 'Absences',
        data: (d.value?.evolution ?? []).map((e: any) => e.absences),
        borderColor: ROUGE,
        borderWidth: 3,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: 'Retards',
        data: (d.value?.evolution ?? []).map((e: any) => e.retards),
        borderColor: JAUNE,
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
    labels: (d.value?.repartition ?? []).map(
      (r: any) => LIBELLE_STATUT_PRESENCE[r.statut as keyof typeof LIBELLE_STATUT_PRESENCE] ?? r.statut,
    ),
    datasets: [
      {
        data: (d.value?.repartition ?? []).map((r: any) => r.valeur),
        backgroundColor: (d.value?.repartition ?? []).map(
          (r: any) => PEINTURE_STATUT[r.statut] ?? ENCRE_DOUCE,
        ),
        borderColor: ENCRE,
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
  // Le référentiel n'alimente qu'une liste déroulante : son échec ne doit pas
  // priver la page de son tableau.
  try {
    const { data } = await api.get('/departements', { params: { all: '1' } });
    departements.value = data.data;
  } catch {
    departements.value = [];
  }
  await charger();
});

watch([dateDebut, dateFin, departementId], charger);
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

// Compteur d'absences en champ peint : la règle du statut peint interdit la
// pastille pastel posée sur du blanc.
.tableau-de-bord__compte {
  width: 34px;
  height: 34px;
  color: #fff;
}

.carte__vide {
  color: var(--up-encre-douce);
  margin: 0;
  padding: var(--up-2) 0;
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
