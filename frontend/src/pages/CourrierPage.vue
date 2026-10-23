<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('courrierPage.title')" :subtitle="$t('courrierPage.subtitle')">
      <template v-if="peutCreer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('courrierPage.actions.register')"
          @click="ouvrirCreation"
        />
      </template>
    </page-header>

    <q-tabs v-model="onglet" dense no-caps align="left" class="onglets-panneau q-mb-md" narrow-indicator>
      <q-tab name="ENTRANT" :label="$t('courrierPage.tabs.entrant')" icon="inbox" />
      <q-tab name="SORTANT" :label="$t('courrierPage.tabs.sortant')" icon="send" />
      <q-tab name="ARCHIVE" :label="$t('courrierPage.tabs.archive')" icon="inventory_2" />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      :placeholder="$t('courrierPage.filters.searchPlaceholder')"
      :chips="chipsFiltres"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('courrierPage.filters.status')"
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('courrierPage.filters.from')" />
        <champ-date v-model="filtres.dateFin" :label="$t('courrierPage.filters.to')" />
      </template>
    </filter-bar>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ ligneResume }}
    </div>

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
            {{ $t('courrierPage.table.steps', { count: p.row.circuits?.length ?? 0 }) }}
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
            :aria-label="$t('courrierPage.actionsColumn.detailAria', { numero: p.row.numero })"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('courrierPage.actionsColumn.detailTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('courrierPage.actionsColumn.printAria', { numero: p.row.numero })"
            @click.stop="imprimer(p.row)"
          >
            <q-tooltip>{{ $t('courrierPage.actionsColumn.printTooltip') }}</q-tooltip>
          </q-btn>
          <template v-if="peutCloturer(p.row)">
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="archive"
              :aria-label="$t('courrierPage.actionsColumn.closeAria', { numero: p.row.numero })"
              @click.stop="cloturer(p.row)"
            >
              <q-tooltip>{{ $t('courrierPage.actionsColumn.closeTooltip') }}</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide icone="mail" :titre="titreVide" :aide="aideVide">
          <template #action>
            <q-btn
              v-if="peutCreer"
              unelevated
              no-caps
              color="primary"
              icon="add"
              :label="$t('courrierPage.actions.register')"
              @click="ouvrirCreation"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div
        v-for="c in liste.lignes"
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
                  {{ c.type === 'ENTRANT' ? $t('courrierPage.card.from', { value: c.expediteur ?? '—' }) : $t('courrierPage.card.to', { value: c.destinataire ?? '—' }) }}
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
                {{ $t('courrierPage.card.stamps', { count: c.circuits?.length ?? 0 }) }}
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="print" :label="$t('courrierPage.card.print')" @click.stop="imprimer(c)" />
            <q-btn v-if="peutCloturer(c)" flat dense no-caps color="negative" icon="archive" :label="$t('courrierPage.card.close')" @click.stop="cloturer(c)" />
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide v-if="!liste.lignes.length && !liste.chargement" class="col-12" icone="mail" :titre="titreVide" :aide="aideVide">
        <template #action>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('courrierPage.actions.register')"
            @click="ouvrirCreation"
          />
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.pageSize = Math.max(liste.total, 200)"
    />

    <courrier-detail-dialog
      v-model="dialogDetailOuvert"
      :courrier-id="courrierSelectionne?.id ?? null"
      @modifie="liste.recharger()"
    />

    <courrier-circuit-dialog
      v-model="dialogCreationOuvert"
      @enregistre="liste.recharger()"
    />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
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
import { ouvrirImpression } from '../services/impression';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';

/** Les archives ne sont pas un type de courrier mais deux statuts de fin. */
const STATUTS_ARCHIVE = ['CLASSE', 'ARCHIVE'];

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const { confirmer } = useConfirmation();
const modeVue = usePresentationListe();
const dialogDetailOuvert = ref(false);
const dialogCreationOuvert = ref(false);
const courrierSelectionne = ref<Courrier | null>(null);

type Onglet = 'ENTRANT' | 'SORTANT' | 'ARCHIVE';

const onglet = ref<Onglet>('ENTRANT');
const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -90),
  dateFin: aujourdhui(),
});

/**
 * L'onglet est un filtre serveur, pas un tri d'affichage : filtrer en local une
 * page déjà découpée par le serveur donnait un compteur qui ne correspondait
 * jamais à la liste (« 1–20 sur 137 » au-dessus de trois lignes).
 *
 * Les archives (deux statuts de fin) se demandent statut par statut : l'API
 * n'accepte qu'un statut à la fois, on additionne donc les deux appels.
 */
