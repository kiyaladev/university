<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('resto.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('resto.subtitle') }}
        </div>
      </div>
      <div class="col-auto" v-if="peutRecharger">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="account_balance_wallet"
          :label="$t('resto.actions.creditWallet')"
          @click="rechargerCible"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab v-if="peutGuichet" name="guichet" icon="lunch_dining" :label="$t('resto.tabs.guichet')" no-caps />
      <q-tab v-if="peutRecharger" name="portefeuilles" icon="account_balance_wallet" :label="$t('resto.tabs.wallets')" no-caps />
      <q-tab v-if="peutRecharger" name="transactions" icon="receipt_long" :label="$t('resto.tabs.transactions')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- GUICHET                                                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'guichet' && peutGuichet" name="guichet" class="q-pa-none q-mt-md">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-7">
          <section class="plaque guichet">
            <header class="guichet__entete">
              <span class="lettrage">{{ $t('resto.guichet.header') }}</span>
              <span class="pochoir pochoir--brut">{{ $t('resto.guichet.onlineNote') }}</span>
            </header>

            <qr-scanner
              v-model="reference"
              :label="$t('resto.guichet.studentLabel')"
              :hint="$t('resto.guichet.studentHint')"
            />

            <div class="row q-col-gutter-md q-mt-sm">
              <div class="col-12 col-sm-6">
                <q-select
                  v-model="repas"
                  :options="optionsRepas"
                  :label="$t('resto.guichet.mealLabel')"
                  outlined
                  dense
                  emit-value
                  map-options
                  @update:model-value="repasChoisi"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model.number="montant"
                  type="number"
                  min="500"
                  step="500"
                  outlined
                  dense
                  :label="$t('resto.guichet.priceLabel')"
                  suffix="GNF"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model="cantine"
                  outlined
                  dense
                  :label="$t('resto.cantine')"
                  :placeholder="$t('resto.guichet.cantinePlaceholder')"
                />
              </div>
            </div>

            <q-btn
              unelevated
              color="primary"
              size="lg"
              no-caps
              icon="check"
              :label="$t('resto.guichet.validate')"
              class="guichet__valider full-width"
              :loading="validationChargement"
              :disable="!reference.trim() || !montant || montant < 500"
              @click="validerRepas"
            />
          </section>
        </div>

        <div class="col-12 col-md-5">
          <!-- Écran vert : repas validé -->
          <section v-if="resultat?.ok" class="plaque guichet-resultat guichet-resultat--ok">
            <q-icon name="check_circle" size="52px" color="positive" />
            <p class="lettrage guichet-resultat__titre">{{ $t('resto.guichet.result.ok.title') }}</p>
            <p class="guichet-resultat__nom">{{ resultat.etudiant.prenom }} {{ resultat.etudiant.nom }}</p>
            <p class="pochoir chiffres">{{ resultat.etudiant.matricule }}</p>
            <div class="guichet-resultat__lignes">
              <div class="guichet-resultat__ligne">
                <span>{{ LIBELLE_TYPE_REPAS[resultat.consommation.repas] }}</span>
                <span class="chiffres">{{ montantLisible(resultat.consommation.montant) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</span>
              </div>
              <div v-if="resultat.consommation.cantine" class="guichet-resultat__ligne">
                <span>{{ $t('resto.cantine') }}</span>
                <span>{{ resultat.consommation.cantine }}</span>
              </div>
              <div class="guichet-resultat__ligne guichet-resultat__ligne--fort">
                <span>{{ $t('resto.guichet.result.ok.newBalance') }}</span>
                <span class="chiffres">{{ montantLisible(resultat.solde) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</span>
              </div>
            </div>
          </section>

          <!-- Écran d'erreur -->
          <section v-else-if="resultat && !resultat.ok" class="plaque guichet-resultat guichet-resultat--ko">
            <q-icon name="error" size="52px" color="negative" />
            <p class="lettrage guichet-resultat__titre">{{ $t('resto.guichet.result.ko.title') }}</p>
            <p class="guichet-resultat__message">{{ resultat.message }}</p>
            <q-btn
              v-if="resultat.soldeInsuffisant"
              unelevated
              color="negative"
              no-caps
              icon="account_balance_wallet"
              :label="$t('resto.guichet.result.ko.rechargeWallet')"
              @click="rechargerDepuisGuichet"
              class="q-mt-md"
            />
          </section>

          <!-- État vide -->
          <section v-else class="plaque guichet-resultat guichet-resultat--vide">
            <q-icon name="qr_code_scanner" size="52px" color="grey-6" />
            <p class="pochoir guichet-resultat__message">
              {{ $t('resto.guichet.result.empty.message') }}
            </p>
          </section>
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- PORTEFEUILLES                                                    -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'portefeuilles'" name="portefeuilles" class="q-pa-none q-mt-md">
      <!-- Le serveur ne filtre que sur l'étudiant (matricule, nom, prénom) :
           pas de filtre avancé qui ne serait pas appliqué. -->
      <filter-bar
        v-model="filtresPortefeuilles"
        :chips="chipsPortefeuilles"
        :placeholder="$t('resto.wallets.searchPlaceholder')"
        @reinitialiser="pf.reinitialiser()"
      />

      <pagination-bar v-model:page="pf.page" v-model:page-size="pf.pageSize" :total="pf.total" :show-all="false" />

      <!-- Vue tableau -->
      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="pf.lignes"
        :columns="colonnesPortefeuilles"
        row-key="id"
        :loading="pf.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="pf.chargement || pf.lignes.length > 0"
      >
        <template #body-cell-etudiant="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
            <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
          </q-td>
        </template>
        <template #body-cell-solde="p">
          <q-td :props="p" class="text-right">
            <span class="chiffres text-weight-medium">{{ montantLisible(p.row.solde) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn v-if="peutRecharger" flat dense no-caps color="primary" icon="add" :label="$t('resto.wallets.actions.recharge')" @click="rechargerPortefeuille(p.row)" />
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="account_balance_wallet" :titre="$t('resto.wallets.emptyState.title')" :aide="$t('resto.wallets.emptyState.description')">
            <template v-if="peutRecharger" #action>
              <q-btn flat no-caps color="primary" icon="account_balance_wallet" :label="$t('resto.actions.creditWallet')" @click="rechargerCible" />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="pf.chargement" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="p in pf.lignes" :key="p.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="pochoir text-grey-7">{{ p.etudiant?.matricule ?? '—' }}</div>
              <div class="text-h4 chiffres q-mt-sm">{{ montantLisible(p.solde) }} <span class="text-h6">{{ $t('statistiquesMesrs.chart.axis.gnf') }}</span></div>
              <div class="text-subtitle1 q-mt-sm">{{ p.etudiant?.nom }} {{ p.etudiant?.prenom }}</div>
              <div class="text-caption text-grey-7">{{ p.etudiant?.telephone ?? '—' }}</div>
            </q-card-section>
            <q-card-actions vertical class="q-px-md q-pb-md">
              <q-btn
                v-if="peutRecharger"
                unelevated
                color="primary"
                no-caps
                icon="add"
                :label="$t('resto.wallets.actions.recharge')"
                class="full-width"
                @click="rechargerPortefeuille(p)"
              />
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide v-if="!pf.chargement && !pf.lignes.length" class="col-12" icone="account_balance_wallet" :titre="$t('resto.wallets.emptyState.title')">
          <template v-if="peutRecharger" #action>
            <q-btn flat no-caps color="primary" icon="account_balance_wallet" :label="$t('resto.actions.creditWallet')" @click="rechargerCible" />
          </template>
        </etat-vide>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- TRANSACTIONS                                                     -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'transactions'" name="transactions" class="q-pa-none q-mt-md">
      <q-tabs v-model="ongletTransactions" dense align="left" class="onglets-panneau q-mb-sm" narrow-indicator>
        <q-tab name="recharges" icon="add_card" :label="$t('resto.transactions.tabs.recharges')" no-caps />
        <q-tab name="consommations" icon="restaurant" :label="$t('resto.transactions.tabs.consommations')" no-caps />
      </q-tabs>

      <filter-bar
        v-model="filtresTransactions"
        :chips="chipsTransactions"
        :recherche="false"
        @reinitialiser="tx.reinitialiser(['dateDebut', 'dateFin'])"
      >
        <template #avances>
          <champ-date v-model="filtresTransactions.dateDebut" :label="$t('resto.transactions.filters.from')" />
          <champ-date v-model="filtresTransactions.dateFin" :label="$t('resto.transactions.filters.to')" />
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
          <q-btn flat dense no-caps icon="today" :label="$t('resto.transactions.actions.today')" @click="periodeAujourdhui" />
          <q-btn flat dense round icon="refresh" :aria-label="$t('resto.transactions.actions.refresh')" @click="tx.recharger()">
            <q-tooltip>{{ $t('resto.transactions.actions.refresh') }}</q-tooltip>
          </q-btn>
        </template>
      </filter-bar>

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
              flat dense round color="negative" icon="history_toggle_off"
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
            :titre="$t('resto.transactions.emptyState.title', {
              type: $t(`resto.transactions.typeLabel.${ongletTransactions}`),
            })"
            :aide="$t('resto.transactions.emptyState.description', {
              from: dateLisible(filtresTransactions.dateDebut),
              to: dateLisible(filtresTransactions.dateFin),
            })"
          />
        </template>
      </q-table>
    </q-tab-panel>

    <recharge-dialog v-if="peutRecharger" v-model="dialogRecharge" :etudiant="rechargeEtudiantId" @enregistre="apresRecharge" />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import { usePresentationListe } from '../composables/presentationListe';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import QrScanner from '../components/QrScanner.vue';
import ChampDate from '../components/ChampDate.vue';
import EtatVide from '../components/EtatVide.vue';
import RechargeDialog from '../components/RechargeDialog.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_REPAS,
  dateHeureLisible,
  dateLisible,
  aujourdhui,
  montantLisible,
} from '../utils/libelles';
import type { TypeRepas, ChipFiltre } from '../types';

const PRIX_REPAS: Record<TypeRepas, number> = {
  PETIT_DEJEUNER: 10_000,
  DEJEUNER: 15_000,
  DINER: 15_000,
  COLLATION: 5_000,
  AUTRE: 0,
};

const auth = useAuthStore();
const $q = useQuasar();
const { t } = useI18n();
const { confirmer } = useConfirmation();
const presentation = usePresentationListe();

const peutGuichet = computed(() => auth.peut('resto.guichet'));
const peutRecharger = computed(() => auth.peut('resto.recharger'));

const onglet = ref<'guichet' | 'portefeuilles' | 'transactions'>(
  peutGuichet.value ? 'guichet' : 'portefeuilles',
);

// ------------------------------------------------------------------ guichet
const reference = ref('');
const repas = ref<TypeRepas>('DEJEUNER');
const montant = ref(PRIX_REPAS.DEJEUNER);
const cantine = ref('');
const validationChargement = ref(false);
const resultat = ref<{
  ok: boolean;
  message?: string;
  solde?: number;
  etudiant?: any;
  consommation?: any;
  soldeInsuffisant?: boolean;
  etudiantId?: string;
} | null>(null);

const optionsRepas = computed(() => (Object.keys(PRIX_REPAS) as TypeRepas[]).map((r) => ({
  value: r,
  label: `${LIBELLE_TYPE_REPAS[r]} — ${PRIX_REPAS[r] ? montantLisible(PRIX_REPAS[r]) + ' GNF' : t('resto.guichet.mealFree')}`,
})));

function repasChoisi(v: TypeRepas) {
  if (PRIX_REPAS[v]) montant.value = PRIX_REPAS[v];
}

async function validerRepas() {
  resultat.value = null;
  validationChargement.value = true;
  try {
    const { data } = await api.post('/resto/valider', {
      reference: reference.value.trim(),
      repas: repas.value,
      montant: montant.value,
      cantine: cantine.value.trim() || undefined,
    }, { silencieux: true });
    resultat.value = {
      ok: true,
      etudiant: data.etudiant,
      consommation: data.consommation,
      solde: data.solde,
      etudiantId: data.etudiant?.id,
    };
    reference.value = '';
  } catch (e: any) {
    const data = e.response?.data;
    const soldeInsuffisant = data?.soldeInsuffisant === true || data?.code === 'SOLDE_INSUFFISANT';
    resultat.value = {
      ok: false,
      message: data?.message ?? t('resto.guichet.result.ko.networkError'),
      soldeInsuffisant,
      etudiantId: data?.etudiantId,
    };
  } finally {
    validationChargement.value = false;
  }
}

function rechargerDepuisGuichet() {
  rechargeEtudiantId.value = resultat.value?.etudiantId ?? null;
  dialogRecharge.value = true;
}

// ------------------------------------------------------------- portefeuilles
// Le serveur ne filtre que sur l'étudiant (matricule, nom, prénom).
const filtresPortefeuilles = ref<Record<string, any>>({ recherche: '' });
const pf = reactive(
  useListePaginee<any>({
    filtres: filtresPortefeuilles,
    syncUrl: true,
    prefixeUrl: 'pf_',
    actif: () => peutRecharger.value,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/resto/portefeuilles', { params: { ...pageApi(p), search: texteApi(f.recherche) } })
        .then((r) => r.data),
  }),
);
const dialogRecharge = ref(false);
const rechargeEtudiantId = ref<string | null>(null);

const chipsPortefeuilles = computed<ChipFiltre[]>(() =>
  filtresPortefeuilles.value.recherche
    ? [{
        label: t('resto.wallets.chips.search', { search: filtresPortefeuilles.value.recherche }),
        value: filtresPortefeuilles.value.recherche,
        icone: 'search',
        defaut: true,
      }]
    : [],
);

function rechargerPortefeuille(row: any) {
  rechargeEtudiantId.value = row.etudiant?.id ?? null;
  dialogRecharge.value = true;
}

function rechargerCible() {
  rechargeEtudiantId.value = null;
  dialogRecharge.value = true;
}

const colonnesPortefeuilles = computed<QTableColumn[]>(() => [
  { name: 'etudiant', label: t('resto.wallets.table.columns.student'), field: 'etudiant', sortable: true },
  {
    name: 'telephone',
    label: t('resto.wallets.table.columns.phone'),
    field: (r: any) => r.etudiant?.telephone ?? '—',
    align: 'left',
  },
  { name: 'solde', label: t('resto.wallets.table.columns.balance'), field: 'solde', sortable: true, align: 'right' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
]);

// ------------------------------------------------------------ transactions
interface LigneTransaction {
  cle: string;
  id: string;
  repas?: TypeRepas;
  type: 'REPAS' | 'RECHARGE';
  date: string;
  libelle: string;
  etudiant: string;
  montant: number;
  statut: string;
  annulable: boolean;
}

const ongletTransactions = ref<'recharges' | 'consommations'>('recharges');

/** La période reste au réinitialiser : c'est le cadre de lecture, pas un filtre parmi d'autres. */
const filtresTransactions = ref<Record<string, any>>({
  dateDebut: aujourdhui(),
  dateFin: aujourdhui(),
  statut: null,
  cantine: '',
});

const nomEtudiant = (e: any) => (e ? `${e.matricule} ${e.nom} ${e.prenom}` : '');

/**
 * Les deux flux de la période (consommations et recharges) fusionnés en une
 * liste : les KPI portent sur l'ensemble, l'onglet ne fait que trancher.
 */
async function chargerFlux(f: Record<string, any>): Promise<{ data: LigneTransaction[] }> {
  const periode = { dateDebut: f.dateDebut || aujourdhui(), dateFin: f.dateFin || aujourdhui(), pageSize: 200 };
  const [cons, rech] = await Promise.all([
    api.get('/resto/consommations', { params: { ...periode, cantine: texteApi(f.cantine) } }),
    // Le serveur ne filtre les recharges que par statut de paiement.
    api.get('/resto/recharges', { params: { ...periode, statut: f.statut || undefined } }),
  ]);
  const peutAnnuler = auth.peut('resto.annuler');
  const lignes: LigneTransaction[] = [
    ...cons.data.data.map((c: any) => ({
      cle: `c-${c.id}`,
      id: c.id,
      repas: c.repas as TypeRepas,
      type: 'REPAS' as const,
      date: c.consommeLe,
      libelle: c.cantine ? `${LIBELLE_TYPE_REPAS[c.repas] ?? c.repas} · ${c.cantine}` : LIBELLE_TYPE_REPAS[c.repas] ?? c.repas,
      etudiant: c.portefeuille?.etudiant ? nomEtudiant(c.portefeuille.etudiant) : c.etudiant,
      montant: -c.montant,
      statut: c.statut,
      annulable: c.statut === 'VALIDEE' && peutAnnuler,
    })),
    ...rech.data.data.map((r: any) => ({
      cle: `r-${r.id}`,
      id: r.id,
      type: 'RECHARGE' as const,
      date: r.rechargeLe,
      libelle: `${LIBELLE_MODE_PAIEMENT[r.paiement?.mode] ?? t('resto.transactions.paymentModeFallback')}${r.paiement?.reference ? ` — ${r.paiement.reference}` : ''}`,
      etudiant: nomEtudiant(r.portefeuille?.etudiant),
      montant: r.montant,
      statut: r.paiement?.statut ?? r.statut,
      annulable: false,
    })),
  ];
  return { data: lignes.sort((a, b) => (a.date < b.date ? 1 : -1)) };
}

const tx = reactive(
  useListePaginee<LigneTransaction>({
    filtres: filtresTransactions,
    pageSize: 0,
    syncUrl: true,
    prefixeUrl: 'tx_',
    clesTexte: ['cantine'],
    actif: () => peutRecharger.value,
    charger: ({ filtres: f }) => chargerFlux(f),
  }),
);

const transactions = computed(() =>
  tx.lignes.filter((l) => (ongletTransactions.value === 'recharges' ? l.type === 'RECHARGE' : l.type === 'REPAS')),
);

const optionsStatutsPaiement = Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({
  value, label,
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
    cs.push({ label: LIBELLE_STATUT_PAIEMENT[f.statut] ?? f.statut, value: f.statut, icone: 'payments', cle: 'statut' });
  }
  if (f.cantine) {
    cs.push({ label: t('resto.transactions.chips.cantine', { cantine: f.cantine }), value: f.cantine, icone: 'restaurant' });
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
    await api.post(`/resto/consommations/${ligne.id}/annuler`, { motif: 'Remboursement guichet' });
    $q.notify({ type: 'positive', message: t('resto.transactions.messages.refunded') });
    void tx.recharger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

const colonnesTransactions = computed<QTableColumn[]>(() => [
  { name: 'date', label: t('resto.transactions.table.columns.date'), field: 'date', sortable: true },
  { name: 'type', label: t('resto.transactions.table.columns.type'), field: 'type' },
  { name: 'etudiant', label: t('resto.transactions.table.columns.student'), field: 'etudiant' },
  { name: 'detail', label: t('resto.transactions.table.columns.detail'), field: 'libelle' },
  { name: 'montant', label: t('resto.transactions.table.columns.amount'), field: 'montant', align: 'right' as const },
  { name: 'statut', label: t('resto.transactions.table.columns.status'), field: 'statut' },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
]);

function triTable(rows: readonly any[], sortBy: string, descending: boolean) {
  const copie = [...rows];
  copie.sort((a: any, b: any) => {
    const va = a[sortBy];
    const vb = b[sortBy];
    if (va < vb) return descending ? 1 : -1;
    if (va > vb) return descending ? -1 : 1;
    return 0;
  });
  return copie;
}

// --------------------------------------------------------------- cycle de vie
function apresRecharge() {
  void pf.recharger();
  void tx.recharger();
}
</script>

<style scoped lang="scss">
.guichet {
  padding: var(--up-4);
  display: grid;
  gap: var(--up-3);
}

.guichet__entete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;

  .lettrage {
    font-size: 1.25rem;
  }
}

.guichet__valider {
  margin-top: var(--up-1);
}

.guichet-resultat {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--up-2);
  text-align: center;
  padding: var(--up-4);

  &__titre {
    font-size: 1.5rem;
    margin: 0;
  }

  &__nom {
    margin: 0;
    font-size: 1.15rem;
  }

  &__message {
    color: var(--up-encre-douce);
    margin: 0;
    max-width: 38ch;
  }

  &__lignes {
    width: 100%;
    max-width: 320px;
    display: grid;
    gap: var(--up-1);
  }

  &__ligne {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--up-2);
    font-size: 0.95rem;
  }

  &__ligne--fort {
    border-top: var(--up-filet-fin);
    padding-top: var(--up-2);
    font-size: 1.05rem;
  }
}

.guichet-resultat--ok {
  border-color: var(--up-vert);
}

.guichet-resultat--ko {
  border-color: var(--up-rouge);
}

.guichet-resultat--vide {
  border-style: dashed;
}
</style>
