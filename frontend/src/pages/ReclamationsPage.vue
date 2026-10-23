<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('reclamations.title')" :subtitle="$t('reclamations.subtitle')">
      <template #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('reclamations.actions.newReclamation')"
          @click="creationOuverte = true"
        />
      </template>
    </page-header>

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
      :placeholder="$t('reclamations.search.placeholder')"
      :recherche="true"
      @reinitialiser="liste.reinitialiser([])"
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
          :label="$t('reclamations.filters.statut')"
        />
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('reclamations.filters.type')"
        />
        <q-select
          v-model="filtres.priorite"
          :options="OPTIONS_PRIORITES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('reclamations.filters.priorite')"
        />
        <autocomplete-async
          v-model="filtres.departementId"
          endpoint="/departements"
          :label-fn="(d) => `${d.code} — ${d.nom}`"
          :label="$t('reclamations.filters.departement')"
        />
        <q-select
          v-model="filtres.assigneAId"
          :options="membresStaff.map((u) => ({ value: u.id, label: `${u.prenom} ${u.nom} (${u.role})` }))"
          outlined dense clearable emit-value map-options
          :label="$t('reclamations.filters.assigneA')"
        />
        <q-select
          v-model="filtres.escalade"
          :options="OPTIONS_ESCALADE"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('reclamations.filters.escalade')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
      @row-click="(_, row) => ouvrir(row)"
    >
      <template #no-data>
        <etat-vide icone="forum" :titre="$t('reclamations.emptyState.message')" />
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
          <span v-if="p.row.anonyme">{{ $t('reclamations.fields.anonyme') }}</span>
          <span v-else-if="p.row.etudiant">
            {{ p.row.etudiant.prenom }} {{ p.row.etudiant.nom }}
          </span>
          <span v-else-if="p.row.nomAuteur">{{ p.row.nomAuteur }}</span>
          <span v-else class="text-grey-7">{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>
      <template #body-cell-activite="p">
        <q-td :props="p">
          <div>{{ dateHeureLisible(p.row.creeLe) }}</div>
          <div v-if="p.row.escaladeLe" class="text-caption text-warning">
            <q-icon name="priority_high" size="14px" />
            {{ $t('reclamations.fields.escaladeeLe', { date: dateHeureLisible(p.row.escaladeLe) }) }}
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
            :aria-label="$t('reclamations.ariaLabels.openDetail')"
            @click.stop="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('reclamations.tooltips.detail') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.aRole(['ADMIN', 'DIRECTION']) && p.row.statut !== 'FERMEE' && p.row.statut !== 'REJETEE' && p.row.statut !== 'RESOLUE'"
            flat
            dense
            round
            icon="priority_high"
            color="warning"
            :aria-label="$t('reclamations.ariaLabels.escalate')"
            @click.stop="escalader(p.row)"
          >
            <q-tooltip>{{ $t('reclamations.tooltips.escalate') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="r in liste.lignes" :key="r.id" class="col-12 col-md-6 col-xl-4">
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
                <span v-if="r.anonyme">{{ $t('reclamations.fields.anonyme') }}</span>
                <span v-else-if="r.etudiant">{{ r.etudiant.prenom }} {{ r.etudiant.nom }}</span>
                <span v-else>{{ $t('rectoratPage.subtitleFallback') }}</span>
              </span>
            </div>
            <div v-if="r.departement" class="row items-center">
              <q-icon name="account_balance" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ r.departement.nom }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="chat" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{
                $t('reclamations.fields.messagesCount', { count: r._count?.messages ?? 0 })
              }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(r.creeLe) }}</span>
            </div>
            <div v-if="r.escaladeLe" class="row items-center text-warning">
              <q-icon name="priority_high" size="16px" class="q-mr-sm" />
              <span class="text-caption">{{
                $t('reclamations.fields.escaladeeLe', { date: dateHeureLisible(r.escaladeLe) })
              }}</span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-px-md">
            <q-btn
              flat
              dense
              no-caps
              icon="visibility"
              :label="$t('reclamations.actions.detail')"
              @click="ouvrir(r)"
            />
            <q-btn
              v-if="auth.aRole(['ADMIN', 'DIRECTION']) && r.statut !== 'FERMEE' && r.statut !== 'REJETEE' && r.statut !== 'RESOLUE'"
              flat
              dense
              no-caps
              color="warning"
              icon="priority_high"
              :label="$t('reclamations.actions.escalate')"
              @click="escalader(r)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!liste.chargement && !liste.lignes.length"
        class="col-12"
        icone="forum"
        :titre="$t('reclamations.emptyState.message')"
      />
    </div>

    <reclamation-dialog v-model="creationOuverte" @enregistre="onChange" />
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
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ReclamationDialog from '../components/ReclamationDialog.vue';
import ReclamationDetailDialog from '../components/ReclamationDetailDialog.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
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
const { t } = useI18n();
const auth = useAuthStore();

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_RECLAMATION);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_RECLAMATION);
const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);
const OPTIONS_ESCALADE = computed(() => [
  { label: t('reclamations.escaladeOptions.toutes'), value: '' },
  { label: t('reclamations.escaladeOptions.escaladees'), value: 'oui' },
  { label: t('reclamations.escaladeOptions.nonEscaladees'), value: 'non' },
]);

