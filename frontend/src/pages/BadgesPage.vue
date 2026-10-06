<script setup lang="ts">
import ParcoursMetier from '../components/ParcoursMetier.vue';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import BadgeDialog from '../components/BadgeDialog.vue';
import type { BadgeAcces, TypeBadge } from '../types';
import { ouvrirImpression } from '../services/impression';
import {
  LIBELLE_STATUT_BADGE,
  LIBELLE_TYPE_BADGE,
  optionsDepuis,
} from '../utils/libelles';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const badges = ref<BadgeAcces[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '', type: null, statut: null });

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEditer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const OPTIONS_TYPE = optionsDepuis(LIBELLE_TYPE_BADGE);
const OPTIONS_STATUT = optionsDepuis(LIBELLE_STATUT_BADGE);

const CLASSE_STATUT: Record<string, string> = {
  ACTIF: 'badge--ok',
  EXPIRE: 'badge--attention',
  ANNULE: 'badge--ko',
};

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('badges.table.columns.number'), field: 'numero', align: 'left' },
  { name: 'type', label: t('badges.table.columns.type'), field: 'type', align: 'left' },
  { name: 'identite', label: t('badges.table.columns.identity'), field: 'nom', align: 'left' },
  {
    name: 'organisation',
    label: t('badges.table.columns.organization'),
    field: 'organisation',
    align: 'left',
  },
  { name: 'validite', label: t('badges.table.columns.validity'), field: 'dateValidite', align: 'left' },
  { name: 'statut', label: t('badges.table.columns.status'), field: 'statut', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const dialogEdition = ref(false);
const badgeEnEdition = ref<BadgeAcces | null>(null);

const dialogAnnulation = ref(false);
const badgeAnnulation = ref<BadgeAcces | null>(null);
const motifAnnulation = ref('');

const dialogRallonge = ref(false);
const badgeRallonge = ref<BadgeAcces | null>(null);
const dateRallonge = ref<string | null>(null);

function ouvrirEdition(b?: BadgeAcces) {
  badgeEnEdition.value = b ?? null;
  dialogEdition.value = true;
}

function imprimer(b: BadgeAcces) {
  void ouvrirImpression(`/badges/${b.id}/imprimer`);
}

function ouvrirAnnulation(b: BadgeAcces) {
  badgeAnnulation.value = b;
  motifAnnulation.value = '';
  dialogAnnulation.value = true;
}

async function confirmerAnnulation() {
  if (!badgeAnnulation.value || motifAnnulation.value.trim().length < 3) return;
  try {
    await api.post(`/badges/${badgeAnnulation.value.id}/annuler`, {
      motif: motifAnnulation.value.trim(),
    });
    $q.notify({ type: 'warning', message: t('badges.messages.cancelled') });
    dialogAnnulation.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? t('badges.messages.cancelFailed'),
    });
  }
}

function ouvrirRallonge(b: BadgeAcces) {
  badgeRallonge.value = b;
  dateRallonge.value = '';
  dialogRallonge.value = true;
}

async function confirmerRallonge() {
  if (!badgeRallonge.value || !dateRallonge.value) return;
  try {
    await api.post(`/badges/${badgeRallonge.value.id}/rallonger`, { dateValidite: dateRallonge.value });
    $q.notify({ type: 'positive', message: t('badges.messages.extended') });
    dialogRallonge.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? t('badges.messages.extendFailed'),
    });
  }
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    if (filtres.value.recherche) params.search = filtres.value.recherche;
    if (filtres.value.type) params.type = filtres.value.type;
    if (filtres.value.statut) params.statut = filtres.value.statut;
    const { data } = await api.get('/badges', { params });
    badges.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR');
}

/**
 * La liste renvoie le statut stocké : le passage à EXPIRE n'est calculé par
 * l'API qu'à l'ouverture d'un badge. On applique ici la même règle pour ne pas
 * afficher « Actif » sur un badge dont la date est passée.
 */
