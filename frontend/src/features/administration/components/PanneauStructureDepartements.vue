<template>
  <barre-filtres
    :model-value="filtre"
    :placeholder="$t('structure.search.departements')"
    @update:model-value="(v) => emit('update:filtre', v)"
  >
    <template #actions>
      <q-btn
        v-if="peutGerer"
        unelevated
        color="primary"
        no-caps
        icon="add"
        :label="$t('structure.actions.newDepartement')"
        @click="emit('nouvelle')"
      />
    </template>
  </barre-filtres>

  <q-table
    flat
    bordered
    class="carte"
    :rows="departements"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :filter="filtre.recherche"
    :pagination="{ rowsPerPage: 15 }"
  >
    <template #no-data>
      <etat-vide icone="apartment" :titre="titreVide">
        <template v-if="peutGerer" #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('structure.actions.createDepartement')"
            @click="emit('nouvelle')"
          />
        </template>
      </etat-vide>
    </template>
    <template #body-cell-filieres="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          no-caps
          :label="String(p.row._count?.filieres ?? 0)"
          :disable="!(p.row._count?.filieres ?? 0)"
          :aria-label="$t('structure.ariaLabels.seeFilieresOfDepartement')"
          @click="emit('voir-filieres', p.row)"
        >
          <q-tooltip v-if="p.row._count?.filieres">{{ $t('structure.tooltips.seeFilieres') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          icon="edit"
          :aria-label="$t('structure.ariaLabels.editDepartement')"
          @click="emit('modifier', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutSupprimer"
          flat
          dense
          round
          color="negative"
          icon="delete"
          :aria-label="$t('structure.ariaLabels.deleteDepartement')"
          @click="emit('supprimer', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { Departement } from '@/types';

/** Onglet « Départements » de la structure académique. */
defineProps<{
  departements: Departement[];
  chargement: boolean;
  filtre: Record<string, any>;
  titreVide: string;
  peutGerer: boolean;
  peutSupprimer: boolean;
}>();

const emit = defineEmits<{
  'update:filtre': [filtre: Record<string, any>];
  nouvelle: [];
  modifier: [departement: Departement];
  supprimer: [departement: Departement];
  'voir-filieres': [departement: Departement];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('common.fields.name'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'faculte',
    label: t('structure.table.columns.faculte'),
    field: (r: Departement) => r.faculte || '—',
    align: 'left',
  },
  {
    name: 'enseignants',
    label: t('common.fields.teachers'),
    field: (r: Departement) => r._count?.enseignants ?? 0,
    align: 'right',
    sortable: true,
  },
  {
    name: 'filieres',
    label: t('structure.table.columns.filieres'),
    field: (r: Departement) => r._count?.filieres ?? 0,
    align: 'right',
    sortable: true,
  },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);
</script>
