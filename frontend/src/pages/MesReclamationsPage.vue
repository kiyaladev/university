<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Mes réclamations</div>
        <div class="page-sous-titre">
          Le guichet unique pour vos doléances : note manquante, erreur de
          saisie, scolarité, enseignement. Chaque réclamation suit un cycle tracé
          et peut être anonyme si vous préférez.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle réclamation"
          @click="creationOuverte = true"
        />
      </div>
    </div>

    <q-banner v-if="rolePasBon" class="note--info q-mb-md">
      Cette page est réservée aux comptes étudiants. Vous êtes connecté en
      {{ auth.utilisateur?.role }} — le registre complet se trouve sur
      « Réclamations & requêtes ».
      <template #action>
        <q-btn
          flat
          no-caps
          icon="support_agent"
          label="Réclamations & requêtes"
          :to="{ name: 'reclamations' }"
        />
      </template>
    </q-banner>

    <div v-if="!rolePasBon" class="row q-col-gutter-md q-mb-md">
      <div v-for="s in plaques" :key="s.cle" class="col-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats?.[s.cle] ?? 0 }}</div>
            <div class="pochoir text-grey-7">{{ s.libelle }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 text-caption text-grey-7">
        Compteurs calculés sur les réclamations affichées ci-dessous.
      </div>
    </div>

    <filter-bar
      v-if="!rolePasBon"
      v-model="filtres"
      placeholder="Rechercher (N°, sujet…)"
      :recherche="true"
      @reinitialiser="filtres = { recherche: '' }; pagination.page = 1; requeter()"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUTS"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Type"
        />
        <q-select
          v-model="filtres.priorite"
          :options="OPTIONS_PRIORITES"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Priorité"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="reclamations.moi"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
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
      hide-bottom
      @row-click="(_, row) => ouvrir(row)"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          Aucune réclamation pour ces critères. Ouvrez-en une si une note, une
          inscription ou un document pose problème : la scolarité vous répond
          dans le fil de discussion.
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
            aria-label="Ouvrir le suivi de la réclamation"
            @click.stop="ouvrir(p.row)"
          >
            <q-tooltip>Suivi et fil de discussion</q-tooltip>
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
              <span class="text-caption">{{ r._count?.messages ?? 0 }} message(s)</span>
            </div>
            <div v-if="r.escaladeLe" class="row items-center text-warning">
              <q-icon name="priority_high" size="16px" class="q-mr-sm" />
              <span class="text-caption">Escaladée le {{ dateHeureLisible(r.escaladeLe) }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="visibility" label="Détail" @click="ouvrir(r)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!chargement && !reclamations.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="forum" size="42px" color="grey-5" />
        <div class="q-mt-sm">
          Aucune réclamation pour ces critères. Ouvrez-en une si une note, une
          inscription ou un document pose problème : la scolarité vous répond
          dans le fil de discussion.
        </div>
        <q-btn
          class="q-mt-md"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle réclamation"
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
import { computed, onMounted, ref, watch } from 'vue';
import { type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
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

const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ETUDIANT');

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_RECLAMATION);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_RECLAMATION);
const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);

const reclamations = ref<Reclamation[]>([]);
const stats = ref<Record<string, number> | null>(null);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });
const modeVue = ref<'tableau' | 'cartes'>('cartes');
const chargement = ref(false);
const creationOuverte = ref(false);
const detailOuvert = ref(false);
const reclamationSelectionnee = ref<Reclamation | null>(null);

// Mêmes intitulés de statut que le registre de la scolarité.
const plaques = [
  { cle: 'OUVERTE', libelle: 'Ouvertes' },
  { cle: 'EN_COURS', libelle: 'En cours' },
  { cle: 'EN_ATTENTE_REPONSE', libelle: 'Attente réponse' },
  { cle: 'RESOLUE', libelle: 'Résolues' },
];

function libelleStatut(s: string) {
  return LIBELLE_STATUT_RECLAMATION[s as StatutReclamation] ?? s;
}
function libelleType(t: string) {
  return LIBELLE_TYPE_RECLAMATION[t as TypeReclamation] ?? t;
}
function libellePriorite(p: string) {
  return LIBELLE_PRIORITE_RECLAMATION[p as PrioriteReclamation] ?? p;
}

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  { name: 'sujet', label: 'Sujet', field: 'sujet', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'priorite', label: 'Priorité', field: 'priorite', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  {
    name: 'creeLe',
    label: 'Créée le',
    field: 'creeLe',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

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
$encre: #10251E;
$chaux-claire: #F2F3EE;
$vert: #0F7A45;
$jaune-fonce: #C98A00;
$rouge: #C4122E;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

.reclamation-prio {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &.prio-BASSE {
    background: $chaux-claire;
    color: $encre;
    border: 2px solid rgba(16, 37, 30, 0.45);
  }
  &.prio-NORMALE { background: #EFB700; color: $encre; }
  &.prio-HAUTE { background: $rouge; color: #fff; }
  &.prio-URGENTE {
    background: $rouge;
    color: #fff;
    animation: clignote 1.4s ease-in-out infinite;
  }
}

.reclamation-statut {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: #fff;
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &.statut-OUVERTE { background: $jaune-fonce; }
  &.statut-EN_COURS { background: $encre; }
  &.statut-EN_ATTENTE_REPONSE { background: #6b7280; }
  &.statut-RESOLUE { background: $vert; }
  &.statut-FERMEE { background: #4b5563; }
  &.statut-REJETEE { background: $rouge; }
}

.reclamation-carte { background: var(--up-plaque); }

@keyframes clignote {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>