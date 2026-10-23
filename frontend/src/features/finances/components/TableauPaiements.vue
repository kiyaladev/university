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
    :hide-bottom="chargement || lignes.length > 0"
  >
    <template #no-data>
      <etat-vide icone="payments" :titre="messageVide">
        <template #action>
          <div class="q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
              @click="emit('reinitialiser')"
            />
            <q-btn
              v-if="peutCreer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('paiements.actions.new')"
              @click="emit('creer')"
            />
          </div>
        </template>
      </etat-vide>
    </template>

    <template #body-cell-etudiant="p">
      <q-td :props="p">
        <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">
          {{ p.row.etudiant?.matricule }}
          <span v-if="p.row.inscription?.numero"> · {{ p.row.inscription.numero }}</span>
        </div>
      </q-td>
    </template>

    <template #body-cell-source="p">
      <q-td :props="p">
        <span class="champ badge-source" :class="`badge-source--${sourceDe(p.row).toLowerCase()}`">
          {{ libelleSource(p.row) }}
        </span>
      </q-td>
    </template>

    <template #body-cell-montant="p">
      <q-td :props="p" class="text-right text-weight-medium">
        {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
      </q-td>
    </template>

    <template #body-cell-modep="p">
      <q-td :props="p">
        <div>{{ LIBELLE_MODE_PAIEMENT[p.row.mode] ?? p.row.mode }}</div>
        <div class="text-caption text-grey-7">
          {{ p.row.operateur ? (LIBELLE_OPERATEUR_MM[p.row.operateur] ?? p.row.operateur) : '—' }}
        </div>
      </q-td>
    </template>

    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="paiement" :statut="p.row.statut" />
      </q-td>
    </template>

    <template #body-cell-horodatage="p">
      <q-td :props="p">{{ dateHeureLisible(p.row.horodatage) }}</q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="info"
          color="primary"
          :aria-label="$t('paiements.table.actions.details')"
          @click="emit('detail', p.row)"
        >
          <q-tooltip>{{ $t('paiements.table.actions.details') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="p.row.inscription || p.row.inscriptionId"
          flat
          dense
          round
          icon="how_to_reg"
          :aria-label="$t('paiements.table.actions.viewEnrollmentAria')"
          @click="emit('inscription', p.row)"
        >
          <q-tooltip>{{ $t('paiements.table.actions.viewEnrollmentTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="p.row.etudiant"
          flat
          dense
          round
          icon="person"
          :aria-label="$t('paiements.table.actions.viewStudentAria')"
          @click="emit('etudiant', p.row)"
        >
          <q-tooltip>{{ $t('paiements.table.actions.viewStudentTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="moduleOuvert(p.row)"
          flat
          dense
          round
          icon="open_in_new"
          color="primary"
          :aria-label="$t('paiements.table.actions.openModule', { module: libelleSource(p.row) })"
          @click="emit('module', p.row)"
        >
          <q-tooltip>{{ $t('paiements.table.actions.openModule', { module: libelleSource(p.row) }) }}</q-tooltip>
        </q-btn>
        <template v-if="peutSimuler(p.row)">
          <q-btn
            flat
            dense
            round
            color="positive"
            icon="check"
            :aria-label="$t('paiements.table.actions.confirmAria')"
            @click="emit('simuler', p.row, 'REUSSI')"
          >
            <q-tooltip>{{ $t('paiements.table.actions.confirmTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            color="negative"
            icon="close"
            :aria-label="$t('paiements.table.actions.markFailedAria')"
            @click="emit('simuler', p.row, 'ECHOUE')"
          >
            <q-tooltip>{{ $t('paiements.table.actions.markFailedTooltip') }}</q-tooltip>
          </q-btn>
        </template>
        <q-btn
          v-if="peutAnnuler(p.row)"
          flat
          dense
          round
          color="negative"
          icon="block"
          :aria-label="$t('paiements.table.actions.cancel')"
          @click="emit('annuler', p.row)"
        >
          <q-tooltip>{{ $t('paiements.table.actions.cancel') }}</q-tooltip>
        </q-btn>
      </q-td>
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
  peutAnnulerPaiement,
  peutSimulerPaiement,
  routeModule,
  sourceDe,
} from '../services/paiements';
import { LIBELLE_MODE_PAIEMENT, LIBELLE_OPERATEUR_MM, dateHeureLisible, montantLisible } from '@/shared/utils/libelles';
import type { Paiement } from '@/types';

const props = defineProps<{
  lignes: Paiement[];
  chargement: boolean;
  messageVide: string;
  filtresActifs: boolean;
  peutCreer: boolean;
  /** Écrans de gestion ouverts au rôle, par portefeuille. */
  modulesOuverts: Record<string, boolean>;
}>();

const emit = defineEmits<{
  detail: [Paiement];
  inscription: [Paiement];
  etudiant: [Paiement];
  module: [Paiement];
  simuler: [Paiement, 'REUSSI' | 'ECHOUE'];
  annuler: [Paiement];
  reinitialiser: [];
  creer: [];
}>();

const auth = useAuthStore();
const { t } = useI18n();

const libelleSource = (p: Paiement) => t(`paiements.sources.${sourceDe(p)}`);

/** Lien vers le module qui gère le paiement, si l'utilisateur peut l'ouvrir. */
const moduleOuvert = (p: Paiement) => routeModule(p, props.modulesOuverts);

const peutSimuler = (p: Paiement) => peutSimulerPaiement(p, auth.peut('paiements.simuler'));
const peutAnnuler = (p: Paiement) => peutAnnulerPaiement(p, auth.peut('paiements.annuler'));

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'reference',
    label: t('paiements.table.columns.reference'),
    field: 'reference',
    align: 'left',
    sortable: true,
  },
  { name: 'source', label: t('paiements.table.columns.source'), field: 'source', align: 'left', sortable: true },
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant', align: 'left' },
  { name: 'mode', label: t('paiements.table.columns.mode'), field: 'mode', align: 'left' },
  { name: 'montant', label: t('common.fields.amount'), field: 'montant', align: 'right', sortable: true },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'motif', label: t('common.fields.motif'), field: 'motif', align: 'left' },
  { name: 'transactionId', label: t('paiements.table.columns.transaction'), field: 'transactionId', align: 'left' },
  { name: 'horodatage', label: t('common.fields.date'), field: 'horodatage', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>

<style scoped lang="scss">
.champ.badge-source {
  display: inline-flex;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 590;
  white-space: nowrap;
  background: #e8e8ed;
  color: #33463f;
}
.badge-source--inscription {
  background: #e3ecf7;
  color: #15518f;
}
</style>
