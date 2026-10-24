<template>
  <!-- Le serveur ne filtre que sur l'étudiant (matricule, nom, prénom) :
       pas de filtre avancé qui ne serait pas appliqué. -->
  <barre-filtres
    v-model="filtresPortefeuilles"
    :chips="chipsPortefeuilles"
    :placeholder="$t('resto.wallets.searchPlaceholder')"
    @reinitialiser="pf.reinitialiser()"
  />

  <barre-pagination v-model:page="pf.page" v-model:page-size="pf.pageSize" :total="pf.total" :show-all="false" />

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
        <span class="chiffres text-weight-medium">{{ montantLisible(p.row.solde) }} {{ $t('common.units.gnf') }}</span>
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
          :label="$t('resto.wallets.actions.recharge')"
          @click="rechargerPortefeuille(p.row)"
        />
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="account_balance_wallet"
        :titre="$t('resto.wallets.emptyState.title')"
        :aide="$t('resto.wallets.emptyState.description')"
      >
        <template v-if="peutRecharger" #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="account_balance_wallet"
            :label="$t('resto.actions.creditWallet')"
            @click="demanderRecharge"
          />
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
          <div class="text-h4 chiffres q-mt-sm">
            {{ montantLisible(p.solde) }} <span class="text-h6">{{ $t('common.units.gnf') }}</span>
          </div>
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
    <etat-vide
      v-if="!pf.chargement && !pf.lignes.length"
      class="col-12"
      icone="account_balance_wallet"
      :titre="$t('resto.wallets.emptyState.title')"
    >
      <template v-if="peutRecharger" #action>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="account_balance_wallet"
          :label="$t('resto.actions.creditWallet')"
          @click="demanderRecharge"
        />
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { montantLisible } from '@/shared/utils/libelles';
import { restoService } from '../services/resto';
import type { PortefeuilleResto } from '../types';
import type { ChipFiltre } from '@/types';

const props = defineProps<{
  /** Droit de recharger : il masque les boutons de recharge. */
  peutRecharger: boolean;
}>();

const emit = defineEmits<{ recharger: [etudiantId: string | null] }>();

/** Filtre de la liste : le serveur ne cherche que sur l'étudiant. */
interface FiltresPortefeuilles {
  recherche: string;
}

const { t } = useI18n();
const presentation = usePresentationListe();

const filtresPortefeuilles = ref<FiltresPortefeuilles>({ recherche: '' });
const pf = reactive(
  useListePaginee<PortefeuilleResto, FiltresPortefeuilles>({
    filtres: filtresPortefeuilles,
    syncUrl: true,
    prefixeUrl: 'pf_',
    actif: () => props.peutRecharger,
    charger: ({ filtres: f, ...p }) => {
      const params = pageApi(p);
      return restoService.listePortefeuilles({ ...params, search: texteApi(f.recherche) });
    },
  }),
);

const chipsPortefeuilles = computed<ChipFiltre[]>(() =>
  filtresPortefeuilles.value.recherche
    ? [
        {
          label: t('resto.wallets.chips.search', { search: filtresPortefeuilles.value.recherche }),
          value: filtresPortefeuilles.value.recherche,
          icone: 'search',
          defaut: true,
        },
      ]
    : [],
);

function rechargerPortefeuille(row: PortefeuilleResto) {
  emit('recharger', row.etudiant?.id ?? null);
}

/** Recharge sans étudiant pré-sélectionné : le dialogue propose la liste. */
function demanderRecharge() {
  emit('recharger', null);
}

const colonnesPortefeuilles = computed<QTableColumn[]>(() => [
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant', sortable: true },
  {
    name: 'telephone',
    label: t('common.fields.phone'),
    field: (r: PortefeuilleResto) => r.etudiant?.telephone ?? '—',
    align: 'left',
  },
  {
    name: 'solde',
    label: t('resto.wallets.table.columns.balance'),
    field: 'solde',
    sortable: true,
    align: 'right' as const,
  },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
]);

/** La page recharge le portefeuille après une recharge : elle redemande la liste. */
defineExpose({ recharger: () => pf.recharger() });
</script>
