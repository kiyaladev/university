<template>
  <q-tabs v-model="ongletTransactions" dense align="left" class="onglets-panneau q-mb-sm" narrow-indicator>
    <q-tab name="recharges" icon="add_card" :label="$t('resto.transactions.tabs.recharges')" no-caps />
    <q-tab name="consommations" icon="restaurant" :label="$t('resto.transactions.tabs.consommations')" no-caps />
  </q-tabs>

  <barre-filtres
    v-model="filtresTransactions"
    :chips="chipsTransactions"
    :recherche="false"
    @reinitialiser="tx.reinitialiser(['dateDebut', 'dateFin'])"
  >
    <template #avances>
      <champ-date v-model="filtresTransactions.dateDebut" :label="$t('common.actions.from')" />
      <champ-date v-model="filtresTransactions.dateFin" :label="$t('common.actions.to')" />
      <!-- Le serveur ne filtre les recharges que par statut de paiement. -->
      <q-select
        v-if="ongletTransactions === 'recharges'"
        v-model="filtresTransactions.statut"
        :options="optionsStatutsPaiement"
        emit-value
        map-options
        dense
        outlined
        clearable
        :label="$t('resto.transactions.filters.paymentStatus')"
      />
      <q-input
        v-if="ongletTransactions === 'consommations'"
        v-model="filtresTransactions.cantine"
        dense
        outlined
        :label="$t('resto.cantine')"
        clearable
      />
    </template>
    <template #actions>
      <q-btn
        flat
        dense
        no-caps
        icon="today"
        :label="$t('resto.transactions.actions.today')"
        @click="periodeAujourdhui"
      />
      <q-btn
        flat
        dense
        round
        icon="refresh"
        :aria-label="$t('resto.transactions.actions.refresh')"
        @click="tx.recharger()"
      >
        <q-tooltip>{{ $t('resto.transactions.actions.refresh') }}</q-tooltip>
      </q-btn>
    </template>
  </barre-filtres>

  <!-- KPIs : toujours calculés sur la période entière, quel que soit l'onglet -->
  <div class="row q-col-gutter-sm q-mb-md items-center">
    <div class="col-auto">
      <q-chip color="positive" text-color="white" icon="add">
        {{ $t('resto.transactions.kpi.credited', { amount: montantLisible(totaux.credite) }) }}
      </q-chip>
    </div>
    <div class="col-auto">
      <q-chip :color="totaux.debite > 0 ? 'blue-grey-7' : 'grey-7'" text-color="white" icon="remove">
        {{ $t('resto.transactions.kpi.debited', { amount: montantLisible(totaux.debite) }) }}
      </q-chip>
    </div>
    <div class="col-auto">
      <q-chip :color="totaux.net >= 0 ? 'positive' : 'negative'" text-color="white" icon="account_balance">
        {{
          totaux.net >= 0
            ? $t('resto.transactions.kpi.netPositive', { amount: montantLisible(Math.abs(totaux.net)) })
            : $t('resto.transactions.kpi.netNegative', { amount: montantLisible(Math.abs(totaux.net)) })
        }}
      </q-chip>
    </div>
  </div>

  <q-table
    flat
    bordered
    class="carte"
    :rows="transactions"
    :columns="colonnesTransactions"
    row-key="cle"
    :loading="tx.chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="tx.chargement || transactions.length > 0"
    :sort-method="triTable"
    :default-sort="{ sortBy: 'date', descending: true }"
  >
    <template #body-cell-date="p">
      <q-td :props="p">{{ dateHeureLisible(p.row.date) }}</q-td>
    </template>
    <template #body-cell-type="p">
      <q-td :props="p">
        <q-badge outline :color="p.row.montant < 0 ? 'deep-orange-8' : 'teal-8'" square>
          {{ p.row.type === 'REPAS' ? $t('resto.transactions.type.meal') : $t('resto.transactions.type.recharge') }}
        </q-badge>
      </q-td>
    </template>
    <template #body-cell-montant="p">
      <q-td :props="p" class="text-right">
        <span class="chiffres" :class="p.row.montant < 0 ? 'text-negative' : 'text-positive'">
          {{ p.row.montant < 0 ? '−' : '+' }}{{ montantLisible(Math.abs(p.row.montant)) }}
        </span>
      </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut :domaine="p.row.type === 'RECHARGE' ? 'paiement' : 'consommation'" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="p.row.annulable"
          flat
          dense
          round
          color="negative"
          icon="history_toggle_off"
          :aria-label="$t('resto.transactions.actions.refundAria')"
          @click="annulerRepas(p.row)"
        >
          <q-tooltip>{{ $t('resto.transactions.actions.refundAria') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="receipt_long"
        :titre="
          $t('resto.transactions.emptyState.title', {
            type: $t(`resto.transactions.typeLabel.${ongletTransactions}`),
          })
        "
        :aide="
          $t('resto.transactions.emptyState.description', {
            from: dateLisible(filtresTransactions.dateDebut),
            to: dateLisible(filtresTransactions.dateFin),
          })
        "
      />
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import {
  aujourdhui,
  dateHeureLisible,
  dateLisible,
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_REPAS,
  montantLisible,
} from '@/shared/utils/libelles';
import { restoService } from '../services/resto';
import { useAuthStore } from '@/stores/auth';
import type { LigneTransaction } from '../types';
import type { ChipFiltre } from '@/types';

const props = defineProps<{
  /** Droit de recharger : sans lui, le journal ne se charge pas. */
  peutRecharger: boolean;
}>();

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const ongletTransactions = ref<'recharges' | 'consommations'>('recharges');

/** Filtres de la période : le cadre de lecture, puis les critères du serveur. */
interface FiltresTransactions {
  dateDebut: string;
  dateFin: string;
  statut: string | null;
  cantine: string;
}

/** La période reste au réinitialiser : c'est le cadre de lecture, pas un filtre parmi d'autres. */
const filtresTransactions = ref<FiltresTransactions>({
  dateDebut: aujourdhui(),
  dateFin: aujourdhui(),
  statut: null,
  cantine: '',
});

const nomEtudiant = (e: { matricule: string; nom: string; prenom: string } | null | undefined) =>
  e ? `${e.matricule} ${e.nom} ${e.prenom}` : '';

/**
 * Les deux flux de la période (consommations et recharges) fusionnés en une
 * liste : les KPI portent sur l'ensemble, l'onglet ne fait que trancher.
 */
async function chargerFlux(f: FiltresTransactions): Promise<{ data: LigneTransaction[] }> {
  const periode = { dateDebut: f.dateDebut || aujourdhui(), dateFin: f.dateFin || aujourdhui(), pageSize: 200 };
  const [cons, rech] = await Promise.all([
    restoService.listeConsommations({ ...periode, cantine: texteApi(f.cantine) }),
    // Le serveur ne filtre les recharges que par statut de paiement.
    restoService.listeRecharges({ ...periode, statut: f.statut || undefined }),
  ]);
  const peutAnnuler = auth.peut('resto.annuler');
  const lignes: LigneTransaction[] = [
    ...cons.data.map((c) => ({
      cle: `c-${c.id}`,
      id: c.id,
      repas: c.repas,
      type: 'REPAS' as const,
      date: c.consommeLe,
      libelle: c.cantine
        ? `${LIBELLE_TYPE_REPAS[c.repas] ?? c.repas} · ${c.cantine}`
        : (LIBELLE_TYPE_REPAS[c.repas] ?? c.repas),
      etudiant: c.portefeuille?.etudiant ? nomEtudiant(c.portefeuille.etudiant) : (c.etudiant ?? ''),
      montant: -c.montant,
      statut: c.statut,
      annulable: c.statut === 'VALIDE' && peutAnnuler,
    })),
    ...rech.data.map((r) => ({
      cle: `r-${r.id}`,
      id: r.id,
      type: 'RECHARGE' as const,
      date: r.rechargeLe,
      libelle: `${LIBELLE_MODE_PAIEMENT[r.paiement?.mode ?? ''] ?? t('common.fields.payment')}${r.paiement?.reference ? ` — ${r.paiement.reference}` : ''}`,
      etudiant: nomEtudiant(r.portefeuille?.etudiant),
      montant: r.montant,
      statut: r.paiement?.statut ?? r.statut,
      annulable: false,
    })),
  ];
  return { data: lignes.sort((a, b) => (a.date < b.date ? 1 : -1)) };
}

const tx = reactive(
  useListePaginee<LigneTransaction, FiltresTransactions>({
    filtres: filtresTransactions,
    pageSize: 0,
    syncUrl: true,
    prefixeUrl: 'tx_',
    clesTexte: ['cantine'],
    actif: () => props.peutRecharger,
    charger: ({ filtres: f }) => chargerFlux(f),
  }),
);

const transactions = computed(() =>
  tx.lignes.filter((l) => (ongletTransactions.value === 'recharges' ? l.type === 'RECHARGE' : l.type === 'REPAS')),
);

const optionsStatutsPaiement = Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({
  value,
  label,
}));

const totaux = computed(() => {
  let debite = 0;
  let credite = 0;
  for (const l of tx.lignes) {
    if (l.montant < 0) debite += -l.montant;
    else credite += l.montant;
  }
  return { debite, credite, net: credite - debite };
});

const chipsTransactions = computed(() => {
  const f = filtresTransactions.value;
  const cs: ChipFiltre[] = [
    {
      label: `${dateLisible(f.dateDebut)} → ${dateLisible(f.dateFin)}`,
      value: `${f.dateDebut}-${f.dateFin}`,
      icone: 'date_range',
    },
  ];
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_PAIEMENT[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'payments',
      cle: 'statut',
    });
  }
  if (f.cantine) {
    cs.push({
      label: t('resto.transactions.chips.cantine', { cantine: f.cantine }),
      value: f.cantine,
      icone: 'restaurant',
    });
  }
  return cs;
});

