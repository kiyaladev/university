<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import {
  CLASSE_STATUT_ELECTION,
  LIBELLE_STATUT_ELECTION,
  LIBELLE_TYPE_ELECTION,
  dateElection,
  dateHeureElection,
  electionsService,
  messageErreurElection,
} from '../services/elections';
import { useAuthStore } from '../stores/auth';
import type { CandidatElection, Election, ResultatElection } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const elections = ref<Election[]>([]);
const electionActive = ref<Election | null>(null);
const resultats = ref<ResultatElection | null>(null);
const chargement = ref(true);
const chargementResultats = ref(false);
const erreurChargement = ref('');

const selections = ref<string[]>([]);
const depot = ref(false);
const erreurDepot = ref('');

/** Ce que dit le serveur : a-t-on déjà déposé un bulletin sur ce scrutin ? */
const aVote = ref(false);
const dateVote = ref<string | null>(null);
const scrutinId = ref<string | null>(null);

const estEtudiant = computed(() => auth.role === 'ETUDIANT');

const candidatsAffiches = computed<CandidatElection[]>(() => {
  if (!electionActive.value) return [];
  return [...(electionActive.value.candidats ?? [])].sort((a, b) => a.ordre - b.ordre);
});

/** Un scrutin encore ouvert accepte des bulletins ; les autres se consultent. */
const scrutinOuvert = computed(() => electionActive.value?.statut === 'OUVERTE');

const peutValider = computed(() => {
  if (!electionActive.value || !scrutinOuvert.value || aVote.value) return false;
  return selections.value.length > 0 && selections.value.length <= electionActive.value.nbSieges;
});

const restantASelectionner = computed(() =>
  electionActive.value ? electionActive.value.nbSieges - selections.value.length : 0,
);

async function charger() {
  chargement.value = true;
  erreurChargement.value = '';
  try {
    // Deux sources : les scrutins ouverts (on y vote) et les scrutins
    // proclamés (on y lit le verdict) — /elections/actives ne rend que les
    // premiers.
    const [ouvertes, proclamees] = await Promise.all([
      electionsService.actives(),
      electionsService.liste({ statut: 'PROCLAMEE', pageSize: 20 }).catch(() => null),
    ]);
    elections.value = [...ouvertes.data, ...(proclamees?.data.data ?? [])];
    if (elections.value[0]) await selectionnerElection(elections.value[0]);
    else {
      electionActive.value = null;
      resultats.value = null;
    }
  } catch (e) {
    erreurChargement.value = messageErreurElection(e, t('vote.errors.load'));
  } finally {
    chargement.value = false;
  }
}

async function selectionnerElection(e: Election) {
  electionActive.value = e;
  selections.value = [];
  erreurDepot.value = '';
  aVote.value = false;
  dateVote.value = null;
  scrutinId.value = null;
  resultats.value = null;

  // Le détail porte la liste des candidats quand la liste paginée ne la
  // renvoie pas (cas des scrutins proclamés).
  if (!e.candidats?.length) {
    try {
      const { data } = await electionsService.trouver(e.id);
      electionActive.value = data;
    } catch {
      /* on garde la fiche résumée : le vote reste possible sur les ouvertes */
    }
  }

  try {
    const { data: vote } = await electionsService.monVote(e.id);
    aVote.value = vote.aVote;
    dateVote.value = vote.dateVote;
    scrutinId.value = vote.scrutinId;
  } catch {
    /* silencieux : l'électeur peut continuer sans cette information */
  }

  if (e.statut === 'CLOSE' || e.statut === 'PROCLAMEE') {
    chargementResultats.value = true;
    try {
      const { data } = await electionsService.resultats(e.id);
      resultats.value = data;
    } catch {
      resultats.value = null;
    } finally {
      chargementResultats.value = false;
    }
  }
}

function basculerCandidat(id: string) {
  if (!electionActive.value || aVote.value || !scrutinOuvert.value) return;
  if (selections.value.includes(id)) {
    selections.value = selections.value.filter((x) => x !== id);
    return;
  }
  if (selections.value.length >= electionActive.value.nbSieges) {
    $q.notify({
      type: 'warning',
      message:
        electionActive.value.nbSieges === 1
          ? t('vote.errors.max_seats_one')
          : t('vote.errors.max_seats', { n: electionActive.value.nbSieges }),
    });
    return;
  }
  selections.value = [...selections.value, id];
}

