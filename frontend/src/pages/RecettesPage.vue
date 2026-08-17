<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Recettes externes</div>
        <div class="page-sous-titre">
          Régie des recettes : analyses laboratoire, location d'amphithéâtre, prestations de formation ou de conseil.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Émettre une recette"
          @click="ouvrirCreation"
        />
      </div>
    </div>

    <div v-if="kpis" class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte-kpi">
          <q-card-section>
            <div class="text-caption text-grey-7">Total du mois</div>
            <div class="text-h4 text-weight-bold">{{ montantLisible(kpis.totalMois) }} GNF</div>
            <div class="text-caption">{{ kpis.totalMois !== 0 ? 'encaissements en cours' : '' }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte-kpi">
          <q-card-section>
            <div class="text-caption text-grey-7">Total année {{ kpis.annee }}</div>
            <div class="text-h4 text-weight-bold">{{ montantLisible(kpis.totalAnnee) }} GNF</div>
            <div class="text-caption">toutes recettes confondues</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte-kpi">
          <q-card-section>
            <div class="text-caption text-grey-7">Top 3 types de recettes</div>
            <q-list dense>
              <q-item v-for="t in kpis.top3" :key="t.type">
                <q-item-section>
                  <q-item-label>{{ libelleType(t.type) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label>{{ montantLisible(t.total) }} GNF</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="!kpis.top3.length">
                <q-item-section class="text-grey-7 text-caption">Aucune donnée</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (numéro, libellé, client…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle v-model="modeVue" :modes="['tableau', 'cartes']" cle="recettes" />
      </template>
      <template #avances>
        <q-select v-model="filtres.type" :options="optionsTypes" outlined dense clearable emit-value map-options label="Type" />
        <q-select v-model="filtres.paiementStatut" :options="optionsPaiement" outlined dense clearable emit-value map-options label="Statut paiement" />
        <champ-date v-model="filtres.dateDebut" label="Du" />
        <champ-date v-model="filtres.dateFin" label="Au" />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte q-mt-md"
      :rows="recettes"
      :columns="colonnesTableau"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge color="primary" :label="libelleType(p.row.type)" />
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge
            :color="p.row.paiementId ? 'positive' : 'orange'"
            :label="p.row.paiementId ? 'Encaissée' : 'À encaisser'"
          />
        </q-td>
      </template>
      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" color="primary" @click.stop="ouvrirDetail(p.row)">
            <q-tooltip>Détail</q-tooltip>
          </q-btn>
          <q-btn v-if="!p.row.paiementId && peutEncaisser" flat dense no-caps color="positive" icon="payments" label="Encaisser" @click.stop="encaisser(p.row)" />
          <q-btn v-if="p.row.paiementId" flat dense no-caps icon="receipt_long" label="Reçu" @click.stop="imprimerRecu(p.row)" />
          <q-btn flat dense round icon="edit" @click.stop="modifier(p.row)">
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md q-mt-md">
      <div v-for="r in recettes" :key="r.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte recette-carte full-height" @click="ouvrirDetail(r)">
          <q-card-section>
            <div class="text-caption text-grey-7">{{ r.numero }}</div>
            <div class="text-subtitle1 text-weight-bold">{{ r.libelle }}</div>
            <div class="text-caption q-mt-xs">{{ libelleType(r.type) }} · {{ r.client ?? '—' }}</div>
          </q-card-section>
          <q-card-section>
            <div class="row items-end justify-between">
              <div>
                <div class="text-caption text-grey-7">Montant</div>
                <div class="text-h6">{{ montantLisible(r.montant) }} {{ r.devise }}</div>
              </div>
              <q-badge :color="r.paiementId ? 'positive' : 'orange'" :label="r.paiementId ? 'Encaissée' : 'À encaisser'" />
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-if="!r.paiementId && peutEncaisser" flat dense no-caps color="positive" icon="payments" label="Encaisser" @click.stop="encaisser(r)" />
            <q-btn v-if="r.paiementId" flat dense no-caps icon="receipt_long" label="Reçu" @click.stop="imprimerRecu(r)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!recettes.length" class="col-12 text-center text-grey-7 q-pa-xl">
        Aucune recette ne correspond aux filtres.
      </div>
    </div>

    <pagination-bar
      :page.sync="filtres.page"
      :page-size.sync="filtres.pageSize"
      :total="total"
      @tous="chargerTout"
    />

    <recette-dialog
      v-model="dialogOuvert"
      :existant="recetteEnEdition"
      @cree="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ChampDate from '../components/ChampDate.vue';
import RecetteDialog from '../components/RecetteDialog.vue';
import {
  LIBELLE_TYPE_RECETTE,
  aujourdhui,
  dateLisible,
  decalerJours,
  montantLisible,
} from '../utils/libelles';
import type { RecetteExterne } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const modeVue = ref<'tableau' | 'cartes'>('tableau');
const recettes = ref<RecetteExterne[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogOuvert = ref(false);
const recetteEnEdition = ref<RecetteExterne | null>(null);
const kpis = ref<{
  annee: number;
  totalMois: number;
  totalAnnee: number;
  parType: Array<{ type: string; total: number; nb: number }>;
  parMois: Array<{ mois: number; libelle: string; total: number }>;
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

const optionsTypes = (['ANALYSE_LABO', 'LOCATION_AMPHI', 'PRESTATION_FORMATION', 'PRESTATION_CONSEIL', 'AUTRE'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_RECETTE[value],
}));

const optionsPaiement = [
  { value: '', label: 'Tous' },
  { value: 'REUSSI', label: 'Encaissées' },
  { value: 'EN_ATTENTE', label: 'À encaisser' },
];

const chipsFiltres = computed(() => {
  const chips: any[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, defaut: true });
  }
  if (filtres.value.type) {
    chips.push({ label: `Type : ${libelleType(filtres.value.type)}`, value: filtres.value.type });
  }
  return chips;
});

const colonnesTableau: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'libelle', label: 'Libellé', field: 'libelle', align: 'left' },
  { name: 'client', label: 'Client', field: 'client', align: 'left' },
  { name: 'date', label: 'Date', field: (r: RecetteExterne) => dateLisible(r.date), align: 'left' },
  { name: 'montant', label: 'Montant', field: 'montant', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'paiementId', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function libelleType(s: string) {
  return LIBELLE_TYPE_RECETTE[s] ?? s;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/recettes', {
      params: {
        all: '1',
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

function ouvrirDetail(r: RecetteExterne) {
  recetteEnEdition.value = r;
  dialogOuvert.value = true;
}

function modifier(r: RecetteExterne) {
  recetteEnEdition.value = r;
  dialogOuvert.value = true;
}

async function encaisser(r: RecetteExterne) {
  $q.dialog({
    title: 'Encaisser la recette',
    message: `Encaisser « ${r.numero} — ${r.libelle} » de ${montantLisible(r.montant)} ${r.devise} ?`,
    cancel: true,
    ok: { color: 'positive', label: 'Encaisser', unelevated: true },
  }).onOk(async () => {
    try {
      await api.post(`/recettes/${r.id}/encaisser`, {});
      $q.notify({ type: 'positive', message: 'Recette encaissée' });
      await charger();
      await chargerKpis();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Encaissement impossible' });
    }
  });
}

function imprimerRecu(r: RecetteExterne) {
  // Le reçu reste la fiche de la recette elle-même — on imprime ses détails dans
  // un nouvel onglet, en passant le token comme pour les autres impressions A4.
  window.open(`${API_URL}/recettes/${r.id}/imprimer?token=${auth.token}`, '_blank');
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
.car-kpi {
  background: linear-gradient(180deg, var(--up-plaque, #fafaf7), white);
}
.recette-carte {
  cursor: pointer;
  transition: background var(--up-transition);
  border-left: 4px solid var(--up-encre);
  &:hover {
    background: var(--up-craie);
  }
}
</style>
