<template>
  <barre-filtres
    :model-value="filtre"
    :chips="chips"
    :placeholder="$t('structure.search.promotions')"
    @update:model-value="(v) => emit('update:filtre', v)"
    @reinitialiser="emit('update:filtre', {})"
  >
    <template #avances>
      <q-select
        :model-value="filtre.filiereId"
        :options="optionsFilieres"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('common.fields.filiere')"
        @update:model-value="(v) => majFiltre('filiereId', v)"
      />
      <q-select
        :model-value="filtre.anneeId"
        :options="optionsAnnees"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('common.fields.academicYear')"
        @update:model-value="(v) => majFiltre('anneeId', v)"
      />
      <q-select
        :model-value="filtre.niveau"
        :options="NIVEAUX"
        outlined
        dense
        clearable
        :label="$t('common.fields.level')"
        @update:model-value="(v) => majFiltre('niveau', v)"
      />
    </template>
    <template #actions>
      <q-btn
        v-if="peutGerer"
        unelevated
        color="primary"
        no-caps
        icon="add"
        :label="$t('structure.actions.newPromotion')"
        @click="emit('nouvelle')"
      />
    </template>
  </barre-filtres>

  <q-table
    flat
    bordered
    class="carte"
    :rows="promotions"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :filter="filtre.recherche"
    :pagination="{ rowsPerPage: 15 }"
  >
    <template #no-data>
      <etat-vide icone="groups" :titre="titreVide">
        <template v-if="peutGerer" #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('structure.actions.createPromotion')"
            @click="emit('nouvelle')"
          />
        </template>
      </etat-vide>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="assignment_ind"
          :aria-label="$t('structure.ariaLabels.seeChargesOfPromotion')"
          @click="emit('voir-charges', p.row)"
        >
          <q-tooltip>{{ $t('structure.tooltips.seesCharges') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          icon="edit"
          :aria-label="$t('structure.ariaLabels.editPromotion')"
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
          :aria-label="$t('structure.ariaLabels.deletePromotion')"
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
import { NIVEAUX } from '@/shared/utils/libelles';
import type { ChipFiltre } from '@/types';
import type { PromotionListee } from '@/features/administration/services/structure';

/** Onglet « Promotions » de la structure académique. */
const props = defineProps<{
  promotions: PromotionListee[];
  chargement: boolean;
  filtre: Record<string, any>;
  chips: ChipFiltre[];
  optionsFilieres: { label: string; value: string }[];
  optionsAnnees: { label: string; value: string }[];
  titreVide: string;
  peutGerer: boolean;
  peutSupprimer: boolean;
}>();

const emit = defineEmits<{
  'update:filtre': [filtre: Record<string, any>];
  nouvelle: [];
  modifier: [promotion: PromotionListee];
  supprimer: [promotion: PromotionListee];
  'voir-charges': [promotion: PromotionListee];
}>();

const { t } = useI18n();

/** Un filtre se remplace, jamais ne se mute : la page garde la main dessus. */
function majFiltre(cle: string, valeur: unknown) {
  emit('update:filtre', { ...props.filtre, [cle]: valeur });
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('structure.table.columns.promotion'), field: 'nom', align: 'left', sortable: true },
  { name: 'niveau', label: t('common.fields.level'), field: 'niveau', align: 'left', sortable: true },
  {
    name: 'filiere',
    label: t('common.fields.filiere'),
    field: (r: PromotionListee) => r.filiere?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'annee',
    label: t('common.fields.year'),
    field: (r: PromotionListee) => r.annee?.libelle ?? '—',
    align: 'left',
  },
  { name: 'effectif', label: t('common.fields.headcount'), field: 'effectif', align: 'right', sortable: true },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);
</script>
