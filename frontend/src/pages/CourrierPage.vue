<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Courrier administratif</div>
        <div class="page-sous-titre">
          Enregistrement et circulation du courrier — chaque envoi traverse un circuit de
          paraphe avant d'atteindre les archives.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Enregistrer un courrier"
          @click="ouvrirCreation"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (numéro, objet, expéditeur, destinataire…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle v-model="modeVue" :modes="['tableau', 'cartes']" cle="courrier" />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="optionsTypes"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Type"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <champ-date v-model="filtres.dateDebut" label="Du" />
        <champ-date v-model="filtres.dateFin" label="Au" />
      </template>
    </filter-bar>

    <div class="q-mb-md">
      <q-tabs v-model="onglet" dense no-caps align="left" class="text-grey-9">
        <q-tab name="ENTRANT" label="Entrants" icon="inbox" />
        <q-tab name="SORTANT" label="Sortants" icon="send" />
        <q-tab name="ARCHIVE" label="Archives" icon="inventory_2" />
      </q-tabs>
    </div>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="courriersFiltres"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge :color="p.row.type === 'ENTRANT' ? 'primary' : 'accent'" :label="p.row.type" />
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ libelleStatut(p.row.statut) }}
          </span>
        </q-td>
      </template>
      <template #body-cell-circuits="p">
        <q-td :props="p">
          <q-chip dense size="xs" :color="p.row.circuits?.length ? 'secondary' : 'grey-5'">
            {{ p.row.circuits?.length ?? 0 }} étape(s)
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" color="primary" @click.stop="ouvrirDetail(p.row)">
            <q-tooltip>Détail / parapher</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="print" @click.stop="imprimer(p.row)">
            <q-tooltip>Imprimer le bordereau</q-tooltip>
          </q-btn>
          <template v-if="peutCloturer(p.row)">
            <q-btn flat dense round color="negative" icon="archive" @click.stop="cloturer(p.row)">
              <q-tooltip>Clôturer / archiver</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div
        v-for="c in courriersFiltres"
        :key="c.id"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card
          flat
          bordered
          class="carte courrier-carte full-height"
          :style="{ borderLeftColor: couleurStatut(c.statut), borderLeftWidth: '6px' }"
          @click="ouvrirDetail(c)"
        >
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-7">{{ c.numero }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ c.objet }}</div>
                <div class="text-caption q-mt-xs">
                  {{ c.type === 'ENTRANT' ? `De : ${c.expediteur ?? '—'}` : `À : ${c.destinataire ?? '—'}` }}
                </div>
              </div>
              <span class="champ badge-statut" :class="classeStatut(c.statut)">
                {{ libelleStatut(c.statut) }}
              </span>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-col-gutter-sm text-caption">
              <div class="col-6">
                <q-icon name="schedule" size="14px" />
                {{ dateCourrier(c) }}
              </div>
              <div class="col-6 text-right">
                <q-icon name="how_to_reg" size="14px" />
                {{ c.circuits?.length ?? 0 }} paraphe(s)
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="print" label="Imprimer" @click.stop="imprimer(c)" />
            <q-btn v-if="peutCloturer(c)" flat dense no-caps color="negative" icon="archive" label="Clôturer" @click.stop="cloturer(c)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!courriersFiltres.length" class="col-12 text-center text-grey-7 q-pa-xl">
        Aucun courrier ne correspond aux filtres.
      </div>
    </div>

    <pagination-bar
      :page.sync="filtres.page"
      :page-size.sync="filtres.pageSize"
      :total="total"
      @tous="chargerTout"
    />

    <courrier-detail-dialog
      v-model="dialogDetailOuvert"
      :courrier-id="courrierSelectionne?.id ?? null"
      @modifie="charger"
    />

    <courrier-circuit-dialog
      v-model="dialogCreationOuvert"
      :existant="null"
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
import CourrierDetailDialog from '../components/CourrierDetailDialog.vue';
import CourrierCircuitDialog from '../components/CourrierCircuitDialog.vue';
import {
  LIBELLE_STATUT_COURRIER,
  LIBELLE_TYPE_COURRIER,
  aujourdhui,
  dateLisible,
  decalerJours,
} from '../utils/libelles';
import type { Courrier } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<'ENTRANT' | 'SORTANT' | 'ARCHIVE'>('ENTRANT');
const modeVue = ref<'tableau' | 'cartes'>('cartes');
const courriers = ref<Courrier[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogDetailOuvert = ref(false);
const dialogCreationOuvert = ref(false);
const courrierSelectionne = ref<Courrier | null>(null);

const filtres = ref<Record<string, any>>({
  recherche: '',
  type: null as 'ENTRANT' | 'SORTANT' | null,
  statut: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -90),
  dateFin: aujourdhui(),
  page: 1,
  pageSize: 20,
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT']));
const peutCloturer = (c: Courrier) =>
  auth.role === 'ADMIN' && ['EN_CIRCUIT', 'TRAITE', 'CLASSE'].includes(c.statut);

const optionsTypes = [
  { label: 'Entrant', value: 'ENTRANT' },
  { label: 'Sortant', value: 'SORTANT' },
];
const optionsStatuts = Object.entries(LIBELLE_STATUT_COURRIER).map(([value, label]) => ({
  value,
  label,
}));

const chipsFiltres = computed(() => {
  const chips: Array<{ label: string; value: any; defaut?: boolean }> = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, defaut: true });
  }
  if (filtres.value.type) {
    chips.push({ label: `Type : ${LIBELLE_TYPE_COURRIER[filtres.value.type]}`, value: filtres.value.type });
  }
  if (filtres.value.statut) {
    chips.push({ label: `Statut : ${LIBELLE_STATUT_COURRIER[filtres.value.statut] ?? filtres.value.statut}`, value: filtres.value.statut });
  }
  return chips;
});

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  {
    name: 'objet',
    label: 'Objet',
    field: 'objet',
    align: 'left',
  },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  {
    name: 'correspondant',
    label: 'Expéditeur / Destinataire',
    field: (r: Courrier) => (r.type === 'ENTRANT' ? r.expediteur : r.destinataire) ?? '—',
    align: 'left',
  },
  {
    name: 'date',
    label: 'Date',
    field: (r: Courrier) => dateCourrier(r),
    align: 'left',
  },
  { name: 'circuits', label: 'Circuit', field: 'circuits', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const courriersFiltres = computed(() => {
  if (onglet.value === 'ARCHIVE') {
    return courriers.value.filter((c) => c.statut === 'CLASSE' || c.statut === 'ARCHIVE');
  }
  return courriers.value.filter((c) => c.type === onglet.value);
});

function classeStatut(s: string) {
  switch (s) {
    case 'RECU':
    case 'ENREGISTRE':
      return 'champ--brouillon';
    case 'EN_CIRCUIT':
      return 'champ--orange';
    case 'TRAITE':
      return 'champ--validee';
    case 'CLASSE':
    case 'ARCHIVE':
      return 'champ--bleue';
    default:
      return 'champ--brouillon';
  }
}

function couleurStatut(s: string) {
  switch (s) {
    case 'RECU':
    case 'ENREGISTRE':
      return '#cfd4d9';
    case 'EN_CIRCUIT':
      return '#ff9800';
    case 'TRAITE':
      return '#0f7a45';
    case 'CLASSE':
    case 'ARCHIVE':
      return '#1565c0';
    default:
      return '#cfd4d9';
  }
}

function libelleStatut(s: string) {
  return LIBELLE_STATUT_COURRIER[s] ?? s;
}

function dateCourrier(c: Courrier): string {
  const d = c.dateReception ?? c.dateEnvoi ?? c.createdAt;
  return dateLisible(d);
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/courrier', {
      params: {
        all: '1',
        search: filtres.value.recherche || undefined,
        type: filtres.value.type || undefined,
        statut: filtres.value.statut || undefined,
        dateDebut: filtres.value.dateDebut || undefined,
        dateFin: filtres.value.dateFin || undefined,
        page: filtres.value.page,
        pageSize: filtres.value.pageSize,
      },
    });
    courriers.value = data.data;
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

