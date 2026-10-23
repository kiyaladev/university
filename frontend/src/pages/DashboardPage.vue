<template>
  <q-page class="q-pa-md">
    <section-navigation section="presence" />
    <page-header
      :title="$t('dashboard.title')"
      :subtitle="$t('dashboard.subtitle', { debut: dateLisible(dateDebut), fin: dateLisible(dateFin) })"
    >
      <template #actions>
        <champ-date v-model="dateDebut" :label="$t('dashboard.filters.from')" style="width: 160px" />
        <champ-date v-model="dateFin" :label="$t('dashboard.filters.to')" style="width: 160px" />
        <q-select
          v-model="departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('dashboard.filters.department')"
          style="min-width: 180px"
        />
        <q-btn
          round
          class="self-center"
          color="primary"
          icon="refresh"
          :aria-label="$t('dashboard.actions.refreshAria')"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>{{ $t('dashboard.actions.refreshTooltip') }}</q-tooltip>
        </q-btn>
      </template>
    </page-header>

    <!-- Situation du jour : ce que la tournée a déjà couvert -->
    <section class="bandeau jour">
      <div class="jour__etat">
        <p class="pochoir jour__mention">{{ $t('dashboard.today.mention', { date: dateLisible(d?.jour.date) }) }}</p>
        <p class="lettrage jour__compte chiffres">
          {{ d?.jour.controlees ?? 0 }}<span class="jour__sur">/{{ d?.jour.planifiees ?? 0 }}</span>
        </p>
        <p class="pochoir jour__legende">{{ $t('dashboard.today.legend') }}</p>
      </div>

      <div class="jour__jauge" role="img" :aria-label="$t('dashboard.gauge.coverageAria', { percent: pourcentLisible(d?.jour.tauxControle) })">
        <div class="jour__jauge-remplie se-peint" :style="{ width: `${d?.jour.tauxControle ?? 0}%` }" />
        <span class="pochoir jour__taux chiffres">{{ $t('dashboard.gauge.coverageLabel', { percent: pourcentLisible(d?.jour.tauxControle) }) }}</span>
      </div>

      <q-btn
        v-if="auth.peutPointer"
        unelevated
        no-caps
        color="primary"
        icon="fact_check"
        :label="$t('dashboard.actions.goToRounds')"
        to="/controle"
      />
      <q-btn
        v-if="auth.peutPointer"
        outline
        no-caps
        icon="offline_pin"
        :label="$t('dashboard.actions.prepareRound')"
        :loading="preparationEnCours"
        @click="preparerTournee"
      />
      <q-chip v-if="tourneePrepareeLe" dense icon="cloud_done" role="status">
        {{ $t('dashboard.actions.preparedAt', { time: heurePreparation }) }}
      </q-chip>
      <q-btn
        v-else
        unelevated
        no-caps
        color="primary"
        icon="event_note"
        :label="$t('dashboard.actions.viewSessionsRegistry')"
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
        <!-- Le chiffre se lit en encre, et l'encre bascule avec le thème. Une
             classe `text-secondary` figeait #1D1D1F : invisible en sombre. -->
        <p class="lettrage avec-unite chiffres releve__valeur">{{ k.valeur }}</p>
      </div>
    </section>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-8">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-subtitle2">{{ $t('dashboard.charts.evolutionTitle') }}</div>
            <div class="text-caption">{{ $t('dashboard.charts.evolutionSubtitle') }}</div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="d" :config="configEvolution" :hauteur="260" />
            <p v-else class="pochoir carte__vide">{{ $t('dashboard.charts.noData') }}</p>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-subtitle2">{{ $t('dashboard.charts.distributionTitle') }}</div>
            <div class="text-caption">{{ $t('dashboard.charts.distributionSubtitle') }}</div>
          </q-card-section>
          <q-card-section>
            <chart-canvas v-if="d" :config="configRepartition" :hauteur="260" />
            <p v-else class="pochoir carte__vide">{{ $t('dashboard.charts.noData') }}</p>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col text-subtitle2">{{ $t('dashboard.departments.title') }}</div>
            <div class="text-caption">{{ $t('dashboard.departments.subtitle') }}</div>
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
                  {{ $t('dashboard.departments.itemDetail', { controlees: dep.controlees, absent: dep.absent, heures: heuresLisibles(dep.heuresRealisees) }) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side style="width: 140px">
                <barre-taux :valeur="dep.tauxPresence" />
              </q-item-section>
            </q-item>
            <q-item v-if="!d?.departements?.length">
              <q-item-section class="pochoir carte__vide">
                {{ $t('dashboard.departments.empty') }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-gutter-sm">
            <div class="col text-subtitle2">{{ $t('dashboard.teachers.title') }}</div>
            <q-btn
              v-if="d?.justificatifsEnAttente"
              outline
              dense
              no-caps
              icon="assignment_late"
              :label="$t('dashboard.teachers.pendingJustifications', { count: d.justificatifsEnAttente })"
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
                  {{ $t('dashboard.teachers.itemDetail', { count: e.planifiees, percent: pourcentLisible(e.tauxPresence) }) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="event_note"
                  :aria-label="$t('dashboard.teachers.viewSessionsAria')"
                  :to="lienSeancesEnseignant(e.id)"
                >
                  <q-tooltip>{{ $t('dashboard.teachers.viewSessionsTooltip') }}</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
            <q-item v-if="!d?.enseignantsAbsents?.length">
              <q-item-section class="pochoir carte__vide">
                {{ $t('dashboard.teachers.empty') }}
              </q-item-section>
            </q-item>
          </q-list>
          <q-card-actions align="right">
            <q-btn
              v-if="peutVoirStatistiques"
              flat
              no-caps
              icon="query_stats"
              :label="$t('dashboard.actions.teacherStats')"
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
import SectionNavigation from '../components/SectionNavigation.vue';
import PageHeader from '../components/PageHeader.vue';
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { isAxiosError } from 'axios';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import { useSeancesStore } from '../stores/seances';
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
const referentiels = useReferentielsStore();
const seancesHorsLigne = useSeancesStore();
const $q = useQuasar();
const { t, locale } = useI18n();

/**
 * Les peintures du panneau, reprises de `css/quasar.variables.scss` : Chart.js
 * ne lit pas les variables Sass, la liste doit donc rester alignée à la main.
 */
const VERT = '#007A4D';
const JAUNE = '#FCD116';
const ROUGE = '#CE1126';
const VERT_CLAIR = '#2E9E70';
const JAUNE_FONCE = '#8A6300';
const ROUGE_CLAIR = '#E05A6B';
const ENCRE = '#1D1D1F';
const ENCRE_DOUCE = '#6E6E73';

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

/**
 * `/rapports/dashboard` renvoie la répartition libellée en clair (« Présent »,
 * « Départ anticipé ») là où le reste de l'API renvoie la clé d'énumération.
 * Chercher la peinture sur la seule clé rendait donc *toutes* les parts de la
 * couronne grises : un camembert d'une seule couleur ne dit plus rien.
 * On accepte les deux écritures, et on retombe sur le gris seulement pour un
 * statut réellement inconnu.
 */
const PEINTURE_PAR_LIBELLE: Record<string, string> = Object.fromEntries(
  Object.entries(PEINTURE_STATUT).map(([cle, teinte]) => [
    (LIBELLE_STATUT_PRESENCE[cle as keyof typeof LIBELLE_STATUT_PRESENCE] ?? cle).toLowerCase(),
    teinte,
  ]),
);

const peinture = (statut: string): string =>
  PEINTURE_STATUT[statut] ?? PEINTURE_PAR_LIBELLE[String(statut).toLowerCase()] ?? ENCRE_DOUCE;

const dateDebut = ref(decalerJours(aujourdhui(), -29));
const dateFin = ref(aujourdhui());
const departementId = ref<string | null>(null);
const departements = ref<Departement[]>([]);
const d = ref<any>(null);
const chargement = ref(false);
const preparationEnCours = ref(false);
const tourneePrepareeLe = ref<string | null>(null);
const clePreparation = computed(() => {
  const userId = auth.utilisateur?.id;
  return userId ? `unipresence_tournee_preparee_${userId}` : null;
});
const heurePreparation = computed(() => {
  if (!tourneePrepareeLe.value) return '';
  return new Date(tourneePrepareeLe.value).toLocaleTimeString(
    locale.value === 'en-US' ? 'en-US' : 'fr-FR',
    { hour: '2-digit', minute: '2-digit' },
  );
});

const optionsDepartements = computed(() =>
  departements.value.map((x) => ({ label: x.nom, value: x.id })),
);

const peutVoirStatistiques = computed(() => auth.peut('statistiques.voir'));

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
      libelle: t('dashboard.kpis.plannedSessions'),
      valeur: g?.planifiees ?? 0,
      detail: t('dashboard.kpis.plannedSessionsDetail', {
        count: g?.controlees ?? 0,
        percent: pourcentLisible(g?.tauxControle),
      }),
    },
    {
      libelle: t('dashboard.kpis.presenceRate'),
      valeur: pourcentLisible(g?.tauxPresence),
      detail: t('dashboard.kpis.presenceRateDetail', { count: g?.assurees ?? 0 }),
    },
    {
      libelle: t('dashboard.kpis.absences'),
      valeur: g?.absent ?? 0,
      detail: t('dashboard.kpis.absencesDetail', {
        excused: g?.excuse ?? 0,
        late: g?.retard ?? 0,
      }),
    },
    {
      libelle: t('dashboard.kpis.hoursWorked'),
      valeur: heuresLisibles(g?.heuresRealisees),
      detail: t('dashboard.kpis.hoursWorkedDetail', { planned: heuresLisibles(g?.heuresPrevues) }),
    },
  ];
});

const configEvolution = computed<ChartConfiguration>(() => ({
  type: 'line',
  data: {
    labels: (d.value?.evolution ?? []).map((e: any) => e.date.slice(5)),
    datasets: [
      {
        label: t('dashboard.charts.datasets.sessionsHeld'),
        data: (d.value?.evolution ?? []).map((e: any) => e.assurees),
        borderColor: VERT,
        backgroundColor: 'rgba(3, 161, 14, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: t('dashboard.charts.datasets.absences'),
        data: (d.value?.evolution ?? []).map((e: any) => e.absences),
        borderColor: ROUGE,
        borderWidth: 3,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: t('dashboard.charts.datasets.delays'),
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
        backgroundColor: (d.value?.repartition ?? []).map((r: any) => peinture(r.statut)),
        // Le liséré sépare les parts : il prend la couleur de la surface,
        // jamais celle de l'encre — sinon la couronne se lit comme un cerclage.
        borderColor: '#FFFFFF',
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

/** Précharge les lectures utilisées par la tournée dans le cache PWA, lié au JWT courant. */
async function preparerTournee() {
  if (!navigator.onLine || !navigator.serviceWorker?.controller || !clePreparation.value) {
    $q.notify({ type: 'warning', message: t('dashboard.actions.prepareRequiresNetwork') });
    return;
  }

  preparationEnCours.value = true;
  const date = aujourdhui();
  try {
    // Le nonce empêche une ancienne réponse santé en cache de faire croire que
    // les données de la tournée viennent d'être rafraîchies.
    await api.get('/health', { params: { _tournee: Date.now() } });
    // `salles(true)` : la tournée doit repasser par le réseau, pas par le cache.
    const [, salles, affectations] = await Promise.all([
      api.get('/seances/journee', { params: { date } }),
      referentiels.salles(true),
      api.get('/affectations', { params: { all: '1' } }),
    ]);
    seancesHorsLigne.enregistrerAffectations(affectations.data.data ?? []);
    seancesHorsLigne.enregistrerSalles(salles);
    const maintenant = new Date().toISOString();
    localStorage.setItem(clePreparation.value, JSON.stringify({ date, prepareeLe: maintenant }));
    tourneePrepareeLe.value = maintenant;
    $q.notify({ type: 'positive', message: t('dashboard.actions.roundPrepared') });
  } catch (e) {
    // Les erreurs de l'API sont notifiées par l'intercepteur ; reste le stockage local.
    if (!isAxiosError(e)) {
      $q.notify({ type: 'negative', message: t('dashboard.actions.prepareFailed') });
    }
  } finally {
    preparationEnCours.value = false;
  }
}

onMounted(async () => {
  if (clePreparation.value) {
    try {
      const preparation = JSON.parse(localStorage.getItem(clePreparation.value) ?? 'null');
      const age = preparation?.prepareeLe ? Date.now() - new Date(preparation.prepareeLe).getTime() : Infinity;
      if (preparation?.date === aujourdhui() && age >= 0 && age < 24 * 60 * 60 * 1000) {
        tourneePrepareeLe.value = preparation.prepareeLe;
      }
    } catch {
      tourneePrepareeLe.value = null;
    }
  }
  // Le référentiel n'alimente qu'une liste déroulante : son échec ne doit pas
  // priver la page de son tableau.
  try {
    departements.value = await referentiels.departements();
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

.jour__mention { color: var(--up-encre-douce); }

.jour__compte {
  font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem);
  color: var(--up-encre);
  margin: 2px 0 0;
}

.jour__sur {
  font-size: 0.5em;
  color: var(--up-encre-douce);
}

.jour__legende { color: var(--up-encre-douce); }

.jour__jauge {
  flex: 1 1 240px;
  position: relative;
  height: 34px;
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-pilule);
  overflow: hidden;
  display: flex;
  align-items: center;
}

.jour__jauge-remplie {
  position: absolute;
  inset: 0 auto 0 0;
  background: #{$vert-action};
  border-radius: var(--up-pilule);
}

.jour__taux {
  position: relative;
  padding-left: var(--up-2);
  color: var(--up-encre);
}

// Compteur d'absences en champ peint : la règle du statut peint interdit la
// pastille pastel posée sur du blanc.
.tableau-de-bord__compte {
  width: 34px;
  height: 34px;
  color: var(--up-encre);
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
  color: var(--up-encre);
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
