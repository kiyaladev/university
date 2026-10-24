<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('resto.title')" :subtitle="$t('resto.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutRecharger"
          unelevated
          color="primary"
          no-caps
          icon="account_balance_wallet"
          :label="$t('resto.actions.creditWallet')"
          @click="rechargerCible"
        />
      </template>
    </en-tete-page>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab v-if="peutGuichet" name="guichet" icon="lunch_dining" :label="$t('resto.tabs.guichet')" no-caps />
      <q-tab
        v-if="peutRecharger"
        name="portefeuilles"
        icon="account_balance_wallet"
        :label="$t('resto.tabs.wallets')"
        no-caps
      />
      <q-tab
        v-if="peutRecharger"
        name="transactions"
        icon="receipt_long"
        :label="$t('resto.tabs.transactions')"
        no-caps
      />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- GUICHET                                                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'guichet' && peutGuichet" name="guichet" class="q-pa-none q-mt-md">
      <resto-guichet @recharger="rechargerEtudiant" />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- PORTEFEUILLES                                                    -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'portefeuilles'" name="portefeuilles" class="q-pa-none q-mt-md">
      <resto-portefeuilles ref="portefeuilles" :peut-recharger="peutRecharger" @recharger="rechargerEtudiant" />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- TRANSACTIONS                                                     -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'transactions'" name="transactions" class="q-pa-none q-mt-md">
      <resto-transactions ref="transactions" :peut-recharger="peutRecharger" />
    </q-tab-panel>

    <dialogue-recharge
      v-if="peutRecharger"
      v-model="dialogRecharge"
      :etudiant="rechargeEtudiantId"
      @enregistre="apresRecharge"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueRecharge from '../components/DialogueRecharge.vue';
import RestoGuichet from '../components/RestoGuichet.vue';
import RestoPortefeuilles from '../components/RestoPortefeuilles.vue';
import RestoTransactions from '../components/RestoTransactions.vue';

const auth = useAuthStore();

const peutGuichet = computed(() => auth.peut('resto.guichet'));
const peutRecharger = computed(() => auth.peut('resto.recharger'));

const onglet = ref<'guichet' | 'portefeuilles' | 'transactions'>(peutGuichet.value ? 'guichet' : 'portefeuilles');

/** Recharge : ouverte par le guichet ou par une ligne du tableau des portefeuilles. */
const dialogRecharge = ref(false);
const rechargeEtudiantId = ref<string | null>(null);

const portefeuilles = ref<InstanceType<typeof RestoPortefeuilles> | null>(null);
const transactions = ref<InstanceType<typeof RestoTransactions> | null>(null);

/** Recharge sans étudiant pré-sélectionné : le dialogue propose la liste. */
function rechargerCible() {
  rechargeEtudiantId.value = null;
  dialogRecharge.value = true;
}

/** Recharge d'un étudiant précis (bouton du guichet ou d'une ligne). */
function rechargerEtudiant(etudiantId: string | null) {
  rechargeEtudiantId.value = etudiantId;
  dialogRecharge.value = true;
}

/** Une recharge change le solde : les deux listes sont rechargées. */
function apresRecharge() {
  void portefeuilles.value?.recharger();
  void transactions.value?.recharger();
}
</script>
