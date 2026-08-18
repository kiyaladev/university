<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Régie des recettes</div>
        <div class="page-sous-titre">
          Les recettes propres de l'université — analyses de laboratoire, location
          d'amphithéâtre, prestations de formation ou de conseil. Une recette est
          d'abord émise, puis encaissée : l'encaissement crée le paiement qui la
          solde.
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

    <liens-croises
      :liens="[
        { to: '/paiements', libelle: 'Paiements', icone: 'payments', aide: 'Les encaissements créés par ces recettes, et leurs reçus' },
        { to: '/rectorat', libelle: 'Tableau de bord Rectorat', icone: 'dashboard', aide: 'La situation d’ensemble de l’établissement' },
      ]"
    />

    <div v-if="kpis" class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section>
            <div class="text-caption text-grey-7">Total du mois en cours</div>
            <div class="stat-chiffre chiffres">{{ montantLisible(kpis.totalMois) }} GNF</div>
            <div class="text-caption text-grey-6">recettes émises, encaissées ou non</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section>
            <div class="text-caption text-grey-7">Total année {{ kpis.annee }}</div>
            <div class="stat-chiffre chiffres">{{ montantLisible(kpis.totalAnnee) }} GNF</div>
            <div class="text-caption text-grey-6">toutes recettes confondues</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section>
            <div class="text-caption text-grey-7">Trois premiers types de recettes</div>
            <q-list dense>
              <q-item v-for="t in kpis.top3" :key="t.type">
                <q-item-section>
                  <q-item-label>{{ libelleType(t.type) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="chiffres">{{ montantLisible(t.total) }} GNF</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="!kpis.top3.length">
                <q-item-section class="text-grey-7 text-caption">
                  Aucune recette enregistrée à ce jour.
                </q-item-section>
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
        <view-toggle cle="recettes" :modes="['tableau', 'cartes']" @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')" />
      </template>
      <template #avances>
        <q-select v-model="filtres.type" :options="optionsTypes" outlined dense clearable emit-value map-options label="Type" />
        <q-select v-model="filtres.paiementStatut" :options="optionsPaiement" outlined dense clearable emit-value map-options label="Encaissement" />
        <champ-date v-model="filtres.dateDebut" label="Du" />
        <champ-date v-model="filtres.dateFin" label="Au" />
      </template>
    </filter-bar>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ periodeLisible }} — 30 derniers jours par défaut. {{ total }} recette(s).
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
      hide-bottom
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
            {{ p.row.paiementId ? 'Encaissée' : 'À encaisser' }}
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
            dense
            round
            icon="visibility"
            color="primary"
            :aria-label="`Détail de la recette ${p.row.numero}`"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>Détail / modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="!p.row.paiementId && peutEncaisser"
            flat
            dense
            no-caps
            color="positive"
            icon="payments"
            label="Encaisser"
            @click.stop="encaisser(p.row)"
          />
          <q-btn
            v-else-if="p.row.paiementId"
            flat
            dense
            no-caps
            color="primary"
            icon="receipt_long"
            label="Voir le paiement"
            to="/paiements"
            @click.stop
          >
            <q-tooltip>Le reçu se délivre depuis l'écran des paiements</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="request_quote" size="36px" />
          <div class="text-subtitle2 q-mt-sm">Aucune recette sur la période</div>
          <div class="text-caption">
            La régie enregistre ici les prestations facturées à des tiers.
            Élargissez la période, retirez les filtres, ou émettez la première recette.
          </div>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Émettre une recette"
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
                {{ r.paiementId ? 'Encaissée' : 'À encaisser' }}
              </span>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-caption text-grey-7">Montant</div>
            <div class="text-h6 chiffres">{{ montantLisible(r.montant) }} {{ r.devise }}</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-if="!r.paiementId && peutEncaisser" flat dense no-caps color="positive" icon="payments" label="Encaisser" @click.stop="encaisser(r)" />
            <q-btn
              v-else-if="r.paiementId"
              flat
              dense
              no-caps
              color="primary"
              icon="receipt_long"
              label="Voir le paiement"
              to="/paiements"
              @click.stop
            />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!recettes.length && !chargement" class="col-12">
        <div class="etat-vide">
          <q-icon name="request_quote" size="36px" />
          <div class="text-subtitle2 q-mt-sm">Aucune recette sur la période</div>
          <div class="text-caption">
            La régie enregistre ici les prestations facturées à des tiers.
            Élargissez la période, retirez les filtres, ou émettez la première recette.
          </div>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Émettre une recette"
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
      @cree="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ChampDate from '../components/ChampDate.vue';
import LiensCroises from '../components/LiensCroises.vue';
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

// Le champ est effaçable : un choix « Tous » ferait doublon avec la croix.
const optionsPaiement = [
  { value: 'REUSSI', label: 'Encaissées' },
  { value: 'EN_ATTENTE', label: 'À encaisser' },
];

const periodeLisible = computed(
  () => `du ${dateLisible(filtres.value.dateDebut)} au ${dateLisible(filtres.value.dateFin)}`,
);

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, defaut: true });
  }
  if (filtres.value.type) {
    chips.push({ label: `Type : ${libelleType(filtres.value.type)}`, value: filtres.value.type });
  }
  if (filtres.value.paiementStatut) {
    chips.push({
      label: `Encaissement : ${
        optionsPaiement.find((o) => o.value === filtres.value.paiementStatut)?.label ??
        filtres.value.paiementStatut
      }`,
      value: filtres.value.paiementStatut,
    });
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
      message: e?.response?.data?.message ?? 'Chargement des recettes impossible.',
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
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return;
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

/** Le détail et la modification ouvrent la même fiche : une seule porte. */
function ouvrirDetail(r: RecetteExterne) {
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
  font-weight: 700;
}

.recette-carte {
  cursor: pointer;
  transition: background var(--up-transition);

  &:hover {
    background: var(--up-craie);
  }
}

</style>
