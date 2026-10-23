<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="inscriptions"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    hide-bottom
    :rows-per-page-options="toutAfficher ? [0] : undefined"
  >
    <template #body-cell-inscrit="r">
      <q-td :props="r">
        <div>{{ nomInscrit(r.row) }}</div>
        <div class="text-caption text-grey-7">
          <template v-if="afficherEmail">
            {{ r.row.telephone ?? '—' }}<span v-if="r.row.email"> · {{ r.row.email }}</span>
          </template>
          <template v-else>{{ r.row.telephone ?? '—' }}</template>
        </div>
      </q-td>
    </template>

    <template #body-cell-statut="r">
      <q-td :props="r">
        <PastilleStatut domaine="inscriptionFormation" :statut="r.row.statut" />
      </q-td>
    </template>

    <template #body-cell-paiement="r">
      <q-td :props="r">
        <div class="chiffres">{{ montantLisible(r.row.paiement?.montant) }} {{ r.row.paiement?.devise ?? DEVISE }}</div>
        <div class="text-caption text-grey-7">{{ r.row.paiement?.reference ?? '—' }}</div>
      </q-td>
    </template>

    <template #body-cell-paiementStatut="r">
      <q-td :props="r">
        <PastilleStatut domaine="paiement" :statut="r.row.paiement?.statut" />
      </q-td>
    </template>

    <template #body-cell-actionsRegistre="r">
      <q-td :props="r" class="text-right">
        <q-btn
          v-if="r.row.statut === 'EN_ATTENTE'"
          flat
          dense
          round
          color="secondary"
          icon="check_circle"
          :aria-label="$t('formationsAdmin.registry.aria.confirmPayment')"
          @click="emit('confirmer', r.row)"
        >
          <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.confirmPayment') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="r.row.statut !== 'ANNULE'"
          flat
          dense
          round
          color="negative"
          icon="block"
          :aria-label="$t('formationsAdmin.registry.aria.cancelRequest')"
          @click="emit('annuler', r.row)"
        >
          <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.cancelRequest') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="r.row.statut === 'CONFIRME'"
          flat
          dense
          round
          icon="print"
          :aria-label="$t('formationsAdmin.registry.aria.printCertificate')"
          @click="emit('imprimer', r.row)"
        >
          <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.printCertificate') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Registre des inscriptions d'une formation : la liste des demandes reçues,
 * leur statut et leur paiement. La page garde les données et les actions ;
 * ce composant présente les lignes.
 */
import type { QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { DEVISE, montantLisible } from '@/shared/utils/format';
import type { InscriptionFormationDetail } from '../types';

defineProps<{
  inscriptions: InscriptionFormationDetail[];
  colonnes: QTableColumn[];
  chargement: boolean;
  /** L'e-mail de l'inscrit accompagne le téléphone (vue tableau). */
  afficherEmail: boolean;
  /** Toutes les lignes d'un coup, sans pagination interne (vue cartes). */
  toutAfficher: boolean;
}>();

const emit = defineEmits<{
  confirmer: [inscription: InscriptionFormationDetail];
  annuler: [inscription: InscriptionFormationDetail];
  imprimer: [inscription: InscriptionFormationDetail];
}>();

/** Nom de l'inscrit : celui de la demande, sinon celui de l'étudiant joint. */
function nomInscrit(i: InscriptionFormationDetail): string {
  if (i.nomComplet) return i.nomComplet;
  return i.etudiant ? `${i.etudiant.prenom} ${i.etudiant.nom}` : '—';
}
</script>
