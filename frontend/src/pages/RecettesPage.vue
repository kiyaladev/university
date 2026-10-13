<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('recettes.title')" :subtitle="$t('recettes.subtitle')">
      <template #actions>
<div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('recettes.actions.issueRecette')"
          @click="ouvrirCreation"
        />
      </div>
      </template>
    </page-header>

    <div v-if="kpis" class="resume-liste" role="status">
      <span>{{ $t('recettes.kpis.totalMois.title') }} : <strong>{{ montantLisible(kpis.totalMois) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</strong></span>
      <span>{{ $t('recettes.kpis.totalAnnee.title', { annee: kpis.annee }) }} : <strong>{{ montantLisible(kpis.totalAnnee) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</strong></span>
    </div>

    <filter-bar
      v-model="filtres"
      :placeholder="$t('recettes.search.placeholder')"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #principaux>
        <q-select v-model="filtres.paiementStatut" :options="optionsPaiement" outlined dense clearable emit-value map-options :label="$t('recettes.filters.paiementStatut')" />
      </template>
      <template #avances>
        <q-select v-model="filtres.type" :options="optionsTypes" outlined dense clearable emit-value map-options :label="$t('recettes.filters.type')" />

        <champ-date v-model="filtres.dateDebut" :label="$t('recettes.filters.dateDebut')" />
        <champ-date v-model="filtres.dateFin" :label="$t('recettes.filters.dateFin')" />
      </template>
    </filter-bar>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ $t('recettes.period.summary', { periode: periodeLisible, total }) }}
    </div>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="recettes"
      :columns="colonnesTableau"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || recettes.length > 0"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge color="primary" :label="libelleType(p.row.type)" />
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="p.row.paiementId ? 'champ--validee' : 'champ--brouillon'">
            {{ p.row.paiementId ? $t('recettes.status.encaissee') : $t('recettes.status.aEncaisser') }}
          </span>
        </q-td>
      </template>
      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right text-weight-medium chiffres">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            flat
            dense no-caps
            icon="visibility"
            color="primary"
            :aria-label="$t('recettes.ariaLabels.detail', { numero: p.row.numero })" :label="$t('recettes.ariaLabels.detail', { numero: p.row.numero })"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('recettes.tooltips.detail') }}</q-tooltip>
          </q-btn>
<q-btn
            v-if="!p.row.paiementId && peutEncaisser"
            flat
            dense
            no-caps
            color="positive"
            icon="payments"
            :label="$t('recettes.actions.cash')"
            :disable="encaissementEnCours || dialogEncaissementOuvert"
            @click.stop="encaisser(p.row)"
          />
