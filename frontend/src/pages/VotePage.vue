<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import type { Election, ResultatElection, StatutElection } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const elections = ref<Election[]>([]);
const electionActive = ref<Election | null>(null);
const resultats = ref<ResultatElection | null>(null);
const chargement = ref(false);

const selections = ref<string[]>([]);
const scrutinDepose = ref(false);
const scrutinDeposeErreur = ref<string | null>(null);
const scrutinIdConserve = ref<string | null>(null);

const LIBELLE_STATUT: Record<StatutElection, string> = {
  BROUILLON: 'Brouillon',
  OUVERTE: 'Ouverte',
  CLOSE: 'Close',
  PROCLAMEE: 'Proclamée',
  ANNULEE: 'Annulée',
};

const candidatesAffiches = computed(() => {
  if (!electionActive.value) return [];
  return [...(electionActive.value.candidats ?? [])].sort((a, b) => a.ordre - b.ordre);
});

const peutValider = computed(() => {
  if (!electionActive.value) return false;
  return selections.value.length > 0 && selections.value.length <= electionActive.value.nbSieges;
});

const dejaVote = computed(() => Boolean(scrutinDepose.value || scrutinIdConserve.value));

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/elections/actives');
    elections.value = data;
    if (data[0]) {
      await selectionnerElection(data[0]);
    } else {
      electionActive.value = null;
      resultats.value = null;
    }
  } finally {
    chargement.value = false;
  }
}

async function selectionnerElection(e: Election) {
  electionActive.value = e;
  selections.value = [];
  scrutinDepose.value = false;
  scrutinIdConserve.value = null;
  scrutinDeposeErreur.value = null;
  if (e.statut === 'CLOSE' || e.statut === 'PROCLAMEE') {
    try {
      const { data } = await api.get(`/elections/${e.id}/resultats`);
      resultats.value = data;
    } catch { resultats.value = null; }
  } else {
    resultats.value = null;
  }
}

function basculerCandidat(id: string) {
  if (!electionActive.value) return;
  if (selections.value.includes(id)) {
    selections.value = selections.value.filter((x) => x !== id);
    return;
  }
  if (selections.value.length >= electionActive.value.nbSieges) {
    $q.notify({
      type: 'warning',
      message: `Vous pouvez sélectionner au plus ${electionActive.value.nbSieges} candidat(s).`,
    });
    return;
  }
  selections.value = [...selections.value, id];
}

async function validerVote() {
  if (!electionActive.value) return;
  if (!peutValider.value) return;
  try {
    const { data } = await api.post('/elections/vote', {
      electionId: electionActive.value.id,
      bulletin: selections.value.map((candidatId) => ({ candidatId })),
    });
    scrutinIdConserve.value = data.scrutinId;
    scrutinDepose.value = true;
    $q.notify({ type: 'positive', message: 'Vote enregistré — merci !' });
  } catch (e: any) {
    scrutinDeposeErreur.value = e?.response?.data?.message ?? 'Vote impossible.';
    $q.notify({ type: 'negative', message: scrutinDeposeErreur.value });
  }
}

