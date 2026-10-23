<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('recettes.title')" :subtitle="$t('recettes.subtitle')">
      <template v-if="peutCreer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('recettes.actions.issueRecette')"
          @click="ouvrirCreation"
        />
      </template>
    </page-header>

    <div v-if="kpis" class="resume-liste" role="status">
      <span>{{ $t('recettes.kpis.totalMois.title') }} : <strong>{{ montantLisible(kpis.totalMois) }} {{ $t('common.units.gnf') }}</strong></span>
      <span>{{ $t('recettes.kpis.totalAnnee.title', { annee: kpis.annee }) }} : <strong>{{ montantLisible(kpis.totalAnnee) }} {{ $t('common.units.gnf') }}</strong></span>
    </div>

    <filter-bar
      v-model="filtres"
      :placeholder="$t('recettes.search.placeholder')"
      :chips="chipsFiltres"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #principaux>
        <q-select v-model="filtres.paiementStatut" :options="optionsPaiement" outlined dense clearable emit-value map-options :label="$t('recettes.filters.paiementStatut')" />
      </template>
      <template #avances>
        <q-select v-model="filtres.type" :options="optionsTypes" outlined dense clearable emit-value map-options :label="$t('common.fields.type')" />

        <champ-date v-model="filtres.dateDebut" :label="$t('common.actions.from')" />
        <champ-date v-model="filtres.dateFin" :label="$t('common.actions.to')" />
      </template>
    </filter-bar>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ $t('recettes.period.summary', { periode: periodeLisible, total: liste.total }) }}
    </div>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnesTableau"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge color="primary" :label="libelleType(p.row.type)" />
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="recette" :statut="p.row.paiementId ? 'ENCAISSEE' : 'A_ENCAISSER'" />
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
        <etat-vide icone="request_quote" :titre="$t('recettes.emptyState.title')" :aide="$t('recettes.emptyState.message')">
          <template v-if="peutCreer" #action>
            <q-btn unelevated no-caps color="primary" icon="add" :label="$t('recettes.actions.issueRecette')" @click="ouvrirCreation" />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="r in liste.lignes" :key="r.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte recette-carte full-height" @click="ouvrirDetail(r)">
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-7">{{ r.numero }} · {{ dateLisible(r.date) }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ r.libelle }}</div>
                <div class="text-caption q-mt-xs">{{ libelleType(r.type) }} · {{ r.client ?? '—' }}</div>
              </div>
              <PastilleStatut domaine="recette" :statut="r.paiementId ? 'ENCAISSEE' : 'A_ENCAISSER'" />
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-caption text-grey-7">{{ $t('common.fields.amount') }}</div>
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
      <etat-vide
        v-if="!liste.lignes.length && !liste.chargement"
        class="col-12"
        icone="request_quote"
        :titre="$t('recettes.emptyState.title')"
        :aide="$t('recettes.emptyState.message')"
      >
        <template v-if="peutCreer" #action>
          <q-btn unelevated no-caps color="primary" icon="add" :label="$t('recettes.actions.issueRecette')" @click="ouvrirCreation" />
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <recette-dialog
      v-model="dialogOuvert"
      :existant="recetteEnEdition"
      @enregistre="apresEnregistrement"
    />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
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
const { confirmer } = useConfirmation();

const modeVue = usePresentationListe();
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
});

/** Recettes : paginées côté serveur, filtres gardés dans l'URL. */
const liste = reactive(
  useListePaginee<RecetteExterne>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/recettes', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            type: f.type || undefined,
            paiementStatut: f.paiementStatut || undefined,
            dateDebut: f.dateDebut || undefined,
            dateFin: f.dateFin || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

const peutCreer = computed(() => auth.peut('recettes.gerer'));
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
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'libelle', label: t('common.fields.label'), field: 'libelle', align: 'left' },
  { name: 'client', label: t('recettes.table.columns.client'), field: 'client', align: 'left' },
  { name: 'date', label: t('common.fields.date'), field: (r: RecetteExterne) => dateLisible(r.date), align: 'left' },
  { name: 'montant', label: t('common.fields.amount'), field: 'montant', align: 'right' },
  { name: 'statut', label: t('common.fields.status'), field: 'paiementId', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function libelleType(s: string) {
  return LIBELLE_TYPE_RECETTE[s] ?? s;
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
  await Promise.all([liste.recharger(), chargerKpis()]);
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
  const ok = await confirmer({
    titre: t('recettes.encaisserDialog.title'),
    message: t('recettes.encaisserDialog.message', {
      numero: r.numero,
      libelle: r.libelle,
      montant: montantLisible(r.montant),
      devise: r.devise,
    }),
    ok: t('recettes.encaisserDialog.ok'),
    couleur: 'positive',
  });
  dialogEncaissementOuvert.value = false;
  if (!ok) return;
  encaissementEnCours.value = true;
  try {
    await api.post(`/recettes/${r.id}/encaisser`, {});
    $q.notify({ type: 'positive', message: t('recettes.messages.cashSuccess') });
    await liste.recharger();
    await chargerKpis();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    encaissementEnCours.value = false;
  }
}

onMounted(() => {
  void chargerKpis();
});
</script>

<style scoped lang="scss">
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
