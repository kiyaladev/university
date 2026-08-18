<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tableau de bord Rectorat</div>
        <div class="page-sous-titre">
          L'état de l'université en une page, à l'instant présent : effectifs,
          réussite, masse salariale, incidents. Chaque chiffre renvoie à l'écran
          qui le produit. Année académique
          <strong>{{ chiffres?.annee?.libelle ?? '—' }}</strong>.
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
        >
          <q-tooltip>
            Fige les chiffres ci-dessous dans un snapshot archivé, consultable
            dans Statistiques MESRS.
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <liens-croises
      :liens="[
        { to: '/statistiques-mesrs', libelle: 'Statistiques MESRS', icone: 'analytics', aide: 'Les snapshots figés déjà transmis au Ministère' },
        { to: '/rapports', libelle: 'Rapports & états', icone: 'insights', aide: 'Les états ligne à ligne, exportables' },
        { to: '/statistiques', libelle: 'Statistiques', icone: 'query_stats', aide: 'Le suivi du contrôle des séances au jour le jour' },
      ]"
    />

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">{{ chiffres?.effectifTotal ?? 0 }}</div>
            <div class="pochoir text-grey-7">Effectif total</div>
            <div class="text-caption text-grey-6">
              {{ (chiffres?.effectifParPromotion ?? []).length }} promotion(s) · inscriptions non annulées
            </div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="groups" label="Voir les étudiants" to="/etudiants" />
          </q-card-actions>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">{{ pourcentLisible(chiffres?.tauxReussite) }}</div>
            <div class="pochoir text-grey-7">Taux de réussite global</div>
            <div class="text-caption text-grey-6">Session normale · délibérations validées</div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="how_to_vote" label="Voir les délibérations" to="/deliberations" />
          </q-card-actions>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">
              {{ montantLisible(chiffres?.masseSalariale) }} <span class="text-h6">GNF</span>
            </div>
            <div class="pochoir text-grey-7">Masse salariale</div>
            <div class="text-caption text-grey-6">{{ chiffres?.masseSalarialeMois ?? '—' }}</div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="payments" label="Voir la paie" to="/paie" />
          </q-card-actions>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte full-height column">
          <q-card-section class="text-center col">
            <div class="stat-chiffre chiffres">
              {{ chiffres?.nbReclamationsEnCours ?? 0 }}
            </div>
            <div class="pochoir text-grey-7">Réclamations en attente</div>
            <div class="text-caption text-grey-6">Tous motifs · non clôturées</div>
          </q-card-section>
          <q-card-actions align="center">
            <q-btn flat dense no-caps color="primary" icon="list_alt" label="Voir les réclamations" to="/reclamations" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-7">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">Effectif par promotion</div>
              <div class="text-caption text-grey-7">Inscriptions non annulées · 24 premières promotions</div>
            </div>
            <q-btn flat dense no-caps color="primary" icon="how_to_reg" label="Inscriptions" to="/inscriptions" />
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
              <div class="text-subtitle2 q-mt-sm">Aucune inscription sur cette année</div>
              <div class="text-caption">
                L'effectif se lit sur les inscriptions non annulées. Changez d'année,
                ou ouvrez les inscriptions pour en enregistrer.
              </div>
              <q-btn flat dense no-caps color="primary" icon="how_to_reg" label="Ouvrir les inscriptions" to="/inscriptions" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-5">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle2">Masse salariale mensuelle</div>
              <div class="text-caption text-grey-7">12 derniers mois — feuilles validées ou payées</div>
            </div>
            <q-btn flat dense no-caps color="primary" icon="payments" label="Paie" to="/paie" />
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
              <div class="text-subtitle2 q-mt-sm">Aucune feuille de paie validée</div>
              <div class="text-caption">
                La courbe agrège les feuilles mensuelles une fois validées par la
                direction. Tant qu'aucune ne l'est, la masse salariale reste à zéro.
              </div>
              <q-btn flat dense no-caps color="primary" icon="payments" label="Ouvrir la paie" to="/paie" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-7">
        <q-card flat bordered class="carte">
          <q-card-section class="text-subtitle2">Personnel & incidents</q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-item clickable to="/enseignants">
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
                      {{ chiffres?.nbIncidentsHelpdesk24h ?? 0 }} incident(s) helpdesk
                    </q-item-label>
                    <q-item-label caption>
                      sur les dernières 24 h — tous statuts confondus
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
              <div class="text-subtitle2">Patrimoine — obsolescences</div>
              <div class="text-caption text-grey-7">
                Équipements dont l'âge dépasse la durée d'obsolescence prévue
              </div>
            </div>
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="inventory_2"
              label="Patrimoine & matériel"
              to="/patrimoine"
            />
          </q-card-section>
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ dashboard?.obsoletes ?? 0 }}</div>
            <div class="pochoir text-grey-7">équipements obsolètes</div>
            <div class="text-caption text-grey-6 q-mt-sm">
              {{ dashboard?.total ?? 0 }} équipements actifs ·
              {{ dashboard?.enReparation ?? 0 }} en réparation
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-inner-loading :showing="chargement" label="Chargement du tableau de bord…" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import ChartCanvas from '../components/ChartCanvas.vue';
import LiensCroises from '../components/LiensCroises.vue';
import { montantLisible, nombreLisible, pourcentLisible } from '../utils/libelles';
import type { AnneeAcademique, FeuillePaie, TableauBordPatrimoine, TableauBordRectorat } from '../types';

/**
 * Les peintures des graphiques. Un même indicateur porte la même couleur ici et
 * dans Statistiques MESRS — sans quoi la lecture d'un écran à l'autre ment.
 * Effectif = encre (une masse, pas un état), réussite = vert, argent = ocre.
 */
const PEINTURE_EFFECTIF = '#10251E';
const PEINTURE_ARGENT = '#C98A00';

const $q = useQuasar();
const router = useRouter();

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
const resumePromotions = computed(
  () =>
    `Effectif par promotion : ${promotions.value
      .map((p) => `${p.nom} ${p.effectif}`)
      .join(', ')}.`,
);
const resumeMasse = computed(
  () =>
    `Masse salariale des 12 derniers mois, en francs guinéens : ${evolutionMasse.value
      .map((m) => `${m.mois} ${montantLisible(m.total)}`)
      .join(', ')}.`,
);

const configPromotions = computed<ChartConfiguration>(() => ({
  type: 'bar',
  data: {
    labels: promotions.value.map((p) => p.nom),
    datasets: [
      {
        label: 'Effectif',
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
          label: 'Masse salariale (GNF)',
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
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement du tableau de bord impossible.',
    });
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
      message: `Bilan MESRS ${chiffres.value?.annee?.libelle ?? ''} généré et archivé.`,
      actions: [
        {
          label: 'Voir les snapshots',
          color: 'white',
          noCaps: true,
          handler: () => void router.push('/statistiques-mesrs'),
        },
      ],
    });
    await charger();
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Génération du bilan impossible.',
    });
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
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Années académiques indisponibles.',
    });
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
  font-weight: 700;
}

</style>
