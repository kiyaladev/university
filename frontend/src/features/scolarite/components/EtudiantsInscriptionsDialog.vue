<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 780px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-h6">
            {{
              $t('etudiants.dialogInscriptions.title', {
                name: `${etudiant?.nom} ${etudiant?.prenom}`,
              })
            }}
          </div>
          <div class="text-caption text-grey-7">
            {{ etudiant?.matricule }}
          </div>
        </div>
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-linear-progress v-if="chargement" indeterminate color="primary" class="q-mb-sm" />
        <q-table
          v-else
          flat
          bordered
          :rows="lignes"
          :columns="colonnes"
          row-key="id"
          :pagination="{ rowsPerPage: 0 }"
          dense
        >
          <template #no-data>
            <etat-vide icone="how_to_reg" :titre="$t('etudiants.dialogInscriptions.emptyState')" />
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <PastilleStatut domaine="inscription" :statut="p.row.statut" />
            </q-td>
          </template>
          <template #body-cell-montant="p">
            <q-td :props="p" class="text-right text-weight-medium chiffres">
              {{ montantLisible(p.row.montantFrais) }} {{ $t('common.units.gnf') }}
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="peutVoirPaiements"
                flat
                dense
                round
                color="primary"
                icon="payments"
                :aria-label="$t('etudiants.dialogInscriptions.paiementsAria')"
                @click="emit('voirPaiements', p.row)"
              >
                <q-tooltip>{{ $t('etudiants.dialogInscriptions.paiementsTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="print"
                :aria-label="$t('etudiants.dialogInscriptions.printAria')"
                @click="emit('imprimer', p.row)"
              >
                <q-tooltip>{{ $t('etudiants.dialogInscriptions.printTooltip') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
        <q-btn
          v-if="peutValiderVoir && etudiant"
          unelevated
          color="primary"
          no-caps
          icon="how_to_reg"
          :label="$t('etudiants.actions.openInInscriptions')"
          @click="emit('ouvrirInscriptions')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Dossiers d'inscription d'un étudiant : la lecture de ses dossiers, toutes
 * années confondues.
 *
 * Le composant ne fait aucune requête : la page charge les dossiers et décide
 * des suites (paiements, impression, écran Inscriptions).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateLisible, montantLisible } from '@/shared/utils/libelles';
import type { EtudiantRegistre } from '../types';
import type { Inscription } from '@/types';

const ouvert = defineModel<boolean>({ required: true });

defineProps<{
  /** Étudiant dont les dossiers sont affichés. */
  etudiant: EtudiantRegistre | null;
  /** Dossiers chargés. */
  lignes: Inscription[];
  /** Chargement des dossiers en cours. */
  chargement: boolean;
  /** Droit de consulter les inscriptions et les évaluations. */
  peutValiderVoir: boolean;
  /** Droit de consulter le suivi financier. */
  peutVoirPaiements: boolean;
}>();

const emit = defineEmits<{
  voirPaiements: [dossier: Inscription];
  imprimer: [dossier: Inscription];
  ouvrirInscriptions: [];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left' },
  {
    name: 'promotion',
    label: t('etudiants.dialogInscriptions.columns.promotion'),
    field: (r) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'annee', label: t('common.fields.year'), field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  { name: 'montant', label: t('etudiants.dialogInscriptions.columns.amount'), field: 'montantFrais', align: 'right' },
  {
    name: 'date',
    label: t('etudiants.dialogInscriptions.columns.date'),
    field: (r) => dateLisible(r.createdAt),
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>
