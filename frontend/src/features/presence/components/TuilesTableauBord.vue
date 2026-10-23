<template>
  <div class="row q-col-gutter-md">
    <div class="col-12 col-md-8">
      <q-card flat bordered class="carte">
        <q-card-section>
          <div class="text-subtitle2">{{ $t('dashboard.charts.evolutionTitle') }}</div>
          <div class="text-caption">{{ $t('dashboard.charts.evolutionSubtitle') }}</div>
        </q-card-section>
        <q-card-section>
          <graphique v-if="rapport" :config="configEvolution" :hauteur="260" />
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
          <graphique v-if="rapport" :config="configRepartition" :hauteur="260" />
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
            v-for="dep in rapport?.departements ?? []"
            :key="dep.id"
            :clickable="dep.id !== 'sans'"
            :active="departementId === dep.id"
            @click="emit('basculerDepartement', dep.id)"
          >
            <q-item-section>
              <q-item-label>{{ dep.nom }}</q-item-label>
              <q-item-label caption>
                {{
                  $t('dashboard.departments.itemDetail', {
                    controlees: dep.controlees,
                    absent: dep.absent,
                    heures: heuresLisibles(dep.heuresRealisees),
                  })
                }}
              </q-item-label>
            </q-item-section>
            <q-item-section side style="width: 140px">
              <barre-taux :valeur="dep.tauxPresence" />
            </q-item-section>
          </q-item>
          <q-item v-if="!rapport?.departements?.length">
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
            v-if="rapport?.justificatifsEnAttente"
            outline
            dense
            no-caps
            icon="assignment_late"
            :label="$t('dashboard.teachers.pendingJustifications', { count: rapport.justificatifsEnAttente })"
            :to="{ name: 'justificatifs', query: { statut: 'EN_ATTENTE' } }"
          />
        </q-card-section>
        <q-list separator>
          <q-item v-for="e in rapport?.enseignantsAbsents ?? []" :key="e.id">
            <q-item-section avatar>
              <span class="champ champ--absent tableau-de-bord__compte">
                <span class="lettrage chiffres">{{ e.absent }}</span>
              </span>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ e.nom }}</q-item-label>
              <q-item-label caption>
                {{
                  $t('dashboard.teachers.itemDetail', {
                    count: e.planifiees,
                    percent: pourcentLisible(e.tauxPresence),
                  })
                }}
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
          <q-item v-if="!rapport?.enseignantsAbsents?.length">
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChartConfiguration } from 'chart.js';
import Graphique from '@/shared/components/Graphique.vue';
import BarreTaux from '@/shared/components/BarreTaux.vue';
import { LIBELLE_STATUT_PRESENCE, heuresLisibles, pourcentLisible } from '@/shared/utils/libelles';
import type { RapportTableauBord } from '../services/rapports';

/**
 * Les quatre tuiles du tableau de bord : deux graphiques et deux classements.
 *
 * Les peintures du panneau, reprises de `css/quasar.variables.scss` : Chart.js
 * ne lit pas les variables Sass, la liste doit donc rester alignée à la main.
 */
const VERT = '#007A4D';
const JAUNE = '#FCD116';
const ROUGE = '#CE1126';
const VERT_CLAIR = '#2E9E70';
const JAUNE_FONCE = '#8A6300';
const ROUGE_CLAIR = '#E05A6B';
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

const props = defineProps<{
  rapport: RapportTableauBord | null;
  departementId: string | null;
  peutVoirStatistiques: boolean;
  lienStatistiques: { name: string; query: Record<string, string> };
  lienSeancesEnseignant: (enseignantId: string) => { name: string; query: Record<string, string> };
}>();
const emit = defineEmits<{ basculerDepartement: [string] }>();

const { t } = useI18n();

const configEvolution = computed<ChartConfiguration>(() => ({
  type: 'line',
  data: {
    labels: (props.rapport?.evolution ?? []).map((e) => e.date.slice(5)),
    datasets: [
      {
        label: t('dashboard.charts.datasets.sessionsHeld'),
        data: (props.rapport?.evolution ?? []).map((e) => e.assurees),
        borderColor: VERT,
        backgroundColor: 'rgba(3, 161, 14, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: t('common.fields.absences'),
        data: (props.rapport?.evolution ?? []).map((e) => e.absences),
        borderColor: ROUGE,
        borderWidth: 3,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: t('dashboard.charts.datasets.delays'),
        data: (props.rapport?.evolution ?? []).map((e) => e.retards),
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
    labels: (props.rapport?.repartition ?? []).map(
      (r) => LIBELLE_STATUT_PRESENCE[r.statut as keyof typeof LIBELLE_STATUT_PRESENCE] ?? r.statut,
    ),
    datasets: [
      {
        data: (props.rapport?.repartition ?? []).map((r) => r.valeur),
        backgroundColor: (props.rapport?.repartition ?? []).map((r) => peinture(r.statut)),
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
</script>

<style scoped lang="scss">
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
</style>
