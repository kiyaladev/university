<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="rapport?.lignes ?? []"
    :columns="colonnes"
    row-key="enseignantId"
    :loading="chargement"
    :pagination="{ rowsPerPage: 25 }"
  >
    <template #top-right>
      <div class="text-caption text-grey-7">
        {{
          $t('rapports.assiduite.total', {
            planifiees: rapport?.total?.planifiees ?? 0,
            presence: pourcentLisible(rapport?.total?.tauxPresence),
            heures: heuresLisibles(rapport?.total?.heuresRealisees),
          })
        }}
      </div>
    </template>
    <template #body-cell-taux="p">
      <q-td :props="p">
        <barre-taux :valeur="p.row.tauxPresence" />
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="print"
          :aria-label="$t('rapports.actions.printFicheAria', { nom: p.row.nom })"
          @click="emit('imprimerFiche', p.row.enseignantId)"
        >
          <q-tooltip>{{ $t('rapports.actions.printFicheTooltip') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="how_to_reg"
        :titre="$t('rapports.assiduite.emptyState.title')"
        :aide="$t('rapports.assiduite.emptyState.message')"
      >
        <template #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="event"
            :label="$t('rapports.assiduite.emptyState.action')"
            to="/emploi-du-temps"
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
import { heuresLisibles, pourcentLisible } from '@/shared/utils/libelles';
import type { RapportAssiduite } from '../services/rapports';

/** Onglet « assiduité » : le bilan de présence de chaque enseignant. */
defineProps<{ rapport: RapportAssiduite | null; chargement: boolean }>();
const emit = defineEmits<{ imprimerFiche: [string] }>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('rapports.assiduite.table.columns.matricule'), field: 'matricule', align: 'left' },
  { name: 'nom', label: t('common.fields.teacher'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('rapports.assiduite.table.columns.departement'),
    field: 'departement',
    align: 'left',
  },
  {
    name: 'planifiees',
    label: t('rapports.assiduite.table.columns.planifiees'),
    field: 'planifiees',
    align: 'right',
    sortable: true,
  },
  { name: 'controlees', label: t('rapports.assiduite.table.columns.controlees'), field: 'controlees', align: 'right' },
  { name: 'assurees', label: t('rapports.assiduite.table.columns.assurees'), field: 'assurees', align: 'right' },
  {
    name: 'retard',
    label: t('rapports.assiduite.table.columns.retard'),
    field: 'retard',
    align: 'right',
    sortable: true,
  },
  { name: 'absent', label: t('common.fields.absences'), field: 'absent', align: 'right', sortable: true },
  {
    name: 'heures',
    label: t('common.fields.hours'),
    field: (r: { heuresRealisees?: number }) => heuresLisibles(r.heuresRealisees),
    align: 'right',
  },
  { name: 'taux', label: t('common.fields.attendance'), field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'enseignantId', align: 'right' },
]);
</script>
