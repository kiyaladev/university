<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Resto numérique</div>
        <div class="page-sous-titre">
          Fini les tickets papier : le guichet scanne la carte de l'étudiant,
          valide le repas en deux secondes — zéro cash, zéro fraude.
        </div>
      </div>
      <div class="col-auto" v-if="peutRecharger">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="account_balance_wallet"
          label="Créditer un portefeuille"
          @click="rechargerCible"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab v-if="peutGuichet" name="guichet" icon="lunch_dining" label="Guichet" no-caps />
      <q-tab name="portefeuilles" icon="account_balance_wallet" label="Portefeuilles" no-caps />
      <q-tab name="transactions" icon="receipt_long" label="Transactions" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- GUICHET                                                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'guichet' && peutGuichet" name="guichet" class="q-pa-none q-mt-md">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-7">
          <section class="plaque guichet">
            <header class="guichet__entete">
              <span class="lettrage">Poste de validation</span>
              <span class="pochoir pochoir--brut">en ligne — le solde est contrôlé au serveur</span>
            </header>

            <qr-scanner
              v-model="reference"
              label="Carte de l'étudiant (QR, matricule ou téléphone)"
              hint="Scannez la carte du convive ou saisissez son matricule"
            />

            <div class="row q-col-gutter-md q-mt-sm">
              <div class="col-12 col-sm-6">
                <q-select
                  v-model="repas"
                  :options="optionsRepas"
                  label="Repas *"
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
                  label="Prix (GNF)"
                  suffix="GNF"
                />
              </div>
              <div class="col-6 col-sm-3">
                <q-input
                  v-model="cantine"
                  outlined
                  dense
                  label="Cantine"
                  placeholder="Principale"
                />
              </div>
            </div>

            <q-btn
              unelevated
              color="primary"
              size="lg"
              no-caps
              icon="check"
              label="Valider le repas"
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
            <p class="lettrage guichet-resultat__titre">Repas validé</p>
            <p class="guichet-resultat__nom">{{ resultat.etudiant.prenom }} {{ resultat.etudiant.nom }}</p>
            <p class="pochoir chiffres">{{ resultat.etudiant.matricule }}</p>
            <div class="guichet-resultat__lignes">
              <div class="guichet-resultat__ligne">
                <span>{{ LIBELLE_TYPE_REPAS[resultat.consommation.repas] }}</span>
                <span class="chiffres">{{ montantLisible(resultat.consommation.montant) }} GNF</span>
              </div>
              <div v-if="resultat.consommation.cantine" class="guichet-resultat__ligne">
                <span>Cantine</span>
                <span>{{ resultat.consommation.cantine }}</span>
              </div>
              <div class="guichet-resultat__ligne guichet-resultat__ligne--fort">
                <span>Nouveau solde</span>
                <span class="chiffres">{{ montantLisible(resultat.solde) }} GNF</span>
              </div>
            </div>
          </section>

          <!-- Écran d'erreur -->
          <section v-else-if="resultat && !resultat.ok" class="plaque guichet-resultat guichet-resultat--ko">
            <q-icon name="error" size="52px" color="negative" />
            <p class="lettrage guichet-resultat__titre">Repas refusé</p>
            <p class="guichet-resultat__message">{{ resultat.message }}</p>
            <q-btn
              v-if="resultat.soldeInsuffisant"
              unelevated
              color="negative"
              no-caps
              icon="account_balance_wallet"
              label="Recharger le portefeuille"
              @click="rechargerDepuisGuichet"
              class="q-mt-md"
            />
          </section>

          <!-- État vide -->
          <section v-else class="plaque guichet-resultat guichet-resultat--vide">
            <q-icon name="qr_code_scanner" size="52px" color="grey-6" />
            <p class="pochoir guichet-resultat__message">
              Scannez la carte ou saisissez le matricule, choisissez le repas,
              puis validez : l'écran affichera ici le verdict.
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
        placeholder="Rechercher (matricule, nom, prénom…)"
        @reinitialiser="reinitialiserPortefeuilles"
      >
        <template #actions>
          <view-toggle cle="resto.portefeuilles" :modes="['tableau', 'cartes']" @update:mode="(v: string) => (modePortefeuilles = v as 'tableau' | 'cartes')" />
        </template>
      </filter-bar>

      <pagination-bar
        :page="paginationPortefeuilles.page"
        :page-size="paginationPortefeuilles.pageSize"
        :total="paginationPortefeuilles.total"
        :show-all="false"
        @update:page="paginationPortefeuilles.page = $event; requeterPortefeuilles()"
        @update:page-size="paginationPortefeuilles.pageSize = $event; paginationPortefeuilles.page = 1; requeterPortefeuilles()"
        @tous="chargerTousPortefeuilles"
      />

      <!-- Vue tableau -->
      <q-table
        v-if="modePortefeuilles === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="portefeuilles"
        :columns="colonnesPortefeuilles"
        row-key="id"
        :loading="chargementPortefeuilles"
        :rows-per-page-options="[0]"
        hide-bottom
      >
        <template #body-cell-etudiant="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
            <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
          </q-td>
        </template>
        <template #body-cell-solde="p">
          <q-td :props="p" class="text-right">
            <span class="chiffres text-weight-medium">{{ montantLisible(p.row.solde) }} GNF</span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn v-if="peutRecharger" flat dense no-caps color="primary" icon="add" label="Recharger" @click="rechargerPortefeuille(p.row)" />
          </q-td>
        </template>
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="account_balance_wallet" size="38px" color="grey-5" />
            <div class="q-mt-sm">Aucun portefeuille pour cette recherche.</div>
            <div class="text-caption q-mt-xs">
              Un portefeuille naît à la première recharge : créditez-en un pour
              ouvrir le compte resto d'un étudiant.
            </div>
            <q-btn
              v-if="peutRecharger"
              flat
              no-caps
              color="primary"
              icon="account_balance_wallet"
              label="Créditer un portefeuille"
              class="q-mt-sm"
              @click="rechargerCible"
            />
          </div>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="chargementPortefeuilles" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="p in portefeuilles" :key="p.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="pochoir text-grey-7">{{ p.etudiant?.matricule ?? '—' }}</div>
              <div class="text-h4 chiffres q-mt-sm">{{ montantLisible(p.solde) }} <span class="text-h6">GNF</span></div>
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
                label="Recharger"
                class="full-width"
                @click="rechargerPortefeuille(p)"
              />
            </q-card-actions>
          </q-card>
        </div>
        <div v-if="!chargementPortefeuilles && !portefeuilles.length" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="account_balance_wallet" size="42px" color="grey-5" />
          <div class="q-mt-sm">Aucun portefeuille pour cette recherche.</div>
          <q-btn
            v-if="peutRecharger"
            flat
            no-caps
            color="primary"
            icon="account_balance_wallet"
            label="Créditer un portefeuille"
            class="q-mt-sm"
            @click="rechargerCible"
          />
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- TRANSACTIONS                                                     -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'transactions'" name="transactions" class="q-pa-none q-mt-md">
      <q-tabs v-model="ongletTransactions" dense align="left" class="onglets-panneau q-mb-sm" narrow-indicator>
        <q-tab name="recharges" icon="add_card" label="Recharges" no-caps />
        <q-tab name="consommations" icon="restaurant" label="Consommations" no-caps />
      </q-tabs>

      <filter-bar
        v-model="filtresTransactions"
        :chips="chipsTransactions"
        :recherche="false"
        @reinitialiser="reinitialiserTransactions"
      >
        <template #avances>
          <champ-date v-model="filtresTransactions.dateDebut" label="Du" />
          <champ-date v-model="filtresTransactions.dateFin" label="Au" />
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
            label="Statut du paiement"
          />
          <q-input
            v-if="ongletTransactions === 'consommations'"
            v-model="filtresTransactions.cantine"
            dense
            outlined
            label="Cantine"
            clearable
          />
        </template>
        <template #actions>
          <q-btn flat dense no-caps icon="today" label="Aujourd'hui" @click="periodeAujourdhui" />
          <q-btn flat dense round icon="refresh" aria-label="Actualiser la liste" @click="chargerTransactions">
            <q-tooltip>Actualiser la liste</q-tooltip>
          </q-btn>
        </template>
      </filter-bar>

      <!-- KPIs : toujours calculés sur la période entière, quel que soit l'onglet -->
      <div class="row q-col-gutter-sm q-mb-md items-center">
        <div class="col-auto">
          <q-chip color="positive" text-color="white" icon="add">
            Encaissé : {{ montantLisible(totaux.credite) }} GNF
          </q-chip>
        </div>
        <div class="col-auto">
          <q-chip :color="totaux.debite > 0 ? 'blue-grey-7' : 'grey-7'" text-color="white" icon="remove">
            Dépensé : {{ montantLisible(totaux.debite) }} GNF
          </q-chip>
        </div>
        <div class="col-auto">
          <q-chip :color="totaux.net >= 0 ? 'positive' : 'negative'" text-color="white" icon="account_balance">
            {{ totaux.net >= 0 ? 'Net positif' : 'Net négatif' }} : {{ montantLisible(Math.abs(totaux.net)) }} GNF
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
        :loading="chargementTransactions"
        :rows-per-page-options="[0]"
        hide-bottom
        :sort-method="triTable"
        :default-sort="{ sortBy: 'date', descending: true }"
      >
        <template #body-cell-date="p">
          <q-td :props="p">{{ dateHeureLisible(p.row.date) }}</q-td>
        </template>
        <template #body-cell-type="p">
          <q-td :props="p">
            <q-badge outline :color="p.row.montant < 0 ? 'deep-orange-8' : 'teal-8'" square>
              {{ p.row.type === 'REPAS' ? 'Repas' : 'Recharge' }}
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
            <span class="champ champ-statut champ-statut--dense" :class="classeStatut(p.row.statut)">
              <span class="pochoir">{{ LIBELLE_STATUT_PAIEMENT[p.row.statut] ?? LIBELLE_STATUT_CONSOMMATION[p.row.statut] ?? p.row.statut }}</span>
            </span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="p.row.annulable"
              flat dense round color="negative" icon="history_toggle_off"
              aria-label="Rembourser ce repas"
              @click="annulerRepas(p.row)"
            >
              <q-tooltip>Rembourser ce repas</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="receipt_long" size="38px" color="grey-5" />
            <div class="q-mt-sm">
              Aucune {{ ongletTransactions === 'recharges' ? 'recharge' : 'consommation' }} sur cette période.
            </div>
            <div class="text-caption q-mt-xs">
              La période va du {{ dateLisible(filtresTransactions.dateDebut) }} au
              {{ dateLisible(filtresTransactions.dateFin) }} — élargissez-la pour voir plus loin.
            </div>
          </div>
        </template>
      </q-table>
    </q-tab-panel>

    <recharge-dialog v-model="dialogRecharge" :etudiant="rechargeEtudiantId" @rechargee="apresRecharge" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import QrScanner from '../components/QrScanner.vue';
