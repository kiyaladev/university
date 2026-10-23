<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="rows"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="chargement || rows.length > 0"
  >
    <template #no-data>
      <etat-vide icone="badge" :titre="$t('carteEtudiante.emptyState.message')" />
    </template>
    <template #body-cell-etudiant="p">
      <q-td :props="p">
        <strong>{{ p.row.etudiant?.prenom }} {{ p.row.etudiant?.nom }}</strong>
      </q-td>
    </template>
    <template #body-cell-matricule="p">
      <q-td :props="p"
        ><code>{{ p.row.etudiant?.matricule ?? '—' }}</code></q-td
      >
    </template>
    <template #body-cell-emission="p">
      <q-td :props="p">{{ dateLisible(p.row.dateEmission) }}</q-td>
    </template>
    <template #body-cell-validite="p">
      <q-td :props="p">{{ dateLisible(p.row.dateValidite) }}</q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="carte" :statut="p.row.statut" />
        <div v-if="p.row.motifRevocation" class="text-caption text-grey-7">
          {{ p.row.motifRevocation }}
        </div>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          no-caps
          dense
          icon="qr_code_2"
          :aria-label="$t('carteEtudiante.actionsColumn.qrAria')"
          :label="$t('carteEtudiante.actionsColumn.qrAria')"
          @click="emit('detail', p.row)"
        >
          <q-tooltip>{{ $t('carteEtudiante.actionsColumn.qrTooltip') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            no-caps
            dense
            icon="print"
            :aria-label="$t('carteEtudiante.actionsColumn.printAria')"
            :label="$t('carteEtudiante.actionsColumn.printAria')"
            @click="emit('imprimer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.print') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutModifier && p.row.statut === 'EMIS'"
            flat
            no-caps
            dense
            icon="edit"
            :aria-label="$t('carteEtudiante.actionsColumn.editAria')"
            :label="$t('carteEtudiante.actionsColumn.editAria')"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'EMIS' && peutRevoquer"
            flat
            no-caps
            dense
            icon="block"
            color="negative"
            :aria-label="$t('carteEtudiante.actionsColumn.revokeAria')"
            :label="$t('carteEtudiante.actionsColumn.revokeAria')"
            @click="emit('revoquer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.revoke') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Registre des cartes étudiantes, en lecture tableau.
 *
 * Le composant ne fait aucune requête : la page détient la liste, les filtres
 * et les droits ; le tableau ne fait que les afficher et remonter les
 * intentions (QR, impression, édition, révocation).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateLisible } from '@/shared/utils/format';
import type { CarteEtudiante } from '@/types';

defineProps<{
  rows: CarteEtudiante[];
  chargement: boolean;
  /** Droit de modifier une carte. */
  peutModifier: boolean;
  /** Droit de révoquer une carte. */
  peutRevoquer: boolean;
}>();

const emit = defineEmits<{
  /** Ouverture de la fiche QR d'une carte. */
  detail: [carte: CarteEtudiante];
  imprimer: [carte: CarteEtudiante];
  modifier: [carte: CarteEtudiante];
  revoquer: [carte: CarteEtudiante];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant', align: 'left' },
  { name: 'matricule', label: t('carteEtudiante.table.columns.matricule'), field: 'etudiant', align: 'left' },
  { name: 'emission', label: t('common.fields.issuedOn'), field: 'dateEmission', align: 'left' },
  { name: 'validite', label: t('carteEtudiante.table.columns.validity'), field: 'dateValidite', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'center' },
  { name: 'actions', label: t('carteEtudiante.table.columns.actions'), field: 'id', align: 'right' },
]);
</script>
