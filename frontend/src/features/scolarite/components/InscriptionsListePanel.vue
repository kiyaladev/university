<template>
  <q-table
    v-if="mode === 'tableau'"
    flat
    bordered
    class="carte"
    :rows="rows"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
  >
    <template #loading
      ><q-linear-progress indeterminate color="primary" :aria-label="$t('common.messages.loading')"
    /></template>
    <template #no-data>
      <etat-vide icone="how_to_reg" :titre="messageVide">
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
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('inscriptions.actions.new')"
              @click="emit('creer')"
            />
          </div>
        </template>
      </etat-vide>
    </template>

    <template #body-cell-etudiant="p">
      <q-td :props="p">
        <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
      </q-td>
    </template>

    <template #body-cell-promotion="p">
      <q-td :props="p">
        <q-chip dense outline color="primary">{{ p.row.promotion?.nom }}</q-chip>
        <div class="text-caption text-grey-7">{{ p.row.annee?.libelle }}</div>
      </q-td>
    </template>

    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="inscription" :statut="p.row.statut" />
      </q-td>
    </template>

    <template #body-cell-montantFrais="p">
      <q-td :props="p" class="text-right text-weight-medium">
        {{ montantLisible(p.row.montantFrais) }}
      </q-td>
    </template>

    <template #body-cell-paye="p">
      <q-td :props="p" class="text-right chiffres">
        <span :class="{ 'text-positive text-weight-medium': resteAPayer(p.row) === 0 }">
          {{ montantLisible(montantPaye(p.row)) }}
        </span>
      </q-td>
    </template>

    <template #body-cell-solde="p">
      <q-td :props="p" class="text-right text-weight-medium chiffres">
        <span :class="{ 'text-negative': resteAPayer(p.row) > 0 }">
          {{ montantLisible(resteAPayer(p.row)) }}
        </span>
      </q-td>
    </template>

    <template #body-cell-dateInscription="p">
      <q-td :props="p">
        {{ dateLisible(p.row.dateInscription ?? p.row.createdAt) }}
      </q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="peutEncaisserDossier(p.row)"
          flat
          dense
          no-caps
          color="primary"
          icon="payments"
          :aria-label="$t('inscriptions.table.actions.collectAria')"
          :label="$t('inscriptions.table.actions.collectAria')"
          @click="emit('encaisser', p.row, resteAPayer(p.row))"
        >
          <q-tooltip>
            {{ $t('inscriptions.table.actions.collectTooltip', { amount: montantLisible(resteAPayer(p.row)) }) }}
          </q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutValider(p.row)"
          flat
          dense
          no-caps
          color="positive"
          icon="verified"
          :aria-label="$t('inscriptions.table.actions.validateAria')"
          :label="$t('inscriptions.table.actions.validateAria')"
          @click="emit('valider', p.row)"
        >
          <q-tooltip>{{ $t('inscriptions.table.actions.validateTooltip') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="receipt_long"
            :aria-label="$t('inscriptions.table.actions.viewPaymentsAria')"
            :label="$t('inscriptions.table.actions.viewPaymentsAria')"
            @click="emit('voirPaiements', p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.viewPaymentsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutAnnuler(p.row)"
            flat
            dense
            no-caps
            color="negative"
            icon="cancel"
            :aria-label="$t('inscriptions.table.actions.cancelAria')"
            :label="$t('inscriptions.table.actions.cancelAria')"
            @click="emit('annuler', p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.cancelTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="print"
            :aria-label="$t('inscriptions.table.actions.printAria')"
            :label="$t('inscriptions.table.actions.printAria')"
            @click="emit('imprimer', p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.printTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            color="primary"
            icon="person"
            :aria-label="$t('inscriptions.table.actions.viewStudentAria')"
            :label="$t('inscriptions.table.actions.viewStudentAria')"
            @click="emit('voirEtudiant', p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.viewStudentTooltip') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>

  <q-linear-progress
    v-if="mode === 'cartes' && chargement"
    :aria-label="$t('common.messages.loading')"
    indeterminate
    color="primary"
    class="q-mb-sm"
  />

  <div v-else-if="mode === 'cartes'" class="inscriptions-cartes">
    <q-card v-for="d in rows" :key="d.id" flat bordered class="carte inscriptions-cartes__carte">
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <PastilleStatut domaine="inscription" :statut="d.statut" />
          <q-space />
          <div class="text-caption text-grey-7">{{ d.numero }}</div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ d.etudiant?.nom }} {{ d.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">
          {{ d.etudiant?.matricule }} · {{ d.promotion?.nom }} · {{ d.annee?.libelle }}
        </div>
        <div class="row q-mt-sm q-col-gutter-sm">
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('inscriptions.cards.fees') }}</div>
            <div class="text-weight-medium chiffres">{{ montantLisible(d.montantFrais) }}</div>
          </div>
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('inscriptions.cards.paid') }}</div>
            <div class="text-weight-medium chiffres text-positive">
              {{ montantLisible(montantPaye(d)) }}
            </div>
          </div>
          <div class="col-4">
            <div class="text-caption text-grey-7">{{ $t('inscriptions.cards.balance') }}</div>
            <div class="text-weight-medium chiffres" :class="{ 'text-negative': resteAPayer(d) > 0 }">
              {{ montantLisible(resteAPayer(d)) }}
            </div>
          </div>
        </div>
        <div class="text-caption text-grey-7 q-mt-xs">
          {{ dateLisible(d.dateInscription ?? d.createdAt) }}
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-gutter-xs">
        <q-btn
          v-if="peutEncaisserDossier(d)"
          flat
          dense
          color="primary"
          icon="payments"
          no-caps
          :label="$t('inscriptions.cards.actions.collect')"
          @click="emit('encaisser', d, resteAPayer(d))"
        />
        <q-btn
          v-if="peutValider(d)"
          flat
          dense
          color="positive"
          icon="verified"
          no-caps
          :label="$t('common.actions.validate')"
          @click="emit('valider', d)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            icon="receipt_long"
            no-caps
            :label="$t('common.fields.payments')"
            @click="emit('voirPaiements', d)"
          />
          <q-btn
            v-close-popup
            v-if="peutAnnuler(d)"
            flat
            dense
            color="negative"
            icon="cancel"
            no-caps
            :label="$t('common.actions.cancel')"
            @click="emit('annuler', d)"
          />
          <q-btn
            v-close-popup
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            :label="$t('inscriptions.cards.actions.certificate')"
            @click="emit('imprimer', d)"
          />
          <q-btn
            v-close-popup
            flat
            dense
            icon="person"
            no-caps
            :label="$t('common.fields.student')"
            @click="emit('voirEtudiant', d)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide v-if="!rows.length" icone="how_to_reg" :titre="messageVide">
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
            v-if="peutGerer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('inscriptions.actions.new')"
            @click="emit('creer')"
          />
        </div>
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
/**
 * Liste des dossiers d'inscription : la lecture en tableau et la lecture en
 * cartes.
 *
 * Le composant ne fait aucune requête : la page détient la liste et les
 * filtres, le panneau ne fait que les afficher et remonter les intentions
 * (encaissement, validation, annulation, impression, paiements, fiche
 * étudiant).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateLisible, montantLisible } from '@/shared/utils/libelles';
import { montantPaye, resteAPayer } from '@/shared/utils/finances';
import type { Inscription } from '@/types';

const props = defineProps<{
  /** Présentation retenue : le tableau ou les cartes. */
  mode: 'tableau' | 'cartes';
  rows: Inscription[];
  chargement: boolean;
  messageVide: string;
  filtresActifs: boolean;
  /** Droit d'ouvrir un dossier d'inscription. */
  peutGerer: boolean;
  /** Droit d'encaisser un paiement (même rôle que `POST /paiements`). */
  peutEncaisser: boolean;
  /** Droit de valider un dossier. */
  droitValider: boolean;
  /** Droit d'annuler un dossier. */
  droitAnnuler: boolean;
}>();

