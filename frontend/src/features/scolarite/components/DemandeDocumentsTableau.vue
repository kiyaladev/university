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
    @row-click="(_, row) => emit('selectionner', row)"
  >
    <template #no-data>
      <etat-vide icone="description" :titre="$t('demandeDocuments.emptyState.message')" />
    </template>
    <template #body-cell-type="p">
      <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
    </template>
    <template #body-cell-etudiant="p">
      <q-td :props="p">
        <template v-if="p.row.etudiant">
          <div>{{ p.row.etudiant.prenom }} {{ p.row.etudiant.nom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant.matricule }}</div>
        </template>
        <span v-else class="text-grey-7">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="demande" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-frais="p">
      <q-td :props="p" class="text-right chiffres">
        {{ montantLisible(p.row.frais) }} {{ p.row.devise }}
        <q-icon
          v-if="p.row.paiement?.statut === 'REUSSI'"
          name="check_circle"
          color="positive"
          size="16px"
          class="q-ml-xs"
        >
          <q-tooltip>{{ $t('demandeDocuments.table.paymentConfirmed') }}</q-tooltip>
        </q-icon>
        <q-icon
          v-else-if="p.row.paiement?.statut === 'EN_ATTENTE'"
          name="hourglass_top"
          color="warning"
          size="16px"
          class="q-ml-xs"
        >
          <q-tooltip>{{ $t('demandeDocuments.table.paymentPending') }}</q-tooltip>
        </q-icon>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="['PAYE', 'EN_TRAITEMENT'].includes(p.row.statut)"
          flat
          dense
          no-caps
          icon="play_arrow"
          :aria-label="$t('demandeDocuments.actionsColumn.startProcessing')"
          :label="$t('demandeDocuments.actionsColumn.startProcessing')"
          :loading="enCours === 'traitement'"
          @click.stop="emit('lancerTraitement', p.row)"
        >
          <q-tooltip>{{ $t('demandeDocuments.actionsColumn.startProcessing') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="['PAYE', 'EN_TRAITEMENT'].includes(p.row.statut)"
          flat
          dense
          no-caps
          icon="check_circle"
          color="positive"
          :aria-label="$t('demandeDocuments.actionsColumn.markReady')"
          :label="$t('demandeDocuments.actionsColumn.markReady')"
          :loading="enCours === 'prete'"
          @click.stop="emit('marquerPrete', p.row)"
        >
          <q-tooltip>{{ $t('demandeDocuments.actionsColumn.markReady') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="p.row.statut === 'PRET'"
          flat
          dense
          no-caps
          icon="assignment_turned_in"
          color="positive"
          :aria-label="$t('demandeDocuments.actionsColumn.handOver')"
          :label="$t('demandeDocuments.actionsColumn.handOver')"
          :loading="enCours === 'remettre'"
          @click.stop="emit('remettre', p.row)"
        >
          <q-tooltip>{{ $t('demandeDocuments.actionsColumn.handOver') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'EN_ATTENTE_PAIEMENT'"
            flat
            dense
            no-caps
            icon="verified"
            color="positive"
            :aria-label="$t('demandeDocuments.actionsColumn.confirmPayment')"
            :label="$t('demandeDocuments.actionsColumn.confirmPayment')"
            :loading="enCours === 'confirmer'"
            @click.stop="emit('confirmerPaiement', p.row)"
          >
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.confirmPayment') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.statut !== 'REMISE' && p.row.statut !== 'REJETE'"
            flat
            dense
            no-caps
            icon="block"
            color="negative"
            :aria-label="$t('common.actions.reject')"
            :label="$t('common.actions.reject')"
            :loading="enCours === 'rejeter'"
            @click.stop="emit('rejeter', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.reject') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="visibility"
            :aria-label="$t('common.actions.detail')"
            :label="$t('common.actions.detail')"
            @click.stop="emit('selectionner', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.detail') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Registre des demandes de documents, en lecture tableau.
 *
 * Le composant ne fait aucune requête : la page détient la liste et l'état de
 * l'action en cours, le tableau ne fait que les afficher et remonter les
 * intentions (traitement, prêt, remise, confirmation, rejet, détail).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { LIBELLE_TYPE_DEMANDE, dateHeureLisible, montantLisible } from '@/shared/utils/libelles';
import type { DemandeDocument, TypeDemandeDocument } from '../types';

defineProps<{
  /** Demandes affichées. */
  rows: DemandeDocument[];
  /** Chargement en cours. */
  chargement: boolean;
  /** Action de workflow en cours (`traitement`, `prete`, `remettre`…). */
  enCours: string;
}>();

const emit = defineEmits<{
  selectionner: [demande: DemandeDocument];
  lancerTraitement: [demande: DemandeDocument];
  marquerPrete: [demande: DemandeDocument];
  remettre: [demande: DemandeDocument];
  confirmerPaiement: [demande: DemandeDocument];
  rejeter: [demande: DemandeDocument];
}>();

const { t } = useI18n();

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant', align: 'left' },
  { name: 'frais', label: t('demandeDocuments.table.columns.frais'), field: 'frais', align: 'right' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('common.fields.createdOn'),
    field: 'createdAt',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: t('demandeDocuments.table.columns.actions'), field: 'id', align: 'right' },
]);
</script>
