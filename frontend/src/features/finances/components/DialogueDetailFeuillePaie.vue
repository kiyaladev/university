<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 900px; max-width: 95vw">
      <q-card-section>
        <div class="row items-start no-wrap q-col-gutter-md">
          <div class="col">
            <div class="text-h6">{{ feuille?.libelle }}</div>
            <div class="text-caption text-grey-7">
              {{ feuille ? `${dateLisible(feuille.dateDebut)} — ${dateLisible(feuille.dateFin)}` : '' }}
            </div>
          </div>
          <PastilleStatut v-if="feuille" domaine="paie" :statut="feuille.statut" />
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-table
          flat
          dense
          :rows="feuille?.lignes ?? []"
          :columns="colonnesLignes"
          row-key="id"
          :pagination="{ rowsPerPage: 0 }"
        >
          <template #body-cell-enseignant="p">
            <q-td :props="p">
              <div>{{ p.row.enseignant?.nom }} {{ p.row.enseignant?.prenom }}</div>
              <div class="q-gutter-xs q-mt-xs">
                <q-chip dense size="xs" outline color="primary">{{ p.row.enseignant?.matricule }}</q-chip>
                <PastilleStatut domaine="enseignant" :statut="p.row.enseignant?.statut" />
              </div>
            </q-td>
          </template>
          <template #no-data>
            <etat-vide
              icone="receipt_long"
              :titre="$t('paie.detail.lineEmptyTitle')"
              :aide="$t('paie.detail.lineEmptyMessage')"
            />
          </template>
          <template #bottom>
            <div class="detail-total">
              <div class="text-weight-medium">
                {{ $t('paie.detail.total', { count: feuille?.lignes?.length ?? 0 }) }}
              </div>
              <div class="text-weight-medium chiffres">
                {{ heuresLisibles(heuresTotal) }} {{ $t('paie.detail.completed') }}
              </div>
              <div class="text-weight-medium chiffres">
                {{ montantLisible(feuille?.montantTotal) }} {{ $t('common.units.gnf') }}
              </div>
            </div>
          </template>
        </q-table>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          v-if="peutImprimer"
          flat
          no-caps
          icon="print"
          :label="$t('paie.actions.printSheet')"
          @click="feuille && emit('imprimer', feuille)"
        />
        <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { heuresLisibles, montantLisible, dateLisible } from '@/shared/utils/libelles';
import type { FeuillePaie, LignePaie } from '@/types';

const props = defineProps<{
  feuille: FeuillePaie | null;
  peutImprimer: boolean;
}>();

const emit = defineEmits<{
  imprimer: [FeuillePaie];
}>();

const ouvert = defineModel<boolean>('ouvert', { required: true });

const { t } = useI18n();

const heuresTotal = computed(() => (props.feuille?.lignes ?? []).reduce((t, l) => t + (l.heuresReelles ?? 0), 0));

// Toutes les grandeurs monétaires passent par le même formateur, et les heures
// par le même : sans quoi une colonne dit « 12000 » quand la voisine dit
// « 12 000 ».
const colonnesLignes = computed<QTableColumn[]>(() => [
  { name: 'enseignant', label: t('common.fields.teacher'), field: 'enseignant', align: 'left' },
  {
    name: 'taux',
    label: t('paie.table.lignesColumns.taux'),
    field: (r: LignePaie) => montantLisible(r.tauxHoraire),
    align: 'right',
  },
  {
    name: 'heures',
    label: t('paie.table.lignesColumns.heures'),
    field: (r: LignePaie) => heuresLisibles(r.heuresReelles),
    align: 'right',
  },
  {
    name: 'volume',
    label: t('paie.table.lignesColumns.volume'),
    field: (r: LignePaie) => heuresLisibles(r.volumePrevu),
    align: 'right',
  },
  {
    name: 'brut',
    label: t('paie.table.lignesColumns.brut'),
    field: (r: LignePaie) => montantLisible(r.montantBrut),
    align: 'right',
  },
  {
    name: 'retenue',
    label: t('paie.table.lignesColumns.retenue'),
    field: (r: LignePaie) => montantLisible(r.retenue),
    align: 'right',
  },
  {
    name: 'montant',
    label: t('paie.table.lignesColumns.montant'),
    field: (r: LignePaie) => montantLisible(r.montantNet),
    align: 'right',
  },
  { name: 'commentaire', label: t('paie.table.lignesColumns.commentaire'), field: 'commentaire', align: 'left' },
]);
</script>

<style scoped lang="scss">
.detail-total {
  display: flex;
  justify-content: space-between;
  gap: var(--up-2);
  padding: 10px var(--up-3);
  border-top: var(--up-filet);
  background: var(--up-craie);
}
</style>
