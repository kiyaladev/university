<script setup lang="ts">
/**
 * Gestion des scrutins : la liste, la vie de chaque scrutin (ouvrir, clore,
 * proclamer) et les candidats.
 *
 * La page garde l'état partagé (la liste, l'onglet, les dialogues) ; la
 * présentation et les dialogues sont des composants dédiés.
 */
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { useListePaginee, texteApi } from '@/shared/composables/useListePaginee';
import { useConfirmation, type CouleurConfirmation } from '@/shared/composables/useConfirmation';
import { ouvrirImpression } from '@/shared/services/impression';
import DialogueElection from '../components/DialogueElection.vue';
import DialogueCandidat from '../components/DialogueCandidat.vue';
import ElectionsListePanneau from '../components/ElectionsListePanneau.vue';
import ElectionsCandidatsDialogue from '../components/ElectionsCandidatsDialogue.vue';
import ElectionsResultatsDialogue from '../components/ElectionsResultatsDialogue.vue';
import { electionsService } from '../services/elections';
import type { ActionTransitionElection } from '../types';
import type { CandidatElection, Election, StatutElection, FiltresPage } from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const onglet = ref<StatutElection>('BROUILLON');

const filtres = ref<FiltresPage>({ recherche: '', type: null });
const liste = reactive(
  useListePaginee<Election>({
    filtres,
    syncUrl: true,
    charger: ({ page, pageSize, filtres: f }) =>
      electionsService.liste({
        page,
        pageSize,
        statut: onglet.value,
        ...(f.type ? { type: f.type } : {}),
        ...(texteApi(f.recherche) ? { search: texteApi(f.recherche) } : {}),
      }),
  }),
);

const peutEditer = computed(() => auth.peut('elections.editer'));
/** L'administrateur est aussi un électeur : il retrouve l'urne depuis ici. */
const peutVoter = computed(() => auth.peut('elections.voterDepuisGestion'));

const ONGLETS = computed<Array<{ statut: StatutElection; label: string; icone: string }>>(() => [
  { statut: 'BROUILLON', label: t('elections.tabs.draft'), icone: 'edit_note' },
  { statut: 'OUVERT', label: t('elections.tabs.open'), icone: 'how_to_vote' },
  { statut: 'CLOS', label: t('elections.tabs.closed'), icone: 'lock' },
  { statut: 'PROCLAME', label: t('elections.tabs.proclaimed'), icone: 'emoji_events' },
  { statut: 'ANNULE', label: t('elections.tabs.cancelled'), icone: 'block' },
]);

const dialogEdition = ref(false);
const electionEnEdition = ref<Election | null>(null);

const dialogCandidats = ref(false);
const electionCandidats = ref<Election | null>(null);
const candidatsListe = ref<CandidatElection[]>([]);
const dialogCandidat = ref(false);
const candidatEnEdition = ref<CandidatElection | null>(null);

const dialogResultats = ref(false);
const electionResultats = ref<Election | null>(null);

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
    libelleAnnuler: t('common.actions.cancel'),
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

function ouvrirResultats(e: Election) {
  electionResultats.value = e;
  dialogResultats.value = true;
}

function transitionInfo(action: ActionTransitionElection): {
  titre: string;
  message: string;
  bouton: string;
  couleur: CouleurConfirmation;
  succes: string;
} {
  const cles: Record<ActionTransitionElection, 'open' | 'close' | 'proclaim'> = {
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

async function transition(id: string, action: ActionTransitionElection) {
  const info = transitionInfo(action);
  const ok = await confirmer({
    titre: info.titre,
    message: info.message,
    ok: info.bouton,
    couleur: info.couleur,
    libelleAnnuler: t('common.actions.cancel'),
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

// Changer d'onglet ramène en page 1 (le setter de `page` relance la requête).
watch(onglet, () => {
  liste.page = 1;
});
</script>

<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('elections.title')" :subtitle="$t('elections.subtitle')">
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
    </en-tete-page>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau q-mb-md">
      <q-tab v-for="o in ONGLETS" :key="o.statut" :name="o.statut" :label="o.label" :icon="o.icone" no-caps />
    </q-tabs>

    <elections-liste-panneau
      v-model:filtres="filtres"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :lignes="liste.lignes"
      :chargement="liste.chargement"
      :total="liste.total"
      :onglet="onglet"
      :peut-editer="peutEditer"
      @modifier="ouvrirEdition"
      @transition="transition"
      @imprimer="imprimerBulletin"
      @ouvrir-candidats="ouvrirCandidats"
      @ouvrir-resultats="ouvrirResultats"
      @reinitialiser="liste.reinitialiser([])"
    />

    <dialogue-election v-model="dialogEdition" :election="electionEnEdition" @enregistre="liste.recharger()" />

    <elections-candidats-dialogue
      v-model="dialogCandidats"
      :election="electionCandidats"
      :candidats="candidatsListe"
      :peut-editer="peutEditer"
      @supprimer-candidat="supprimerCandidat"
      @ajouter-candidat="ouvrirCandidat()"
    />

    <dialogue-candidat
      v-if="electionCandidats"
      v-model="dialogCandidat"
      :election="electionCandidats"
      :candidat="candidatEnEdition"
      @enregistre="
        (c) => {
          const idx = candidatsListe.findIndex((x) => x.id === c.id);
          if (idx >= 0) candidatsListe.splice(idx, 1, c);
          else candidatsListe.push(c);
        }
      "
    />

    <elections-resultats-dialogue v-model="dialogResultats" :election="electionResultats" />
  </q-page>
</template>
