<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Délibérations</div>
        <div class="page-sous-titre">
          Sessions du jury : moyennes pondérées par les crédits, décisions ADMIS /
          AJOURNÉ / DÉFAILLANT
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutSaisir()"
          unelevated
          color="primary"
          no-caps
          icon="gavel"
          label="Nouvelle délibération"
          @click="dialogOuvert = true"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher une promotion…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Année académique"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Promotion"
        />
        <semestre-select
          v-model="filtres.session"
          type="session"
          label="Session"
          clearable
        />
      </template>
      <template #actions>
        <view-toggle
          cle="deliberations"
          :modes="['tableau', 'kanban']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = (m as 'tableau' | 'kanban'))"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="deliberationsFiltrees"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 15 }"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">Aucune délibération pour ces critères.</div>
      </template>

      <template #body-cell-session="p">
        <q-td :props="p">{{ LIBELLE_SESSION_DELIBERATION[p.row.session] }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="p.row.statut === 'VALIDEE' ? 'positive' : 'warning'">
            {{ LIBELLE_STATUT_DELIBERATION[p.row.statut] }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-taux="p">
        <q-td :props="p">
          <template v-if="p.row.tauxReussite !== null && p.row.tauxReussite !== undefined">
            {{ pourcentLisible(p.row.tauxReussite) }}
          </template>
          <template v-else>—</template>
        </q-td>
      </template>

      <template #body-cell-effectif="p">
        <q-td :props="p">{{ (p.row as any)._count?.lignes ?? 0 }}</q-td>
      </template>

      <template #body-cell-creeLe="p">
        <q-td :props="p">{{ dateLisible(p.row.creeLe) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" @click="ouvrirDetail(p.row)">
            <q-tooltip>Détail des lignes</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON' && peutSaisir()"
            flat
            dense
            round
            icon="replay"
            color="primary"
            @click="calculer(p.row)"
          >
            <q-tooltip>Recalculer moyennes et décisions</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON' && estJury()"
            flat
            dense
            no-caps
            icon="verified_user"
            color="positive"
            label="Valider le jury"
            @click="valider(p.row)"
          />
          <q-btn flat dense round icon="print" @click="imprimerPv(p.row)">
            <q-tooltip>Imprimer le PV</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <kanban-board
      v-else
      :colonnes="colonnesKanban"
    />

    <pagination-bar
      v-if="deliberations.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <deliberation-dialog
      v-model="dialogOuvert"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="charger"
    />

    <!-- Détail des lignes -->
    <q-dialog v-model="dialogDetail" :maximized="$q.screen.lt.md">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">Délibération — {{ detail?.promotion?.nom }}</div>
            <div class="text-caption text-grey-7">
              {{ LIBELLE_SESSION_DELIBERATION[detail?.session ?? 'NORMALE'] }} ·
              {{ detail?.annee?.libelle }} ·
              {{
                detail?.statut === 'VALIDEE' ? 'validée par le jury' : 'brouillon'
              }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn outline no-caps icon="print" label="PV" @click="imprimerPv(detail)" />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-table
            flat
            bordered
            :rows="detailLignes"
            :columns="colonnesDetail"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-decision="p">
              <q-td :props="p">
                <q-badge :color="couleurDecision(p.row.decision)">
                  {{ LIBELLE_DECISION_JURY[p.row.decision] }}
                </q-badge>
              </q-td>
            </template>
            <template #body-cell-actions="p">
              <q-td :props="p" class="text-right">
                <q-btn flat dense round icon="print" @click="imprimerBulletin(p.row)">
                  <q-tooltip>Bulletin individuel</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import DeliberationDialog from '../components/DeliberationDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import SemestreSelect from '../components/SemestreSelect.vue';
import KanbanBoard from '../components/KanbanBoard.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_STATUT_DELIBERATION,
  dateLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { AnneeAcademique, Deliberation, DeliberationLigne, Matiere, Promotion } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const peutSaisir = () => auth.aRole(['ADMIN', 'SCOLARITE']);
/** Le jury : direction et administrateur figent les résultats. */
const estJury = () => auth.aRole(['ADMIN', 'DIRECTION']);

const deliberations = ref<Deliberation[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'kanban'>('tableau');

const page = ref(1);
const pageSize = ref(15);
const total = ref(0);
const tousLesElements = ref(false);

const filtres = ref<Record<string, any>>({});

const dialogOuvert = ref(false);
const dialogDetail = ref(false);
const detail = ref<Deliberation | null>(null);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);

const chips = computed(() => {
  const cs: Array<{ label: string; value: any; icone?: string; defaut?: boolean }> = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: `Année : ${a?.libelle ?? '?'}`, value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.session) {
    cs.push({
      label: `Session : ${LIBELLE_SESSION_DELIBERATION[filtres.value.session] ?? filtres.value.session}`,
      value: filtres.value.session,
      icone: 'flag',
    });
  }
  return cs;
});

const deliberationsFiltrees = computed(() => deliberations.value);

const colonnes: QTableColumn[] = [
  { name: 'promotion', label: 'Promotion', field: (r) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'session', label: 'Session', field: 'session', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'taux', label: 'Taux de réussite', field: 'tauxReussite', align: 'center' },
  { name: 'effectif', label: 'Étudiants', field: 'id', align: 'center' },
  { name: 'creeLe', label: 'Créée le', field: 'creeLe', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesDetail: QTableColumn[] = [
  { name: 'rang', label: 'Rang', field: 'rang', align: 'center' },
  { name: 'matricule', label: 'Matricule', field: (r) => r.inscription?.etudiant?.matricule ?? '—', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.inscription?.etudiant?.nom ?? ''} ${r.inscription?.etudiant?.prenom ?? ''}`, align: 'left' },
  { name: 'moyenne', label: 'Moyenne', field: 'moyenne', align: 'center' },
  { name: 'decision', label: 'Décision', field: 'decision', align: 'center' },
  { name: 'mention', label: 'Mention', field: 'mention', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const detailLignes = computed<DeliberationLigne[]>(() => detail.value?.lignes ?? []);

const colonnesKanban = computed(() => {
  const parColonne: Record<string, Deliberation[]> = {
    PROPOSE: [],
    VALIDE: [],
    SOUTENU: [],
    ABANDONNE: [],
  };
  for (const d of deliberationsFiltrees.value) {
    const cle = bucketDeliberation(d);
    (parColonne[cle] ||= []).push(d);
  }

  const cartes = (d: Deliberation) => ({
    id: d.id,
    titre: d.promotion?.nom ?? '—',
    sousTitre: `${LIBELLE_SESSION_DELIBERATION[d.session]} · ${d.annee?.libelle ?? ''}`,
    meta: `${(d as any)._count?.lignes ?? 0} étudiant(s) · créée le ${dateLisible(d.creeLe)}`,
    badge: d.statut === 'VALIDEE'
      ? (d.session === 'NORMALE' ? 'Validée' : 'Soutenue')
      : (d.session === 'RATTRAPAGE' ? 'À reprendre' : 'Brouillon'),
    couleur: d.statut === 'VALIDEE' ? 'positive' : 'warning',
    actions: [
      {
        label: 'Calculer',
        icone: 'replay',
        couleur: 'primary',
        onClick: () => peutSaisir() && calculer(d),
      },
      ...(d.statut === 'BROUILLON' && estJury()
        ? [{
            label: 'Valider',
            icone: 'verified_user',
            couleur: 'positive',
            onClick: () => valider(d),
          }]
        : []),
      {
        label: 'Bulletins',
        icone: 'picture_as_pdf',
        onClick: () => allerBulletins(d),
      },
    ],
    onClick: () => ouvrirDetail(d),
  });

  return [
    {
      identifiant: 'PROPOSE',
      titre: 'Proposées (brouillon)',
      couleur: '#EFB700',
      cartes: parColonne.PROPOSE.map(cartes),
    },
    {
      identifiant: 'VALIDE',
      titre: 'Validées (jury)',
      couleur: '#0F7A45',
      cartes: parColonne.VALIDE.map(cartes),
    },
    {
      identifiant: 'SOUTENU',
      titre: 'Soutenues (rattrapage validé)',
      couleur: '#3E9E6C',
      cartes: parColonne.SOUTENU.map(cartes),
    },
    {
      identifiant: 'ABANDONNE',
      titre: 'Abandonnées',
      couleur: '#C4122E',
      cartes: parColonne.ABANDONNE.map(cartes),
    },
  ];
});

function bucketDeliberation(d: Deliberation): string {
  if (d.session === 'RATTRAPAGE' && d.statut === 'VALIDEE') return 'SOUTENU';
  if (d.session === 'RATTRAPAGE' && d.statut === 'BROUILLON') return 'ABANDONNE';
  if (d.statut === 'VALIDEE') return 'VALIDE';
  return 'PROPOSE';
}

function couleurDecision(d: string): string {
  return d === 'ADMIS' ? 'positive' : d === 'AJOURNE' ? 'warning' : 'negative';
}

function urlToken(chemin: string) {
  return `${API_URL}${chemin}${chemin.includes('?') ? '&' : '?'}token=${auth.token}`;
}

function imprimerPv(d: Deliberation | null) {
  if (!d) return;
  window.open(urlToken(`/deliberations/${d.id}/imprimer`), '_blank');
}

function imprimerBulletin(l: DeliberationLigne) {
  if (!detail.value) return;
  window.open(
    urlToken(`/deliberations/${detail.value.id}/releve/${l.inscriptionId}`),
    '_blank',
  );
}

function ouvrirDetail(d: Deliberation) {
  detail.value = d;
  dialogDetail.value = true;
}

function calculer(d: Deliberation) {
  $q.dialog({
    title: 'Recalculer la délibération',
    message:
      'Les moyennes d’UE (pondérées par les coefficients), la moyenne générale (pondérée par les crédits), les décisions, rangs et taux de réussite seront recalculés sur les notes actuelles.',
    cancel: true,
    ok: { color: 'primary', label: 'Recalculer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    await api.post(`/deliberations/${d.id}/calculer`);
    $q.notify({ type: 'positive', message: 'Délibération recalculée' });
    await charger();
  });
}

function valider(d: Deliberation) {
  $q.dialog({
    title: 'Valider les résultats du jury',
    html: true,
    message: `<p>La décision est prise selon les règles écrites :</p>
      <ul>
        <li>moyenne générale = Σ(moyenne UE × crédits) / Σ(crédits) ;</li>
        <li>ADMIS si moyenne générale ≥ 10 et aucune matière sous 5/20 pour défaut d’absence ;</li>
        <li>DÉFAILLANT si une matière n’a aucune note à une épreuve clôturée ;</li>
        <li>AJOURNÉ sinon — en rattrapage, seuls les AJOURNÉ sont repositionnés.</li>
      </ul>
      <p><strong>Après validation, tout recalcul sera bloqué.</strong> Continuer ?</p>`,
    cancel: true,
    ok: { color: 'positive', label: 'Valider le jury', unelevated: true, noCaps: true },
  }).onOk(async () => {
    await api.post(`/deliberations/${d.id}/valider`);
    $q.notify({ type: 'positive', message: 'Délibération validée par le jury' });
    await charger();
  });
}

function allerBulletins(d: Deliberation) {
  // Délégué au routeur de BulletinsPage via une redirection HTML : on préfère
  // ouvrir dans un nouvel onglet pour ne pas perdre la vue courante.
  window.open(`/bulletins?promotionId=${d.promotionId}&anneeId=${d.anneeId}`, '_blank');
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/deliberations', {
      params: {
        all: '1',
        page: page.value,
        pageSize: pageSize.value,
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        session: filtres.value.session || undefined,
        search: filtres.value.recherche || undefined,
      },
    });
    deliberations.value = data.data ?? [];
    total.value = data.total ?? deliberations.value.length;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/deliberations', {
      params: {
        all: '1',
        pageSize: 1000,
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        session: filtres.value.session || undefined,
      },
    });
    deliberations.value = data.data ?? [];
    total.value = deliberations.value.length;
    tousLesElements.value = true;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  tousLesElements.value = false;
  charger();
}

watch(
  () => [filtres.value.anneeId, filtres.value.promotionId, filtres.value.session, filtres.value.recherche],
  () => {
    page.value = 1;
    tousLesElements.value = false;
    charger();
  },
);

onMounted(async () => {
  const [a, p, m] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
    api.get('/matieres', { params: { all: '1' } }).catch(() => ({ data: { data: [] } })),
  ]);
  annees.value = a.data.data;
  promotions.value = p.data.data;
  matieres.value = m.data.data ?? [];
  await charger();
});
</script>