const emit = defineEmits<{
  encaisser: [dossier: Inscription, reste: number];
  valider: [dossier: Inscription];
  annuler: [dossier: Inscription];
  imprimer: [dossier: Inscription];
  voirPaiements: [dossier: Inscription];
  voirEtudiant: [dossier: Inscription];
  reinitialiser: [];
  creer: [];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('inscriptions.table.columns.number'), field: 'numero', align: 'left', sortable: true },
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant', align: 'left' },
  { name: 'promotion', label: t('inscriptions.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  {
    name: 'montantFrais',
    label: t('inscriptions.table.columns.fees'),
    field: 'montantFrais',
    align: 'right',
    sortable: true,
  },
  { name: 'paye', label: t('inscriptions.table.columns.paid'), field: 'paye', align: 'right' },
  { name: 'solde', label: t('inscriptions.table.columns.balance'), field: 'solde', align: 'right' },
  {
    name: 'dateInscription',
    label: t('inscriptions.table.columns.enrolledOn'),
    field: 'dateInscription',
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const peutValider = (d: Inscription) => props.droitValider && d.statut === 'PAYE';
const peutAnnuler = (d: Inscription) => props.droitAnnuler && !['VALIDE', 'ANNULE'].includes(d.statut);
/** Un dossier annulé ne s'encaisse plus, un dossier soldé non plus. */
const peutEncaisserDossier = (d: Inscription) => props.peutEncaisser && d.statut !== 'ANNULE' && resteAPayer(d) > 0;
</script>

<style scoped lang="scss">
.inscriptions-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--up-3);
}
.inscriptions-cartes__carte {
  background: var(--up-plaque);
}
</style>
