<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="salles"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
  >
    <template #no-data>
      <etat-vide icone="meeting_room" :titre="titreVide">
        <template #action>
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('salles.emptyState.createFirst')"
            @click="emit('creer')"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            :label="$t('common.actions.reset_filters')"
            @click="emit('reinitialiser')"
          />
        </template>
      </etat-vide>
    </template>

    <template #body-cell-etat="p">
      <q-td :props="p">
        <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
          {{ p.row.actif ? $t('salles.card.active') : $t('salles.card.inactive') }}
        </q-badge>
      </q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="event_note"
          :aria-label="$t('salles.roomActions.viewSessionsAria')"
          @click="emit('voir-seances', p.row)"
        >
          <q-tooltip>{{ $t('salles.roomActions.viewSessionsTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          icon="print"
          :aria-label="$t('salles.roomActions.printPosterAria')"
          @click="emit('imprimer', p.row.id)"
        >
          <q-tooltip>{{ $t('salles.roomActions.printPosterTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          icon="autorenew"
          :aria-label="$t('salles.roomActions.regenerateAria')"
          @click="emit('regenerer', p.row)"
        >
          <q-tooltip>{{ $t('salles.roomActions.regenerateTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          icon="edit"
          :aria-label="$t('salles.roomActions.editAria')"
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
          :aria-label="$t('salles.roomActions.deleteAria')"
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
import EtatVide from '@/shared/components/EtatVide.vue';
import type { Salle } from '@/types';

/**
 * Vue tableau des salles : pour comparer capacités, bâtiments et repères GPS.
 */
defineProps<{
  salles: Salle[];
  chargement: boolean;
  peutGerer: boolean;
  peutSupprimer: boolean;
  titreVide: string;
  filtresActifs: boolean;
}>();

const emit = defineEmits<{
  creer: [];
  reinitialiser: [];
  'voir-seances': [salle: Salle];
  imprimer: [salleId: string];
  regenerer: [salle: Salle];
  modifier: [salle: Salle];
  supprimer: [salle: Salle];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('common.fields.name'), field: 'nom', align: 'left', sortable: true },
  { name: 'batiment', label: t('common.fields.building'), field: (r: Salle) => r.batiment || '—', align: 'left' },
  { name: 'capacite', label: t('common.fields.capacity'), field: 'capacite', align: 'right', sortable: true },
  {
    name: 'repere',
    label: t('salles.table.columns.gpsMark'),
    field: (r: Salle) => (r.latitude ? `± ${r.rayonMetres} m` : '—'),
    align: 'left',
  },
  { name: 'qr', label: t('salles.table.columns.qrToken'), field: 'qrToken', align: 'left' },
  { name: 'etat', label: t('common.fields.state'), field: 'actif', align: 'left' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);
</script>
