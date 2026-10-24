<template>
  <q-dialog v-model="ouvert" :maximized="$q.screen.lt.md">
    <q-card style="width: 900px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-h6">
            {{ $t('evaluations.notes_modal.title', { name: evaluation?.intitule }) }}
          </div>
          <div class="text-caption text-grey-7">
            {{
              $t('evaluations.notes_modal.subject_line', {
                subject: evaluation?.matiere?.intitule,
                promotion: evaluation?.promotion?.nom,
                status:
                  evaluation?.statut === 'OUVERT'
                    ? $t('evaluations.notes_modal.status_open')
                    : $t('evaluations.notes_modal.status_closed'),
              })
            }}
          </div>
        </div>
        <q-btn
          v-if="evaluation?.statut === 'OUVERT' && peutSaisir"
          unelevated
          color="primary"
          no-caps
          icon="edit_note"
          :label="$t('evaluations.notes_modal.enter_notes')"
          @click="emit('saisir')"
        />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-linear-progress v-if="chargement" indeterminate color="primary" class="q-mb-sm" />
        <q-table
          v-else
          flat
          bordered
          :rows="lignes"
          :columns="colonnes"
          row-key="inscriptionId"
          :pagination="{ rowsPerPage: 0 }"
          dense
        >
          <template #no-data>
            <etat-vide icone="people_outline" :titre="$t('evaluations.notes_modal.empty')" />
          </template>
          <template #body-cell-note="p">
            <q-td :props="p" class="text-center chiffres">
              <span
                :class="{
                  'text-negative': p.row.note !== null && p.row.note < 5,
                  'text-warning': p.row.note !== null && p.row.note >= 5 && p.row.note < 10,
                }"
              >
                {{ p.row.note !== null ? p.row.note.toFixed(2) : '—' }}
              </span>
            </q-td>
          </template>
          <template #body-cell-present="p">
            <q-td :props="p" class="text-center">
              <q-icon
                :name="p.row.present ? 'check_circle' : 'cancel'"
                :color="p.row.present ? 'positive' : 'grey-6'"
              />
            </q-td>
          </template>
        </q-table>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Modale « Voir les notes » d'une évaluation : la feuille des inscrits avec
 * leur note et leur présence, en lecture seule.
 *
 * La page charge les lignes et les transmet ; la modale ne fait aucune
 * requête.
 */
import { computed } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { LigneEvaluation } from '../services/evaluations';
import type { Evaluation } from '@/types';

const ouvert = defineModel<boolean>({ required: true });

defineProps<{
  evaluation?: Evaluation | null;
  lignes: LigneEvaluation[];
  chargement: boolean;
  peutSaisir: boolean;
}>();

const emit = defineEmits<{ saisir: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('common.fields.studentId'), field: 'matricule', align: 'left' },
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left' },
  {
    name: 'etudiant',
    label: t('common.fields.student'),
    field: (r) => `${r.nom} ${r.prenom}`,
    align: 'left',
  },
  { name: 'present', label: t('evaluations.notes_modal.columns.present'), field: 'present', align: 'center' },
  { name: 'note', label: t('evaluations.notes_modal.columns.note'), field: 'note', align: 'center' },
]);
</script>