<actions-secondaires>
<q-btn v-close-popup
            v-if="p.row.paiementId"
            flat
            dense
            no-caps
            color="primary"
            icon="receipt_long"
            :label="$t('recettes.actions.viewPayment')"
            to="/paiements"
            @click.stop
          >
            <q-tooltip>{{ $t('recettes.tooltips.voirPaiement') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="request_quote" size="36px" />
          <div class="text-subtitle2 q-mt-sm">{{ $t('recettes.emptyState.title') }}</div>
          <div class="text-caption">
            {{ $t('recettes.emptyState.message') }}
          </div>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('recettes.actions.issueRecette')"
            @click="ouvrirCreation"
          />
        </div>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="r in recettes" :key="r.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte recette-carte full-height" @click="ouvrirDetail(r)">
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-7">{{ r.numero }} · {{ dateLisible(r.date) }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ r.libelle }}</div>
                <div class="text-caption q-mt-xs">{{ libelleType(r.type) }} · {{ r.client ?? '—' }}</div>
              </div>
              <span class="champ badge-statut" :class="r.paiementId ? 'champ--validee' : 'champ--brouillon'">
                {{ r.paiementId ? $t('recettes.status.encaissee') : $t('recettes.status.aEncaisser') }}
              </span>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-caption text-grey-7">{{ $t('recettes.card.montant') }}</div>
            <div class="text-h6 chiffres">{{ montantLisible(r.montant) }} {{ r.devise }}</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-if="!r.paiementId && peutEncaisser" flat dense no-caps color="positive" icon="payments" :label="$t('recettes.actions.cash')" :disable="encaissementEnCours || dialogEncaissementOuvert" @click.stop="encaisser(r)" />
            <q-btn
              v-else-if="r.paiementId"
              flat
              dense
              no-caps
              color="primary"
              icon="receipt_long"
              :label="$t('recettes.actions.viewPayment')"
              to="/paiements"
              @click.stop
            />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!recettes.length && !chargement" class="col-12">
        <div class="etat-vide">
          <q-icon name="request_quote" size="36px" />
          <div class="text-subtitle2 q-mt-sm">{{ $t('recettes.emptyState.title') }}</div>
          <div class="text-caption">
            {{ $t('recettes.emptyState.message') }}
          </div>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('recettes.actions.issueRecette')"
            @click="ouvrirCreation"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      :page="filtres.page"
      :page-size="filtres.pageSize"
      :total="total"
      @update:page="filtres.page = $event; charger()"
      @update:page-size="filtres.pageSize = $event; filtres.page = 1; charger()"
      @tous="chargerTout"
    />

    <recette-dialog
      v-model="dialogOuvert"
      :existant="recetteEnEdition"
      @cree="apresEnregistrement"
    />
  </q-page>
</template>

<script setup lang="ts">
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ChampDate from '../components/ChampDate.vue';
import RecetteDialog from '../components/RecetteDialog.vue';
import {
  LIBELLE_TYPE_RECETTE,
  aujourdhui,
  dateLisible,
  decalerJours,
  montantLisible,
} from '../utils/libelles';
import type { RecetteExterne, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const modeVue = usePresentationListe();
const recettes = ref<RecetteExterne[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogOuvert = ref(false);
const encaissementEnCours = ref(false);
const dialogEncaissementOuvert = ref(false);
const recetteEnEdition = ref<RecetteExterne | null>(null);
const kpis = ref<{
  annee: number;
  totalMois: number;
  totalAnnee: number;
  top3: Array<{ type: string; total: number }>;
} | null>(null);

const filtres = ref<Record<string, any>>({
  recherche: '',
  type: null as string | null,
  paiementStatut: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -30),
  dateFin: aujourdhui(),
  page: 1,
  pageSize: 20,
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutEncaisser = peutCreer;

const optionsTypes = Object.entries(LIBELLE_TYPE_RECETTE).map(([value, label]) => ({
  value,
  label,
}));

// Le champ est effaçable : un choix « Tous » ferait doublon avec la croix.
const optionsPaiement = computed(() => [
  { value: 'REUSSI', label: t('recettes.paiementOptions.reussi') },
  { value: 'A_ENCAISSER', label: t('recettes.paiementOptions.aEncaisser') },
]);

const periodeLisible = computed(() => {
  const { dateDebut, dateFin } = filtres.value;
  if (dateDebut && dateFin) return t('recettes.period.range', { debut: dateLisible(dateDebut), fin: dateLisible(dateFin) });
  if (dateDebut) return t('recettes.period.from', { debut: dateLisible(dateDebut) });
  if (dateFin) return t('recettes.period.until', { fin: dateLisible(dateFin) });
  return t('recettes.period.all');
});

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: t('recettes.chips.search', { texte: filtres.value.recherche }), value: filtres.value.recherche, defaut: true });
  }
  if (filtres.value.type) {
    chips.push({ label: t('recettes.chips.type', { type: libelleType(filtres.value.type) }), value: filtres.value.type });
  }
  if (filtres.value.paiementStatut) {
    chips.push({
      label: t('recettes.chips.paiementStatut', {
        statut:
          optionsPaiement.value.find((o) => o.value === filtres.value.paiementStatut)?.label ??
          filtres.value.paiementStatut,
      }),
      value: filtres.value.paiementStatut,
    });
  }
  return chips;
});

