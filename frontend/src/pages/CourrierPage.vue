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

    <q-tabs v-model="onglet" dense no-caps align="left" class="onglets-panneau q-mb-md" narrow-indicator>
      <q-tab name="ENTRANT" label="Entrants" icon="inbox" />
      <q-tab name="SORTANT" label="Sortants" icon="send" />
      <q-tab name="ARCHIVE" label="Archives" icon="inventory_2" />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (numéro, objet, expéditeur, destinataire…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle cle="courrier" :modes="['tableau', 'cartes']" @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')" />
      </template>
      <template #avances>
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

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ libelleOnglet }} · {{ periodeLisible }} — 90 derniers jours par défaut.
      {{ total }} courrier(s).
    </div>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="courriers"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge
            :color="p.row.type === 'ENTRANT' ? 'primary' : 'secondary'"
            :label="LIBELLE_TYPE_COURRIER[p.row.type] ?? p.row.type"
          />
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
          <q-btn
            flat
            dense
            round
            icon="visibility"
            color="primary"
            :aria-label="`Détail du courrier ${p.row.numero}`"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>Détail / parapher</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="`Imprimer le bordereau du courrier ${p.row.numero}`"
            @click.stop="imprimer(p.row)"
          >
            <q-tooltip>Imprimer le bordereau (A4)</q-tooltip>
          </q-btn>
          <template v-if="peutCloturer(p.row)">
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="archive"
              :aria-label="`Clôturer le courrier ${p.row.numero}`"
              @click.stop="cloturer(p.row)"
            >
              <q-tooltip>Clôturer / archiver</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="mail" size="36px" />
          <div class="text-subtitle2 q-mt-sm">{{ titreVide }}</div>
          <div class="text-caption">{{ aideVide }}</div>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Enregistrer un courrier"
            @click="ouvrirCreation"
          />
        </div>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div
        v-for="c in courriers"
        :key="c.id"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card
          flat
          bordered
          class="carte courrier-carte full-height"
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
            <q-btn flat dense no-caps icon="print" label="Imprimer le bordereau" @click.stop="imprimer(c)" />
            <q-btn v-if="peutCloturer(c)" flat dense no-caps color="negative" icon="archive" label="Clôturer" @click.stop="cloturer(c)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!courriers.length && !chargement" class="col-12">
        <div class="etat-vide">
          <q-icon name="mail" size="36px" />
          <div class="text-subtitle2 q-mt-sm">{{ titreVide }}</div>
          <div class="text-caption">{{ aideVide }}</div>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Enregistrer un courrier"
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
import type { Courrier, ChipFiltre } from '../types';

/** Les archives ne sont pas un type de courrier mais deux statuts de fin. */
const STATUTS_ARCHIVE = ['CLASSE', 'ARCHIVE'];

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<'ENTRANT' | 'SORTANT' | 'ARCHIVE'>('ENTRANT');
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const courriers = ref<Courrier[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogDetailOuvert = ref(false);
const dialogCreationOuvert = ref(false);
const courrierSelectionne = ref<Courrier | null>(null);

const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -90),
  dateFin: aujourdhui(),
  page: 1,
  pageSize: 20,
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT']));
const peutCloturer = (c: Courrier) =>
  auth.role === 'ADMIN' && ['EN_CIRCUIT', 'TRAITE', 'CLASSE'].includes(c.statut);

const optionsStatuts = Object.entries(LIBELLE_STATUT_COURRIER).map(([value, label]) => ({
  value,
  label,
}));

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, defaut: true });
  }
  if (filtres.value.statut) {
    chips.push({ label: `Statut : ${LIBELLE_STATUT_COURRIER[filtres.value.statut] ?? filtres.value.statut}`, value: filtres.value.statut });
  }
  return chips;
});

const libelleOnglet = computed(() =>
  onglet.value === 'ARCHIVE' ? 'Archives' : `Courriers ${LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase()}s`,
);
const periodeLisible = computed(
  () => `du ${dateLisible(filtres.value.dateDebut)} au ${dateLisible(filtres.value.dateFin)}`,
);

const titreVide = computed(() =>
  onglet.value === 'ARCHIVE' ? 'Aucun courrier archivé' : `Aucun courrier ${LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase()}`,
);
const aideVide = computed(() =>
  onglet.value === 'ARCHIVE'
    ? 'Un courrier rejoint les archives une fois classé puis clôturé. Élargissez la période, ou suivez les circuits encore ouverts dans les onglets Entrants et Sortants.'
    : `Aucun courrier ${LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase()} ${periodeLisible.value}. Élargissez la période ou retirez les filtres avancés.`,
);

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

/** Cycle de vie du courrier, peint aux couleurs partagées avec la paie. */
function classeStatut(s: string) {
  switch (s) {
    case 'EN_CIRCUIT':
      return 'champ--en-cours';
    case 'TRAITE':
      return 'champ--validee';
    case 'CLASSE':
    case 'ARCHIVE':
      return 'champ--close';
    default:
      return 'champ--brouillon';
  }
}

function libelleStatut(s: string) {
  return LIBELLE_STATUT_COURRIER[s] ?? s;
}

function dateCourrier(c: Courrier): string {
  const d = c.dateReception ?? c.dateEnvoi ?? c.createdAt;
  return dateLisible(d);
}

/**
 * L'onglet est un filtre serveur, pas un tri d'affichage : filtrer en local une
 * page déjà découpée par le serveur donnait un compteur qui ne correspondait
 * jamais à la liste (« 1–20 sur 137 » au-dessus de trois lignes).
 *
 * Les archives (deux statuts de fin) se demandent statut par statut : l'API
 * n'accepte qu'un statut à la fois, on additionne donc les deux appels.
 */
async function charger() {
  chargement.value = true;
  try {
    const commun = {
      search: filtres.value.recherche || undefined,
      dateDebut: filtres.value.dateDebut || undefined,
      dateFin: filtres.value.dateFin || undefined,
      page: filtres.value.page,
      pageSize: filtres.value.pageSize,
    };

    if (onglet.value === 'ARCHIVE') {
      const statuts = filtres.value.statut
        ? [filtres.value.statut].filter((s) => STATUTS_ARCHIVE.includes(s))
        : STATUTS_ARCHIVE;
      if (!statuts.length) {
        courriers.value = [];
        total.value = 0;
        return;
      }
      const reponses = await Promise.all(
        statuts.map((statut) => api.get('/courrier', { params: { ...commun, statut } })),
      );
      courriers.value = reponses.flatMap((r) => r.data.data as Courrier[]);
      total.value = reponses.reduce((t, r) => t + (r.data.total ?? 0), 0);
      return;
    }

    const { data } = await api.get('/courrier', {
      params: { ...commun, type: onglet.value, statut: filtres.value.statut || undefined },
    });
    courriers.value = data.data;
    total.value = data.total;
  } catch (e: any) {
    courriers.value = [];
    total.value = 0;
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement du courrier impossible.',
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

function reinitialiser() {
  filtres.value = {
    recherche: '',
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

watch(onglet, () => {
  filtres.value.page = 1;
  charger();
});
watch(
  () => [
    filtres.value.recherche,
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

<style scoped lang="scss">
@use '../css/champs-admin' as *;

.courrier-carte {
  cursor: pointer;
  transition: background var(--up-transition);

  &:hover {
    background: var(--up-craie);
  }
}

</style>
