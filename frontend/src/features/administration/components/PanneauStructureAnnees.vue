<template>
  <barre-filtres
    :model-value="filtre"
    :placeholder="$t('structure.search.annees')"
    @update:model-value="(v) => emit('update:filtre', v)"
  >
    <template #actions>
      <q-btn
        v-if="peutGerer"
        unelevated
        color="primary"
        no-caps
        icon="add"
        :label="$t('structure.actions.newAnnee')"
        @click="emit('nouvelle')"
      />
    </template>
  </barre-filtres>

  <q-table
    flat
    bordered
    class="carte"
    :rows="annees"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :filter="filtre.recherche"
    :pagination="{ rowsPerPage: 10 }"
  >
    <template #no-data>
      <etat-vide icone="event" :titre="titreVide">
        <template v-if="peutGerer" #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('structure.actions.createAnnee')"
            @click="emit('nouvelle')"
          />
        </template>
      </etat-vide>
    </template>
    <template #body-cell-active="p">
      <q-td :props="p">
        <q-chip v-if="p.row.active" dense color="positive" text-color="white">{{
          $t('structure.table.active')
        }}</q-chip>
        <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="groups"
          :aria-label="$t('structure.ariaLabels.seePromotionsOfAnnee')"
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
          :aria-label="$t('structure.ariaLabels.editAnnee')"
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
          :aria-label="$t('structure.ariaLabels.deleteAnnee')"
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
import { dateLisible } from '@/shared/utils/libelles';
import type { AnneeAcademique } from '@/types';

/** Onglet « Années » de la structure académique : les années et leurs promotions. */
defineProps<{
  annees: AnneeAcademique[];
  chargement: boolean;
  filtre: Record<string, any>;
  titreVide: string;
  peutGerer: boolean;
  peutSupprimer: boolean;
}>();

const emit = defineEmits<{
  'update:filtre': [filtre: Record<string, any>];
  nouvelle: [];
  modifier: [annee: AnneeAcademique];
  supprimer: [annee: AnneeAcademique];
  'voir-promotions': [annee: AnneeAcademique];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('common.fields.year'), field: 'libelle', align: 'left', sortable: true },
  {
    name: 'debut',
    label: t('common.fields.start'),
    field: (r: AnneeAcademique) => dateLisible(r.dateDebut),
    align: 'left',
  },
  {
    name: 'fin',
    label: t('common.fields.end'),
    field: (r: AnneeAcademique) => dateLisible(r.dateFin),
    align: 'left',
  },
  { name: 'active', label: t('common.fields.status'), field: 'active', align: 'left' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);
</script>
