<template>
  <barre-filtres
    :model-value="filtre"
    :chips="chips"
    :placeholder="$t('structure.search.filieres')"
    @update:model-value="(v) => emit('update:filtre', v)"
    @reinitialiser="emit('update:filtre', {})"
  >
    <template #avances>
      <q-select
        :model-value="filtre.departementId"
        :options="optionsDepartements"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('common.fields.department')"
        @update:model-value="(v) => majFiltre('departementId', v)"
      />
    </template>
    <template #actions>
      <q-btn
        v-if="peutGerer"
        unelevated
        color="primary"
        no-caps
        icon="add"
        :label="$t('structure.actions.newFiliere')"
        @click="emit('nouvelle')"
      />
    </template>
  </barre-filtres>

  <q-table
    flat
    bordered
    class="carte"
    :rows="filieres"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :filter="filtre.recherche"
    :pagination="{ rowsPerPage: 15 }"
  >
    <template #no-data>
      <etat-vide icone="account_tree" :titre="titreVide">
        <template v-if="peutGerer" #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('structure.actions.createFiliere')"
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
          icon="groups"
          :aria-label="$t('structure.ariaLabels.seePromotionsOfFiliere')"
          @click="emit('voir-promotions', p.row)"
        >
          <q-tooltip>{{ $t('structure.tooltips.seesPromotions') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          icon="edit"
          :aria-label="$t('structure.ariaLabels.editFiliere')"
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
          :aria-label="$t('structure.ariaLabels.deleteFiliere')"
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
import type { ChipFiltre, Filiere, FiltresPage } from '@/types';

/** Onglet « Filières » de la structure académique. */
const props = defineProps<{
  filieres: Filiere[];
  chargement: boolean;
  filtre: FiltresPage;
  chips: ChipFiltre[];
  optionsDepartements: { label: string; value: string }[];
  titreVide: string;
  peutGerer: boolean;
  peutSupprimer: boolean;
}>();

const emit = defineEmits<{
  'update:filtre': [filtre: FiltresPage];
  nouvelle: [];
  modifier: [filiere: Filiere];
  supprimer: [filiere: Filiere];
  'voir-promotions': [filiere: Filiere];
}>();

const { t } = useI18n();

/** Un filtre se remplace, jamais ne se mute : la page garde la main dessus. */
function majFiltre(cle: string, valeur: unknown) {
  emit('update:filtre', { ...props.filtre, [cle]: valeur });
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('common.fields.name'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: Filiere) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);
</script>
