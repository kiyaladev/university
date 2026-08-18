<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Anti-plagiat</div>
        <div class="page-sous-titre">
          File d'arbitrage des suspicions détectées par empreinte sur les documents
          déposés. Acquitter lève la suspicion ; confirmer ouvre une procédure
          disciplinaire — les deux décisions sont définitives et journalisées.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="library_books"
          label="Bibliothèque"
          @click="router.push({ name: 'bibliotheque' })"
        />
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

    <!-- KPIs : chiffres globaux renvoyés par le moteur, tous statuts confondus -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">Total suspicions</div>
            <div class="kpi-carte__chiffre">{{ kpis.total }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">Score moyen</div>
            <div class="kpi-carte__chiffre">
              {{ nombreLisible(kpis.scoreMoyen, 1) }}<span class="kpi-carte__unite">%</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">En attente d'arbitrage</div>
            <div class="kpi-carte__chiffre text-orange">{{ kpis.enAttente }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">Arbitrées</div>
            <div class="kpi-carte__chiffre">
              <span class="text-positive">{{ kpis.acquittees }}</span>
              <span class="kpi-carte__unite"> acquittées · </span>
              <span class="text-negative">{{ kpis.confirmees }}</span>
              <span class="kpi-carte__unite"> confirmées</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-banner v-if="dernierRecap" dense class="bg-positive text-white q-mb-md">
      <template #avatar><q-icon name="check_circle" /></template>
      <div class="text-weight-medium">{{ dernierRecap.titre }}</div>
      <div class="text-caption">{{ dernierRecap.message }}</div>
      <template #action>
        <q-btn flat dense no-caps label="Masquer" aria-label="Masquer le récapitulatif" @click="dernierRecap = null" />
      </template>
    </q-banner>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (titre, auteurs d'un document…)"
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
          clearable
          label="Score minimum (%)"
        />
        <autocomplete-async
          v-model="filtres.documentId"
          endpoint="/documents"
          :label-fn="(d) => `${d.titre}${d.auteurs ? ' — ' + d.auteurs : ''}`"
          label="Document concerné"
          placeholder="Tapez le titre…"
          clearable
        />
        <champ-date v-model="filtres.dateMin" label="Détecté du" />
        <champ-date v-model="filtres.dateMax" label="au" />
      </template>
      <template #actions>
        <view-toggle
          cle="plagiat.dashboard"
          :modes="['tableau', 'cartes']"
          defaut="cartes"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <!-- Top 5 documents les plus dupliqués -->
    <q-banner v-if="topDocuments.length" dense class="carte q-mb-md">
      <template #avatar><q-icon name="leaderboard" color="primary" /></template>
      <div class="text-caption text-weight-medium q-mb-xs">Documents les plus dupliqués</div>
      <ol class="q-pl-md q-mb-none">
        <li v-for="d in topDocuments" :key="d.id" class="text-caption">
          {{ d.titre }} — <span class="text-grey-9">{{ d.compte }} suspicion(s)</span>
        </li>
      </ol>
    </q-banner>

    <div v-if="chargement" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="!suspicionsFiltrees.length" class="plaque q-pa-lg text-center text-grey-7">
      <q-icon name="verified" size="38px" color="positive" />
      <div class="q-mt-sm text-weight-medium">
        {{ filtresActifs ? 'Aucune suspicion ne correspond à ces critères.' : 'Aucune suspicion en attente d’arbitrage.' }}
      </div>
      <div class="text-caption q-mt-xs">
        {{
          filtresActifs
            ? 'Élargissez les critères pour revoir la file d’arbitrage.'
            : 'Les nouveaux dépôts sont comparés automatiquement ; relancez un recalcul complet après un import massif.'
        }}
      </div>
      <q-btn
        v-if="filtresActifs"
        flat
        no-caps
        color="primary"
        icon="refresh"
        label="Réinitialiser les filtres"
        class="q-mt-md"
        @click="reinitialiser"
      />
    </div>

    <template v-else>
      <q-table
        v-if="modeVue === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="suspicionsPage"
        :columns="colonnes"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        @row-click="(_, row) => voirDetail(row)"
      >
        <template #body-cell-score="p">
          <q-td :props="p" class="text-center">
            <q-badge :color="couleurScore(p.row.score)" text-color="white" dense>
              {{ Math.round(p.row.score) }} %
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-documentA="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.documentA?.titre ?? '—' }}</div>
            <div class="text-caption text-grey-7">{{ p.row.documentA?.auteurs ?? '—' }}</div>
          </q-td>
        </template>
        <template #body-cell-documentB="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.documentB?.titre ?? '—' }}</div>
            <div class="text-caption text-grey-7">{{ p.row.documentB?.auteurs ?? '—' }}</div>
          </q-td>
        </template>
        <template #body-cell-statut="p">
          <q-td :props="p">
            <q-badge :color="couleurStatut(p.row.statut)" text-color="white">
              {{ LIBELLE_STATUT_SUSPICION[p.row.statut] ?? p.row.statut }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              flat
              dense
              round
              icon="open_in_new"
              aria-label="Voir le détail de la suspicion"
              @click.stop="voirDetail(p.row)"
            >
              <q-tooltip>Voir le détail et le diff</q-tooltip>
            </q-btn>
            <template v-if="peutDecider && p.row.statut === 'EN_ATTENTE'">
              <q-btn
                flat
                dense
                round
                color="positive"
                icon="thumb_down"
                aria-label="Acquitter la suspicion"
                @click.stop="acquitter(p.row)"
              >
                <q-tooltip>Acquitter</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                color="negative"
                icon="gavel"
                aria-label="Confirmer le plagiat"
                @click.stop="confirmer(p.row)"
              >
                <q-tooltip>Confirmer le plagiat</q-tooltip>
              </q-btn>
            </template>
          </q-td>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div v-for="s in suspicionsPage" :key="s.id" class="col-12 col-sm-6 col-lg-4">
          <plagiat-card
            :suspicion="s"
            :show-actions="peutDecider"
            @voir="voirDetail"
            @acquitter="acquitter"
            @confirmer="confirmer"
          />
        </div>
      </div>

      <pagination-bar
        :page="page"
        :page-size="pageSize"
        :total="suspicionsFiltrees.length"
        :show-all="false"
        @update:page="(v) => (page = v)"
        @update:page-size="(v) => { pageSize = v; page = 1; }"
      />
    </template>

    <!-- Dialog de décision rapide (acquittement / confirmation) -->
    <q-dialog v-model="decisionDialogOuvert">
      <q-card v-if="decisionCourante" style="width: 540px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ decisionStatut === 'ACQUITTE' ? 'Acquitter la suspicion' : 'Confirmer le plagiat' }}
        </q-card-section>
        <q-card-section class="q-pt-none text-caption text-grey-7">
          Score <strong>{{ Math.round(decisionCourante.score) }} %</strong> —
          « {{ decisionCourante.documentA?.titre ?? '—' }} »
          contre « {{ decisionCourante.documentB?.titre ?? '—' }} »
        </q-card-section>
        <q-card-section>
          <q-banner dense :class="decisionStatut === 'CONFIRME' ? 'bg-red-1 text-red-10 q-mb-md' : 'carte q-mb-md'">
            <template #avatar>
              <q-icon :name="decisionStatut === 'CONFIRME' ? 'warning' : 'info'" :color="decisionStatut === 'CONFIRME' ? 'negative' : 'primary'" />
            </template>
            <template v-if="decisionStatut === 'CONFIRME'">
              Confirmer ouvre une procédure disciplinaire. Le motif est obligatoire
              et la décision ne pourra plus être modifiée.
            </template>
            <template v-else>
              La suspicion sera close sans suite. La décision ne pourra plus être modifiée.
            </template>
          </q-banner>
          <q-input
            v-model="decisionMotif"
            outlined
            dense
            type="textarea"
            autogrow
            :label="decisionStatut === 'CONFIRME' ? 'Motif *' : 'Motif (facultatif)'"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            unelevated
            no-caps
            :color="decisionStatut === 'ACQUITTE' ? 'positive' : 'negative'"
            :label="decisionStatut === 'ACQUITTE' ? 'Acquitter définitivement' : 'Confirmer le plagiat'"
            :disable="decisionStatut === 'CONFIRME' && !decisionMotif.trim()"
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
import { useRoute, useRouter } from 'vue-router';
import { api } from '../boot/axios';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ChampDate from '../components/ChampDate.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import PlagiatCard from '../components/PlagiatCard.vue';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_STATUT_SUSPICION, dateLisible, nombreLisible } from '../utils/libelles';
import type { SuspicionPlagiat, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const modeVue = ref<'tableau' | 'cartes'>('cartes');

/**
 * `GET /documents/plagiat` renvoie un tableau de bord complet — file d'attente,
 * compteurs globaux et top des documents — sans paramètre de filtre ni de
 * pagination : le tri, la recherche et la pagination sont donc faits ici.
 */
const suspicions = ref<SuspicionPlagiat[]>([]);
const kpis = ref({ total: 0, scoreMoyen: 0, enAttente: 0, acquittees: 0, confirmees: 0 });
const topDocuments = ref<Array<{ id: string; titre: string; compte: number }>>([]);

const chargement = ref(false);
const page = ref(1);
const pageSize = ref(12);
const recalculEnCours = ref(false);
const dernierRecap = ref<{ titre: string; message: string } | null>(null);

const filtres = ref<Record<string, any>>({});

const peutDecider = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const colonnes: QTableColumn<SuspicionPlagiat>[] = [
  { name: 'score', label: 'Score', field: 'score', align: 'center', sortable: true },
  { name: 'documentA', label: 'Document A', field: 'documentAId', align: 'left' },
  { name: 'documentB', label: 'Document B', field: 'documentBId', align: 'left' },
  { name: 'detecteLe', label: 'Détecté le', field: (r) => dateLisible(r.detecteLe), align: 'center', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function couleurScore(score: number): string {
  if (score >= 80) return 'negative';
  if (score >= 50) return 'warning';
  return 'positive';
}

function couleurStatut(s: SuspicionPlagiat['statut']): string {
  return { EN_ATTENTE: 'orange', ACQUITTE: 'positive', CONFIRME: 'negative' }[s];
}

const filtresActifs = computed(() =>
  Boolean(
    filtres.value.recherche ||
      filtres.value.documentId ||
      filtres.value.dateMin ||
      filtres.value.dateMax ||
      (filtres.value.scoreMin ?? null) !== null,
  ),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, icone: 'search', defaut: true });
  }
  if ((filtres.value.scoreMin ?? null) !== null && filtres.value.scoreMin !== '') {
    cs.push({ label: `Score ≥ ${filtres.value.scoreMin} %`, value: filtres.value.scoreMin, icone: 'speed' });
  }
  if (filtres.value.documentId) {
    cs.push({ label: 'Document ciblé', value: filtres.value.documentId, icone: 'description', cle: 'documentId'});
  }
  if (filtres.value.dateMin) {
    cs.push({ label: `Depuis : ${dateLisible(filtres.value.dateMin)}`, value: filtres.value.dateMin, icone: 'event' });
  }
  if (filtres.value.dateMax) {
    cs.push({ label: `Jusqu'à : ${dateLisible(filtres.value.dateMax)}`, value: filtres.value.dateMax, icone: 'event' });
  }
  return cs;
});

const suspicionsFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
  const scoreMin = Number(filtres.value.scoreMin ?? NaN);
  const debut = filtres.value.dateMin ? new Date(String(filtres.value.dateMin)).getTime() : null;
  const fin = filtres.value.dateMax
    ? new Date(String(filtres.value.dateMax)).getTime() + 86_400_000 - 1
    : null;

  return suspicions.value.filter((s) => {
    if (!Number.isNaN(scoreMin) && (s.score ?? 0) < scoreMin) return false;
    if (filtres.value.documentId
      && s.documentAId !== filtres.value.documentId
      && s.documentBId !== filtres.value.documentId) return false;
    const t = new Date(s.detecteLe).getTime();
    if (debut !== null && t < debut) return false;
    if (fin !== null && t > fin) return false;
    if (q) {
      const texte = [
        s.documentA?.titre,
        s.documentA?.auteurs,
        s.documentB?.titre,
        s.documentB?.auteurs,
        s.commentaire,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!texte.includes(q)) return false;
    }
    return true;
  });
});

const suspicionsPage = computed(() =>
  suspicionsFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/documents/plagiat');
    suspicions.value = data?.suspicions ?? [];
    kpis.value = {
      total: data?.kpis?.total ?? 0,
      scoreMoyen: data?.kpis?.scoreMoyen ?? 0,
      enAttente: data?.kpis?.enAttente ?? 0,
      acquittees: data?.kpis?.acquittees ?? 0,
      confirmees: data?.kpis?.confirmees ?? 0,
    };

    // Le « top » est renvoyé sous forme de suspicions : on agrège par document.
    const compteur = new Map<string, { id: string; titre: string; compte: number }>();
    for (const s of (data?.topDix ?? []) as SuspicionPlagiat[]) {
      for (const d of [s.documentA, s.documentB]) {
        if (!d) continue;
        const ex = compteur.get(d.id);
        if (ex) ex.compte += 1;
        else compteur.set(d.id, { id: d.id, titre: d.titre, compte: 1 });
      }
    }
    topDocuments.value = Array.from(compteur.values())
      .sort((a, b) => b.compte - a.compte)
      .slice(0, 5);
  } catch (e: any) {
    suspicions.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Tableau de bord anti-plagiat indisponible',
    });
  } finally {
    chargement.value = false;
    page.value = 1;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
}

