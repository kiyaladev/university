<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('frais.title')" :subtitle="$t('frais.subtitle')">
      <template v-if="peutGerer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('frais.actions.new')"
          @click="ouvrirCreation"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :recherche="false"
      :chips="chips"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #principaux>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.academicYear')"
          @update:model-value="filtres.promotionId = null"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('frais.filters.promotion')"
        />
      </template>
    </barre-filtres>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ $t('frais.summary', { count: liste.lignes.length, total: liste.total }) }}
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || lignes.length > 0"
    >
      <template #no-data>
        <etat-vide icone="request_quote" :titre="$t('frais.emptyState.title')">
          <template v-if="filtresActifs" #action>
            <q-btn
              outline
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
              @click="liste.reinitialiser([])"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <div>{{ p.row.promotionLibelle }}</div>
          <div v-if="p.row.promotion?.niveau" class="text-caption text-grey-7">{{ p.row.promotion.niveau }}</div>
        </q-td>
      </template>

      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right text-weight-medium chiffres">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            color="primary"
            :aria-label="$t('frais.actions.edit')"
            @click="ouvrirModification(p.row)"
          >
            <q-tooltip>{{ $t('frais.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            icon="delete"
            color="negative"
            :aria-label="$t('frais.actions.delete')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('frais.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-frais v-model="dialogOuvert" :existant="fraisEnEdition" @enregistre="liste.recharger()" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { montantLisible } from '@/shared/utils/libelles';
import DialogueFrais from '../components/DialogueFrais.vue';
import {
  fraisService,
  filtresFrais,
  ligneFrais,
  type FraisAvecLibelles,
} from '../services/frais';
import type { ChipFiltre } from '@/types';

const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();
const $q = useQuasar();

const annees = ref<Awaited<ReturnType<typeof referentiels.annees>>>([]);
const promotions = ref<Awaited<ReturnType<typeof referentiels.promotions>>>([]);

const filtres = ref<{ anneeId: string | null; promotionId: string | null }>({
  anneeId: null,
  promotionId: null,
});

const dialogOuvert = ref(false);
const fraisEnEdition = ref<FraisAvecLibelles | null>(null);

/** Tarifs paginés côté serveur ; les filtres suivent l'URL. */
const liste = reactive(
  useListePaginee<FraisAvecLibelles>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      fraisService
        .liste({
          ...filtresFrais(f),
          ...(p.tout ? { all: '1' } : { page: p.page, pageSize: p.pageSize }),
        })
        .then((page) => ({ data: page.data ?? [], total: page.total })),
  }),
);

const lignes = computed(() => liste.lignes.map(ligneFrais));

const optionsAnnees = computed(() => annees.value.map((a) => ({ value: a.id, label: a.libelle })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ value: p.id, label: p.nom })),
);

/** Les `@Roles` de l'API : administration et scolarité gèrent, l'administration seule supprime. */
const peutGerer = computed(() => auth.peut('frais.gerer'));
const peutSupprimer = computed(() => auth.peut('frais.supprimer'));

const filtresActifs = computed(() => !!filtres.value.anneeId || !!filtres.value.promotionId);

const chips = computed<ChipFiltre[]>(() => {
  const liste: ChipFiltre[] = [];
  if (filtres.value.anneeId) {
    liste.push({
      label: t('frais.chips.year', {
        year: annees.value.find((a) => a.id === filtres.value.anneeId)?.libelle ?? filtres.value.anneeId,
      }),
      value: filtres.value.anneeId,
      cle: 'anneeId',
      icone: 'calendar_month',
    });
  }
  if (filtres.value.promotionId) {
    liste.push({
      label: t('frais.chips.promotion', {
        promotion:
          promotions.value.find((p) => p.id === filtres.value.promotionId)?.nom ?? filtres.value.promotionId,
      }),
      value: filtres.value.promotionId,
      cle: 'promotionId',
      icone: 'school',
    });
  }
  return liste;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'annee', label: t('common.fields.academicYear'), field: 'anneeLibelle', align: 'left' },
  { name: 'promotion', label: t('frais.table.columns.promotion'), field: 'promotionLibelle', align: 'left' },
  { name: 'montant', label: t('common.fields.amount'), field: 'montant', align: 'right', sortable: true },
  { name: 'devise', label: t('common.fields.currency'), field: 'devise', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ouvrirCreation() {
  fraisEnEdition.value = null;
  dialogOuvert.value = true;
}

function ouvrirModification(frais: FraisAvecLibelles) {
  fraisEnEdition.value = frais;
  dialogOuvert.value = true;
}

async function supprimer(frais: FraisAvecLibelles) {
  const ok = await confirmer({
    titre: t('frais.deleteDialog.title'),
    message: t('frais.deleteDialog.message', {
      promotion: frais.promotion?.nom ?? '—',
      year: frais.annee?.libelle ?? '—',
      amount: `${montantLisible(frais.montant)} ${frais.devise}`,
    }),
    ok: t('common.actions.yes_delete'),
    danger: true,
  });
  if (!ok) return;
  await fraisService.supprimer(frais.id);
  $q.notify({ type: 'positive', message: t('frais.messages.deleted') });
  await liste.recharger();
}

onMounted(async () => {
  try {
    [annees.value, promotions.value] = await Promise.all([referentiels.annees(), referentiels.promotions()]);
  } catch {
    annees.value = [];
    promotions.value = [];
  }
});
</script>
