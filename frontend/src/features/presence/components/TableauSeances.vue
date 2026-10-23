<template>
  <q-table
    flat
    bordered
    class="carte registre__tableau"
    :rows="seances"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 50 }"
    :visible-columns="colonnesVisibles"
    :dense="$q.screen.lt.md"
    @row-click="(_, ligne) => $q.screen.lt.md && emit('detail', ligne)"
  >
    <template #body-cell-etat="p">
      <q-td :props="p">
        <champ-statut :statut="p.row.controle?.statut ?? 'NON_CONTROLE'" />
      </q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="visibility"
          :aria-label="$t('seances.table.actions.viewDetail')"
          @click="emit('detail', p.row)"
        >
          <q-tooltip>{{ $t('seances.table.actions.detail') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutPointer && p.row.statut !== 'ANNULE'"
          dense
          unelevated
          no-caps
          color="primary"
          :icon="p.row.controle ? 'edit' : 'how_to_reg'"
          :label="p.row.controle ? $t('seances.table.actions.correct') : $t('seances.table.actions.check')"
          @click="emit('pointer', p.row)"
        />
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import ChampStatut from './ChampStatut.vue';
import { dateLisible, dureeLisible } from '@/shared/utils/libelles';
import type { Seance } from '@/types';

/**
 * Vue tableau du registre des séances : la lecture qui compare et qui trie.
 *
 * Les colonnes vivent avec la table : c'est le seul endroit qui les utilise,
 * et la page n'a plus à porter cette définition.
 */
defineProps<{ seances: Seance[]; chargement: boolean; peutPointer: boolean }>();
const emit = defineEmits<{ detail: [Seance]; pointer: [Seance] }>();

const $q = useQuasar();
const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'date',
    label: t('common.fields.date'),
    field: (r: Seance) => r.date,
    format: (v: string) => dateLisible(v),
    align: 'left',
    sortable: true,
  },
  {
    name: 'heure',
    label: t('seances.table.columns.schedule'),
    field: (r: Seance) => `${r.heureDebut}–${r.heureFin}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'enseignant',
    label: t('common.fields.teacher'),
    field: (r: Seance) => `${r.affectation?.enseignant?.nom ?? ''} ${r.affectation?.enseignant?.prenom ?? ''}`.trim(),
    align: 'left',
    sortable: true,
  },
  {
    name: 'matiere',
    label: t('common.fields.subject'),
    field: (r: Seance) => r.affectation?.matiere?.intitule ?? '—',
    align: 'left',
    sortable: true,
  },
  {
    name: 'promotion',
    label: t('seances.table.columns.promotion'),
    field: (r: Seance) => r.affectation?.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'salle', label: t('common.fields.room'), field: (r: Seance) => r.salle?.code ?? '—', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  {
    name: 'duree',
    label: t('seances.table.columns.durationObserved'),
    field: (r: Seance) => (r.controle ? dureeLisible(r.controle.dureeMinutes) : '—'),
    align: 'right',
  },
  {
    name: 'etat',
    label: t('seances.table.columns.status'),
    field: (r: Seance) => r.controle?.statut ?? '',
    align: 'left',
    sortable: true,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

// Sur téléphone le tableau reste consultable : trois colonnes tiennent dans
// 390 px sans déborder, et la ligne entière ouvre le détail — d'où on peut
// pointer. Garder la colonne d'actions poussait l'état hors de l'écran.
const colonnesVisibles = computed(() =>
  $q.screen.lt.md ? ['heure', 'enseignant', 'etat'] : colonnes.value.map((c) => String(c.name)),
);
</script>
