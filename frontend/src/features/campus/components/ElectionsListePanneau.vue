<template>
  <div>
    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('elections.filters.searchPlaceholder')"
      @reinitialiser="emit('reinitialiser')"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE_ELECTION"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('elections.filters.type')"
        />
      </template>
    </barre-filtres>

    <q-table
      v-if="modeVue === 'tableau'"
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
      <template #no-data>
        <etat-vide
          icone="how_to_vote"
          :titre="$t('elections.emptyState.filtered', { status: LIBELLE_STATUT_ELECTION[onglet].toLowerCase() })"
        />
      </template>

      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_ELECTION[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-periode="p">
        <q-td :props="p">
          {{ dateHeureElection(p.row.dateOuverture) }} → {{ dateHeureElection(p.row.dateCloture) }}
        </q-td>
      </template>
      <template #body-cell-candidats="p">
        <q-td :props="p" class="chiffres">{{ nbCandidats(p.row) }}</q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="election" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'CLOS' || p.row.statut === 'PROCLAME'"
            flat
            round
            dense
            icon="print"
            :aria-label="$t('elections.table.actions.printBallot')"
            @click="emit('imprimer', p.row)"
          >
            <q-tooltip>{{ $t('elections.table.actions.printBallot') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="edit"
            :aria-label="$t('elections.table.actions.editAria')"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="how_to_vote"
            color="positive"
            :aria-label="$t('elections.dialogs.transitions.open.title')"
            @click="emit('transition', p.row.id, 'ouvrir')"
          >
            <q-tooltip>{{ $t('elections.dialogs.transitions.open.title') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'OUVERT'"
            flat
            round
            dense
            icon="lock"
            :aria-label="$t('elections.dialogs.transitions.close.title')"
            @click="emit('transition', p.row.id, 'clore')"
          >
            <q-tooltip>{{ $t('elections.dialogs.transitions.close.title') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'CLOS'"
            flat
            round
            dense
            icon="emoji_events"
            color="amber-8"
            :aria-label="$t('elections.dialogs.transitions.proclaim.title')"
            @click="emit('transition', p.row.id, 'proclamer')"
          >
            <q-tooltip>{{ $t('elections.dialogs.transitions.proclaim.title') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="groups"
            :aria-label="$t('elections.table.actions.candidatesAria')"
            @click="emit('ouvrirCandidats', p.row)"
          >
            <q-tooltip>{{ $t('elections.table.actions.candidatesTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="bar_chart"
            :aria-label="$t('elections.table.actions.resultsAria')"
            @click="emit('ouvrirResultats', p.row)"
          >
            <q-tooltip>{{ $t('elections.table.actions.resultsTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <template v-else>
      <div v-if="chargement && !lignes.length" class="etat-vide">
        <q-spinner color="primary" size="28px" />
        <span class="pochoir">{{ $t('elections.emptyState.loading') }}</span>
      </div>
      <div v-else-if="lignes.length" class="row q-col-gutter-md">
        <div v-for="e in lignes" :key="e.id" class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered class="carte election-carte">
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <PastilleStatut domaine="election" :statut="e.statut" />
                <q-chip dense square outline color="primary">
                  {{ LIBELLE_TYPE_ELECTION[e.type] ?? e.type }}
                </q-chip>
              </div>
              <div class="text-h6 q-mt-sm">{{ e.titre }}</div>
              <div class="text-caption text-grey-7">
                {{ $t('common.actions.from') }} {{ dateHeureElection(e.dateOuverture) }}<br />
                {{ $t('elections.cardView.to') }} {{ dateHeureElection(e.dateCloture) }}
              </div>
              <div class="row q-mt-sm items-center">
                <q-icon name="how_to_vote" size="16px" class="q-mr-xs" />
                <span class="text-caption">
                  {{ e.nbSieges }}
                  {{ e.nbSieges > 1 ? $t('elections.cardView.seatsPlural') : $t('elections.cardView.seatSingular') }}
                </span>
                <q-space />
                <q-icon name="groups" size="16px" class="q-mr-xs" />
                <span class="text-caption">
                  {{ nbCandidats(e) }}
                  {{
                    nbCandidats(e) > 1
                      ? $t('elections.cardView.candidatesPlural')
                      : $t('elections.cardView.candidateSingular')
                  }}
                </span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right" class="q-gutter-x-xs">
              <q-btn
                flat
                dense
                no-caps
                icon="print"
                :label="$t('elections.cardView.actions.ballot')"
                @click="emit('imprimer', e)"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'BROUILLON'"
                flat
                dense
                no-caps
                icon="edit"
                :label="$t('common.actions.edit')"
                @click="emit('modifier', e)"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'BROUILLON'"
                flat
                dense
                color="positive"
                icon="how_to_vote"
                no-caps
                :label="$t('elections.cardView.actions.open')"
                @click="emit('transition', e.id, 'ouvrir')"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'OUVERT'"
                flat
                dense
                icon="lock"
                no-caps
                :label="$t('elections.cardView.actions.close')"
                @click="emit('transition', e.id, 'clore')"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'CLOS'"
                flat
                dense
                color="amber-8"
                icon="emoji_events"
                no-caps
                :label="$t('elections.cardView.actions.proclaim')"
                @click="emit('transition', e.id, 'proclamer')"
              />
              <q-btn
                flat
                dense
                icon="groups"
                no-caps
                :label="$t('elections.cardView.actions.candidates')"
                @click="emit('ouvrirCandidats', e)"
              />
              <q-btn
                v-if="e.statut === 'CLOS' || e.statut === 'PROCLAME'"
                flat
                dense
                icon="bar_chart"
                no-caps
                :label="$t('elections.cardView.actions.results')"
                @click="emit('ouvrirResultats', e)"
              />
            </q-card-actions>
          </q-card>
        </div>
      </div>
      <etat-vide
        v-else-if="!chargement"
        icone="how_to_vote"
        :titre="$t('elections.emptyState.filtered', { status: LIBELLE_STATUT_ELECTION[onglet].toLowerCase() })"
      />
    </template>

    <barre-pagination
      v-if="lignes.length"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      :show-all="false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Liste des scrutins : filtres, tableau ou cartes, et les actions de l'onglet.
 * La page garde la liste et l'onglet courant ; ce composant présente les
 * lignes et rend les actions.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { LIBELLE_TYPE_ELECTION, OPTIONS_TYPE_ELECTION, dateHeureElection } from '../services/elections';
import { LIBELLE_STATUT_ELECTION } from '@/shared/utils/libelles';
import type { ActionTransitionElection } from '../types';
import type { ChipFiltre, Election, StatutElection } from '@/types';

const props = defineProps<{
  lignes: Election[];
  chargement: boolean;
  total: number;
  /** Statut de l'onglet courant : il nomme l'état vide. */
  onglet: StatutElection;
  peutEditer: boolean;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<Record<string, any>>('filtres', { required: true });
/** Pagination : la page garde l'état, pour rester synchronisée avec l'URL. */
const page = defineModel<number>('page', { required: true });
const pageSize = defineModel<number>('pageSize', { required: true });

const emit = defineEmits<{
  modifier: [election: Election];
  transition: [id: string, action: ActionTransitionElection];
  imprimer: [election: Election];
  ouvrirCandidats: [election: Election];
  ouvrirResultats: [election: Election];
  reinitialiser: [];
}>();

const { t } = useI18n();
const modeVue = usePresentationListe();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'titre', label: t('common.fields.title'), field: 'titre', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'periode', label: t('common.fields.period'), field: 'dateOuverture', align: 'left' },
  { name: 'sieges', label: t('elections.table.columns.seats'), field: 'nbSieges', align: 'center' },
  { name: 'candidats', label: t('elections.table.columns.candidates'), field: '_count', align: 'center' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'center' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('elections.chips.search', { query: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.type) {
    cs.push({
      label: t('elections.chips.type', {
        type: LIBELLE_TYPE_ELECTION[filtres.value.type] ?? filtres.value.type,
      }),
      value: filtres.value.type,
      icone: 'category',
    });
  }
  return cs;
});

const nbCandidats = (e: Election): number => e._count?.candidats ?? e.candidats?.length ?? 0;
</script>

<style scoped lang="scss">
// Pas d'arrondi : une élection est une plaque du panneau comme les autres.
.election-carte {
  height: 100%;
}
</style>
