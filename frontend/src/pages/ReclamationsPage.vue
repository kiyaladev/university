<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Réclamations & requêtes</div>
        <div class="page-sous-titre">
          Guichet unique des doléances étudiantes — note manquante, erreur de
          saisie, scolarité, enseignement. Chaque réclamation suit un cycle
          tracé : de l'ouverture à la clôture, en passant par l'assignation et
          l'escalade automatique à 48 h.
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

    <div class="row q-col-gutter-md q-mb-md">
      <div v-for="s in plaques" :key="s.cle" class="col-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres" :class="{ 'text-warning': s.alerte }">
              {{ stats?.[s.cle] ?? 0 }}
            </div>
            <div class="pochoir text-grey-7">{{ s.libelle }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (N°, sujet, nom…)"
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
        <autocomplete-async
          v-model="filtres.departementId"
          endpoint="/departements"
          :label-fn="(d) => `${d.code} — ${d.nom}`"
          label="Département"
        />
        <autocomplete-async
          v-model="filtres.assigneAId"
          endpoint="/utilisateurs"
          :label-fn="(u) => `${u.prenom} ${u.nom} (${u.role})`"
          label="Assigné à"
        />
        <q-select
          v-model="filtres.escalade"
          :options="OPTIONS_ESCALADE"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Escalade"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="reclamations.admin"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; requeter()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; requeter()"
      @tous="chargerTout"
    />

    <q-table
      v-if="modeVue === 'tableau'"
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
          Aucune réclamation pour ces critères. Réinitialisez les filtres ou
          ouvrez une réclamation au nom d'un étudiant.
        </div>
      </template>
      <template #body-cell-numero="p">
        <q-td :props="p" class="text-weight-medium">{{ p.row.numero }}</q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
      </template>
      <template #body-cell-priorite="p">
        <q-td :props="p">
          <span class="reclamation-prio" :class="`prio-${p.row.priorite}`">
            <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="reclamation-statut" :class="`statut-${p.row.statut}`">
            <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-auteur="p">
        <q-td :props="p">
          <span v-if="p.row.anonyme">Anonyme</span>
          <span v-else-if="p.row.etudiant">
            {{ p.row.etudiant.prenom }} {{ p.row.etudiant.nom }}
          </span>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>
      <template #body-cell-activite="p">
        <q-td :props="p">
          <div>{{ dateHeureLisible(p.row.creeLe) }}</div>
          <div v-if="p.row.escaladeLe" class="text-caption text-warning">
            <q-icon name="priority_high" size="14px" /> Escaladée {{ dateHeureLisible(p.row.escaladeLe) }}
          </div>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            aria-label="Ouvrir le détail de la réclamation"
            @click.stop="ouvrir(p.row)"
          >
            <q-tooltip>Détail, fil de discussion et assignation</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.aRole(['ADMIN', 'DIRECTION']) && p.row.statut !== 'FERMEE' && p.row.statut !== 'REJETEE' && p.row.statut !== 'RESOLUE'"
            flat
            dense
            round
            icon="priority_high"
            color="warning"
            aria-label="Escalader la réclamation"
            @click.stop="escalader(p.row)"
          >
            <q-tooltip>Escalader</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="r in reclamations" :key="r.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte reclamation-carte">
          <q-card-section class="row items-start q-pb-sm">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ r.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">
                {{ r.sujet }}
              </div>
              <div class="text-caption text-grey-7 q-mt-xs">{{ libelleType(r.type) }}</div>
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
              <q-icon name="person" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">
                <span v-if="r.anonyme">Anonyme</span>
                <span v-else-if="r.etudiant">{{ r.etudiant.prenom }} {{ r.etudiant.nom }}</span>
                <span v-else>—</span>
              </span>
            </div>
            <div v-if="r.departement" class="row items-center">
              <q-icon name="account_balance" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ r.departement.nom }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="chat" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ r._count?.messages ?? 0 }} message(s)</span>
            </div>
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(r.creeLe) }}</span>
            </div>
            <div v-if="r.escaladeLe" class="row items-center text-warning">
              <q-icon name="priority_high" size="16px" class="q-mr-sm" />
              <span class="text-caption">Escaladée {{ dateHeureLisible(r.escaladeLe) }}</span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-px-md">
            <q-btn flat dense no-caps icon="visibility" label="Détail" @click="ouvrir(r)" />
            <q-btn
              v-if="auth.aRole(['ADMIN', 'DIRECTION']) && r.statut !== 'FERMEE' && r.statut !== 'REJETEE' && r.statut !== 'RESOLUE'"
              flat
              dense
              no-caps
              color="warning"
              icon="priority_high"
              label="Escalader"
              @click="escalader(r)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!chargement && !reclamations.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="forum" size="42px" color="grey-5" />
        <div class="q-mt-sm">
          Aucune réclamation pour ces critères. Réinitialisez les filtres ou
          ouvrez une réclamation au nom d'un étudiant.
        </div>
      </div>
    </div>

    <reclamation-dialog v-model="creationOuverte" @creee="onCreee" />
    <reclamation-detail-dialog
      v-model="detailOuvert"
      :reclamation="reclamationSelectionnee"
      :membres-staff="membresStaff"
      @change="onChange"
      @assigne="onChange"
      @escalade="onChange"
      @cloture="onChange"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
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
  Utilisateur,
} from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_RECLAMATION);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_RECLAMATION);
const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);
const OPTIONS_ESCALADE = [
  { label: 'Toutes', value: '' },
  { label: 'Escaladées', value: 'oui' },
  { label: 'Non escaladées', value: 'non' },
];

