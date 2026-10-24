<template>
  <div>
    <barre-filtres
      v-model="filtres"
      :placeholder="$t('patrimoine.equipments.searchPlaceholder')"
      :recherche="true"
      @reinitialiser="emit('reinitialiser')"
    >
      <template #avances>
        <champ-recherche
          v-model="filtres.categorieId"
          :label="$t('common.fields.category')"
          endpoint="/patrimoine/categories"
          :endpoint-detail="false"
          :label-fn="(c) => `${c.libelle} (${c.code})`"
          preload
        />
        <champ-recherche
          v-model="filtres.departementId"
          :label="$t('common.fields.department')"
          endpoint="/departements"
          :label-fn="(d) => d.nom"
          preload
        />
        <q-select
          v-model="filtres.actif"
          :options="[
            { label: $t('patrimoine.equipments.filters.statusInService'), value: 'true' },
            { label: $t('patrimoine.equipments.filters.statusOutOfService'), value: 'false' },
          ]"
          dense
          outlined
          emit-value
          map-options
          clearable
          :label="$t('common.fields.status')"
        />
        <q-select
          v-model="filtres.enReparation"
          :options="[
            { label: $t('patrimoine.equipments.filters.repairStateInRepair'), value: 'true' },
            { label: $t('patrimoine.equipments.filters.repairStateAvailable'), value: 'false' },
          ]"
          dense
          outlined
          emit-value
          map-options
          clearable
          :label="$t('common.fields.state')"
        />
      </template>
    </barre-filtres>

    <q-table
      v-if="presentation === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || lignes.length > 0"
    >
      <template #body-cell-libelle="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.libelle }}</div>
          <div class="text-caption text-grey-7">{{ p.row.numeroInventaire }}</div>
        </q-td>
      </template>
      <template #body-cell-categorie="p">
        <q-td :props="p">
          <q-chip dense color="primary" text-color="white">
            {{ p.row.categorie?.libelle ?? '—' }}
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-valeur="p">
        <q-td :props="p" class="text-right chiffres">
          <span v-if="p.row.valeurAcquisition != null">
            {{ montantLisible(p.row.valeurAcquisition) }}
            <span class="text-caption">{{ $t('common.units.gnf') }}</span>
          </span>
          <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
        </q-td>
      </template>
      <template #body-cell-etat="p">
        <q-td :props="p">
          <q-chip
            dense
            :color="p.row.enReparation ? 'warning' : p.row.actif ? 'positive' : 'grey-7'"
            text-color="white"
          >
            {{
              p.row.enReparation
                ? $t('patrimoine.equipments.state.inRepair')
                : p.row.actif
                  ? $t('patrimoine.equipments.state.inService')
                  : $t('patrimoine.equipments.state.outOfService')
            }}
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
            :aria-label="$t('patrimoine.equipments.table.actions.detailsAria', { name: p.row.libelle })"
            @click="emit('voirDetails', p.row)"
          >
            <q-tooltip>{{ $t('patrimoine.equipments.table.actions.detailsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('patrimoine.equipments.table.actions.printAria', { name: p.row.libelle })"
            @click="emit('imprimer', p.row)"
          >
            <q-tooltip>{{ $t('patrimoine.equipments.table.actions.printTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutPlanifier && !p.row.enReparation"
            flat
            dense
            round
            icon="build"
            :aria-label="$t('patrimoine.equipments.table.actions.declareRepairAria', { name: p.row.libelle })"
            @click="emit('declarerReparation', p.row)"
          >
            <q-tooltip>{{ $t('patrimoine.equipments.table.actions.declareRepairTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutPlanifier"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('patrimoine.equipments.table.actions.editAria', { name: p.row.libelle })"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('patrimoine.equipments.table.actions.deleteAria', { name: p.row.libelle })"
            @click="emit('supprimer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="inventory_2"
          :titre="$t('patrimoine.equipments.emptyState.title')"
          :aide="aideVideEquipements"
        >
          <template #action>
            <q-btn
              v-if="aDesFiltres"
              flat
              dense
              no-caps
              color="primary"
              icon="filter_alt_off"
              :label="$t('patrimoine.equipments.emptyState.removeFilters')"
              @click="emit('reinitialiser')"
            />
            <q-btn
              v-else-if="peutPlanifier"
              unelevated
              no-caps
              color="primary"
              icon="add"
              :label="$t('patrimoine.equipments.emptyState.createFirst')"
              @click="emit('creer')"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="e in lignes" :key="e.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section>
            <div class="text-h6 ellipsis">{{ e.libelle }}</div>
            <div class="text-caption text-grey-7">{{ e.numeroInventaire }}</div>
          </q-card-section>
          <q-card-section class="row items-center">
            <div class="col-4 text-center">
              <canvas :ref="(el) => enregistrerCanvas(el, e)" />
            </div>
            <div class="col-8">
              <q-chip dense color="primary" text-color="white">
                {{ e.categorie?.libelle ?? '—' }}
              </q-chip>
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ e.departement?.nom ?? $t('patrimoine.equipments.filters.noDepartment') }}
              </div>
              <div class="text-caption text-grey-7" v-if="e.valeurAcquisition != null">
                {{ montantLisible(e.valeurAcquisition) }} {{ $t('common.units.gnf') }}
              </div>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-chip dense :color="e.enReparation ? 'warning' : e.actif ? 'positive' : 'grey-7'" text-color="white">
              {{
                e.enReparation
                  ? $t('patrimoine.equipments.state.inRepair')
                  : e.actif
                    ? $t('patrimoine.equipments.state.inService')
                    : $t('patrimoine.equipments.state.outOfService')
              }}
            </q-chip>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              round
              icon="visibility"
              :aria-label="$t('common.actions.details')"
              @click="emit('voirDetails', e)"
            >
              <q-tooltip>{{ $t('common.actions.details') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="print"
              :aria-label="$t('patrimoine.equipments.cards.labelTooltip')"
              @click="emit('imprimer', e)"
            >
              <q-tooltip>{{ $t('patrimoine.equipments.cards.labelTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutPlanifier && !e.enReparation"
              flat
              dense
              round
              icon="build"
              :aria-label="$t('patrimoine.equipments.table.actions.declareRepairAria', { name: e.libelle })"
              @click="emit('declarerReparation', e)"
            >
              <q-tooltip>{{ $t('patrimoine.equipments.table.actions.declareRepairTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutPlanifier"
              flat
              dense
              round
              icon="edit"
              :aria-label="$t('patrimoine.equipments.table.actions.editAria', { name: e.libelle })"
              @click="emit('modifier', e)"
            >
              <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!lignes.length && !chargement"
        class="col-12"
        icone="inventory_2"
        :titre="$t('patrimoine.equipments.emptyState.title')"
        :aide="aideVideEquipements"
      >
        <template #action>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            :label="$t('patrimoine.equipments.emptyState.removeFilters')"
            @click="emit('reinitialiser')"
          />
          <q-btn
            v-else-if="peutPlanifier"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('patrimoine.equipments.emptyState.createFirst')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </div>

    <barre-pagination v-model:page="page" v-model:page-size="pageSize" :total="total" :show-all="false" />
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Équipements » du patrimoine : l'inventaire, ses filtres et ses
 * actions. La page garde la liste et la pagination ; ce composant présente les
 * lignes et rend les actions.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { montantLisible } from '@/shared/utils/format';
import type { EquipementPatrimoine, FiltresPage } from '@/types';

defineProps<{
  lignes: EquipementPatrimoine[];
  chargement: boolean;
  total: number;
  peutPlanifier: boolean;
  estAdmin: boolean;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<FiltresPage>('filtres', { required: true });
/** Pagination : la page garde l'état, pour rester synchronisée avec l'URL. */
const page = defineModel<number>('page', { required: true });
const pageSize = defineModel<number>('pageSize', { required: true });

const emit = defineEmits<{
  creer: [];
  modifier: [equipement: EquipementPatrimoine];
  supprimer: [equipement: EquipementPatrimoine];
  voirDetails: [equipement: EquipementPatrimoine];
  imprimer: [equipement: EquipementPatrimoine];
  declarerReparation: [equipement: EquipementPatrimoine];
  reinitialiser: [];
}>();

const { t } = useI18n();
const presentation = usePresentationListe();

/** Un filtre autre que la recherche vide est posé sur la liste. */
const aDesFiltres = computed(() => Object.values(filtres.value).some(Boolean));

const aideVideEquipements = computed(() =>
  `${t('patrimoine.equipments.emptyState.description')} ${aDesFiltres.value ? t('patrimoine.equipments.emptyState.noneMatchFilters') : ''}`.trim(),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('patrimoine.equipments.table.columns.equipment'), field: 'libelle', align: 'left' },
  { name: 'categorie', label: t('common.fields.category'), field: 'categorie', align: 'left' },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: EquipementPatrimoine) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'valeur', label: t('patrimoine.equipments.table.columns.value'), field: 'valeur', align: 'right' },
  { name: 'serie', label: t('patrimoine.equipments.table.columns.serial'), field: 'numeroSerie', align: 'left' },
  { name: 'etat', label: t('common.fields.state'), field: 'etat', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function enregistrerCanvas(el: unknown, e: EquipementPatrimoine) {
  if (!(el instanceof HTMLCanvasElement)) return;
  QRCode.toCanvas(el, e.qrCode, { width: 96, margin: 1 }).catch(() => {});
}
</script>