const colonnesTableau = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('recettes.table.columns.numero'), field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: t('recettes.table.columns.type'), field: 'type', align: 'left' },
  { name: 'libelle', label: t('recettes.table.columns.libelle'), field: 'libelle', align: 'left' },
  { name: 'client', label: t('recettes.table.columns.client'), field: 'client', align: 'left' },
  { name: 'date', label: t('recettes.table.columns.date'), field: (r: RecetteExterne) => dateLisible(r.date), align: 'left' },
  { name: 'montant', label: t('recettes.table.columns.montant'), field: 'montant', align: 'right' },
  { name: 'statut', label: t('recettes.table.columns.statut'), field: 'paiementId', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function libelleType(s: string) {
  return LIBELLE_TYPE_RECETTE[s] ?? s;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/recettes', {
      params: {
        search: filtres.value.recherche || undefined,
        type: filtres.value.type || undefined,
        paiementStatut: filtres.value.paiementStatut || undefined,
        dateDebut: filtres.value.dateDebut || undefined,
        dateFin: filtres.value.dateFin || undefined,
        page: filtres.value.page,
        pageSize: filtres.value.pageSize,
      },
    });
    recettes.value = data.data;
    total.value = data.total;
  } catch (e: any) {
    recettes.value = [];
    total.value = 0;
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? t('recettes.messages.loadError'),
    });
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  filtres.value.page = 1;
  filtres.value.pageSize = Math.max(total.value, 200);
  await charger();
}

async function chargerKpis() {
  if (!auth.aRole(['ADMIN', 'DIRECTION'])) return;
  try {
    const { data } = await api.get('/recettes/dashboard');
    kpis.value = data;
  } catch {
    kpis.value = null;
  }
}

async function apresEnregistrement() {
  await Promise.all([charger(), chargerKpis()]);
}

function reinitialiser() {
  filtres.value = {
    recherche: '',
    type: null,
    paiementStatut: null,
    dateDebut: decalerJours(aujourdhui(), -30),
    dateFin: aujourdhui(),
    page: 1,
    pageSize: 20,
  };
  charger();
}

function ouvrirCreation() {
  recetteEnEdition.value = null;
  dialogOuvert.value = true;
}

/** Le détail et la modification ouvrent la même fiche : une seule porte. */
function ouvrirDetail(r: RecetteExterne) {
  recetteEnEdition.value = r;
  dialogOuvert.value = true;
}

async function encaisser(r: RecetteExterne) {
  if (encaissementEnCours.value || dialogEncaissementOuvert.value) return;
  dialogEncaissementOuvert.value = true;
  $q.dialog({
    title: t('recettes.encaisserDialog.title'),
    message: t('recettes.encaisserDialog.message', {
      numero: r.numero,
      libelle: r.libelle,
      montant: montantLisible(r.montant),
      devise: r.devise,
    }),
    cancel: true,
    ok: { color: 'positive', label: t('recettes.encaisserDialog.ok'), unelevated: true },
  }).onOk(async () => {
    dialogEncaissementOuvert.value = false;
    encaissementEnCours.value = true;
    try {
      await api.post(`/recettes/${r.id}/encaisser`, {});
      $q.notify({ type: 'positive', message: t('recettes.messages.cashSuccess') });
      await charger();
      await chargerKpis();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? t('recettes.messages.cashError') });
    } finally {
      encaissementEnCours.value = false;
    }
  }).onCancel(() => {
    dialogEncaissementOuvert.value = false;
  });
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.type,
    filtres.value.paiementStatut,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    filtres.value.page = 1;
    charger();
  },
);
onMounted(() => {
  charger();
  chargerKpis();
});
</script>

<style scoped lang="scss">
@use '../css/champs-admin' as *;

/* Même définition que les autres tableaux de bord de l'application. */
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}

.recette-carte {
  cursor: pointer;
  transition: background var(--up-transition);

  &:hover {
    background: var(--up-craie);
  }
}

</style>