function statutEffectif(b: BadgeAcces): string {
  if (b.statut === 'ANNULE') return 'ANNULE';
  return new Date(b.dateValidite) < new Date() ? 'EXPIRE' : 'ACTIF';
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('badges.title')" :subtitle="$t('badges.subtitle')">
      <template #actions>
<div class="col-auto">
        <q-btn
          v-if="peutEditer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('badges.actions.issueBadge')"
          @click="ouvrirEdition()"
        />
      </div>
      </template>
    </page-header>

    <parcours-metier parcours="documents" />

    <filter-bar
      v-model="filtres"
      :placeholder="$t('badges.filters.searchPlaceholder')"
      @update:model-value="recharger"
    >
      <template #actions>
        <view-toggle
          cle="badges"
          :modes="['tableau', 'cartes']"
          :defaut="modeVue"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          :label="$t('badges.filters.type')"
          outlined
          dense
          clearable
          @update:model-value="recharger"
        />
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUT"
          emit-value
          map-options
          :label="$t('badges.filters.status')"
          outlined
          dense
          clearable
          @update:model-value="recharger"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; charger()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; charger()"
    />

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="badges"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || badges.length > 0"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          {{ $t('badges.emptyState.message') }}
        </div>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_BADGE[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-identite="p">
        <q-td :props="p">
          <strong>{{ p.row.prenom }} {{ p.row.nom }}</strong>
          <div v-if="p.row.fonction" class="text-caption text-grey-7">{{ p.row.fonction }}</div>
        </q-td>
      </template>
      <template #body-cell-organisation="p">
        <q-td :props="p">{{ p.row.organisation ?? '—' }}</q-td>
      </template>
      <template #body-cell-validite="p">
        <q-td :props="p">
          {{ dateFr(p.row.dateDelivrance) }} → {{ dateFr(p.row.dateValidite) }}
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-statut" :class="CLASSE_STATUT[statutEffectif(p.row)]">
            <span class="pochoir">{{ LIBELLE_STATUT_BADGE[statutEffectif(p.row)] }}</span>
          </span>
          <div v-if="p.row.statut === 'ANNULE' && p.row.motif" class="text-caption text-grey-7">
            {{ p.row.motif }}
          </div>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat round dense icon="print" :aria-label="$t('badges.aria.printBadge')" @click="imprimer(p.row)">
            <q-tooltip>{{ $t('badges.tooltips.print') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer"
            flat
            round
            dense
            icon="edit"
            :aria-label="$t('badges.aria.editBadge')"
            @click="ouvrirEdition(p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat
            round
            dense
            icon="schedule"
            :aria-label="$t('badges.aria.extendBadge')"
            @click="ouvrirRallonge(p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.extend') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat
            round
            dense
            icon="block"
            color="negative"
            :aria-label="$t('badges.aria.cancelBadge')"
            @click="ouvrirAnnulation(p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.cancel') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="b in badges" :key="b.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="badge-carte">
          <q-card-section class="row items-center q-gutter-sm">
            <q-avatar size="56px" color="grey-3" text-color="primary">
              <img v-if="b.photoUrl" :src="b.photoUrl" :alt="`${b.prenom} ${b.nom}`" />
              <q-icon v-else name="badge" size="32px" />
            </q-avatar>
            <div class="col">
              <div class="text-weight-bold">{{ b.prenom }} {{ b.nom }}</div>
              <div class="text-caption text-grey-7">{{ b.organisation ?? '—' }}</div>
            </div>
            <span class="champ champ-statut" :class="CLASSE_STATUT[statutEffectif(b)]">
              <span class="pochoir">{{ LIBELLE_STATUT_BADGE[statutEffectif(b)] }}</span>
            </span>
          </q-card-section>
          <q-separator />
          <q-card-section class="text-caption">
            <q-chip dense :color="b.type === 'VIP' ? 'amber-7' : 'primary'" text-color="white">
              {{ LIBELLE_TYPE_BADGE[b.type] ?? b.type }}
            </q-chip>
            <div class="q-mt-sm">
              {{ $t('badges.card.issuedOn', { date: dateFr(b.dateDelivrance) }) }}<br>
              <i18n-t keypath="badges.card.validUntil" tag="span">
                <template #date><strong>{{ dateFr(b.dateValidite) }}</strong></template>
              </i18n-t>
            </div>
            <div class="q-mt-sm"><code>{{ b.numero }}</code></div>
            <div v-if="b.statut === 'ANNULE' && b.motif" class="q-mt-sm text-grey-7">
              {{ $t('badges.card.cancelReason', { reason: b.motif }) }}
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense icon="print" :label="$t('badges.actions.print')" no-caps @click="imprimer(b)" />
            <q-btn
              v-if="peutEditer"
              flat
              dense
              icon="edit"
              :label="$t('badges.actions.edit')"
              no-caps
              @click="ouvrirEdition(b)"
            />
            <q-btn
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="schedule"
              :label="$t('badges.actions.extend')"
              no-caps
              @click="ouvrirRallonge(b)"
            />
            <q-btn
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="block"
              color="negative"
              :label="$t('badges.actions.cancel')"
              no-caps
              @click="ouvrirAnnulation(b)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!chargement && !badges.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="how_to_reg" size="42px" color="grey-5" />
        <div class="q-mt-sm">
          {{ $t('badges.emptyState.message') }}
        </div>
      </div>
    </div>

    <badge-dialog v-model="dialogEdition" :badge="badgeEnEdition" @enregistre="charger" />

    <q-dialog v-model="dialogAnnulation">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ $t('badges.dialogs.cancel.title') }}</div>
            <div v-if="badgeAnnulation" class="text-caption text-grey-7">
              {{ badgeAnnulation.prenom }} {{ badgeAnnulation.nom }} · {{ badgeAnnulation.numero }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('badges.aria.close')" @click="dialogAnnulation = false" />
        </q-card-section>
        <q-card-section>
          <q-banner class="note--alerte q-mb-md">
            {{ $t('badges.dialogs.cancel.warning') }}
          </q-banner>
          <q-input
            v-model="motifAnnulation"
            :label="$t('badges.dialogs.cancel.reasonLabel')"
            :hint="$t('badges.dialogs.cancel.reasonHint')"
            outlined
            dense
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('badges.dialogs.cancel.cancelAction')" no-caps @click="dialogAnnulation = false" />
          <q-btn
            unelevated
            color="negative"
            no-caps
            :label="$t('badges.dialogs.cancel.confirmAction')"
            :disable="motifAnnulation.trim().length < 3"
            @click="confirmerAnnulation"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogRallonge">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ $t('badges.dialogs.extend.title') }}</div>
            <div v-if="badgeRallonge" class="text-caption text-grey-7">
              {{ badgeRallonge.prenom }} {{ badgeRallonge.nom }} · {{ badgeRallonge.numero }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('badges.aria.close')" @click="dialogRallonge = false" />
        </q-card-section>
        <q-card-section>
          <q-banner class="note--info q-mb-md">
            {{ $t('badges.dialogs.extend.info') }}
          </q-banner>
          <q-input
            v-model="dateRallonge"
            type="date"
            :label="$t('badges.dialogs.extend.newValidityDateLabel')"
            outlined
            dense
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('badges.dialogs.extend.cancelAction')" no-caps @click="dialogRallonge = false" />
          <q-btn
            unelevated
            color="primary"
            no-caps
            :label="$t('badges.dialogs.extend.confirmAction')"
            :disable="!dateRallonge"
            @click="confirmerRallonge"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
/* Pas d'arrondi : le badge est une plaque, comme les cartes étudiantes. */
.badge-carte {
  border: var(--up-filet-fin);
  height: 100%;
  background: var(--up-plaque);
}

/* Pastille de statut : même gabarit que sur les cartes étudiantes. */
.champ-statut {
  display: inline-flex;
  padding: 3px 8px;
  min-height: 24px;
}
.badge--ok { background: #f1fbf2; color: #027a0b; }
.badge--ko { background: #fff1f2; color: #c10000; }
.badge--attention { background: #fff6ef; color: #b64400; }
</style>
