<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { API_URL } from '../boot/axios';
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

const $q = useQuasar();
const auth = useAuthStore();

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
    erreurChargement.value = messageErreurElection(e, 'Impossible de charger les scrutins.');
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
          ? 'Un seul siège est à pourvoir : décochez d’abord votre choix actuel.'
          : `Vous pouvez retenir au plus ${electionActive.value.nbSieges} candidats.`,
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
    title: 'Déposer mon bulletin',
    message:
      `Vous votez pour : <strong>${noms}</strong>.<br><br>` +
      'Le vote est <strong>définitif</strong> : une fois le bulletin déposé, il ne peut être ' +
      'ni modifié ni retiré, et vous ne pourrez plus voter sur ce scrutin. ' +
      'Votre choix est anonyme : seul le fait que vous ayez voté est conservé.',
    html: true,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { label: 'Déposer mon bulletin', color: 'primary', unelevated: true, noCaps: true },
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
    $q.notify({ type: 'positive', message: 'Bulletin déposé — merci pour votre participation.' });
  } catch (e) {
    erreurDepot.value = messageErreurElection(e, 'Dépôt du bulletin impossible.');
    $q.notify({ type: 'negative', message: erreurDepot.value });
  } finally {
    depot.value = false;
  }
}

/** Bulletin papier A4 : le jeton passe en URL, l'onglet neuf n'a pas d'en-tête. */
function imprimerBulletin() {
  if (!electionActive.value) return;
  const url = `${API_URL}/elections/${electionActive.value.id}/imprimer-bulletin?token=${auth.token}`;
  if (!window.open(url, '_blank')) {
    $q.notify({
      type: 'warning',
      message: 'Autorisez les fenêtres contextuelles pour ouvrir le bulletin.',
    });
  }
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Voter</div>
        <div class="page-sous-titre">
          Les scrutins ouverts à votre voix, et les résultats des scrutins proclamés.
          Votre bulletin est anonyme.
        </div>
      </div>
    </div>

    <div v-if="chargement" class="etat-vide">
      <q-spinner color="primary" size="36px" />
      <span class="pochoir">Chargement des scrutins…</span>
    </div>

    <q-banner v-else-if="erreurChargement" class="note--erreur q-mb-md">
      <template #avatar><q-icon name="error" /></template>
      {{ erreurChargement }}
      <template #action>
        <q-btn flat no-caps label="Réessayer" @click="charger" />
      </template>
    </q-banner>

    <div v-else-if="!elections.length" class="etat-vide">
      <q-icon name="how_to_vote" size="46px" color="grey-7" />
      <span class="lettrage etat-vide__titre">Aucun scrutin en ce moment</span>
      <span class="pochoir etat-vide__mention">
        Aucune élection n’est ouverte et aucun résultat n’a encore été proclamé.
        Vous serez informé de l’ouverture du prochain scrutin.
      </span>
      <div class="etat-vide__actions">
        <q-btn v-if="estEtudiant" unelevated color="primary" no-caps icon="person" label="Mon espace" to="/portail" />
        <q-btn flat no-caps icon="refresh" label="Actualiser" @click="charger" />
      </div>
    </div>

    <div v-else class="row q-col-gutter-md">
      <!-- Liste des scrutins -->
      <div class="col-12 col-md-4">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div class="text-h6">Scrutins</div>
            <div class="text-caption text-grey-7">
              Choisissez le scrutin à consulter ou auquel participer.
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
                  {{ e.nbSieges }} siège{{ e.nbSieges > 1 ? 's' : '' }} ·
                  clôture le {{ dateElection(e.dateCloture) }}
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
              du {{ dateHeureElection(electionActive.dateOuverture) }}
              au {{ dateHeureElection(electionActive.dateCloture) }}
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
                Votre bulletin a été déposé le <strong>{{ dateHeureElection(dateVote) }}</strong>.
                Merci pour votre participation.
              </div>
              <div v-if="scrutinId" class="text-caption q-mt-xs">
                Référence anonyme de votre bulletin :
                <strong class="chiffres">{{ scrutinId }}</strong> — elle prouve le dépôt sans
                révéler votre choix.
              </div>
              <div class="text-caption q-mt-xs">
                Un seul bulletin est accepté par électeur : vous ne pouvez plus voter sur ce scrutin.
              </div>
            </q-banner>
          </q-card-section>

          <!-- Scrutin clos / proclamé -->
          <q-card-section v-else-if="!scrutinOuvert">
            <q-banner class="note--info">
              <template #avatar><q-icon name="lock" /></template>
              Ce scrutin est {{ LIBELLE_STATUT_ELECTION[electionActive.statut].toLowerCase() }} :
              plus aucun bulletin n’est accepté. Les résultats sont affichés ci-dessous.
            </q-banner>
          </q-card-section>

          <!-- Bulletin à remplir -->
          <template v-else>
            <q-card-section>
              <q-banner class="note--info">
                <template #avatar><q-icon name="visibility_off" /></template>
                Votre vote est <strong>anonyme</strong> : votre bulletin n’est jamais rattaché à
                votre nom. Seul le fait que vous ayez voté est conservé, pour empêcher un second
                bulletin. Le dépôt est <strong>définitif</strong>.
              </q-banner>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="text-caption text-grey-7 q-mb-sm">
                <strong>{{ electionActive.nbSieges }}</strong>
                siège{{ electionActive.nbSieges > 1 ? 's' : '' }} à pourvoir —
                retenez de 1 à {{ electionActive.nbSieges }} candidat{{ electionActive.nbSieges > 1 ? 's' : '' }}.
                <span v-if="selections.length">
                  {{ selections.length }} retenu{{ selections.length > 1 ? 's' : '' }},
                  {{ restantASelectionner }} restant{{ restantASelectionner > 1 ? 's' : '' }}.
                </span>
              </div>

              <div v-if="!candidatsAffiches.length" class="etat-vide">
                <q-icon name="groups" size="36px" color="grey-7" />
                <span class="pochoir etat-vide__mention">
                  Aucun candidat n’est déclaré sur ce scrutin : le vote n’est pas encore possible.
                </span>
              </div>

              <q-list v-else bordered separator>
                <q-item v-for="c in candidatsAffiches" :key="c.id" tag="label" clickable>
                  <q-item-section avatar>
                    <q-checkbox
                      :model-value="selections.includes(c.id)"
                      :aria-label="`Retenir ${c.prenom} ${c.nom}`"
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
                    <span class="text-caption text-grey-7 chiffres">N° {{ c.ordre }}</span>
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
              Retenez au moins un candidat pour pouvoir déposer votre bulletin.
            </span>
            <q-btn flat no-caps icon="print" label="Imprimer un bulletin papier" @click="imprimerBulletin">
              <q-tooltip>Bulletin vierge à imprimer pour le vote en salle (nouvel onglet)</q-tooltip>
            </q-btn>
            <q-space />
            <q-btn
              v-if="scrutinOuvert && !aVote"
              unelevated
              color="primary"
              icon="how_to_vote"
              label="Déposer mon bulletin"
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
          <span class="pochoir">Chargement des résultats…</span>
        </q-card>

        <q-card v-else-if="electionActive && resultats" flat bordered class="carte q-mt-md">
          <q-card-section>
            <div class="text-h6">Résultats</div>
            <div class="text-caption text-grey-7">
              Bulletins déposés : <strong class="chiffres">{{ resultats.participation.nbBulletins }}</strong> ·
              voix exprimées : <strong class="chiffres">{{ resultats.participation.voixTotales }}</strong> ·
              sièges à pourvoir : <strong class="chiffres">{{ resultats.participation.siegesPourvoir }}</strong>
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
                    Élu
                  </q-chip>
                </q-item-label>
                <q-item-label caption class="chiffres">{{ c.voix }} voix</q-item-label>
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
  font-weight: 700;
}

// Champs peints des statuts — mêmes teintes que l'écran de gestion.
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }
.badge--neutre { background: #eef0f4; color: #455a64; }
.badge--attention { background: #fff4e0; color: #8a5300; }
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