function reinitialiser() {
  filtres.value = {
    recherche: '',
    type: null,
    statut: null,
    dateDebut: decalerJours(aujourdhui(), -90),
    dateFin: aujourdhui(),
    page: 1,
    pageSize: 20,
  };
  charger();
}

function ouvrirCreation() {
  dialogCreationOuvert.value = true;
}

function ouvrirDetail(c: Courrier) {
  courrierSelectionne.value = c;
  dialogDetailOuvert.value = true;
}

function imprimer(c: Courrier) {
  window.open(`${API_URL}/courrier/${c.id}/imprimer?token=${auth.token}`, '_blank');
}

function cloturer(c: Courrier) {
  $q.dialog({
    title: 'Clôturer le courrier',
    message: `Confirmer la clôture de « ${c.numero} » ? Cette transition avance vers les archives (CLASSE → ARCHIVE).`,
    cancel: true,
    ok: { color: 'negative', label: 'Clôturer', unelevated: true },
  }).onOk(async () => {
    try {
      await api.post(`/courrier/${c.id}/cloturer`, {});
      $q.notify({ type: 'positive', message: 'Courrier clôturé' });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Clôture impossible' });
    }
  });
}

watch(onglet, () => charger());
watch(
  () => [
    filtres.value.recherche,
    filtres.value.type,
    filtres.value.statut,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    filtres.value.page = 1;
    charger();
  },
);
onMounted(charger);
</script>

<style>
.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.champ--brouillon {
  background: #cfd4d9;
  color: #33463f;
}
.champ--validee {
  background: #0f7a45;
  color: white;
}
.champ--orange {
  background: #ff9800;
  color: white;
}
.champ--bleue {
  background: #1565c0;
  color: white;
}
</style>

<style scoped lang="scss">
.courrier-carte {
  cursor: pointer;
  transition: background var(--up-transition);
  border-left: 4px solid var(--up-encre);
  &:hover {
    background: var(--up-craie);
  }
}
</style>
