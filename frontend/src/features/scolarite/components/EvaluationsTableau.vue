<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="lignes"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
  >
    <template #no-data>
      <etat-vide icone="fact_check" :titre="messageVide">
        <template #action>
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            :label="$t('common.actions.reset_filters')"
            @click="emit('reinitialiser')"
          />
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('evaluations.actions.new')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </template>

    <template #body-cell-type="p">
      <q-td :props="p">{{ LIBELLE_TYPE_EVALUATION[p.row.type] }}</q-td>
    </template>

    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="evaluation" :statut="p.row.statut" />
      </q-td>
    </template>

    <template #body-cell-notes="p">
      <q-td :props="p">
        <q-badge outline color="primary" :label="libelleNotes(p.row)" />
      </q-td>
    </template>

    <template #body-cell-date="p">
      <q-td :props="p">{{ dateLisible(p.row.date) }}</q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="p.row.statut !== 'OUVERT' || !peutSaisir"
          flat
          dense
          no-caps
          icon="visibility"
          :aria-label="$t('evaluations.table.view_notes_aria')"
          :label="$t('evaluations.table.view_notes_aria')"
          @click="emit('voir-notes', p.row)"
        >
          <q-tooltip>{{ $t('evaluations.table.view_notes') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="p.row.statut === 'OUVERT' && peutSaisir"
          flat
          dense
          no-caps
          icon="edit_note"
          color="primary"
          :aria-label="$t('evaluations.table.enter_notes_aria')"
          :label="$t('evaluations.table.enter_notes_aria')"
          @click="emit('saisir-notes', p.row)"
        >
          <q-tooltip>{{ $t('evaluations.table.enter_notes') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'OUVERT' && peutGerer"
            flat
            dense
            no-caps
            icon="lock"
            :aria-label="$t('evaluations.table.close_evaluation_aria')"
            :label="$t('evaluations.table.close_evaluation_aria')"
            @click="emit('cloturer', p.row)"
          >
            <q-tooltip>{{ $t('evaluations.table.close_evaluation') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'OUVERT' && peutGerer"
            flat
            dense
            no-caps
            icon="edit"
            :aria-label="$t('evaluations.table.edit_evaluation_aria')"
            :label="$t('evaluations.table.edit_evaluation_aria')"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('evaluations.table.edit_evaluation') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutGerer"
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            :aria-label="$t('evaluations.table.delete_aria')"
            :label="$t('evaluations.table.delete_aria')"
            :disable="nombreNotes(p.row) > 0"
            @click="emit('supprimer', p.row)"
          >
            <q-tooltip>
              {{ nombreNotes(p.row) > 0 ? $t('evaluations.table.delete_locked') : $t('common.actions.delete') }}
            </q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Vue tableau de la liste des évaluations : colonnes, pastilles et actions.
 *
 * Le composant ne fait aucune requête : il reçoit les lignes déjà chargées et
 * rend les actions, qu'il émet à la page (création, modification, clôture,
 * suppression, consultation et saisie des notes).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_TYPE_EVALUATION } from '@/shared/utils/libelles';
import { dateLisible } from '@/shared/utils/format';
import type { Evaluation } from '@/types';

defineProps<{
  lignes: Evaluation[];
  chargement: boolean;
  messageVide: string;
  filtresActifs: boolean;
  peutGerer: boolean;
  peutSaisir: boolean;
}>();

const emit = defineEmits<{
  'voir-notes': [evaluation: Evaluation];
  'saisir-notes': [evaluation: Evaluation];
  cloturer: [evaluation: Evaluation];
  modifier: [evaluation: Evaluation];
  supprimer: [evaluation: Evaluation];
  creer: [];
  reinitialiser: [];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'intitule', label: t('common.fields.intitule'), field: 'intitule', align: 'left', sortable: true },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'coefficient', label: t('evaluations.table.columns.coefficient'), field: 'coefficient', align: 'center' },
  { name: 'matiere', label: t('common.fields.subject'), field: (r) => r.matiere?.intitule ?? '—', align: 'left' },
  {
    name: 'promotion',
    label: t('evaluations.table.columns.promotion'),
    field: (r) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'semestre', label: t('evaluations.table.columns.semester'), field: 'semestre', align: 'center' },
  { name: 'date', label: t('common.fields.date'), field: 'date', align: 'left' },
  { name: 'statut', label: t('evaluations.table.columns.status'), field: 'statut', align: 'left' },
  { name: 'notes', label: t('evaluations.table.columns.notes'), field: 'id', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

/** Nombre de notes déjà saisies sur l'évaluation. */
const nombreNotes = (e: Evaluation) => e._count?.notes ?? 0;

const libelleNotes = (e: Evaluation) => {
  const n = nombreNotes(e);
  return t('evaluations.notes_count', { n, plural: n > 1 ? 's' : '' });
};
</script>
