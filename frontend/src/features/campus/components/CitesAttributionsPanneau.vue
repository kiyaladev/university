<template>
  <div>
    <barre-filtres v-model="filtres" :chips="chips" :recherche="false" @reinitialiser="emit('reinitialiser')">
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          emit-value
          map-options
          dense
          outlined
          clearable
          :label="$t('common.fields.year')"
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
        <champ-recherche
          v-model="filtres.residenceId"
          endpoint="/residences"
          :label-fn="(r) => `${r.code} — ${r.nom}`"
          :label="$t('cites.attributions.filters.residence')"
        />
        <q-input
          v-model="filtres.etudiant"
          dense
          outlined
          :label="$t('cites.attributions.filters.etudiant')"
          clearable
          @keydown.enter="emit('rechercher')"
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
      <template #body-cell-createdAt="p">
        <q-td :props="p">{{ dateLisible(p.row.createdAt) }}</q-td>
      </template>
      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
        </q-td>
      </template>
      <template #body-cell-chambre="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.chambre?.code }}</div>
          <div class="text-caption text-grey-7">{{ p.row.chambre?.residence?.nom }}</div>
        </q-td>
      </template>
      <template #body-cell-score="p">
        <q-td :props="p">
          <q-badge
            v-if="p.row.critereScore !== null && p.row.critereScore !== undefined"
            dense
            :color="couleurScore(p.row.critereScore)"
            text-color="white"
          >
            {{ p.row.critereScore }}
          </q-badge>
          <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="attribution" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'EN_ATTENTE' && peutDecider"
            flat
            dense
            round
            color="primary"
            icon="gavel"
            :aria-label="$t('cites.attributions.table.aria.decider')"
            @click="emit('decider', p.row)"
          >
            <q-tooltip>{{ $t('cites.attributions.table.tooltip.decider') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="['EN_ATTENTE', 'ACCORDE'].includes(p.row.statut) && estAdmin"
            flat
            dense
            round
            color="negative"
            icon="undo"
            :aria-label="$t('cites.attributions.table.aria.retirer')"
            @click="emit('retirer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.withdraw') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.etudiant"
            flat
            dense
            round
            icon="person"
            :aria-label="$t('cites.attributions.table.aria.voirEtudiant')"
            @click="emit('voirEtudiant', p.row)"
          >
            <q-tooltip>{{ $t('cites.attributions.table.tooltip.voirEtudiant') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="how_to_reg"
          :titre="$t('cites.attributions.emptyState.title')"
          :aide="$t('cites.attributions.emptyState.hint')"
        >
          <template v-if="peutCreer" #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="how_to_reg"
              :label="$t('cites.actions.newAttribution')"
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
      <div v-for="a in lignes" :key="a.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ a.etudiant?.matricule ?? '—' }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ a.etudiant?.nom }} {{ a.etudiant?.prenom }}</div>
            </div>
            <PastilleStatut domaine="attribution" :statut="a.statut" />
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="meeting_room" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">
                <i18n-t keypath="cites.attributions.card.chambreLabel" tag="span">
                  <template #code
                    ><strong>{{ a.chambre?.code }}</strong></template
                  >
                  <template #residence>{{ a.chambre?.residence?.nom ?? '—' }}</template>
                </i18n-t>
              </span>
            </div>
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{
                $t('cites.attributions.card.demandeLe', { date: dateLisible(a.createdAt) })
              }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="workspace_premium" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ $t('cites.attributions.card.score') }}</span>
              <q-badge
                v-if="a.critereScore !== null && a.critereScore !== undefined"
                dense
                :color="couleurScore(a.critereScore)"
                text-color="white"
                class="q-ml-xs"
              >
                {{ a.critereScore }}
              </q-badge>
              <span v-else class="text-grey-6 q-ml-xs">{{ $t('common.format.emptyValue') }}</span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions class="q-px-md">
            <q-btn
              v-if="a.statut === 'EN_ATTENTE' && peutDecider"
              flat
              dense
              no-caps
              color="primary"
              icon="gavel"
              :label="$t('cites.attributions.card.decider')"
              @click="emit('decider', a)"
            >
              <q-tooltip>{{ $t('cites.attributions.card.deciderTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="['EN_ATTENTE', 'ACCORDE'].includes(a.statut) && estAdmin"
              flat
              dense
              no-caps
              color="negative"
              icon="undo"
              :label="$t('common.actions.withdraw')"
              @click="emit('retirer', a)"
            >
              <q-tooltip>{{ $t('cites.attributions.card.retirerTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="a.etudiant"
              flat
              dense
              no-caps
              icon="person"
              :label="$t('common.fields.student')"
              @click="emit('voirEtudiant', a)"
            >
              <q-tooltip>{{ $t('cites.attributions.card.etudiantTooltip') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!chargement && !lignes.length"
        class="col-12"
        icone="how_to_reg"
        :titre="$t('cites.attributions.emptyState.title')"
      >
        <template v-if="peutCreer" #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="how_to_reg"
            :label="$t('cites.actions.newAttribution')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Attributions » de la cité : les demandes de logement, leurs filtres
 * et les décisions du jury. La page garde la liste et la pagination ; ce
 * composant présente les lignes et rend les actions.
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
import { dateLisible } from '@/shared/utils/format';
import { LIBELLE_STATUT_ATTRIBUTION } from '@/shared/utils/libelles';
import type { AnneeAcademique, AttributionLogement, ChipFiltre, Residence, FiltresPage } from '@/types';

const props = defineProps<{
  lignes: AttributionLogement[];
  chargement: boolean;
  total: number;
  /** Le parc, pour nommer la résidence dans les chips. */
  residences: Residence[];
  annees: AnneeAcademique[];
  peutDecider: boolean;
  peutCreer: boolean;
  estAdmin: boolean;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<FiltresPage>('filtres', { required: true });
/** Pagination : la page garde l'état, pour rester synchronisée avec l'URL. */
const page = defineModel<number>('page', { required: true });
const pageSize = defineModel<number>('pageSize', { required: true });

const emit = defineEmits<{
  creer: [];
  decider: [attribution: AttributionLogement];
  retirer: [attribution: AttributionLogement];
  voirEtudiant: [attribution: AttributionLogement];
  reinitialiser: [];
  rechercher: [];
}>();

const { t } = useI18n();
const presentation = usePresentationListe();

const optionsAnnees = computed(() => props.annees.map((a) => ({ label: a.libelle, value: a.id })));
const optionsStatuts = Object.entries(LIBELLE_STATUT_ATTRIBUTION).map(([value, label]) => ({ value, label }));

const codeResidence = (id: string) => props.residences.find((x) => x.id === id)?.code ?? '…';

const chips = computed<ChipFiltre[]>(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.anneeId) {
    const a = props.annees.find((x) => x.id === f.anneeId);
    cs.push({ label: a?.libelle ?? t('common.fields.year'), value: f.anneeId, icone: 'event', cle: 'anneeId' });
  }
  if (f.statut)
    cs.push({
      label: LIBELLE_STATUT_ATTRIBUTION[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'how_to_reg',
      cle: 'statut',
    });
  if (f.residenceId) {
    cs.push({
      label: t('cites.attributions.chips.residence', { code: codeResidence(f.residenceId) }),
      value: f.residenceId,
      icone: 'apartment',
    });
  }
  if (f.etudiant)
    cs.push({
      label: t('cites.attributions.chips.etudiant', { etudiant: f.etudiant }),
      value: f.etudiant,
      icone: 'person',
    });
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'createdAt',
    label: t('cites.attributions.table.columns.demandeLe'),
    field: 'createdAt',
    align: 'left',
    sortable: true,
  },
  { name: 'etudiant', label: t('common.fields.student'), field: 'id', align: 'left' },
  { name: 'chambre', label: t('cites.attributions.table.columns.chambre'), field: 'id', align: 'left' },
  { name: 'score', label: t('common.fields.score'), field: 'critereScore', align: 'center' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const couleurScore = (score: number) => (score >= 70 ? 'positive' : score >= 40 ? 'warning' : 'negative');
</script>
