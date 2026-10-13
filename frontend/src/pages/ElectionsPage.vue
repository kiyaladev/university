<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ElectionDialog from '../components/ElectionDialog.vue';
import CandidatDialog from '../components/CandidatDialog.vue';
import {
  CLASSE_STATUT_ELECTION,
  LIBELLE_STATUT_ELECTION,
  LIBELLE_TYPE_ELECTION,
  OPTIONS_TYPE_ELECTION,
  dateHeureElection,
  electionsService,
  messageErreurElection,
} from '../services/elections';
import type { CandidatElection, Election, ResultatElection, StatutElection, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const onglet = ref<StatutElection>('BROUILLON');

const elections = ref<Election[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });

const modeVue = usePresentationListe();

const peutEditer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
/** L'administrateur est aussi un électeur : il retrouve l'urne depuis ici. */
const peutVoter = computed(() => auth.aRole(['ADMIN']));

const ONGLETS = computed<Array<{ statut: StatutElection; label: string; icone: string }>>(() => [
  { statut: 'BROUILLON', label: t('elections.tabs.draft'), icone: 'edit_note' },
  { statut: 'OUVERTE', label: t('elections.tabs.open'), icone: 'how_to_vote' },
  { statut: 'CLOSE', label: t('elections.tabs.closed'), icone: 'lock' },
  { statut: 'PROCLAMEE', label: t('elections.tabs.proclaimed'), icone: 'emoji_events' },
  { statut: 'ANNULEE', label: t('elections.tabs.cancelled'), icone: 'block' },
]);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'titre', label: t('elections.table.columns.title'), field: 'titre', align: 'left' },
  { name: 'type', label: t('elections.table.columns.type'), field: 'type', align: 'left' },
  { name: 'periode', label: t('elections.table.columns.period'), field: 'dateOuverture', align: 'left' },
  { name: 'sieges', label: t('elections.table.columns.seats'), field: 'nbSieges', align: 'center' },
  { name: 'candidats', label: t('elections.table.columns.candidates'), field: '_count', align: 'center' },
  { name: 'statut', label: t('elections.table.columns.status'), field: 'statut', align: 'center' },
  { name: 'actions', label: t('elections.table.columns.actions'), field: 'id', align: 'right' },
]);

const dialogEdition = ref(false);
const electionEnEdition = ref<Election | null>(null);

const dialogCandidats = ref(false);
const electionCandidats = ref<Election | null>(null);
const candidatsListe = ref<CandidatElection[]>([]);
const dialogCandidat = ref(false);
const candidatEnEdition = ref<CandidatElection | null>(null);

const dialogResultats = ref(false);
const resultats = ref<ResultatElection | null>(null);
const chargementResultats = ref(false);
const electionResultats = ref<Election | null>(null);

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

function ouvrirEdition(e?: Election) {
  electionEnEdition.value = e ?? null;
  dialogEdition.value = true;
}

function ouvrirCandidats(e: Election) {
  electionCandidats.value = e;
  candidatsListe.value = e.candidats ?? [];
  dialogCandidats.value = true;
}

function ouvrirCandidat(c?: CandidatElection) {
  if (!electionCandidats.value) return;
  candidatEnEdition.value = c ?? null;
  dialogCandidat.value = true;
}

function supprimerCandidat(c: CandidatElection) {
  const election = electionCandidats.value;
  if (!election) return;
  $q.dialog({
    title: t('elections.dialogs.removeCandidate.title'),
    message: t('elections.dialogs.removeCandidate.message', { name: `${c.prenom} ${c.nom}` }),
    cancel: { label: t('elections.dialogs.removeCandidate.cancel'), flat: true, noCaps: true },
    ok: {
      label: t('elections.dialogs.removeCandidate.confirm'),
      color: 'negative',
      unelevated: true,
      noCaps: true,
    },
    persistent: true,
  }).onOk(async () => {
    try {
      await electionsService.supprimerCandidat(election.id, c.id);
      candidatsListe.value = candidatsListe.value.filter((x) => x.id !== c.id);
      $q.notify({ type: 'positive', message: t('elections.messages.candidateRemoved') });
    } catch (e) {
      $q.notify({
        type: 'negative',
        message: messageErreurElection(e, t('elections.messages.candidateRemoveError')),
      });
    }
  });
}

async function ouvrirResultats(e: Election) {
  electionResultats.value = e;
  resultats.value = null;
  chargementResultats.value = true;
  dialogResultats.value = true;
  try {
    const { data } = await electionsService.resultats(e.id);
    resultats.value = data;
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: messageErreurElection(err, t('elections.messages.resultsError')),
    });
  } finally {
    chargementResultats.value = false;
  }
}

type ActionTransition = 'ouvrir' | 'clore' | 'proclamer';

