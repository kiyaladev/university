<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="lignes"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 20 }"
  >
    <template #body-cell-equipements="p">
      <q-td :props="p" class="text-right chiffres">
        {{ p.row._count?.equipements ?? 0 }}
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="peutPlanifier"
          flat
          dense
          round
          icon="edit"
          :aria-label="$t('patrimoine.categories.table.actions.editAria', { name: p.row.libelle })"
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
          :aria-label="$t('patrimoine.categories.table.actions.deleteAria', { name: p.row.libelle })"
          @click="emit('supprimer', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="category"
        :titre="$t('patrimoine.categories.emptyState.title')"
        :aide="$t('patrimoine.categories.emptyState.description')"
      >
        <template v-if="peutPlanifier" #action>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('patrimoine.categories.emptyState.createFirst')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Onglet « Catégories » du patrimoine : le plan d'amortissement du parc.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { CategoriePatrimoine } from '@/types';

defineProps<{
  lignes: CategoriePatrimoine[];
  chargement: boolean;
  peutPlanifier: boolean;
  estAdmin: boolean;
}>();

const emit = defineEmits<{
  creer: [];
  modifier: [categorie: CategoriePatrimoine];
  supprimer: [categorie: CategoriePatrimoine];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left' },
  { name: 'libelle', label: t('common.fields.label'), field: 'libelle', align: 'left' },
  {
    name: 'dureeAmortissement',
    label: t('patrimoine.categories.table.columns.amortization'),
    field: (r: CategoriePatrimoine) => r.dureeAmortissement ?? '—',
    align: 'right',
  },
  {
    name: 'equipements',
    label: t('patrimoine.categories.table.columns.equipments'),
    field: 'equipements',
    align: 'right',
  },
  { name: 'actif', label: t('common.fields.state'), field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>