const liste = reactive(
  useListePaginee<Courrier>({
    filtres,
    syncUrl: true,
    charger: async ({ filtres: f, ...p }) => {
      const commun = {
        ...pageApi(p),
        search: texteApi(f.recherche),
        dateDebut: f.dateDebut || undefined,
        dateFin: f.dateFin || undefined,
      };
      if (onglet.value === 'ARCHIVE') {
        const statuts = f.statut ? [f.statut].filter((s) => STATUTS_ARCHIVE.includes(s)) : STATUTS_ARCHIVE;
        const reponses = await Promise.all(
          statuts.map((statut) => api.get('/courrier', { params: { ...commun, statut } })),
        );
        return {
          data: reponses.flatMap((r) => r.data.data as Courrier[]),
          total: reponses.reduce((t, r) => t + (r.data.total ?? 0), 0),
        };
      }
      const { data } = await api.get('/courrier', {
        params: { ...commun, type: onglet.value, statut: f.statut || undefined },
      });
      return data;
    },
  }),
);
// Changer d'onglet ramène en page 1 (le setter de `page` recharge).
watch(onglet, () => {
  liste.page = 1;
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
    chips.push({
      label: t('courrierPage.filters.searchChip', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      defaut: true,
    });
  }
  if (filtres.value.statut) {
    chips.push({
      label: t('courrierPage.filters.statusChip', {
        value: LIBELLE_STATUT_COURRIER[filtres.value.statut] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
    });
  }
  return chips;
});

const libelleOnglet = computed(() =>
  onglet.value === 'ARCHIVE'
    ? t('courrierPage.summary.archiveLabel')
    : t('courrierPage.summary.tabLabel', { type: LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase() }),
);
const periodeLisible = computed(() =>
  t('courrierPage.summary.period', {
    debut: dateLisible(filtres.value.dateDebut),
    fin: dateLisible(filtres.value.dateFin),
  }),
);

const ligneResume = computed(() =>
  t('courrierPage.summary.line', {
    onglet: libelleOnglet.value,
    periode: periodeLisible.value,
    total: liste.total,
  }),
);

const titreVide = computed(() =>
  onglet.value === 'ARCHIVE'
    ? t('courrierPage.emptyState.archiveTitle')
    : t('courrierPage.emptyState.typeTitle', { type: LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase() }),
);
const aideVide = computed(() =>
  onglet.value === 'ARCHIVE'
    ? t('courrierPage.emptyState.archiveHint')
    : t('courrierPage.emptyState.typeHint', {
        type: LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase(),
        periode: periodeLisible.value,
      }),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('courrierPage.table.columns.numero'), field: 'numero', align: 'left', sortable: true },
  {
    name: 'objet',
    label: t('courrierPage.table.columns.objet'),
    field: 'objet',
    align: 'left',
  },
  { name: 'type', label: t('courrierPage.table.columns.type'), field: 'type', align: 'left' },
  {
    name: 'correspondant',
    label: t('courrierPage.table.columns.correspondant'),
    field: (r: Courrier) => (r.type === 'ENTRANT' ? r.expediteur : r.destinataire) ?? '—',
    align: 'left',
  },
  {
    name: 'date',
    label: t('courrierPage.table.columns.date'),
    field: (r: Courrier) => dateCourrier(r),
    align: 'left',
  },
  { name: 'circuits', label: t('courrierPage.table.columns.circuit'), field: 'circuits', align: 'left' },
  { name: 'statut', label: t('courrierPage.table.columns.statut'), field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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

function ouvrirCreation() {
  dialogCreationOuvert.value = true;
}

function ouvrirDetail(c: Courrier) {
  courrierSelectionne.value = c;
  dialogDetailOuvert.value = true;
}

function imprimer(c: Courrier) {
  void ouvrirImpression(`/courrier/${c.id}/imprimer`);
}

async function cloturer(c: Courrier) {
  const ok = await confirmer({
    titre: t('courrierPage.dialogs.close.title'),
    message: t('courrierPage.dialogs.close.message', { numero: c.numero }),
    ok: t('courrierPage.dialogs.close.okLabel'),
    danger: true,
  });
  if (!ok) return;
  try {
    await api.post(`/courrier/${c.id}/cloturer`, {});
    $q.notify({ type: 'positive', message: t('courrierPage.messages.closed') });
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}
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
