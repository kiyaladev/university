<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="rapport?.lignes ?? []"
    :columns="colonnes"
    row-key="affectationId"
    :loading="chargement"
    :pagination="{ rowsPerPage: 25 }"
  >
    <template #body-cell-avancement="p">
      <q-td :props="p">
        <!-- Un contrat est « en avance » bien plus tôt qu'un taux de
             présence : les seuils sont propres à cet indicateur. -->
        <barre-taux :valeur="p.row.tauxContrat" :seuil-bas="50" :seuil-haut="90" />
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="timelapse"
        :titre="$t('rapports.volume.emptyState.title')"
        :aide="$t('rapports.volume.emptyState.message')"
      >
        <template #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="assignment_ind"
            :label="$t('rapports.volume.emptyState.action')"
            to="/affectations"
          />
        </template>
      </etat-vide>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarreTaux from '@/shared/components/BarreTaux.vue';
import type { RapportVolumeHoraire } from '../services/rapports';

/** Onglet « volume horaire » : le contrat d'un enseignant face au réalisé. */
defineProps<{ rapport: RapportVolumeHoraire | null; chargement: boolean }>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'enseignant', label: t('common.fields.teacher'), field: 'enseignant', align: 'left', sortable: true },
  { name: 'matiere', label: t('common.fields.subject'), field: 'matiere', align: 'left' },
  { name: 'promotion', label: t('rapports.volume.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'prevu', label: t('rapports.volume.table.columns.prevu'), field: 'volumeHorairePrevu', align: 'right' },
  {
    name: 'realise',
    label: t('rapports.volume.table.columns.realise'),
    field: 'heuresRealisees',
    align: 'right',
    sortable: true,
  },
  { name: 'reste', label: t('rapports.volume.table.columns.reste'), field: 'reste', align: 'right' },
  { name: 'seances', label: t('common.fields.sessions'), field: 'planifiees', align: 'right' },
  {
    name: 'avancement',
    label: t('rapports.volume.table.columns.avancement'),
    field: 'tauxContrat',
    align: 'left',
    sortable: true,
  },
]);
</script>
