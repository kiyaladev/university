<template>
  <div>
    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-caption text-grey-7">{{ $t('rapports.paiement.heuresPayables') }}</div>
          <div class="text-h5 text-weight-bold">{{ heuresLisibles(rapport?.totalHeures) }}</div>
        </div>
        <div class="col">
          <div class="text-caption text-grey-7">{{ $t('rapports.paiement.montantTotal') }}</div>
          <div class="text-h5 text-weight-bold text-primary">
            {{ montantLisible(rapport?.totalMontant) }} {{ $t('common.units.gnf') }}
          </div>
        </div>
        <div class="col-auto">
          <q-select
            :model-value="statutEnseignant"
            :options="STATUTS_ENSEIGNANT"
            outlined
            dense
            clearable
            :label="$t('common.fields.status')"
            style="min-width: 160px"
            @update:model-value="(v) => emit('update:statutEnseignant', v ?? null)"
          />
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            unelevated
            icon="print"
            no-caps
            :label="$t('rapports.actions.printPaiement')"
            @click="emit('imprimer')"
          >
            <q-tooltip
              >{{ periodeLisible }}{{ statutEnseignant ? ` — ${statutEnseignant.toLowerCase()}s` : '' }}</q-tooltip
            >
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
      row-key="enseignantId"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25 }"
    >
      <template #body="p">
        <q-tr :props="p">
          <q-td v-for="col in p.cols" :key="col.name" :props="p">{{ col.value }}</q-td>
        </q-tr>
        <q-tr v-if="p.row.detail?.length" :props="p" class="ligne-detail">
          <q-td colspan="100%">
            <div class="text-caption text-grey-8">
              <span v-for="d in p.row.detail" :key="d.libelle" class="q-mr-md">
                {{
                  $t('rapports.paiement.detailLine', {
                    libelle: d.libelle,
                    heures: heuresLisibles(d.heures),
                    seances: d.seances,
                  })
                }}
              </span>
            </div>
          </q-td>
        </q-tr>
      </template>
      <template #no-data>
        <etat-vide
          icone="payments"
          :titre="$t('rapports.paiement.emptyState.title')"
          :aide="$t('rapports.paiement.emptyState.message')"
        >
          <template #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="fact_check"
              :label="$t('rapports.paiement.emptyState.action')"
              to="/controle"
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
import { STATUTS_ENSEIGNANT, heuresLisibles, montantLisible } from '@/shared/utils/libelles';
import type { RapportPaiement } from '../services/rapports';

/** Onglet « état de paiement » : ce qu'on doit aux enseignants vacataires. */
defineProps<{
  rapport: RapportPaiement | null;
  chargement: boolean;
  statutEnseignant: string | null;
  periodeLisible: string;
}>();
const emit = defineEmits<{ 'update:statutEnseignant': [string | null]; imprimer: [] }>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('rapports.paiement.table.columns.matricule'), field: 'matricule', align: 'left' },
  { name: 'nom', label: t('common.fields.teacher'), field: 'nom', align: 'left', sortable: true },
  { name: 'statut', label: t('common.fields.status'), field: 'statutEnseignant', align: 'left' },
  { name: 'departement', label: t('rapports.paiement.table.columns.departement'), field: 'departement', align: 'left' },
  { name: 'seances', label: t('common.fields.sessions'), field: 'seancesAssurees', align: 'right' },
  { name: 'heures', label: t('common.fields.hours'), field: 'heuresRealisees', align: 'right', sortable: true },
  {
    name: 'taux',
    label: t('rapports.paiement.table.columns.taux'),
    field: (r: { tauxHoraire?: number }) => montantLisible(r.tauxHoraire),
    align: 'right',
  },
  {
    name: 'montant',
    label: t('rapports.paiement.table.columns.montant'),
    field: (r: { montant?: number }) => montantLisible(r.montant),
    align: 'right',
    sortable: true,
  },
]);
</script>
