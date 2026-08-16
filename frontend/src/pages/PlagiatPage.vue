<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Anti-plagiat</div>
        <div class="page-sous-titre">
          Tableau de bord des suspicions détectées par empreinte sur les documents déposés.
          Les acquisitions acquittent la suspicion ; les confirmations ouvrent une procédure disciplinaire.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.estAdmin"
          unelevated
          color="negative"
          no-caps
          icon="refresh"
          label="Recalculer toutes les suspicions"
          :loading="recalculEnCours"
          @click="lancerRecalcul"
        />
      </div>
    </div>

    <!-- KPIs -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">Total suspicions</div>
            <div class="kpi-carte__chiffre">{{ stats.total }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">Score moyen</div>
            <div class="kpi-carte__chiffre">
              {{ stats.total ? stats.scoreMoyen.toFixed(1) : '0' }}
              <span class="kpi-carte__unite">%</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">En attente</div>
            <div class="kpi-carte__chiffre text-orange">{{ stats.enAttente }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">Confirmées</div>
            <div class="kpi-carte__chiffre text-negative">{{ stats.confirmees }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-banner v-if="dernierRecap" dense class="bg-positive text-white q-mb-md">
      <template #avatar><q-icon name="check_circle" /></template>
      <div class="text-weight-medium">{{ dernierRecap.titre }}</div>
      <div class="text-caption">{{ dernierRecap.message }}</div>
    </q-banner>

    <q-tabs
      v-model="onglet"
      dense
      align="left"
      narrow-indicator
      class="onglets-panneau q-mb-md"
    >
      <q-tab name="en_attente" icon="hourglass_empty" label="En attente" no-caps />
      <q-tab name="acquittees" icon="thumb_down" label="Acquittées" no-caps />
      <q-tab name="confirmees" icon="gavel" label="Confirmées" no-caps />
      <q-tab name="toutes" icon="list" label="Toutes" no-caps />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      placeholder="Recherche (document, commentaire, détecteur…)"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-input
          v-model.number="filtres.scoreMin"
          type="number"
          min="0"
          max="100"
          dense
          outlined
          label="Score minimum"
          clearable
        />
        <autocomplete-async
          v-model="filtres.documentId"
          endpoint="/documents"
          :label-fn="(d) => `${d.titre}${d.auteurs ? ' — ' + d.auteurs : ''}`"
          label="Document"
          placeholder="Tapez le titre…"
        />
        <q-input
          v-model="filtres.dateMin"
          type="date"
          dense
          outlined
          clearable
          label="Du"
        />
        <q-input
          v-model="filtres.dateMax"
          type="date"
          dense
          outlined
          clearable
          label="Au"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="plagiat.dashboard"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (mode = v as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      @update:page="(v) => { pagination.page = v; charger(true) }"
      @update:page-size="(v) => { pagination.pageSize = v; pagination.page = 1; charger(true); }"
      @tous="chargerTout"
    />

    <!-- Top 5 documents les plus dupliqués -->
    <q-banner v-if="stats.topDocuments.length" dense class="bg-grey-2 text-grey-10 q-mb-md">
      <template #avatar><q-icon name="leaderboard" /></template>
      <div class="text-caption text-weight-medium q-mb-xs">Top 5 documents les plus dupliqués</div>
      <ol class="q-pl-md q-mb-none">
        <li v-for="d in stats.topDocuments" :key="d.id" class="text-caption">
          {{ d.titre }} —
          <span class="text-grey-9">{{ d.compte }} suspicion(s)</span>
        </li>
      </ol>
    </q-banner>

    <div v-if="chargement && !suspicions.length" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="!suspicions.length" class="plaque q-pa-lg text-center text-grey-7">
      <q-icon name="verified" size="38px" color="positive" />
      <div class="q-mt-sm">Aucune suspicion à afficher dans cet onglet.</div>
    </div>

    <q-table
      v-else-if="mode === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="suspicions"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-score="p">
        <q-td :props="p">
          <q-badge
            :color="couleurScore(p.row.score)"
            text-color="white"
            dense
            size="md"
          >
            {{ Math.round(p.row.score) }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-documentA="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.documentA?.titre ?? p.row.documentAId }}</div>
          <div class="text-caption text-grey-7">{{ p.row.documentA?.auteurs ?? '—' }}</div>
        </q-td>
      </template>
      <template #body-cell-documentB="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.documentB?.titre ?? p.row.documentBId }}</div>
          <div class="text-caption text-grey-7">{{ p.row.documentB?.auteurs ?? '—' }}</div>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="couleurStatut(p.row.statut)" text-color="white">
            {{ libelleStatut[p.row.statut] }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="open_in_new" @click="voirDetail(p.row)">
            <q-tooltip>Voir le détail</q-tooltip>
          </q-btn>
          <template v-if="peutDecider && p.row.statut === 'EN_ATTENTE'">
            <q-btn flat dense round color="positive" icon="thumb_down" @click="acquitter(p.row)">
              <q-tooltip>Acquitter</q-tooltip>
            </q-btn>
            <q-btn flat dense round color="negative" icon="gavel" @click="confirmer(p.row)">
              <q-tooltip>Confirmer</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="s in suspicions" :key="s.id" class="col-12 col-sm-6 col-lg-4">
        <plagiat-card
          :suspicion="s"
          :show-actions="peutDecider"
          @voir="voirDetail"
          @acquitter="acquitter"
          @confirmer="confirmer"
        />
      </div>
    </div>

    <!-- Dialog de décision rapide (acquittement / confirmation) -->
    <q-dialog v-model="decisionDialogOuvert">
      <q-card style="width: 540px; max-width: 95vw" v-if="decisionCourante">
        <q-card-section class="text-h6">
          {{ decisionStatut === 'ACQUITTE' ? 'Acquitter la suspicion' : 'Confirmer le plagiat' }}
        </q-card-section>
        <q-card-section class="q-pt-none text-caption text-grey-7">
          Score : <strong>{{ Math.round(decisionCourante.score) }} %</strong>
          — Documents n° {{ decisionCourante.documentAId.slice(0, 8) }}
          et {{ decisionCourante.documentBId.slice(0, 8) }}
        </q-card-section>
        <q-card-section>
          <q-banner
            v-if="decisionStatut === 'CONFIRME'"
            dense
            class="bg-red-1 text-red-10 q-mb-md"
          >
            <template #avatar><q-icon name="warning" color="negative" /></template>
            Confirmer ouvre une procédure disciplinaire. Le motif est obligatoire.
          </q-banner>
          <q-input
            v-model="decisionMotif"
            outlined
            dense
            type="textarea"
            autogrow
            label="Motif"
            :rules="decisionStatut === 'CONFIRME' ? [(v: string) => (v && v.trim().length > 0) || 'Motif obligatoire'] : []"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            unelevated
            :color="decisionStatut === 'ACQUITTE' ? 'positive' : 'negative'"
            :label="decisionStatut === 'ACQUITTE' ? 'Acquitter' : 'Confirmer le plagiat'"
            :loading="decisionEnCours"
            @click="validerDecision"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import PlagiatCard from '../components/PlagiatCard.vue';
import { useAuthStore } from '../stores/auth';
import type { SuspicionPlagiat } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

type Onglet = 'en_attente' | 'acquittees' | 'confirmees' | 'toutes';
const onglet = ref<Onglet>('en_attente');
const mode = ref<'tableau' | 'cartes'>('cartes');

const suspicions = ref<SuspicionPlagiat[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 12, total: 0 });
const recalculEnCours = ref(false);
const dernierRecap = ref<{ titre: string; message: string } | null>(null);

const filtres = ref<Record<string, any>>({
  recherche: '',
  scoreMin: null as number | null,
  documentId: '',
  dateMin: '',
  dateMax: '',
});

const peutDecider = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const colonnes: QTableColumn<SuspicionPlagiat>[] = [
  { name: 'score', label: 'Score', field: 'score', align: 'center', sortable: true },
  { name: 'documentA', label: 'Document A', field: 'documentAId', align: 'left' },
  { name: 'documentB', label: 'Document B', field: 'documentBId', align: 'left' },
  { name: 'detecteLe', label: 'Détecté', field: 'detecteLe', align: 'center', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const libelleStatut: Record<SuspicionPlagiat['statut'], string> = {
  EN_ATTENTE: 'En attente',
  ACQUITTE: 'Acquittée',
  CONFIRME: 'Confirmée',
};

function couleurScore(score: number): string {
  if (score >= 80) return 'negative';
  if (score >= 50) return 'warning';
  return 'positive';
}

function couleurStatut(s: SuspicionPlagiat['statut']): string {
  return { EN_ATTENTE: 'orange', ACQUITTE: 'positive', CONFIRME: 'negative' }[s];
}

const stats = computed(() => {
  const total = suspicions.value.length;
  const scoreMoyen = total
    ? suspicions.value.reduce((acc, s) => acc + (s.score ?? 0), 0) / total
    : 0;
  const enAttente = suspicions.value.filter((s) => s.statut === 'EN_ATTENTE').length;
  const confirmees = suspicions.value.filter((s) => s.statut === 'CONFIRME').length;

  // Calcul local du top 5 — agrège par titre de document A.
  const compteur = new Map<string, { id: string; titre: string; compte: number }>();
  suspicions.value.forEach((s) => {
    const docs = [s.documentA, s.documentB].filter((d): d is NonNullable<typeof d> => !!d);
    docs.forEach((d) => {
      const ex = compteur.get(d.id);
      if (ex) ex.compte += 1;
      else compteur.set(d.id, { id: d.id, titre: d.titre, compte: 1 });
    });
  });
  const topDocuments = Array.from(compteur.values())
    .sort((a, b) => b.compte - a.compte)
    .slice(0, 5);

  return { total, scoreMoyen, enAttente, confirmees, topDocuments };
});

async function charger(reinit = true) {
  if (reinit) pagination.value.page = 1;
  chargement.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    const f = filtres.value;
    if (f.scoreMin !== null && f.scoreMin !== undefined && f.scoreMin !== '') {
      params.scoreMin = f.scoreMin;
    }
    if (f.documentId) params.documentId = f.documentId;
    if (f.dateMin) params.dateMin = f.dateMin;
    if (f.dateMax) params.dateMax = f.dateMax;
    if (f.recherche) params.search = f.recherche;

    switch (onglet.value) {
      case 'en_attente': params.statut = 'EN_ATTENTE'; break;
      case 'acquittees': params.statut = 'ACQUITTE'; break;
      case 'confirmees': params.statut = 'CONFIRME'; break;
      default: break;
    }

    const { data } = await api.get('/documents/plagiat', { params });
    suspicions.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await charger(true);
}

function reinitialiser() {
  filtres.value = { recherche: '', scoreMin: null, documentId: '', dateMin: '', dateMax: '' };
}

function voirDetail(s: SuspicionPlagiat) {
  void router.push(`/plagiat/${s.id}`);
}

// Dialog de décision rapide
const decisionDialogOuvert = ref(false);
const decisionCourante = ref<SuspicionPlagiat | null>(null);
const decisionStatut = ref<'ACQUITTE' | 'CONFIRME'>('ACQUITTE');
const decisionMotif = ref('');
const decisionEnCours = ref(false);

function acquitter(s: SuspicionPlagiat) {
  decisionCourante.value = s;
  decisionStatut.value = 'ACQUITTE';
  decisionMotif.value = '';
  decisionDialogOuvert.value = true;
}

function confirmer(s: SuspicionPlagiat) {
  decisionCourante.value = s;
  decisionStatut.value = 'CONFIRME';
  decisionMotif.value = '';
  decisionDialogOuvert.value = true;
}

async function validerDecision() {
  if (!decisionCourante.value) return;
  if (decisionStatut.value === 'CONFIRME' && !decisionMotif.value.trim()) {
    $q.notify({ type: 'warning', message: 'Le motif est obligatoire pour une confirmation' });
    return;
  }
  decisionEnCours.value = true;
  try {
    await api.post(
      `/documents/plagiat/${decisionCourante.value.id}/acquitter`,
      {
        decision: decisionStatut.value,
        commentaire: decisionMotif.value.trim() || undefined,
      },
    );
    $q.notify({
      type: 'positive',
      message: decisionStatut.value === 'ACQUITTE'
        ? 'Suspicion acquittée'
        : 'Plagiat confirmé — procédure ouverte',
    });
    decisionDialogOuvert.value = false;
    await charger(true);
  } finally {
    decisionEnCours.value = false;
  }
}

async function lancerRecalcul() {
  $q.dialog({
    title: 'Recalculer toutes les suspicions',
    message:
      'Cette opération compare tous les documents et peut prendre plusieurs minutes. '
      + 'Confirmez pour lancer le calcul.',
    cancel: true,
    ok: { color: 'negative', label: 'Lancer le recalcul', unelevated: true },
  }).onOk(async () => {
    recalculEnCours.value = true;
    try {
      const { data } = await api.post('/documents/recalculer-plagiat', {});
      const total = (data?.total ?? data?.suspicionsCreees ?? data?.data?.total) as number | undefined;
      const docs = (data?.documentsAnalyses ?? data?.data?.documentsAnalyses) as number | undefined;
      dernierRecap.value = {
        titre: 'Recalcul terminé',
        message: `${docs ?? '?'} document(s) analysés — ${total ?? '?'} suspicion(s) détectée(s).`,
      };
      $q.notify({ type: 'positive', message: 'Recalcul anti-plagiat terminé' });
      await charger(true);
    } finally {
      recalculEnCours.value = false;
    }
  });
}

watch([filtres, onglet], () => charger(true), { deep: true });

onMounted(() => charger(true));
</script>

<style scoped>
.kpi-carte__chiffre {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
  color: var(--up-encre);
}
.kpi-carte__unite {
  font-size: 1rem;
  font-weight: 600;
}
</style>
