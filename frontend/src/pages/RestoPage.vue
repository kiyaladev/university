<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Cantine & portefeuille resto</div>
        <div class="page-sous-titre">
          Fini les tickets papier : le guichet scanne la carte de l'étudiant,
          valide le repas en deux secondes — zéro cash, zéro fraude
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutRecharger"
          unelevated
          color="primary"
          no-caps
          icon="account_balance_wallet"
          label="Recharger un portefeuille"
          @click="rechargerCible"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab v-if="peutGuichet" name="guichet" icon="lunch_dining" label="Guichet" no-caps />
      <q-tab name="portefeuilles" icon="account_balance_wallet" label="Portefeuilles" no-caps />
      <q-tab name="transactions" icon="receipt_long" label="Transactions" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------------ Guichet -->
      <q-tab-panel v-if="peutGuichet" name="guichet" class="q-pa-none">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-7">
            <section class="plaque guichet">
              <header class="guichet__entete">
                <span class="lettrage">Poste de validation</span>
                <span class="pochoir pochoir--brut">en ligne — le solde est contrôlé au serveur</span>
              </header>

              <label class="pochoir guichet__libelle">Carte de l'étudiant (QR, matricule ou téléphone)</label>
              <QrScanner v-model="reference" />

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
                    label="Montant"
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

              <p class="guichet__note">
                <q-icon name="wifi" size="15px" />
                Décision produit : la validation exige la connexion par défaut —
                un solde local serait falsifiable et incohérent entre les postes.
              </p>
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

      <!-- ------------------------------------------------------ Portefeuilles -->
      <q-tab-panel name="portefeuilles" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="portefeuilles"
          :columns="colonnesPortefeuilles"
          row-key="id"
          :loading="chargementPortefeuilles"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #top-left>
            <q-input
              v-model="recherchePortefeuilles"
              dense
              outlined
              clearable
              placeholder="Matricule, nom…"
              @update:model-value="chargerPortefeuilles"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </template>

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
              <q-btn
                v-if="peutRecharger"
                flat
                dense
                no-caps
                color="primary"
                icon="add"
                label="Recharger"
                @click="rechargerPortefeuille(p.row)"
              />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ------------------------------------------------------- Transactions -->
      <q-tab-panel name="transactions" class="q-pa-none">
        <div class="row items-center q-col-gutter-md q-mb-md">
          <div class="col-auto">
            <q-input v-model="dateDebut" type="date" dense outlined label="Du" style="width: 170px" />
          </div>
          <div class="col-auto">
            <q-input v-model="dateFin" type="date" dense outlined label="Au" style="width: 170px" />
          </div>
          <div class="col-auto">
            <q-btn dense outline no-caps icon="today" label="Aujourd'hui" @click="periodeAujourdhui" />
          </div>
          <q-space />
          <q-btn dense flat no-caps icon="refresh" label="Recharger" @click="chargerTransactions" />
        </div>

        <div class="row q-col-gutter-sm q-mb-sm">
          <div class="col-auto">
            <q-chip :color=" 'positive'" text-color="white" icon="add">
              Crédité : {{ montantLisible(totaux.credite) }} GNF
            </q-chip>
          </div>
          <div class="col-auto">
            <q-chip :color="totaux.net >= 0 ? 'blue-grey-7' : 'negative'" text-color="white" icon="remove">
              Débité : {{ montantLisible(totaux.debite) }} GNF
            </q-chip>
          </div>
          <div class="col-auto">
            <q-chip :color="totaux.net >= 0 ? 'positive' : 'negative'" text-color="white" icon="account_balance">
              {{ totaux.net >= 0 ? 'Recharges nettes' : 'Dépenses nettes' }} : {{ montantLisible(Math.abs(totaux.net)) }} GNF
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
          :pagination="{ page: 1, rowsPerPage: 25 }"
        >
          <template #body-cell-date="p">
            <q-td :props="p">{{ dateHeureLisible(p.row.date) }}</q-td>
          </template>
          <template #body-cell-type="p">
            <q-td :props="p">
              <q-badge outline :color="p.row.type === 'REPAS' ? 'deep-orange-8' : 'teal-8'" square>
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
                flat
                dense
                round
                color="negative"
                icon="history_toggle_off"
                title="Rembourser ce repas"
                @click="annulerRepas(p.row)"
              />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <RechargeDialog v-model="dialogRecharge" :etudiant="rechargeEtudiantId" @rechargee="apresRecharge" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import QrScanner from '../components/QrScanner.vue';
