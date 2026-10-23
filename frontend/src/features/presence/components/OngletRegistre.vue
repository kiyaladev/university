<template>
  <div>
    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-caption text-grey-7">
            {{ $t('rapports.registre.subtitle') }}
          </div>
          <div class="text-subtitle2">
            {{
              $t('rapports.registre.summary', {
                total: rapport?.total ?? 0,
                controlees: rapport?.synthese?.controlees ?? 0,
                absences: rapport?.synthese?.absent ?? 0,
              })
            }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            unelevated
            icon="print"
            no-caps
            :label="$t('rapports.actions.printRegistre')"
            @click="emit('imprimer')"
          >
            <q-tooltip>{{ periodeLisible }}</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <q-table
      flat
      bordered
      class="carte"
      :rows="rapport?.lignes ?? []"
      :columns="colonnes"
      row-key="seanceId"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25 }"
    >
      <template #body-cell-statut="p">
        <q-td :props="p">
          <champ-statut :statut="p.row.statut" dense />
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="menu_book"
          :titre="$t('rapports.registre.emptyState.title')"
          :aide="$t('rapports.registre.emptyState.message')"
        >
          <template #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="event"
              :label="$t('rapports.registre.emptyState.action')"
              to="/seances"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import ChampStatut from './ChampStatut.vue';
import { dureeLisible } from '@/shared/utils/libelles';
import type { RapportRegistre } from '../services/rapports';

/** Onglet « registre » : la transcription du cahier du contrôleur. */
defineProps<{ rapport: RapportRegistre | null; chargement: boolean; periodeLisible: string }>();
const emit = defineEmits<{ imprimer: [] }>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'date', label: t('common.fields.date'), field: 'date', align: 'left', sortable: true },
  { name: 'horaire', label: t('common.fields.schedule'), field: 'horaire', align: 'left' },
  { name: 'enseignant', label: t('common.fields.teacher'), field: 'enseignant', align: 'left' },
  { name: 'matiere', label: t('common.fields.subject'), field: 'matiere', align: 'left' },
  { name: 'promotion', label: t('rapports.registre.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'salle', label: t('common.fields.room'), field: 'salle', align: 'left' },
  { name: 'statut', label: t('rapports.registre.table.columns.statut'), field: 'statut', align: 'left' },
  { name: 'arrivee', label: t('rapports.registre.table.columns.arrivee'), field: 'heureArrivee', align: 'left' },
  {
    name: 'duree',
    label: t('common.fields.duration'),
    field: (r: { dureeMinutes?: number }) => dureeLisible(r.dureeMinutes),
    align: 'left',
  },
  { name: 'effectif', label: t('rapports.registre.table.columns.effectif'), field: 'effectifPresent', align: 'right' },
  { name: 'theme', label: t('rapports.registre.table.columns.theme'), field: 'thematiqueTraitee', align: 'left' },
]);
</script>