function voirDetail(s: SuspicionPlagiat) {
  void router.push({ name: 'plagiat-detail', params: { id: s.id } });
}

// Dialog de décision rapide
const decisionDialogOuvert = ref(false);
const decisionCourante = ref<SuspicionPlagiat | null>(null);
const decisionStatut = ref<'ACQUITTE' | 'CONFIRME'>('ACQUITTE');
const decisionMotif = ref('');
const decisionEnCours = ref(false);

function ouvrirDecision(s: SuspicionPlagiat, statut: 'ACQUITTE' | 'CONFIRME') {
  decisionCourante.value = s;
  decisionStatut.value = statut;
  decisionMotif.value = '';
  decisionDialogOuvert.value = true;
}

const acquitter = (s: SuspicionPlagiat) => ouvrirDecision(s, 'ACQUITTE');
const confirmer = (s: SuspicionPlagiat) => ouvrirDecision(s, 'CONFIRME');

async function validerDecision() {
  if (!decisionCourante.value) return;
  if (decisionStatut.value === 'CONFIRME' && !decisionMotif.value.trim()) {
    $q.notify({ type: 'warning', message: 'Le motif est obligatoire pour une confirmation' });
    return;
  }
  decisionEnCours.value = true;
  try {
    await api.post(`/documents/plagiat/${decisionCourante.value.id}/acquitter`, {
      decision: decisionStatut.value,
      commentaire: decisionMotif.value.trim() || undefined,
    });
    $q.notify({
      type: 'positive',
      message:
        decisionStatut.value === 'ACQUITTE'
          ? 'Suspicion acquittée'
          : 'Plagiat confirmé — procédure ouverte',
    });
    decisionDialogOuvert.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Décision impossible' });
  } finally {
    decisionEnCours.value = false;
  }
}

