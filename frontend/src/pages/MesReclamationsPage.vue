<template>
  <q-page class="q-pa-md">
    <section-navigation section="procedures" />
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('mesReclamations.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('mesReclamations.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('mesReclamations.actions.new')"
          @click="creationOuverte = true"
        />
      </div>
    </div>

    <q-banner v-if="rolePasBon" class="note--info q-mb-md">
      {{ $t('mesReclamations.banner.wrongRole', { role: auth.utilisateur?.role, registry: $t('mesReclamations.banner.goToRegistry') }) }}
      <template #action>
        <q-btn
          flat
          no-caps
          icon="support_agent"
          :label="$t('mesReclamations.banner.goToRegistry')"
          :to="{ name: 'reclamations' }"
        />
      </template>
    </q-banner>

    <div v-if="!rolePasBon" class="resume-liste" role="status">
      <span v-for="s in plaques" :key="s.cle">{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span>
    </div>

    <filter-bar
      v-if="!rolePasBon"
      v-model="filtres"
      :placeholder="$t('mesReclamations.filters.searchPlaceholder')"
      :recherche="true"
      @reinitialiser="filtres = { recherche: '' }; pagination.page = 1; requeter()"
    >
      <template #principaux>
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUTS"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('mesReclamations.filters.status')"
        />
      </template>
      <template #avances>

        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('mesReclamations.filters.type')"
        />
        <q-select
          v-model="filtres.priorite"
          :options="OPTIONS_PRIORITES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('mesReclamations.filters.priority')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      v-if="!rolePasBon"
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; requeter()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; requeter()"
      @tous="chargerTout"
    />

    <q-table
      v-if="!rolePasBon && modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="reclamations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || reclamations.length > 0"
      @row-click="(_, row) => ouvrir(row)"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          {{ $t('mesReclamations.emptyState.description') }}
        </div>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="reclamation-statut" :class="`statut-${p.row.statut}`">
            <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-priorite="p">
        <q-td :props="p">
          <span class="reclamation-prio" :class="`prio-${p.row.priorite}`">
            <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('mesReclamations.table.openTracking')"
            @click.stop="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('mesReclamations.table.trackingTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else-if="!rolePasBon" class="row q-col-gutter-md">
      <div v-for="r in reclamations" :key="r.id" class="col-12 col-md-6">
        <q-card flat bordered class="carte reclamation-carte">
          <q-card-section class="row items-start">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ r.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ r.sujet }}</div>
              <div class="text-caption text-grey-7">{{ libelleType(r.type) }}</div>
            </div>
            <div class="column items-end q-gutter-xs">
              <span class="reclamation-statut" :class="`statut-${r.statut}`">
                <span class="pochoir">{{ libelleStatut(r.statut) }}</span>
              </span>
              <span class="reclamation-prio" :class="`prio-${r.priorite}`">
                <span class="pochoir">{{ libellePriorite(r.priorite) }}</span>
              </span>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(r.creeLe) }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="chat" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ $t('mesReclamations.cards.messagesCount', { count: r._count?.messages ?? 0 }) }}</span>
            </div>
            <div v-if="r.escaladeLe" class="row items-center text-warning">
              <q-icon name="priority_high" size="16px" class="q-mr-sm" />
              <span class="text-caption">{{ $t('mesReclamations.cards.escalatedOn', { date: dateHeureLisible(r.escaladeLe) }) }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="visibility" :label="$t('mesReclamations.cards.detail')" @click="ouvrir(r)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!chargement && !reclamations.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="forum" size="42px" color="grey-5" />
        <div class="q-mt-sm">
          {{ $t('mesReclamations.emptyState.description') }}
        </div>
        <q-btn
          class="q-mt-md"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('mesReclamations.actions.new')"
          @click="creationOuverte = true"
        />
      </div>
    </div>

    <reclamation-dialog v-model="creationOuverte" @creee="onCreee" />
    <reclamation-detail-dialog
      v-model="detailOuvert"
      :reclamation="reclamationSelectionnee"
      @change="onChange"
    />
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '../components/SectionNavigation.vue';
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, ref, watch } from 'vue';
import { type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ReclamationDialog from '../components/ReclamationDialog.vue';
import ReclamationDetailDialog from '../components/ReclamationDetailDialog.vue';
import {
  LIBELLE_PRIORITE_RECLAMATION,
  LIBELLE_STATUT_RECLAMATION,
  LIBELLE_TYPE_RECLAMATION,
  dateHeureLisible,
  optionsDepuis,
} from '../utils/libelles';
import type {
  PrioriteReclamation,
  Reclamation,
  StatutReclamation,
  TypeReclamation,
} from '../types';

const auth = useAuthStore();
const { t } = useI18n();

const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ETUDIANT');

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_RECLAMATION);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_RECLAMATION);
const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);