const stats = ref<Record<string, number> | null>(null);
const membresStaff = ref<Utilisateur[]>([]);
const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null,
  type: null,
  priorite: null,
  departementId: null,
  assigneAId: null,
  escalade: null,
});
const liste = reactive(
  useListePaginee<Reclamation>({
    filtres,
    actif: () => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']),
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/reclamations', {
          params: {
            ...pageApi(p),
            statut: f.statut || undefined,
            type: f.type || undefined,
            priorite: f.priorite || undefined,
            departementId: f.departementId || undefined,
            assigneAId: f.assigneAId || undefined,
            escalade: f.escalade || undefined,
            search: texteApi(f.recherche),
          },
        })
        .then((r) => r.data),
  }),
);
const modeVue = usePresentationListe();
const creationOuverte = ref(false);
const detailOuvert = ref(false);
const reclamationSelectionnee = ref<Reclamation | null>(null);

// Seuls les compteurs qui appellent une action sont mis en alerte.
const plaques = computed(() => [
  { cle: 'OUVERTE', libelle: t('reclamations.stats.ouvertes'), alerte: false },
  { cle: 'EN_ATTENTE_REPONSE', libelle: t('reclamations.stats.attenteReponse'), alerte: false },
  { cle: 'urgentes', libelle: t('reclamations.stats.urgentes'), alerte: true },
  { cle: 'delaiDepasse', libelle: t('reclamations.stats.delaiDepasse'), alerte: true },
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
  { name: 'numero', label: t('reclamations.table.columns.numero'), field: 'numero', align: 'left', sortable: true },
  { name: 'sujet', label: t('reclamations.table.columns.sujet'), field: 'sujet', align: 'left' },
  { name: 'type', label: t('reclamations.table.columns.type'), field: 'type', align: 'left' },
  { name: 'priorite', label: t('reclamations.table.columns.priorite'), field: 'priorite', align: 'left' },
  { name: 'auteur', label: t('reclamations.table.columns.auteur'), field: 'auteur', align: 'left' },
  { name: 'statut', label: t('reclamations.table.columns.statut'), field: 'statut', align: 'left' },
  { name: 'activite', label: t('reclamations.table.columns.activite'), field: 'creeLe', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ouvrir(r: Reclamation) {
  reclamationSelectionnee.value = r;
  detailOuvert.value = true;
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
    const { data } = await api.get('/reclamations/agents');
    membresStaff.value = (Array.isArray(data) ? data : data.data ?? []).filter((u: Utilisateur) =>
      ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'].includes(u.role),
    );
  } catch {
    membresStaff.value = [];
  }
}

function onChange() {
  void liste.recharger();
  void chargerStats();
}

async function escalader(r: Reclamation) {
  try {
    await api.post(`/reclamations/${r.id}/escalader`);
    $q.notify({ type: 'warning', message: t('reclamations.messages.escalated', { numero: r.numero }) });
    await liste.recharger();
    await chargerStats();
  } catch {
    /* notifié par l'intercepteur */
  }
}

onMounted(() => {
  void chargerStats();
  void chargerStaff();
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