function periodeAujourdhui() {
  filtresTransactions.value = { ...filtresTransactions.value, dateDebut: aujourdhui(), dateFin: aujourdhui() };
}

async function annulerRepas(ligne: LigneTransaction) {
  const ok = await confirmer({
    titre: t('resto.transactions.confirmRefund.title'),
    message: t('resto.transactions.confirmRefund.message', {
      meal: LIBELLE_TYPE_REPAS[ligne.repas ?? 'AUTRE'] ?? ligne.libelle,
      amount: montantLisible(-ligne.montant),
    }),
    ok: t('resto.transactions.confirmRefund.confirm'),
    danger: true,
  });
  if (!ok) return;
  try {
    // Motif interne conservé en français : c'est une valeur d'audit stockée côté serveur, pas un texte affiché.
    await restoService.annulerConsommation(ligne.id, 'Remboursement guichet');
    $q.notify({ type: 'positive', message: t('resto.transactions.messages.refunded') });
    void tx.recharger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

const colonnesTransactions = computed<QTableColumn[]>(() => [
  { name: 'date', label: t('resto.transactions.table.columns.date'), field: 'date', sortable: true },
  { name: 'type', label: t('resto.transactions.table.columns.type'), field: 'type' },
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant' },
  { name: 'detail', label: t('common.actions.detail'), field: 'libelle' },
  { name: 'montant', label: t('common.fields.amount'), field: 'montant', align: 'right' as const },
  { name: 'statut', label: t('common.fields.status'), field: 'statut' },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
]);

function triTable(rows: readonly LigneTransaction[], sortBy: string, descending: boolean) {
  const copie = [...rows];
  copie.sort((a, b) => {
    const va = a[sortBy as keyof LigneTransaction] as unknown as number;
    const vb = b[sortBy as keyof LigneTransaction] as unknown as number;
    if (va < vb) return descending ? 1 : -1;
    if (va > vb) return descending ? -1 : 1;
    return 0;
  });
  return copie;
}

/** La page recharge le portefeuille après une recharge : elle redemande le journal. */
defineExpose({ recharger: () => tx.recharger() });
</script>