import ChampDate from '../components/ChampDate.vue';
import RechargeDialog from '../components/RechargeDialog.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_STATUT_CONSOMMATION,
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

const peutGuichet = computed(() => auth.aRole(['CONTROLEUR', 'ADMIN', 'SCOLARITE']));
const peutRecharger = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

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

const optionsRepas = (Object.keys(PRIX_REPAS) as TypeRepas[]).map((r) => ({
  value: r,
  label: `${LIBELLE_TYPE_REPAS[r]} — ${PRIX_REPAS[r] ? montantLisible(PRIX_REPAS[r]) + ' GNF' : 'libre'}`,
}));

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
    });
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
      message: data?.message ?? 'Erreur réseau : vérifiez la connexion du poste de guichet',
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
const portefeuilles = ref<any[]>([]);
const chargementPortefeuilles = ref(false);
const paginationPortefeuilles = ref({ page: 1, pageSize: 20, total: 0 });
const filtresPortefeuilles = ref<Record<string, any>>({ recherche: '' });
const modePortefeuilles = ref<'tableau' | 'cartes'>('cartes');
const dialogRecharge = ref(false);
const rechargeEtudiantId = ref<string | null>(null);

watch(filtresPortefeuilles, () => {
  paginationPortefeuilles.value.page = 1;
  requeterPortefeuilles();
}, { deep: true });

