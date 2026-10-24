<template>
  <div>
    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('cites.chambres.filters.placeholder')"
      @reinitialiser="emit('reinitialiser')"
    >
      <template #avances>
        <champ-recherche
          v-model="filtres.residenceId"
          endpoint="/residences"
          :label-fn="(r) => `${r.code} — ${r.nom}`"
          :label="$t('cites.chambres.filters.residence')"
        />
        <q-select
          v-model="filtres.categorie"
          :options="optionsCategories"
          emit-value
          map-options
          dense
          outlined
          clearable
          :label="$t('common.fields.category')"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          emit-value
          map-options
          dense
          outlined
          clearable
          :label="$t('common.fields.status')"
        />
      </template>
    </barre-filtres>

    <barre-pagination v-model:page="page" v-model:page-size="pageSize" :total="total" :show-all="false" />

    <!-- Vue tableau -->
    <q-table
      v-if="presentation === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || lignes.length > 0"
    >
      <template #body-cell-categorie="p">
        <q-td :props="p">{{ LIBELLE_CATEGORIE_CHAMBRE[p.row.categorie] ?? p.row.categorie }}</q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="chambre" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-loyer="p">
        <q-td :props="p" class="text-right">{{ montantLisible(p.row.loyer) }} {{ p.row.devise }}</q-td>
      </template>
      <template #body-cell-residence="p">
        <q-td :props="p">{{ p.row.residence?.nom ?? '—' }}</q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="how_to_reg"
            :aria-label="$t('cites.chambres.table.aria.voirAttributions')"
            @click="emit('voirAttributions', p.row)"
          >
            <q-tooltip>{{ $t('cites.chambres.table.tooltip.voirAttributions') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('cites.chambres.table.aria.modifier')"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('cites.chambres.table.aria.supprimer')"
            @click="emit('supprimer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="meeting_room"
          :titre="$t('cites.chambres.emptyState.title')"
          :aide="$t('cites.chambres.emptyState.hint')"
        >
          <template v-if="peutGerer" #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="add"
              :label="$t('cites.actions.newChambre')"
              @click="emit('creer')"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div v-if="chargement" class="col-12 q-pa-md text-center">
        <q-spinner color="primary" />
      </div>
      <div v-for="c in lignes" :key="c.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ c.residence?.code ?? '—' }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ c.code }}</div>
            </div>
            <PastilleStatut domaine="chambre" :statut="c.statut" />
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="apartment" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ c.residence?.nom ?? '—' }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="category" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ LIBELLE_CATEGORIE_CHAMBRE[c.categorie] ?? c.categorie }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="bed" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption"
                >{{ c.lits }}
                {{ c.lits > 1 ? $t('cites.chambres.card.litPlural') : $t('cites.chambres.card.litSingular') }}</span
              >
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions class="text-caption text-grey-7 q-px-md">
            <q-icon name="payments" size="16px" class="q-mr-xs" />
            <span class="chiffres text-weight-medium">{{ montantLisible(c.loyer) }} {{ c.devise }}</span>
            <q-space />
            <q-btn
              v-if="peutGerer"
              flat
              dense
              round
              size="sm"
              icon="edit"
              :aria-label="$t('cites.chambres.table.aria.modifier')"
              @click="emit('modifier', c)"
            >
              <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="estAdmin"
              flat
              dense
              round
              size="sm"
              color="negative"
              icon="delete"
              :aria-label="$t('cites.chambres.table.aria.supprimer')"
              @click="emit('supprimer', c)"
            >
              <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!chargement && !lignes.length"
        class="col-12"
        icone="meeting_room"
        :titre="$t('cites.chambres.emptyState.title')"
      >
        <template v-if="peutGerer" #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="add"
            :label="$t('cites.actions.newChambre')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Chambres » de la cité : les chambres du parc, leurs filtres et
 * leurs actions. La page garde la liste et la pagination ; ce composant
 * présente les lignes et rend les actions.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { montantLisible } from '@/shared/utils/format';
import { LIBELLE_CATEGORIE_CHAMBRE, LIBELLE_STATUT_CHAMBRE } from '@/shared/utils/libelles';
import type { Chambre, ChipFiltre, Residence, FiltresPage } from '@/types';

const props = defineProps<{
  lignes: Chambre[];
  chargement: boolean;
  total: number;
  /** Le parc, pour nommer la résidence dans les chips. */
  residences: Residence[];
  peutGerer: boolean;
  estAdmin: boolean;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<FiltresPage>('filtres', { required: true });
/** Pagination : la page garde l'état, pour rester synchronisée avec l'URL. */
const page = defineModel<number>('page', { required: true });
const pageSize = defineModel<number>('pageSize', { required: true });

const emit = defineEmits<{
  creer: [];
  modifier: [chambre: Chambre];
  supprimer: [chambre: Chambre];
  voirAttributions: [chambre: Chambre];
  reinitialiser: [];
}>();

const { t } = useI18n();
const presentation = usePresentationListe();

const optionsCategories = Object.entries(LIBELLE_CATEGORIE_CHAMBRE).map(([value, label]) => ({ value, label }));
const optionsStatuts = Object.entries(LIBELLE_STATUT_CHAMBRE).map(([value, label]) => ({ value, label }));

const codeResidence = (id: string) => props.residences.find((x) => x.id === id)?.code ?? '…';

const chips = computed<ChipFiltre[]>(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = f.recherche
    ? [{ label: t('cites.chips.recherche', { q: f.recherche }), value: f.recherche, icone: 'search', defaut: true }]
    : [];
  if (f.residenceId) {
    cs.push({
      label: t('cites.chambres.chips.residence', { code: codeResidence(f.residenceId) }),
      value: f.residenceId,
      icone: 'apartment',
    });
  }
  if (f.categorie)
    cs.push({
      label: LIBELLE_CATEGORIE_CHAMBRE[f.categorie] ?? f.categorie,
      value: f.categorie,
      icone: 'category',
      cle: 'categorie',
    });
  if (f.statut)
    cs.push({
      label: LIBELLE_STATUT_CHAMBRE[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'meeting_room',
      cle: 'statut',
    });
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'residence', label: t('cites.chambres.table.columns.residence'), field: 'residence', align: 'left' },
  { name: 'categorie', label: t('common.fields.category'), field: 'categorie', align: 'left', sortable: true },
  { name: 'lits', label: t('cites.chambres.table.columns.lits'), field: 'lits', align: 'center' },
  { name: 'loyer', label: t('cites.chambres.table.columns.loyer'), field: 'loyer', align: 'right', sortable: true },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>
