<script setup lang="ts">
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import BadgeDialog from '../components/BadgeDialog.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import type { BadgeAcces } from '../types';
import { ouvrirImpression } from '../services/impression';
import {
  LIBELLE_STATUT_BADGE,
  LIBELLE_TYPE_BADGE,
  dateLisible,
  optionsDepuis,
} from '../utils/libelles';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const filtres = ref<Record<string, any>>({ recherche: '', type: null, statut: null });
const liste = reactive(
  useListePaginee<BadgeAcces>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/badges', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            type: f.type || undefined,
            statut: f.statut || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

const modeVue = usePresentationListe();

const peutEditer = computed(() => auth.peut('badges.editer'));

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
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
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
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
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
</script>

<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('badges.title')" :subtitle="$t('badges.subtitle')">
      <template v-if="peutEditer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('badges.actions.issueBadge')"
          @click="ouvrirEdition()"
        />
      </template>
    </page-header>

    <filter-bar v-model="filtres" :placeholder="$t('badges.filters.searchPlaceholder')">
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
        />
      </template>
    </filter-bar>

    <pagination-bar v-model:page="liste.page" v-model:page-size="liste.pageSize" :total="liste.total" :show-all="false" />

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
    >
      <template #no-data>
        <etat-vide icone="how_to_reg" :titre="$t('badges.emptyState.message')" />
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
          {{ dateLisible(p.row.dateDelivrance) }} → {{ dateLisible(p.row.dateValidite) }}
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
<q-btn flat no-caps dense icon="print" :aria-label="$t('badges.aria.printBadge')" :label="$t('badges.aria.printBadge')" @click="imprimer(p.row)">
            <q-tooltip>{{ $t('badges.tooltips.print') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            v-if="peutEditer"
            flat no-caps
            dense
            icon="edit"
            :aria-label="$t('badges.aria.editBadge')" :label="$t('badges.aria.editBadge')"
            @click="ouvrirEdition(p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.edit') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat no-caps
            dense
            icon="schedule"
            :aria-label="$t('badges.aria.extendBadge')" :label="$t('badges.aria.extendBadge')"
            @click="ouvrirRallonge(p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.extend') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat no-caps
            dense
            icon="block"
            color="negative"
            :aria-label="$t('badges.aria.cancelBadge')" :label="$t('badges.aria.cancelBadge')"
            @click="ouvrirAnnulation(p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.cancel') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
<div v-for="b in liste.lignes" :key="b.id" class="col-12 col-sm-6 col-md-4">
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
              {{ $t('badges.card.issuedOn', { date: dateLisible(b.dateDelivrance) }) }}<br>
              <i18n-t keypath="badges.card.validUntil" tag="span">
                <template #date><strong>{{ dateLisible(b.dateValidite) }}</strong></template>
              </i18n-t>
            </div>
            <div class="q-mt-sm"><code>{{ b.numero }}</code></div>
            <div v-if="b.statut === 'ANNULE' && b.motif" class="q-mt-sm text-grey-7">
              {{ $t('badges.card.cancelReason', { reason: b.motif }) }}
            </div>
          </q-card-section>
          <q-card-actions align="right">
<q-btn flat dense icon="print" :label="$t('badges.actions.print')" no-caps @click="imprimer(b)" />
<actions-secondaires>
<q-btn v-close-popup
              v-if="peutEditer"
              flat
              dense
              icon="edit"
              :label="$t('badges.actions.edit')"
              no-caps
              @click="ouvrirEdition(b)"
            />
<q-btn v-close-popup
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="schedule"
              :label="$t('badges.actions.extend')"
              no-caps
              @click="ouvrirRallonge(b)"
            />
<q-btn v-close-popup
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="block"
              color="negative"
              :label="$t('badges.actions.cancel')"
              no-caps
              @click="ouvrirAnnulation(b)"
            />
</actions-secondaires>
</q-card-actions>
        </q-card>
      </div>
      <etat-vide v-if="!liste.chargement && !liste.lignes.length" class="col-12" icone="how_to_reg" :titre="$t('badges.emptyState.message')" />
    </div>

    <badge-dialog v-model="dialogEdition" :badge="badgeEnEdition" @enregistre="liste.recharger()" />

    <dialogue-formulaire
      v-model="dialogAnnulation"
      :titre="$t('badges.dialogs.cancel.title')"
      :sous-titre="badgeAnnulation ? `${badgeAnnulation.prenom} ${badgeAnnulation.nom} · ${badgeAnnulation.numero}` : undefined"
      taille="s"
      :libelle-valider="$t('badges.dialogs.cancel.confirmAction')"
      couleur-valider="negative"
      :desactive="motifAnnulation.trim().length < 3"
      @valider="confirmerAnnulation"
    >
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
    </dialogue-formulaire>

    <dialogue-formulaire
      v-model="dialogRallonge"
      :titre="$t('badges.dialogs.extend.title')"
      :sous-titre="badgeRallonge ? `${badgeRallonge.prenom} ${badgeRallonge.nom} · ${badgeRallonge.numero}` : undefined"
      taille="s"
      :libelle-valider="$t('badges.dialogs.extend.confirmAction')"
      :desactive="!dateRallonge"
      @valider="confirmerRallonge"
    >
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
    </dialogue-formulaire>
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