const chipsPortefeuilles = computed(() =>
  filtresPortefeuilles.value.recherche
    ? [{
        label: `« ${filtresPortefeuilles.value.recherche} »`,
        value: filtresPortefeuilles.value.recherche,
        icone: 'search',
        defaut: true,
      }]
    : [],
);

async function requeterPortefeuilles() {
  chargementPortefeuilles.value = true;
  try {
    const f = filtresPortefeuilles.value;
    const params: Record<string, any> = {
      page: paginationPortefeuilles.value.page,
      pageSize: paginationPortefeuilles.value.pageSize,
      search: (f.recherche ?? '').toString().trim() || undefined,
    };
    const { data } = await api.get('/resto/portefeuilles', { params });
    portefeuilles.value = data.data;
    paginationPortefeuilles.value.total = data.total;
  } finally {
    chargementPortefeuilles.value = false;
  }
}

async function chargerTousPortefeuilles() {
  paginationPortefeuilles.value.page = 1;
  paginationPortefeuilles.value.pageSize = Math.max(paginationPortefeuilles.value.total, 200) || 200;
  await requeterPortefeuilles();
}

function reinitialiserPortefeuilles() {
  filtresPortefeuilles.value = { recherche: filtresPortefeuilles.value.recherche ?? '' };
}