/** Le bulletin est définitif : on le récapitule avant de le glisser dans l'urne. */
function confirmerVote() {
  if (!electionActive.value || !peutValider.value) return;
  const noms = candidatsAffiches.value
    .filter((c) => selections.value.includes(c.id))
    .map((c) => `${c.prenom} ${c.nom}`)
    .join(', ');
  $q.dialog({
    title: t('vote.confirm_dialog.title'),
    message: t('vote.confirm_dialog.message', { names: noms }),
    html: false,
    cancel: { label: t('vote.confirm_dialog.cancel'), flat: true, noCaps: true },
    ok: { label: t('vote.confirm_dialog.confirm'), color: 'primary', unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(() => {
    void validerVote();
  });
}

async function validerVote() {
  if (!electionActive.value) return;
  depot.value = true;
  erreurDepot.value = '';
  try {
    const { data } = await electionsService.voter({
      electionId: electionActive.value.id,
      bulletin: selections.value.map((candidatId) => ({ candidatId })),
    });
    scrutinId.value = data.scrutinId;
    aVote.value = true;
    dateVote.value = new Date().toISOString();
    selections.value = [];
    $q.notify({ type: 'positive', message: t('vote.messages.ballot_submitted') });
  } catch (e) {
    erreurDepot.value = messageErreurElection(e, t('vote.errors.submit'));
    $q.notify({ type: 'negative', message: erreurDepot.value });
  } finally {
    depot.value = false;
  }
}

/** Bulletin papier A4, dans un onglet neuf. */
function imprimerBulletin() {
  if (!electionActive.value) return;
  void ouvrirImpression(`/elections/${electionActive.value.id}/imprimer-bulletin`);
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('vote.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('vote.subtitle') }}
        </div>
      </div>
    </div>

    <div v-if="chargement" class="etat-vide">
      <q-spinner color="primary" size="36px" />
      <span class="pochoir">{{ $t('vote.loading') }}</span>
    </div>

    <q-banner v-else-if="erreurChargement" class="note--erreur q-mb-md">
      <template #avatar><q-icon name="error" /></template>
      {{ erreurChargement }}
      <template #action>
        <q-btn flat no-caps :label="$t('vote.retry')" @click="charger" />
      </template>
    </q-banner>

    <div v-else-if="!elections.length" class="etat-vide">
      <q-icon name="how_to_vote" size="46px" color="grey-7" />
      <span class="lettrage etat-vide__titre">{{ $t('vote.empty_state.title') }}</span>
      <span class="pochoir etat-vide__mention">
        {{ $t('vote.empty_state.message') }}
      </span>
      <div class="etat-vide__actions">
        <q-btn v-if="estEtudiant" unelevated color="primary" no-caps icon="person" :label="$t('vote.empty_state.my_space')" to="/portail" />
        <q-btn flat no-caps icon="refresh" :label="$t('vote.empty_state.refresh')" @click="charger" />
      </div>
    </div>

    <div v-else class="row q-col-gutter-md">
      <!-- Liste des scrutins -->
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-h6">{{ $t('vote.list.title') }}</div>
            <div class="text-caption text-grey-7">
              {{ $t('vote.list.subtitle') }}
            </div>
          </q-card-section>
          <q-separator />
          <q-list separator>
            <q-item
              v-for="e in elections"
              :key="e.id"
              clickable
              :active="electionActive?.id === e.id"
              active-class="scrutin--actif"
              :aria-current="electionActive?.id === e.id ? 'true' : undefined"
              @click="selectionnerElection(e)"
            >
              <q-item-section>
                <q-item-label><strong>{{ e.titre }}</strong></q-item-label>
                <q-item-label caption>
                  {{ LIBELLE_TYPE_ELECTION[e.type] ?? e.type }} ·
                  {{ e.nbSieges }} {{ e.nbSieges > 1 ? $t('vote.list.seats') : $t('vote.list.seat') }} ·
                  {{ $t('vote.list.closes_on', { date: dateElection(e.dateCloture) }) }}
                </q-item-label>
                <q-item-label>
                  <span class="champ champ-statut" :class="CLASSE_STATUT_ELECTION[e.statut]">
                    <span class="pochoir">{{ LIBELLE_STATUT_ELECTION[e.statut] }}</span>
                  </span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <!-- Scrutin sélectionné -->
      <div class="col-12 col-md-8">
        <q-card v-if="electionActive" flat bordered class="carte">
          <q-card-section>
            <div class="text-h6">{{ electionActive.titre }}</div>
            <div class="text-caption text-grey-7">
              {{ LIBELLE_TYPE_ELECTION[electionActive.type] ?? electionActive.type }} ·
              {{ $t('vote.detail.period', { debut: dateHeureElection(electionActive.dateOuverture), fin: dateHeureElection(electionActive.dateCloture) }) }}
            </div>
          </q-card-section>

          <q-card-section v-if="electionActive.description" class="q-pt-none">
            <p class="q-mb-none">{{ electionActive.description }}</p>
          </q-card-section>

          <q-separator />

          <!-- Bulletin déjà déposé -->
          <q-card-section v-if="aVote">
            <q-banner class="note--valide">
              <template #avatar><q-icon name="how_to_vote" /></template>
              <div>
                {{ $t('vote.detail.already_voted', { date: dateHeureElection(dateVote) }) }}
              </div>
              <div v-if="scrutinId" class="text-caption q-mt-xs">
                {{ $t('vote.detail.ballot_reference') }}
                <strong class="chiffres">{{ scrutinId }}</strong> {{ $t('vote.detail.ballot_reference_hint') }}
              </div>
              <div class="text-caption q-mt-xs">
                {{ $t('vote.detail.one_ballot_only') }}
              </div>
            </q-banner>
          </q-card-section>

          <!-- Scrutin clos / proclamé -->
          <q-card-section v-else-if="!scrutinOuvert">
            <q-banner class="note--info">
              <template #avatar><q-icon name="lock" /></template>
              {{ $t('vote.detail.closed_notice', { statut: LIBELLE_STATUT_ELECTION[electionActive.statut].toLowerCase() }) }}
            </q-banner>
          </q-card-section>

          <!-- Bulletin à remplir -->
          <template v-else>
            <q-card-section>
              <q-banner class="note--info">
                <template #avatar><q-icon name="visibility_off" /></template>
                {{ $t('vote.detail.anonymous_notice') }}
              </q-banner>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="text-caption text-grey-7 q-mb-sm">
                <strong>{{ electionActive.nbSieges }}</strong>
                {{ $t('vote.detail.seats_to_fill', { n: electionActive.nbSieges, plural: electionActive.nbSieges > 1 ? 's' : '' }) }}
                <span v-if="selections.length">
                  {{ $t('vote.detail.selection_status', {
                    selected: selections.length,
                    selectedPlural: selections.length > 1 ? 's' : '',
                    remaining: restantASelectionner,
                    remainingPlural: restantASelectionner > 1 ? 's' : '',
                  }) }}
                </span>
              </div>

              <div v-if="!candidatsAffiches.length" class="etat-vide">
                <q-icon name="groups" size="36px" color="grey-7" />
                <span class="pochoir etat-vide__mention">
                  {{ $t('vote.detail.no_candidates') }}
                </span>
              </div>

              <q-list v-else bordered separator>
                <q-item v-for="c in candidatsAffiches" :key="c.id" tag="label" clickable>
                  <q-item-section avatar>
                    <q-checkbox
                      :model-value="selections.includes(c.id)"
                      :aria-label="$t('vote.detail.select_candidate', { name: `${c.prenom} ${c.nom}` })"
                      @update:model-value="basculerCandidat(c.id)"
                    />
                  </q-item-section>
                  <q-item-section avatar>
                    <q-avatar>
                      <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.prenom} ${c.nom}`">
                      <q-icon v-else name="person" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label><strong>{{ c.prenom }} {{ c.nom }}</strong></q-item-label>
                    <q-item-label v-if="c.programme" caption>{{ c.programme }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <span class="text-caption text-grey-7 chiffres">{{ $t('vote.detail.candidate_number', { n: c.ordre }) }}</span>
                  </q-item-section>
                </q-item>
              </q-list>

              <q-banner v-if="erreurDepot" class="note--erreur q-mt-md">
                <template #avatar><q-icon name="error" /></template>
                {{ erreurDepot }}
              </q-banner>
            </q-card-section>
          </template>

          <q-separator />

          <q-card-actions align="right">
            <span v-if="scrutinOuvert && !aVote && !peutValider" class="text-caption text-grey-7">
              {{ $t('vote.detail.select_at_least_one') }}
            </span>
            <q-btn flat no-caps icon="print" :label="$t('vote.detail.print_ballot')" @click="imprimerBulletin">
              <q-tooltip>{{ $t('vote.detail.print_ballot_tooltip') }}</q-tooltip>
            </q-btn>
            <q-space />
            <q-btn
              v-if="scrutinOuvert && !aVote"
              unelevated
              color="primary"
              icon="how_to_vote"
              :label="$t('vote.detail.submit_ballot')"
              no-caps
              :loading="depot"
              :disable="!peutValider"
              @click="confirmerVote"
            />
          </q-card-actions>
        </q-card>

        <!-- Résultats -->
        <q-card v-if="electionActive && chargementResultats" flat bordered class="carte q-mt-md q-pa-md">
          <q-spinner color="primary" size="24px" class="q-mr-sm" />
          <span class="pochoir">{{ $t('vote.results.loading') }}</span>
        </q-card>

        <q-card v-else-if="electionActive && resultats" flat bordered class="carte q-mt-md">
          <q-card-section>
            <div class="text-h6">{{ $t('vote.results.title') }}</div>
            <div class="text-caption text-grey-7">
              {{ $t('vote.results.summary', {
                ballots: resultats.participation.nbBulletins,
                votes: resultats.participation.voixTotales,
                seats: resultats.participation.siegesPourvoir,
              }) }}
            </div>
          </q-card-section>
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
                    {{ $t('vote.results.elected') }}
                  </q-chip>
                </q-item-label>
                <q-item-label caption class="chiffres">{{ $t('vote.results.votes_count', { n: c.voix }) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<style scoped lang="scss">
.scrutin--actif {
  background: var(--up-chaux);
  font-weight: 590;
}

// Champs peints des statuts — mêmes teintes que l'écran de gestion.
.badge--ok { background: #f1fbf2; color: #027a0b; }
.badge--ko { background: #fff1f2; color: #c10000; }
.badge--neutre { background: #f5f5f7; color: #6e6e73; }
.badge--attention { background: #fff6ef; color: #b64400; }
.badge--primaire { background: #e8eef5; color: #0d47a1; }

.etat-vide__titre { font-size: 1.3rem; color: var(--up-encre); }

.etat-vide__mention { max-width: 46ch; }

.etat-vide__actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-2);
}
</style>
