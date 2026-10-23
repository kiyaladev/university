<template>
  <div>
    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-subtitle2">{{ $t('rapports.controleurs.title') }}</div>
          <div class="text-caption text-grey-7">{{ $t('rapports.controleurs.help') }}</div>
        </div>
        <div class="col-auto text-caption">
          {{ $t('rapports.controleurs.unassigned', { count: rapport?.nonAffectees?.seancesPassees ?? 0 }) }}
        </div>
      </q-card-section>
    </q-card>
    <q-table
      flat
      bordered
      class="carte"
      :rows="rapport?.lignes ?? []"
      :columns="colonnes"
      row-key="controleurId"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25 }"
    >
      <template #body-cell-tauxCouverture="p">
        <q-td :props="p"><barre-taux :valeur="p.row.tauxCouverture" /></q-td>
      </template>
      <template #body-cell-tauxParAssigne="p">
        <q-td :props="p"><barre-taux :valeur="p.row.tauxParAssigne" /></q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="route"
          :titre="$t('rapports.controleurs.emptyTitle')"
          :aide="$t('rapports.controleurs.emptyHelp')"
        >
          <template #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="event"
              :label="$t('rapports.controleurs.emptyAction')"
              to="/seances"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarreTaux from '@/shared/components/BarreTaux.vue';
import { pourcentLisible } from '@/shared/utils/libelles';
import type { RapportCouverture } from '../services/rapports';

/** Onglet « contrôleurs » : la couverture des tournées sur la période. */
defineProps<{ rapport: RapportCouverture | null; chargement: boolean }>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('rapports.controleurs.columns.controller'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'seancesPassees',
    label: t('rapports.controleurs.columns.assigned'),
    field: 'seancesPassees',
    align: 'right',
    sortable: true,
  },
  {
    name: 'visitees',
    label: t('rapports.controleurs.columns.visited'),
    field: 'visitees',
    align: 'right',
    sortable: true,
  },
  {
    name: 'nonVisitees',
    label: t('rapports.controleurs.columns.missed'),
    field: 'nonVisitees',
    align: 'right',
    sortable: true,
  },
  {
    name: 'realiseesParAssigne',
    label: t('rapports.controleurs.columns.byAssigned'),
    field: 'realiseesParAssigne',
    align: 'right',
  },
  {
    name: 'realiseesParUnAutre',
    label: t('rapports.controleurs.columns.coveredByPeer'),
    field: 'realiseesParUnAutre',
    align: 'right',
  },
  {
    name: 'tauxCouverture',
    label: t('rapports.controleurs.columns.coverage'),
    field: (r: { tauxCouverture?: number }) => pourcentLisible(r.tauxCouverture),
    align: 'left',
    sortable: true,
  },
  {
    name: 'tauxParAssigne',
    label: t('rapports.controleurs.columns.ownRate'),
    field: (r: { tauxParAssigne?: number }) => pourcentLisible(r.tauxParAssigne),
    align: 'left',
    sortable: true,
  },
]);
</script>