function rechargerPortefeuille(row: any) {
  rechargeEtudiantId.value = row.etudiant?.id ?? null;
  dialogRecharge.value = true;
}

function rechargerCible() {
  rechargeEtudiantId.value = null;
  dialogRecharge.value = true;
}

const colonnesPortefeuilles: QTableColumn[] = [
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', sortable: true },
  { name: 'telephone', label: 'Téléphone', field: (r: any) => r.etudiant?.telephone ?? '—', align: 'left' },
  { name: 'solde', label: 'Solde', field: 'solde', sortable: true, align: 'right' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
];

// ------------------------------------------------------------ transactions
const ongletTransactions = ref<'recharges' | 'consommations'>('recharges');
const chargementTransactions = ref(false);
/** Les deux flux de la période : les KPI portent sur l'ensemble. */
const toutesLignes = ref<LigneTransaction[]>([]);

const filtresTransactions = ref<Record<string, any>>({
  dateDebut: aujourdhui(),
  dateFin: aujourdhui(),
});

/** L'onglet ne fait que trancher dans ce qui est déjà chargé. */
const transactions = computed(() =>
  toutesLignes.value.filter((l) =>
    ongletTransactions.value === 'recharges' ? l.type === 'RECHARGE' : l.type === 'REPAS',
  ),
);

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

const optionsStatutsPaiement = Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({
  value, label,
}));

const totaux = computed(() => {
  let debite = 0;
  let credite = 0;
  for (const t of toutesLignes.value) {
    if (t.montant < 0) debite += -t.montant;
    else credite += t.montant;
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
      icone: 'payments', cle: 'statut'});
  }
  if (f.cantine) cs.push({ label: `Cantine : ${f.cantine}`, value: f.cantine, icone: 'restaurant' });
  return cs;
});

/** La période reste : c'est le cadre de lecture, pas un filtre parmi d'autres. */
function reinitialiserTransactions() {
  filtresTransactions.value = {
    dateDebut: filtresTransactions.value.dateDebut,
    dateFin: filtresTransactions.value.dateFin,
  };
}

function periodeAujourdhui() {
  filtresTransactions.value = {
    ...filtresTransactions.value,
    dateDebut: aujourdhui(),
    dateFin: aujourdhui(),
  };
}

