<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('courrier.title')" :subtitle="$t('courrier.subtitle')">
      <template v-if="peutCreer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('courrier.actions.register')"
          @click="ouvrirCreation"
        />
      </template>
    </en-tete-page>

    <q-tabs v-model="onglet" dense no-caps align="left" class="onglets-panneau q-mb-md" narrow-indicator>
      <q-tab name="ENTRANT" :label="$t('courrier.tabs.entrant')" icon="inbox" />
      <q-tab name="SORTANT" :label="$t('courrier.tabs.sortant')" icon="send" />
      <q-tab name="ARCHIVE" :label="$t('courrier.tabs.archive')" icon="inventory_2" />
    </q-tabs>

    <barre-filtres
      v-model="filtres"
      :placeholder="$t('courrier.filters.searchPlaceholder')"
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
          :label="$t('common.fields.status')"
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('common.actions.from')" />
        <champ-date v-model="filtres.dateFin" :label="$t('common.actions.to')" />
      </template>
    </barre-filtres>

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
          <PastilleStatut domaine="courrier" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-circuits="p">
        <q-td :props="p">
          <q-chip dense size="xs" :color="p.row.circuits?.length ? 'secondary' : 'grey-5'">
            {{ $t('courrier.table.steps', { count: p.row.circuits?.length ?? 0 }) }}
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
            :aria-label="$t('courrier.actionsColumn.detailAria', { numero: p.row.numero })"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('courrier.actionsColumn.detailTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('courrier.actionsColumn.printAria', { numero: p.row.numero })"
            @click.stop="imprimer(p.row)"
          >
            <q-tooltip>{{ $t('courrier.actionsColumn.printTooltip') }}</q-tooltip>
          </q-btn>
          <template v-if="peutCloturer(p.row)">
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="archive"
              :aria-label="$t('courrier.actionsColumn.closeAria', { numero: p.row.numero })"
              @click.stop="cloturer(p.row)"
            >
              <q-tooltip>{{ $t('courrier.actionsColumn.closeTooltip') }}</q-tooltip>
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
              :label="$t('courrier.actions.register')"
              @click="ouvrirCreation"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="c in liste.lignes" :key="c.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte courrier-carte full-height" @click="ouvrirDetail(c)">
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-7">{{ c.numero }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ c.objet }}</div>
                <div class="text-caption q-mt-xs">
                  {{
                    c.type === 'ENTRANT'
                      ? $t('courrier.card.from', { value: c.expediteur ?? '—' })
                      : $t('courrier.card.to', { value: c.destinataire ?? '—' })
                  }}
                </div>
              </div>
              <PastilleStatut domaine="courrier" :statut="c.statut" />
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
                {{ $t('courrier.card.stamps', { count: c.circuits?.length ?? 0 }) }}
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="print" :label="$t('courrier.card.print')" @click.stop="imprimer(c)" />
            <q-btn
              v-if="peutCloturer(c)"
              flat
              dense
              no-caps
              color="negative"
              icon="archive"
              :label="$t('common.actions.closeOut')"
              @click.stop="cloturer(c)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!liste.lignes.length && !liste.chargement"
        class="col-12"
        icone="mail"
        :titre="titreVide"
        :aide="aideVide"
      >
        <template #action>
          <q-btn
            v-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('courrier.actions.register')"
            @click="ouvrirCreation"
          />
        </template>
      </etat-vide>
    </div>

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-detail-courrier
      v-model="dialogDetailOuvert"
      :courrier-id="courrierSelectionne?.id ?? null"
      @modifie="liste.recharger()"
    />

    <dialogue-circuit-courrier v-model="dialogCreationOuvert" @enregistre="liste.recharger()" />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueDetailCourrier from '../components/DialogueDetailCourrier.vue';
import DialogueCircuitCourrier from '../components/DialogueCircuitCourrier.vue';
import {
  LIBELLE_STATUT_COURRIER,
  LIBELLE_TYPE_COURRIER,
  aujourdhui,
  dateLisible,
  decalerJours,
} from '@/shared/utils/libelles';
import type { Courrier, ChipFiltre } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { courrierService, listeCourrierArchive, type Onglet } from '../services/courrier';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const { confirmer } = useConfirmation();
const modeVue = usePresentationListe();
const dialogDetailOuvert = ref(false);
const dialogCreationOuvert = ref(false);
const courrierSelectionne = ref<Courrier | null>(null);

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
        return listeCourrierArchive(commun, f.statut);
      }
      return courrierService.liste({ ...commun, type: onglet.value, statut: f.statut || undefined });
    },
  }),
);
// Changer d'onglet ramène en page 1 (le setter de `page` recharge).
watch(onglet, () => {
  liste.page = 1;
});

const peutCreer = computed(() => auth.peut('courrier.creer'));
const peutCloturer = (c: Courrier) =>
  auth.peut('courrier.cloturer') && ['EN_CIRCUIT', 'TRAITE', 'CLASSE'].includes(c.statut);

const optionsStatuts = Object.entries(LIBELLE_STATUT_COURRIER).map(([value, label]) => ({
  value,
  label,
}));

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({
      label: t('courrier.filters.searchChip', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      defaut: true,
    });
  }
  if (filtres.value.statut) {
    chips.push({
      label: t('courrier.filters.statusChip', {
        value: LIBELLE_STATUT_COURRIER[filtres.value.statut] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
    });
  }
  return chips;
});

const libelleOnglet = computed(() =>
  onglet.value === 'ARCHIVE'
    ? t('courrier.summary.archiveLabel')
    : t('courrier.summary.tabLabel', { type: LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase() }),
);
const periodeLisible = computed(() =>
  t('courrier.summary.period', {
    debut: dateLisible(filtres.value.dateDebut),
    fin: dateLisible(filtres.value.dateFin),
  }),
);

const ligneResume = computed(() =>
  t('courrier.summary.line', {
    onglet: libelleOnglet.value,
    periode: periodeLisible.value,
    total: liste.total,
  }),
);

const titreVide = computed(() =>
  onglet.value === 'ARCHIVE'
    ? t('courrier.emptyState.archiveTitle')
    : t('courrier.emptyState.typeTitle', { type: LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase() }),
);
const aideVide = computed(() =>
  onglet.value === 'ARCHIVE'
    ? t('courrier.emptyState.archiveHint')
    : t('courrier.emptyState.typeHint', {
        type: LIBELLE_TYPE_COURRIER[onglet.value].toLowerCase(),
        periode: periodeLisible.value,
      }),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  {
    name: 'objet',
    label: t('courrier.table.columns.objet'),
    field: 'objet',
    align: 'left',
  },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  {
    name: 'correspondant',
    label: t('courrier.table.columns.correspondant'),
    field: (r: Courrier) => (r.type === 'ENTRANT' ? r.expediteur : r.destinataire) ?? '—',
    align: 'left',
  },
  {
    name: 'date',
    label: t('common.fields.date'),
    field: (r: Courrier) => dateCourrier(r),
    align: 'left',
  },
  { name: 'circuits', label: t('courrier.table.columns.circuit'), field: 'circuits', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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
    titre: t('courrier.dialogs.close.title'),
    message: t('courrier.dialogs.close.message', { numero: c.numero }),
    ok: t('common.actions.closeOut'),
    danger: true,
  });
  if (!ok) return;
  await courrierService.cloturer(c.id);
  $q.notify({ type: 'positive', message: t('courrier.messages.closed') });
  await liste.recharger();
}
</script>

<style scoped lang="scss">
.courrier-carte {
  cursor: pointer;
  transition: background var(--up-transition);

  &:hover {
    background: var(--up-craie);
  }
}
</style>