import RechargeDialog from '../components/RechargeDialog.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_STATUT_CONSOMMATION,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_REPAS,
  dateHeureLisible,
  montantLisible,
} from '../utils/libelles';
import type { TypeRepas } from '../types';

function aujourdhui(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Prix par défaut des repas, paramétrables ici (GNF). */
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

// La direction consulte mais n'a pas accès au poste de guichet : on ouvre
// alors directement sur les portefeuilles.
const onglet = ref(peutGuichet.value ? 'guichet' : 'portefeuilles');

// ------------------------------------------------------------------ guichet
const reference = ref('');
const repas = ref<TypeRepas>('DEJEUNER');
const montant = ref(PRIX_REPAS.DEJEUNER);
const cantine = ref('');
const validationChargement = ref(false);
const resultat = ref<{ ok: boolean; message?: string; solde?: number; etudiant?: any; consommation?: any } | null>(null);

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
    resultat.value = { ok: true, etudiant: data.etudiant, consommation: data.consommation, solde: data.solde };
    reference.value = '';
  } catch (e: any) {
    resultat.value = {
      ok: false,
      message: e.response?.data?.message ?? 'Erreur réseau : vérifiez la connexion du poste de guichet',
    };
  } finally {
    validationChargement.value = false;
  }
}

// ------------------------------------------------------------- portefeuilles
const portefeuilles = ref<any[]>([]);
const chargementPortefeuilles = ref(false);
const recherchePortefeuilles = ref('');
const dialogRecharge = ref(false);
const rechargeEtudiantId = ref<string | null>(null);

async function chargerPortefeuilles() {
  chargementPortefeuilles.value = true;
  try {
    const { data } = await api.get('/resto/portefeuilles', {
      params: { search: recherchePortefeuilles.value || undefined, pageSize: 100 },
    });
    portefeuilles.value = data.data;
  } finally {
    chargementPortefeuilles.value = false;
  }
}

function rechargerPortefeuille(row: any) {
  rechargeEtudiantId.value = row.etudiant?.id ?? null;
  dialogRecharge.value = true;
}

function rechargerCible() {
  rechargeEtudiantId.value = null;
  dialogRecharge.value = true;
}

const colonnesPortefeuilles = [
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', sortable: true },
  { name: 'solde', label: 'Solde', field: 'solde', sortable: true, align: 'right' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
];

// ------------------------------------------------------------ transactions
const dateDebut = ref(aujourdhui());
const dateFin = ref(aujourdhui());
const chargementTransactions = ref(false);
const transactions = ref<LigneTransaction[]>([]);

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

const totaux = computed(() => {
  let debite = 0;
  let credite = 0;
  for (const t of transactions.value) {
    if (t.montant < 0) debite += -t.montant;
    else credite += t.montant;
  }
  return { debite, credite, net: credite - debite };
});

function periodeAujourdhui() {
  dateDebut.value = aujourdhui();
  dateFin.value = aujourdhui();
  void chargerTransactions();
}

async function chargerTransactions() {
  chargementTransactions.value = true;
  try {
    const [cons, rech] = await Promise.all([
      api.get('/resto/consommations', { params: { dateDebut: dateDebut.value, dateFin: dateFin.value, pageSize: 200 } }),
      api.get('/resto/recharges', { params: { dateDebut: dateDebut.value, dateFin: dateFin.value, pageSize: 200 } }),
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
        statut: r.statut,
        annulable: false,
      })),
    ];
    lignes.sort((a, b) => (a.date < b.date ? 1 : -1));
    transactions.value = lignes;
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

const colonnesTransactions = [
  { name: 'date', label: 'Le', field: 'date', sortable: true },
  { name: 'type', label: 'Opération', field: 'type' },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant' },
  { name: 'detail', label: 'Détail', field: 'libelle' },
  { name: 'montant', label: 'Montant', field: 'montant', align: 'right' as const },
  { name: 'statut', label: 'Statut', field: 'statut' },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
];

// --------------------------------------------------------------- cycle de vie
function apresRecharge() {
  void chargerPortefeuilles();
  void chargerTransactions();
}

onMounted(() => {
  void chargerPortefeuilles();
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

.guichet__libelle {
  color: var(--up-encre-douce);
  margin-bottom: var(--up-1);
  font-size: 0.9rem;
}

.guichet__valider {
  margin-top: var(--up-1);
}

.guichet__note {
  display: flex;
  align-items: flex-start;
  gap: var(--up-2);
  color: var(--up-encre-douce);
  font-size: 0.82rem;
  line-height: 1.45;
  margin: 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
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