async function chargerTransactions() {
  chargementTransactions.value = true;
  try {
    const params: Record<string, any> = {
      dateDebut: filtresTransactions.value.dateDebut || aujourdhui(),
      dateFin: filtresTransactions.value.dateFin || aujourdhui(),
      pageSize: 200,
    };
    // Le serveur ne filtre les recharges que par statut de paiement.
    const paramsRecharges: Record<string, any> = { ...params };
    if (filtresTransactions.value.statut) paramsRecharges.statut = filtresTransactions.value.statut;

    const paramsConso: Record<string, any> = { ...params };
    if (filtresTransactions.value.cantine) paramsConso.cantine = filtresTransactions.value.cantine;

    const [cons, rech] = await Promise.all([
      api.get('/resto/consommations', { params: paramsConso }),
      api.get('/resto/recharges', { params: paramsRecharges }),
    ]);
    const lignes: LigneTransaction[] = [
      ...cons.data.data.map((c: any) => ({
        cle: `c-${c.id}`,
        id: c.id,
        repas: c.repas as TypeRepas,
        type: 'REPAS' as const,
        date: c.consommeLe,
        libelle: c.cantine ? `${LIBELLE_TYPE_REPAS[c.repas] ?? c.repas} · ${c.cantine}` : LIBELLE_TYPE_REPAS[c.repas] ?? c.repas,
        etudiant: c.portefeuille?.etudiant
          ? `${c.portefeuille.etudiant.matricule} ${c.portefeuille.etudiant.nom} ${c.portefeuille.etudiant.prenom}`
          : c.etudiant,
        montant: -c.montant,
        statut: c.statut,
        annulable: c.statut === 'VALIDEE' && auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']),
      })),
      ...rech.data.data.map((r: any) => ({
        cle: `r-${r.id}`,
        id: r.id,
        type: 'RECHARGE' as const,
        date: r.rechargeLe,
        libelle: `${LIBELLE_MODE_PAIEMENT[r.paiement?.mode] ?? 'Paiement'}${r.paiement?.reference ? ` — ${r.paiement.reference}` : ''}`,
        etudiant: r.portefeuille?.etudiant
          ? `${r.portefeuille.etudiant.matricule} ${r.portefeuille.etudiant.nom} ${r.portefeuille.etudiant.prenom}`
          : '',
        montant: r.montant,
        statut: r.paiement?.statut ?? r.statut,
        annulable: false,
      })),
    ];
    toutesLignes.value = lignes.sort((a, b) => (a.date < b.date ? 1 : -1));
  } finally {
    chargementTransactions.value = false;
  }
}

function classeStatut(s: string) {
  return (
    {
      VALIDEE: 'champ--present',
      REUSSI: 'champ--present',
      EN_ATTENTE: 'champ--attente',
      ECHOUE: 'champ--absent',
      ANNULEE: 'champ--retard',
      ANNULE: 'champ--retard',
      REMBOURSE: 'champ--retard',
    })[s] ?? 'champ--attente';
}

function annulerRepas(ligne: LigneTransaction) {
  $q.dialog({
    title: 'Rembourser ce repas ?',
    message: `${LIBELLE_TYPE_REPAS[ligne.repas ?? 'AUTRE'] ?? ligne.libelle} — ${montantLisible(-ligne.montant)} GNF seront recrédités sur le portefeuille de l'étudiant.`,
    cancel: true,
    ok: { label: 'Rembourser', color: 'negative' },
  }).onOk(async () => {
    await api.post(`/resto/consommations/${ligne.id}/annuler`, { motif: 'Remboursement guichet' });
    $q.notify({ type: 'positive', message: 'Repas annulé — solde remboursé' });
    void chargerTransactions();
  });
}

const colonnesTransactions: QTableColumn[] = [
  { name: 'date', label: 'Le', field: 'date', sortable: true },
  { name: 'type', label: 'Opération', field: 'type' },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant' },
  { name: 'detail', label: 'Détail', field: 'libelle' },
  { name: 'montant', label: 'Montant', field: 'montant', align: 'right' as const },
  { name: 'statut', label: 'Statut', field: 'statut' },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
];

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
  void requeterPortefeuilles();
  void chargerTransactions();
}

// Sans ce watcher, changer les dates n'avait aucun effet tant qu'on ne
// cliquait pas sur « Actualiser ».
watch(filtresTransactions, () => {
  void chargerTransactions();
}, { deep: true });

onMounted(() => {
  void requeterPortefeuilles();
  void chargerTransactions();
});
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