function transitionInfo(action: ActionTransition): {
  titre: string;
  message: string;
  bouton: string;
  couleur: string;
  succes: string;
} {
  const cles: Record<ActionTransition, 'open' | 'close' | 'proclaim'> = {
    ouvrir: 'open',
    clore: 'close',
    proclamer: 'proclaim',
  };
  const couleurs: Record<ActionTransition, string> = {
    ouvrir: 'primary',
    clore: 'primary',
    proclamer: 'amber-8',
  };
  const cle = cles[action];
  return {
    titre: t(`elections.dialogs.transitions.${cle}.title`),
    message: t(`elections.dialogs.transitions.${cle}.message`),
    bouton: t(`elections.dialogs.transitions.${cle}.button`),
    couleur: couleurs[action],
    succes: t(`elections.dialogs.transitions.${cle}.success`),
  };
}

function transition(id: string, action: ActionTransition) {
  const info = transitionInfo(action);
  $q.dialog({
    title: info.titre,
    message: info.message,
    cancel: { label: t('elections.dialogs.removeCandidate.cancel'), flat: true, noCaps: true },
    ok: { label: info.bouton, color: info.couleur, unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await electionsService.transition(id, action);
      $q.notify({ type: 'positive', message: info.succes });
      await charger();
    } catch (e) {
      $q.notify({
        type: 'negative',
        message: messageErreurElection(e, t('elections.messages.transitionError')),
      });
    }
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await electionsService.liste({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      statut: onglet.value,
      ...(filtres.value.type ? { type: filtres.value.type } : {}),
      ...(filtres.value.recherche ? { search: filtres.value.recherche } : {}),
    });
    elections.value = data.data;
    pagination.value.total = data.total;
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: messageErreurElection(e, t('elections.messages.loadError')),
    });
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function reinitialiser() {
  filtres.value = { recherche: '' };
  recharger();
}

/** Bulletin papier A4, dans un onglet neuf. */
function imprimerBulletin(e: Election) {
  void ouvrirImpression(`/elections/${e.id}/imprimer-bulletin`);
}

function nbCandidats(e: Election): number {
  return e._count?.candidats ?? e.candidats?.length ?? 0;
}

watch(onglet, () => recharger());
watch(() => [filtres.value.recherche, filtres.value.type], () => recharger());
onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('elections.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('elections.subtitle') }}
        </div>
      </div>
      <div class="col-auto row q-gutter-sm items-center">
        <q-btn
          v-if="peutVoter"
          flat
          no-caps
          icon="how_to_vote"
          :label="$t('elections.actions.vote')"
          to="/elections/vote"
        >
          <q-tooltip>{{ $t('elections.actions.voteTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutEditer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('elections.actions.new')"
          @click="ouvrirEdition()"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau q-mb-md">
      <q-tab
        v-for="o in ONGLETS"
        :key="o.statut"
        :name="o.statut"
        :label="o.label"
        :icon="o.icone"
        no-caps
      />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('elections.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
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
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="elections"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || elections.length > 0"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="how_to_vote" size="36px" color="grey-7" />
          <span class="pochoir">
            {{ $t('elections.emptyState.filtered', { status: LIBELLE_STATUT_ELECTION[onglet].toLowerCase() }) }}
          </span>
        </div>
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
          <span class="champ champ-statut" :class="CLASSE_STATUT_ELECTION[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT_ELECTION[p.row.statut] }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'CLOSE' || p.row.statut === 'PROCLAMEE'"
            flat
            round
            dense
            icon="print"
            :aria-label="$t('elections.table.actions.printBallot')"
            @click="imprimerBulletin(p.row)"
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
            @click="ouvrirEdition(p.row)"
          >
            <q-tooltip>{{ $t('elections.table.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="how_to_vote"
            color="positive"
            :aria-label="$t('elections.dialogs.transitions.open.title')"
            @click="transition(p.row.id, 'ouvrir')"
          >
            <q-tooltip>{{ $t('elections.dialogs.transitions.open.title') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'OUVERTE'"
            flat
            round
            dense
            icon="lock"
            :aria-label="$t('elections.dialogs.transitions.close.title')"
            @click="transition(p.row.id, 'clore')"
          >
            <q-tooltip>{{ $t('elections.dialogs.transitions.close.title') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'CLOSE'"
            flat
            round
            dense
            icon="emoji_events"
            color="amber-8"
            :aria-label="$t('elections.dialogs.transitions.proclaim.title')"
            @click="transition(p.row.id, 'proclamer')"
          >
            <q-tooltip>{{ $t('elections.dialogs.transitions.proclaim.title') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="groups"
            :aria-label="$t('elections.table.actions.candidatesAria')"
            @click="ouvrirCandidats(p.row)"
          >
            <q-tooltip>{{ $t('elections.table.actions.candidatesTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="bar_chart"
            :aria-label="$t('elections.table.actions.resultsAria')"
            @click="ouvrirResultats(p.row)"
          >
            <q-tooltip>{{ $t('elections.table.actions.resultsTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <template v-else>
      <div v-if="chargement && !elections.length" class="etat-vide">
        <q-spinner color="primary" size="28px" />
        <span class="pochoir">{{ $t('elections.emptyState.loading') }}</span>
      </div>
      <div v-else-if="elections.length" class="row q-col-gutter-md">
        <div v-for="e in elections" :key="e.id" class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered class="carte election-carte">
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <span class="champ champ-statut" :class="CLASSE_STATUT_ELECTION[e.statut]">
                  <span class="pochoir">{{ LIBELLE_STATUT_ELECTION[e.statut] }}</span>
                </span>
                <q-chip dense square outline color="primary">
                  {{ LIBELLE_TYPE_ELECTION[e.type] ?? e.type }}
                </q-chip>
              </div>
              <div class="text-h6 q-mt-sm">{{ e.titre }}</div>
              <div class="text-caption text-grey-7">
                {{ $t('elections.cardView.from') }} {{ dateHeureElection(e.dateOuverture) }}<br>
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
                  {{ nbCandidats(e) > 1 ? $t('elections.cardView.candidatesPlural') : $t('elections.cardView.candidateSingular') }}
                </span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right" class="q-gutter-x-xs">
              <q-btn flat dense no-caps icon="print" :label="$t('elections.cardView.actions.ballot')" @click="imprimerBulletin(e)" />
              <q-btn
                v-if="peutEditer && e.statut === 'BROUILLON'"
                flat
                dense
                no-caps
                icon="edit"
                :label="$t('elections.cardView.actions.edit')"
                @click="ouvrirEdition(e)"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'BROUILLON'"
                flat
                dense
                color="positive"
                icon="how_to_vote"
                no-caps
                :label="$t('elections.cardView.actions.open')"
                @click="transition(e.id, 'ouvrir')"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'OUVERTE'"
                flat
                dense
                icon="lock"
                no-caps
                :label="$t('elections.cardView.actions.close')"
                @click="transition(e.id, 'clore')"
              />
              <q-btn
                v-if="peutEditer && e.statut === 'CLOSE'"
                flat
                dense
                color="amber-8"
                icon="emoji_events"
                no-caps
                :label="$t('elections.cardView.actions.proclaim')"
                @click="transition(e.id, 'proclamer')"
              />
              <q-btn flat dense icon="groups" no-caps :label="$t('elections.cardView.actions.candidates')" @click="ouvrirCandidats(e)" />
              <q-btn v-if="e.statut === 'CLOSE' || e.statut === 'PROCLAMEE'" flat dense icon="bar_chart" no-caps :label="$t('elections.cardView.actions.results')" @click="ouvrirResultats(e)" />
            </q-card-actions>
          </q-card>
        </div>
      </div>
      <div v-else-if="!chargement" class="etat-vide">
        <q-icon name="how_to_vote" size="36px" color="grey-7" />
        <span class="pochoir">
          {{ $t('elections.emptyState.filtered', { status: LIBELLE_STATUT_ELECTION[onglet].toLowerCase() }) }}
        </span>
      </div>
    </template>

    <pagination-bar
      v-if="elections.length"
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="(v) => { pagination.page = v; charger(); }"
      @update:page-size="(v) => { pagination.pageSize = v; pagination.page = 1; charger(); }"
    />

    <election-dialog v-model="dialogEdition" :election="electionEnEdition" @enregistre="charger" />

    <q-dialog v-model="dialogCandidats">
      <q-card style="min-width: 640px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ $t('elections.dialogs.candidates.title', { title: electionCandidats?.titre }) }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :aria-label="$t('elections.dialogs.candidates.close')" @click="dialogCandidats = false" />
        </q-card-section>
        <q-card-section>
          <q-banner v-if="electionCandidats?.statut !== 'BROUILLON'" class="note--alerte q-mb-md">
            <template #avatar><q-icon name="lock" /></template>
            {{ $t('elections.dialogs.candidates.lockedBanner', { status: LIBELLE_STATUT_ELECTION[electionCandidats?.statut ?? 'BROUILLON'].toLowerCase() }) }}
          </q-banner>

          <div v-if="!candidatsListe.length" class="etat-vide">
            <q-icon name="groups" size="36px" color="grey-7" />
            <span class="pochoir">
              {{ $t('elections.dialogs.candidates.emptyState') }}
            </span>
          </div>

          <q-list v-else bordered separator>
            <q-item v-for="c in candidatsListe" :key="c.id">
              <q-item-section avatar>
                <q-avatar>
                  <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.prenom} ${c.nom}`">
                  <q-icon v-else name="person" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label><strong>{{ c.prenom }} {{ c.nom }}</strong></q-item-label>
                <q-item-label caption>
                  {{ $t('elections.dialogs.candidates.ballotNumber', { n: c.ordre }) }}
                  <span v-if="c.etudiant">{{ $t('elections.dialogs.candidates.studentSuffix', { matricule: c.etudiant.matricule }) }}</span>
                  <span v-if="c.enseignant">{{ $t('elections.dialogs.candidates.teacherSuffix', { matricule: c.enseignant.matricule }) }}</span>
                </q-item-label>
              </q-item-section>
              <q-item-section v-if="electionCandidats?.statut === 'BROUILLON' && peutEditer" side>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="negative"
                  :aria-label="$t('elections.dialogs.removeCandidate.removeAria', { name: `${c.prenom} ${c.nom}` })"
                  @click="supprimerCandidat(c)"
                >
                  <q-tooltip>{{ $t('elections.dialogs.candidates.removeTooltip') }}</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('elections.dialogs.candidates.close')" @click="dialogCandidats = false" />
          <q-btn
            v-if="electionCandidats?.statut === 'BROUILLON' && peutEditer"
            unelevated
            color="primary"
            icon="add"
            :label="$t('elections.dialogs.candidates.add')"
            no-caps
            @click="ouvrirCandidat()"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <candidat-dialog
      v-if="electionCandidats"
      v-model="dialogCandidat"
      :election="electionCandidats"
      :candidat="candidatEnEdition"
      @enregistre="(c) => {
        const idx = candidatsListe.findIndex((x) => x.id === c.id);
        if (idx >= 0) candidatsListe.splice(idx, 1, c);
        else candidatsListe.push(c);
      }"
    />

    <q-dialog v-model="dialogResultats">
      <q-card style="min-width: 560px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ $t('elections.dialogs.results.title', { title: electionResultats?.titre }) }}</div>
          <q-space />
          <q-btn flat round dense icon="close" :aria-label="$t('elections.dialogs.results.close')" @click="dialogResultats = false" />
        </q-card-section>

        <q-card-section v-if="chargementResultats" class="etat-vide">
          <q-spinner color="primary" size="28px" />
          <span class="pochoir">{{ $t('elections.dialogs.results.loading') }}</span>
        </q-card-section>

        <q-card-section v-else-if="!resultats" class="etat-vide">
          <q-icon name="bar_chart" size="36px" color="grey-7" />
          <span class="pochoir">{{ $t('elections.dialogs.results.unavailable') }}</span>
        </q-card-section>

        <q-card-section v-else>
          <q-banner v-if="electionResultats?.statut !== 'PROCLAMEE'" class="note--alerte q-mb-md">
            <template #avatar><q-icon name="visibility_off" /></template>
            {{ $t('elections.dialogs.results.provisionalBanner') }}
          </q-banner>
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-4">
              <div class="text-caption text-grey-7">{{ $t('elections.dialogs.results.ballots') }}</div>
              <div class="text-h6 chiffres">{{ resultats.participation.nbBulletins }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">{{ $t('elections.dialogs.results.votesExpressed') }}</div>
              <div class="text-h6 chiffres">{{ resultats.participation.voixTotales }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">{{ $t('elections.dialogs.results.seatsToFill') }}</div>
              <div class="text-h6 chiffres">{{ resultats.participation.siegesPourvoir }}</div>
            </div>
          </div>
          <q-list bordered separator>
            <q-item v-for="c in resultats.candidats" :key="c.id">
              <q-item-section avatar>
                <q-avatar :color="c.elu ? 'amber-8' : 'grey-4'" text-color="white">
                  <q-icon v-if="c.elu" name="emoji_events" />
                  <span v-else class="chiffres">{{ c.ordre }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <strong>{{ c.prenom }} {{ c.nom }}</strong>
                  <q-chip v-if="c.elu" dense square color="amber-8" text-color="white" class="q-ml-sm">
                    {{ $t('elections.dialogs.results.elected') }}
                  </q-chip>
                </q-item-label>
                <q-item-label caption class="chiffres">{{ c.voix }} {{ $t('elections.dialogs.results.votesSuffix') }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped lang="scss">
// Pas d'arrondi : une élection est une plaque du panneau comme les autres.
.election-carte { height: 100%; }

.badge--ok { background: #f1fbf2; color: #027a0b; }
.badge--ko { background: #fff1f2; color: #c10000; }
.badge--neutre { background: #f5f5f7; color: #6e6e73; }
.badge--attention { background: #fff6ef; color: #b64400; }
.badge--primaire { background: #e8eef5; color: #0d47a1; }

</style>