const reclamations = ref<Reclamation[]>([]);
const stats = ref<Record<string, number> | null>(null);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });
const modeVue = usePresentationListe();
const chargement = ref(false);
const creationOuverte = ref(false);
const detailOuvert = ref(false);
const reclamationSelectionnee = ref<Reclamation | null>(null);

// Mêmes intitulés de statut que le registre de la scolarité.
const plaques = computed(() => [
  { cle: 'OUVERTE', libelle: t('mesReclamations.stats.labels.open') },
  { cle: 'EN_COURS', libelle: t('mesReclamations.stats.labels.inProgress') },
  { cle: 'EN_ATTENTE_REPONSE', libelle: t('mesReclamations.stats.labels.awaitingReply') },
  { cle: 'RESOLUE', libelle: t('mesReclamations.stats.labels.resolved') },
]);

function libelleStatut(s: string) {
  return LIBELLE_STATUT_RECLAMATION[s as StatutReclamation] ?? s;
}
function libelleType(t: string) {
  return LIBELLE_TYPE_RECLAMATION[t as TypeReclamation] ?? t;
}
function libellePriorite(p: string) {
  return LIBELLE_PRIORITE_RECLAMATION[p as PrioriteReclamation] ?? p;
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('mesReclamations.table.columns.number'), field: 'numero', align: 'left', sortable: true },
  { name: 'sujet', label: t('mesReclamations.table.columns.subject'), field: 'sujet', align: 'left' },
  { name: 'type', label: t('mesReclamations.table.columns.type'), field: 'type', align: 'left' },
  { name: 'priorite', label: t('mesReclamations.table.columns.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('mesReclamations.table.columns.status'), field: 'statut', align: 'left' },
  {
    name: 'creeLe',
    label: t('mesReclamations.table.columns.createdAt'),
    field: 'creeLe',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ouvrir(r: Reclamation) {
  reclamationSelectionnee.value = r;
  detailOuvert.value = true;
}

async function requeter() {
  if (auth.utilisateur?.role !== 'ETUDIANT') return;
  chargement.value = true;
  try {
    const f = filtres.value;
    const { data } = await api.get('/reclamations/me', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        statut: f.statut || undefined,
        type: f.type || undefined,
        priorite: f.priorite || undefined,
        search: (f.recherche ?? '').toString().trim() || undefined,
      },
    });
    reclamations.value = data.data;
    pagination.value.total = data.total;

    // Compteurs calculés sur les réclamations affichées (l'API étudiante ne
    // fournit pas de tableau de bord dédié).
    const counts: Record<string, number> = {
      OUVERTE: 0,
      EN_COURS: 0,
      EN_ATTENTE_REPONSE: 0,
      RESOLUE: 0,
    };
    for (const r of reclamations.value) {
      if (counts[r.statut] != null) counts[r.statut]++;
    }
    stats.value = counts;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await requeter();
}

function onCreee() {
  void requeter();
}

function onChange() {
  void requeter();
}

watch(
  () => [filtres.value.recherche, filtres.value.statut, filtres.value.type, filtres.value.priorite],
  () => {
    pagination.value.page = 1;
    void requeter();
  },
);

onMounted(() => {
  void requeter();
});
</script>

<style scoped lang="scss">
$encre: #1D1D1F;
$chaux-claire: #FFFFFF;
$vert: #007A4D;
$jaune-fonce: #8A6300;
$rouge: #CE1126;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}

.reclamation-prio {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  border-radius: var(--up-rayon-sm);
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;

  &.prio-BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
  }
  &.prio-NORMALE { background: $jaune-fond; color: $jaune-texte; }
  &.prio-HAUTE { background: $rouge-fond; color: #{$rouge}; }
  &.prio-URGENTE {
    background: $rouge-fond; color: #{$rouge};
    color: var(--up-encre);
    animation: clignote 1.4s ease-in-out infinite;
  }
}

.reclamation-statut {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: var(--up-encre);
  border-radius: var(--up-rayon-sm);
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;

  &.statut-OUVERTE { background: $jaune-fond; color: $jaune-texte; }
  &.statut-EN_COURS { background: $vert-fond; color: $vert-lien; }
  &.statut-EN_ATTENTE_REPONSE { background: var(--up-gris-inerte); color: var(--up-encre-douce); }
  &.statut-RESOLUE { background: $vert-fond; color: #{$vert}; }
  &.statut-FERMEE { background: var(--up-gris-inerte); color: var(--up-encre-douce); }
  &.statut-REJETEE { background: $rouge-fond; color: #{$rouge}; }
}

.reclamation-carte { background: var(--up-plaque); }

@keyframes clignote {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
