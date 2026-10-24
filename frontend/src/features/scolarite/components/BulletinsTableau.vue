<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="lignes"
    :columns="colonnes"
    row-key="inscriptionId"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
    @row-click="(_, row) => emit('selectionner', row)"
  >
    <template #no-data>
      <etat-vide icone="school" :titre="$t('bulletins.table.emptyState')" />
    </template>

    <template #body-cell-moyenne="p">
      <q-td :props="p" class="text-center chiffres">
        <span :class="{ 'text-negative': p.row.moyenne !== null && p.row.moyenne < 10 }">
          {{ p.row.moyenne !== null ? p.row.moyenne.toFixed(2) : '—' }}
        </span>
      </q-td>
    </template>

    <template #body-cell-decision="p">
      <q-td :props="p" class="text-center">
        <PastilleStatut v-if="p.row.decision" domaine="decision" :statut="p.row.decision" />
        <span v-else class="text-grey-7">{{ $t('bulletins.table.nonDelibere') }}</span>
      </q-td>
    </template>

    <template #body-cell-rang="p">
      <q-td :props="p" class="text-center chiffres">{{ p.row.rang ?? '—' }}</q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          no-caps
          icon="visibility"
          :aria-label="$t('bulletins.table.ariaLabels.voirBulletin')"
          :label="$t('bulletins.table.ariaLabels.voirBulletin')"
          @click.stop="emit('selectionner', p.row)"
        >
          <q-tooltip>{{ $t('bulletins.table.tooltips.voirBulletin') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="picture_as_pdf"
            :color="p.row.deliberationId ? 'primary' : 'grey-5'"
            :disable="!p.row.deliberationId"
            :aria-label="$t('bulletins.table.ariaLabels.imprimerBulletin')"
            :label="$t('bulletins.table.ariaLabels.imprimerBulletin')"
            @click.stop="emit('imprimer', p.row)"
          >
            <q-tooltip>
              {{
                p.row.deliberationId
                  ? $t('bulletins.table.tooltips.imprimerOfficiel')
                  : $t('bulletins.table.tooltips.aucuneDeliberationEtudiant')
              }}
            </q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.decision === 'ADMIS'"
            flat
            dense
            no-caps
            icon="verified_user"
            color="secondary"
            :aria-label="$t('bulletins.table.ariaLabels.emettreAttestation')"
            :label="$t('bulletins.table.ariaLabels.emettreAttestation')"
            @click.stop="emit('aller-attestation', p.row)"
          >
            <q-tooltip>{{ $t('bulletins.table.tooltips.emettreAttestation') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { LigneBulletin } from '@/features/scolarite/types';

defineProps<{
  lignes: LigneBulletin[];
  colonnes: QTableColumn[];
  chargement: boolean;
}>();

const emit = defineEmits<{
  selectionner: [ligne: LigneBulletin];
  imprimer: [ligne: LigneBulletin];
  'aller-attestation': [ligne: LigneBulletin];
}>();
</script>