const reclamations = ref<Reclamation[]>([]);
const stats = ref<Record<string, number> | null>(null);
const membresStaff = ref<Utilisateur[]>([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const chargement = ref(false);
const creationOuverte = ref(false);
const detailOuvert = ref(false);
const reclamationSelectionnee = ref<Reclamation | null>(null);

// Seuls les compteurs qui appellent une action sont mis en alerte.
const plaques = [
  { cle: 'OUVERTE', libelle: 'Ouvertes', alerte: false },
  { cle: 'EN_ATTENTE_REPONSE', libelle: 'Attente réponse', alerte: false },
  { cle: 'urgentes', libelle: 'Urgentes', alerte: true },
  { cle: 'delaiDepasse', libelle: 'Délai dépassé', alerte: true },
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
  { name: 'auteur', label: 'Auteur', field: 'auteur', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'activite', label: 'Activité', field: 'creeLe', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(r: Reclamation) {
  reclamationSelectionnee.value = r;
  detailOuvert.value = true;
}

async function requeter() {
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return;
  chargement.value = true;
  try {
    const f = filtres.value;
    const { data } = await api.get('/reclamations', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        statut: f.statut || undefined,
        type: f.type || undefined,
        priorite: f.priorite || undefined,
        departementId: f.departementId || undefined,
        assigneAId: f.assigneAId || undefined,
        escalade: f.escalade || undefined,
        search: (f.recherche ?? '').toString().trim() || undefined,
      },
    });
    reclamations.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await requeter();
}

async function chargerStats() {
  // Même périmètre que /reclamations/dashboard côté API.
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return;
  try {
    const { data } = await api.get('/reclamations/dashboard');
    stats.value = data;
  } catch {
    /* silencieux */
  }
}

async function chargerStaff() {
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return;
  try {
    const { data } = await api.get('/utilisateurs', {
      params: { all: '1', actif: 'true' },
    });
    membresStaff.value = (Array.isArray(data) ? data : data.data ?? []).filter((u: Utilisateur) =>
      ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'].includes(u.role),
    );
  } catch {
    membresStaff.value = [];
  }
}

function onCreee() {
  void requeter();
  void chargerStats();
}

function onChange() {
  void requeter();
  void chargerStats();
}

async function escalader(r: Reclamation) {
  try {
    await api.post(`/reclamations/${r.id}/escalader`);
    $q.notify({ type: 'warning', message: `Réclamation ${r.numero} escaladée` });
    await requeter();
    await chargerStats();
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e.response?.data?.message ?? 'Escalade impossible',
    });
  }
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.statut,
    filtres.value.type,
    filtres.value.priorite,
    filtres.value.departementId,
    filtres.value.assigneAId,
    filtres.value.escalade,
  ],
  () => {
    pagination.value.page = 1;
    void requeter();
  },
);

onMounted(() => {
  void requeter();
  void chargerStats();
  void chargerStaff();
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