async function lancerRecalcul() {
  $q.dialog({
    title: 'Recalculer toutes les suspicions',
    message:
      'Tous les documents déposés seront comparés deux à deux : l’opération peut '
      + 'prendre plusieurs minutes. Les décisions déjà prises ne sont pas remises en cause.',
    cancel: true,
    ok: { color: 'negative', label: 'Lancer le recalcul', unelevated: true, noCaps: true },
  }).onOk(async () => {
    recalculEnCours.value = true;
    try {
      const { data } = await api.post('/documents/recalculer-plagiat', {});
      dernierRecap.value = {
        titre: 'Recalcul terminé',
        message: `${data?.creees ?? 0} suspicion(s) créée(s), ${data?.misesAJour ?? 0} mise(s) à jour, ${data?.ignorees ?? 0} ignorée(s).`,
      };
      $q.notify({ type: 'positive', message: 'Recalcul anti-plagiat terminé' });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Recalcul impossible' });
    } finally {
      recalculEnCours.value = false;
    }
  });
}

watch(
  () => [filtres.value.recherche, filtres.value.scoreMin, filtres.value.documentId, filtres.value.dateMin, filtres.value.dateMax],
  () => {
    page.value = 1;
  },
);

onMounted(async () => {
  // La bibliothèque renvoie ici avec le document à examiner.
  if (route.query.documentId) filtres.value.documentId = String(route.query.documentId);
  await charger();
});
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