function imprimerBulletin() {
  if (!electionActive.value) return;
  window.open(`${API_URL}/elections/${electionActive.value.id}/imprimer-bulletin?token=${auth.token}`, '_blank');
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Votez</div>
        <div class="page-sous-titre">
          Élections en cours et résultats dès la clôture.
        </div>
      </div>
    </div>

    <q-card v-if="chargement" class="q-pa-md">
      <q-spinner /> Chargement des élections en cours…
    </q-card>

    <q-card v-else-if="!elections.length" class="q-pa-md">
      <q-banner class="bg-info text-white">
        Aucune élection ouverte en ce moment. Revenez lors d'un scrutin.
      </q-banner>
    </q-card>

    <div v-else class="row q-col-gutter-md">
      <div class="col-12 col-md-4">
        <q-card>
          <q-card-section>
            <div class="text-h6">Scrutins en cours</div>
            <div class="text-caption text-grey-7">Sélectionnez une élection.</div>
          </q-card-section>
          <q-separator />
          <q-list bordered separator>
            <q-item
              v-for="e in elections"
              :key="e.id"
              clickable
              :active="electionActive?.id === e.id"
              active-class="bg-grey-2"
              @click="selectionnerElection(e)"
            >
              <q-item-section>
                <q-item-label><strong>{{ e.titre }}</strong></q-item-label>
                <q-item-label caption>
                  {{ e.nbSieges }} siège(s) — clôture le {{ dateFr(e.dateCloture) }}
                </q-item-label>
                <q-item-label>
                  <span class="champ champ-statut badge--ok">
                    <span class="pochoir">{{ LIBELLE_STATUT[e.statut] }}</span>
                  </span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card v-if="electionActive">
          <q-card-section>
            <div class="text-h6">{{ electionActive.titre }}</div>
            <div class="text-caption text-grey-7">
              Sièges à pourvoir : <strong>{{ electionActive.nbSieges }}</strong> — vous pouvez
              sélectionner au plus <strong>{{ electionActive.nbSieges }}</strong> candidat(s).
            </div>
          </q-card-section>
          <q-separator />

          <q-card-section v-if="electionActive.description">
            <p>{{ electionActive.description }}</p>
          </q-card-section>

          <q-card-section>
            <q-list bordered separator>
              <q-item
                v-for="c in candidatesAffiches"
                :key="c.id"
                tag="label"
              >
                <q-item-section avatar>
                  <q-checkbox
                    :model-value="selections.includes(c.id)"
                    @update:model-value="basculerCandidat(c.id)"
                    :disable="dejaVote"
                  />
                </q-item-section>
                <q-item-section avatar>
                  <q-avatar>
                    <img v-if="c.photoUrl" :src="c.photoUrl" />
                    <q-icon v-else name="person" />
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label><strong>{{ c.prenom }} {{ c.nom }}</strong></q-item-label>
                  <q-item-label caption v-if="c.programme">{{ c.programme }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <span class="text-caption text-grey-7">N° {{ c.ordre }}</span>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn flat icon="print" no-caps label="Imprimer un bulletin" @click="imprimerBulletin" />
            <q-space />
            <q-banner v-if="dejaVote" class="bg-positive text-white">
              Votre vote a été enregistré. Référence : {{ scrutinIdConserve }}
            </q-banner>
            <q-btn
              v-if="!dejaVote"
              unelevated
              color="primary"
              icon="how_to_vote"
              label="Valider mon vote"
              no-caps
              :disable="!peutValider"
              @click="validerVote"
            />
          </q-card-actions>
        </q-card>

        <q-card v-if="electionActive && resultats" class="q-mt-md">
          <q-card-section>
            <div class="text-h6">Résultats</div>
            <div class="text-caption text-grey-7">
              Bulletins : <strong>{{ resultats.participation.nbBulletins }}</strong> —
              Voix : <strong>{{ resultats.participation.voixTotales }}</strong>
            </div>
          </q-card-section>
          <q-list bordered separator>
            <q-item v-for="c in resultats.candidats" :key="c.id">
              <q-item-section avatar>
                <q-avatar :color="c.elu ? 'amber-7' : 'grey-3'" text-color="white">
                  <q-icon v-if="c.elu" name="emoji_events" />
                  <span v-else>{{ c.ordre }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <strong>{{ c.prenom }} {{ c.nom }}</strong>
                  <q-chip v-if="c.elu" dense color="amber-7" text-color="white" class="q-ml-sm">Élu</q-chip>
                </q-item-label>
                <q-item-label caption>{{ c.voix }} voix</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.badge--ok { background: #e3f5e9; color: #17683a; padding: 3px 10px; border-radius: 999px; font-weight: 600; font-size: 11px; }
</style>