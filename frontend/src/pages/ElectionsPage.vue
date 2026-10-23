<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { useListePaginee, texteApi } from '../composables/useListePaginee';
import { useConfirmation, type CouleurConfirmation } from '../composables/useConfirmation';
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
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
} from '../services/elections';
import type { CandidatElection, Election, ResultatElection, StatutElection, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const onglet = ref<StatutElection>('BROUILLON');

const filtres = ref<Record<string, any>>({ recherche: '', type: null });
const liste = reactive(
  useListePaginee<Election>({
    filtres,
    syncUrl: true,
    charger: ({ page, pageSize, filtres: f }) =>
      electionsService
        .liste({
          page,
          pageSize,
          statut: onglet.value,
          ...(f.type ? { type: f.type } : {}),
          ...(texteApi(f.recherche) ? { search: texteApi(f.recherche) } : {}),
        })
        .then((r) => r.data),
  }),
);

const modeVue = usePresentationListe();

const peutEditer = computed(() => auth.peut('elections.editer'));
/** L'administrateur est aussi un électeur : il retrouve l'urne depuis ici. */
const peutVoter = computed(() => auth.peut('elections.voterDepuisGestion'));

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

async function supprimerCandidat(c: CandidatElection) {
  const election = electionCandidats.value;
  if (!election) return;
  const ok = await confirmer({
    titre: t('elections.dialogs.removeCandidate.title'),
    message: t('elections.dialogs.removeCandidate.message', { name: `${c.prenom} ${c.nom}` }),
    ok: t('elections.dialogs.removeCandidate.confirm'),
    danger: true,
    libelleAnnuler: t('elections.dialogs.removeCandidate.cancel'),
    persistent: true,
  });
  if (!ok) return;
  try {
    await electionsService.supprimerCandidat(election.id, c.id);
    candidatsListe.value = candidatsListe.value.filter((x) => x.id !== c.id);
    $q.notify({ type: 'positive', message: t('elections.messages.candidateRemoved') });
  } catch {
    /* notifié par l'intercepteur */
  }
}

async function ouvrirResultats(e: Election) {
  electionResultats.value = e;
  resultats.value = null;
  chargementResultats.value = true;
  dialogResultats.value = true;
  try {
    const { data } = await electionsService.resultats(e.id);
    resultats.value = data;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargementResultats.value = false;
  }
}

type ActionTransition = 'ouvrir' | 'clore' | 'proclamer';

function transitionInfo(action: ActionTransition): {
  titre: string;
  message: string;
  bouton: string;
  couleur: CouleurConfirmation;
  succes: string;
} {
  const cles: Record<ActionTransition, 'open' | 'close' | 'proclaim'> = {
    ouvrir: 'open',
    clore: 'close',
    proclamer: 'proclaim',
  };
  const cle = cles[action];
  return {
    titre: t(`elections.dialogs.transitions.${cle}.title`),
    message: t(`elections.dialogs.transitions.${cle}.message`),
    bouton: t(`elections.dialogs.transitions.${cle}.button`),
    // La proclamation est solennelle : bouton ambre, comme avant la migration.
    couleur: action === 'proclamer' ? 'warning' : 'primary',
    succes: t(`elections.dialogs.transitions.${cle}.success`),
  };
}

async function transition(id: string, action: ActionTransition) {
  const info = transitionInfo(action);
  const ok = await confirmer({
    titre: info.titre,
    message: info.message,
    ok: info.bouton,
    couleur: info.couleur,
    libelleAnnuler: t('elections.dialogs.removeCandidate.cancel'),
    persistent: true,
  });
  if (!ok) return;
  try {
    await electionsService.transition(id, action);
    $q.notify({ type: 'positive', message: info.succes });
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

/** Bulletin papier A4, dans un onglet neuf. */
function imprimerBulletin(e: Election) {
  void ouvrirImpression(`/elections/${e.id}/imprimer-bulletin`);
}

function nbCandidats(e: Election): number {
  return e._count?.candidats ?? e.candidats?.length ?? 0;
}

// Changer d'onglet ramène en page 1 (le setter de `page` relance la requête).
watch(onglet, () => {
  liste.page = 1;
});
</script>

<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('elections.title')" :subtitle="$t('elections.subtitle')">
      <template #actions>
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
      </template>
    </page-header>

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
      @reinitialiser="liste.reinitialiser([])"
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
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
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
      <div v-if="liste.chargement && !liste.lignes.length" class="etat-vide">
        <q-spinner color="primary" size="28px" />
        <span class="pochoir">{{ $t('elections.emptyState.loading') }}</span>
      </div>
      <div v-else-if="liste.lignes.length" class="row q-col-gutter-md">
        <div v-for="e in liste.lignes" :key="e.id" class="col-12 col-sm-6 col-md-4">
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
      <etat-vide
        v-else-if="!liste.chargement"
        icone="how_to_vote"
        :titre="$t('elections.emptyState.filtered', { status: LIBELLE_STATUT_ELECTION[onglet].toLowerCase() })"
      />
    </template>

    <pagination-bar
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <election-dialog v-model="dialogEdition" :election="electionEnEdition" @enregistre="liste.recharger()" />

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

          <etat-vide v-if="!candidatsListe.length" icone="groups" :titre="$t('elections.dialogs.candidates.emptyState')" />

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

        <q-card-section v-else-if="!resultats">
          <etat-vide icone="bar_chart" :titre="$t('elections.dialogs.results.unavailable')" />
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
