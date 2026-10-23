<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="lignes"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="chargement || lignes.length > 0"
    @row-click="(_, row) => emit('detail', row)"
  >
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="paie" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-montantTotal="p">
      <q-td :props="p" class="text-right text-weight-medium">
        {{ montantLisible(p.row.montantTotal) }}
      </q-td>
    </template>
    <template #body-cell-lignes="p">
      <q-td :props="p" class="text-right">
        {{ p.row.lignes?.length ?? 0 }}
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="visibility"
          color="primary"
          :aria-label="$t('paie.ariaLabels.detail', { libelle: p.row.libelle })"
          @click.stop="emit('detail', p.row)"
        >
          <q-tooltip>{{ $t('paie.tooltips.detail') }}</q-tooltip>
        </q-btn>
        <template v-if="peutCalculer(p.row)">
          <q-btn
            flat
            dense
            round
            icon="refresh"
            :aria-label="$t('paie.ariaLabels.recalculate', { libelle: p.row.libelle })"
            @click.stop="emit('recalculer', p.row)"
          >
            <q-tooltip>{{ $t('paie.tooltips.recalculate') }}</q-tooltip>
          </q-btn>
        </template>
        <template v-if="peutValider(p.row)">
          <q-btn
            flat
            dense
            round
            color="positive"
            icon="verified"
            :aria-label="$t('paie.ariaLabels.validate', { libelle: p.row.libelle })"
            @click.stop="emit('valider', p.row)"
          >
            <q-tooltip>{{ $t('paie.tooltips.validate') }}</q-tooltip>
          </q-btn>
        </template>
        <template v-if="peutPayer(p.row)">
          <q-btn
            flat
            dense
            round
            color="primary"
            icon="payments"
            :aria-label="$t('paie.ariaLabels.markPaid', { libelle: p.row.libelle })"
            @click.stop="emit('payer', p.row)"
          >
            <q-tooltip>{{ $t('paie.tooltips.markPaid') }}</q-tooltip>
          </q-btn>
        </template>
        <q-btn
          v-if="peutImprimer"
          flat
          dense
          round
          icon="print"
          :aria-label="$t('paie.ariaLabels.print', { libelle: p.row.libelle })"
          @click.stop="emit('imprimer', p.row)"
        >
          <q-tooltip>{{ $t('paie.tooltips.print') }}</q-tooltip>
        </q-btn>
        <template v-if="peutSupprimer(p.row)">
          <q-btn
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('paie.ariaLabels.delete', { libelle: p.row.libelle })"
            @click.stop="emit('supprimer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </template>
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="payments"
        :titre="$t('paie.emptyState.title')"
        :aide="`${$t('paie.emptyState.description')} ${aDesFiltres ? $t('paie.emptyState.filtered') : ''}`.trim()"
      >
        <template #action>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            :label="$t('common.actions.clearFilters')"
            @click="emit('reinitialiser')"
          />
          <q-btn
            v-else-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('paie.actions.createFirst')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useAuthStore } from '@/stores/auth';
import {
  peutCalculerFeuille,
  peutPayerFeuille,
  peutSupprimerFeuille,
  peutValiderFeuille,
} from '../services/paie';
import { dateLisible, montantLisible } from '@/shared/utils/libelles';import type { FeuillePaie } from '@/types';

defineProps<{
  lignes: FeuillePaie[];
  chargement: boolean;
  aDesFiltres: boolean;
  peutCreer: boolean;
  peutImprimer: boolean;
}>();
const emit = defineEmits<{
  detail: [FeuillePaie];
  recalculer: [FeuillePaie];
  valider: [FeuillePaie];
  payer: [FeuillePaie];
  imprimer: [FeuillePaie];
  supprimer: [FeuillePaie];
  reinitialiser: [];
  creer: [];
}>();

const auth = useAuthStore();
const { t } = useI18n();

// Droits d'action, par rôle et par statut du cycle de vie.
const peutCalculer = (f: FeuillePaie) => peutCalculerFeuille(f, auth.peut('paie.calculer'));
const peutValider = (f: FeuillePaie) => peutValiderFeuille(f, auth.peut('paie.valider'));
const peutPayer = (f: FeuillePaie) => peutPayerFeuille(f, auth.peut('paie.payer'));
const peutSupprimer = (f: FeuillePaie) => peutSupprimerFeuille(f, auth.peut('paie.supprimer'));

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('paie.table.columns.libelle'), field: 'libelle', align: 'left', sortable: true },
  {
    name: 'periode',
    label: t('common.fields.period'),
    field: (r: FeuillePaie) => `${dateLisible(r.dateDebut)} — ${dateLisible(r.dateFin)}`,
    align: 'left',
  },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'lignes', label: t('paie.table.columns.lignes'), field: 'lignes', align: 'right' },
  {
    name: 'montantTotal',
    label: t('paie.table.columns.montantTotal'),
    field: 'montantTotal',
    align: 'right',
    sortable: true,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>
