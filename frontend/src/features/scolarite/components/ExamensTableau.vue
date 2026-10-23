<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="rows"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
    @row-click="(_, row) => emit('ouvrirFiche', row)"
  >
    <template #no-data>
      <etat-vide icone="quiz" :titre="messageVide">
        <template #action>
          <q-btn
            v-if="peutCreer && surOngletPlanifie"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('examens.actions.schedule')"
            @click="emit('planifier')"
          />
        </template>
      </etat-vide>
    </template>

    <template #body-cell-type="p">
      <q-td :props="p">
        <q-badge color="primary" :label="libelleType(p.row.type)" />
      </q-td>
    </template>
    <template #body-cell-creneau="p">
      <q-td :props="p">
        <div>{{ dateLisible(p.row.dateExamen) }}</div>
        <div class="text-caption text-grey-7">{{ p.row.heureDebut }}–{{ p.row.heureFin }}</div>
      </q-td>
    </template>
    <template #body-cell-presence="p">
      <q-td :props="p" class="text-right">
        <q-chip dense size="sm" :color="p.row.nbPresents >= p.row.nbInscrits ? 'positive' : 'primary'">
          {{ p.row.nbPresents }} / {{ p.row.nbInscrits }}
        </q-chip>
      </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="examen" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          no-caps
          icon="visibility"
          color="primary"
          :aria-label="$t('examens.table.tooltips.openSheetAria')"
          :label="$t('examens.table.tooltips.openSheetAria')"
          @click.stop="emit('ouvrirFiche', p.row)"
        >
          <q-tooltip>{{ $t('examens.table.tooltips.openSheet') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'PLANIFIE' && peutDemarrer"
            flat
            dense
            no-caps
            icon="play_arrow"
            color="positive"
            :aria-label="$t('examens.table.tooltips.start')"
            :label="$t('examens.table.tooltips.start')"
            @click.stop="emit('demarrer', p.row)"
          >
            <q-tooltip>{{ $t('examens.table.tooltips.start') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'EN_COURS' && peutTerminer"
            flat
            dense
            no-caps
            icon="stop"
            color="negative"
            :aria-label="$t('examens.table.tooltips.finish')"
            :label="$t('examens.table.tooltips.finish')"
            @click.stop="emit('terminer', p.row)"
          >
            <q-tooltip>{{ $t('examens.table.tooltips.finish') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="qr_code_scanner"
            :aria-label="$t('examens.table.tooltips.scanCardsAria')"
            :label="$t('examens.table.tooltips.scanCardsAria')"
            @click.stop="emit('scan', p.row)"
          >
            <q-tooltip>{{ $t('examens.table.tooltips.scanCards') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutVoirTirage"
            flat
            dense
            no-caps
            icon="local_printshop"
            :aria-label="$t('examens.table.tooltips.drawAria')"
            :label="$t('examens.table.tooltips.drawAria')"
            @click.stop="emit('tirage', p.row)"
          >
            <q-tooltip>{{ $t('examens.table.tooltips.draw') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'PLANIFIE' && peutAnnuler"
            flat
            dense
            no-caps
            icon="block"
            color="negative"
            :aria-label="$t('examens.actions.cancelExam')"
            :label="$t('examens.actions.cancelExam')"
            @click.stop="emit('annuler', p.row)"
          />
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { LIBELLE_TYPE_EXAMEN, dateLisible } from '@/shared/utils/libelles';
import type { Examen } from '@/types';

defineProps<{
  rows: Examen[];
  colonnes: QTableColumn[];
  chargement: boolean;
  messageVide: string;
  peutCreer: boolean;
  surOngletPlanifie: boolean;
  peutDemarrer: boolean;
  peutTerminer: boolean;
  peutAnnuler: boolean;
  peutVoirTirage: boolean;
}>();

const emit = defineEmits<{
  ouvrirFiche: [Examen];
  demarrer: [Examen];
  terminer: [Examen];
  annuler: [Examen];
  scan: [Examen];
  tirage: [Examen];
  planifier: [];
}>();

function libelleType(s: string) {
  return LIBELLE_TYPE_EXAMEN[s] ?? s;
}
</script>
