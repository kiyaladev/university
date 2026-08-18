<template>
  <q-page class="q-pa-md">
    <div v-if="chargement && !suspicion" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="!suspicion" class="plaque q-pa-lg text-center text-grey-7">
      <q-icon name="error" size="38px" color="negative" />
      <div class="q-mt-sm">Suspicion introuvable ou supprimée.</div>
      <q-btn
        flat
        no-caps
        color="primary"
        icon="arrow_back"
        label="Retour à la file d'arbitrage"
        :to="{ name: 'plagiat' }"
        class="q-mt-md"
      />
    </div>

    <template v-else>
      <q-btn
        flat
        dense
        no-caps
        icon="arrow_back"
        label="Liste des suspicions"
        :to="{ name: 'plagiat' }"
        class="q-mb-md"
      />

      <div class="row items-center q-col-gutter-md q-mb-md">
        <div class="col">
          <div class="page-titre">Détail suspicion</div>
          <div class="page-sous-titre">
            Comparaison automatique par empreinte + similarité Jaccard.
          </div>
        </div>
        <div class="col-auto">
          <q-chip :color="couleurStatut(suspicion.statut)" text-color="white" dense size="md" :icon="iconeStatut(suspicion.statut)">
            {{ LIBELLE_STATUT_SUSPICION[suspicion.statut] }}
          </q-chip>
        </div>
      </div>

      <q-card flat bordered class="carte q-mb-md">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-caption text-grey-7 text-uppercase">Score de similarité</div>
            <div class="plagiat-detail__score" :class="`text-${couleurScore(suspicion.score)}`">
              {{ Math.round(suspicion.score) }}<span class="plagiat-detail__score-unite">%</span>
            </div>
          </div>
          <div class="col-auto text-right">
            <div class="text-caption text-grey-7">Détecté le</div>
            <div class="text-weight-medium">{{ new Date(suspicion.detecteLe).toLocaleString('fr-FR') }}</div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 2 cartes documents côte à côte -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-caption text-grey-7 text-uppercase">Document A</div>
                <div class="text-h6 q-mt-xs">{{ suspicion.documentA?.titre ?? '—' }}</div>
              </div>
              <q-chip dense color="primary" outline :label="libelleType(suspicion.documentA?.type)" />
            </q-card-section>
            <q-card-section class="q-pt-sm">
              <q-list dense>
                <q-item>
                  <q-item-section avatar><q-icon name="person" /></q-item-section>
                  <q-item-section>{{ suspicion.documentA?.auteurs ?? '—' }}</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="apartment" /></q-item-section>
                  <q-item-section>{{ suspicion.documentA?.departement?.nom ?? '—' }}</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="storage" /></q-item-section>
                  <q-item-section>
                    {{ suspicion.documentA?.tailleKo ? (suspicion.documentA.tailleKo / 1024).toFixed(1) + ' Mo' : '—' }}
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="event" /></q-item-section>
                  <q-item-section>{{ dateComplete(suspicion.documentA?.createdAt) }}</q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
            <q-separator />
            <q-card-actions>
              <q-btn
                flat
                dense
                no-caps
                icon="library_books"
                label="Voir la fiche du document"
                :to="{ name: 'bibliotheque', query: { documentId: suspicion.documentAId } }"
              />
            </q-card-actions>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-caption text-grey-7 text-uppercase">Document B</div>
                <div class="text-h6 q-mt-xs">{{ suspicion.documentB?.titre ?? '—' }}</div>
              </div>
              <q-chip dense color="primary" outline :label="libelleType(suspicion.documentB?.type)" />
            </q-card-section>
            <q-card-section class="q-pt-sm">
              <q-list dense>
                <q-item>
                  <q-item-section avatar><q-icon name="person" /></q-item-section>
                  <q-item-section>{{ suspicion.documentB?.auteurs ?? '—' }}</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="apartment" /></q-item-section>
                  <q-item-section>{{ suspicion.documentB?.departement?.nom ?? '—' }}</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="storage" /></q-item-section>
                  <q-item-section>
                    {{ suspicion.documentB?.tailleKo ? (suspicion.documentB.tailleKo / 1024).toFixed(1) + ' Mo' : '—' }}
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="event" /></q-item-section>
                  <q-item-section>{{ dateComplete(suspicion.documentB?.createdAt) }}</q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
            <q-separator />
            <q-card-actions>
              <q-btn
                flat
                dense
                no-caps
                icon="library_books"
                label="Voir la fiche du document"
                :to="{ name: 'bibliotheque', query: { documentId: suspicion.documentBId } }"
              />
            </q-card-actions>
          </q-card>
        </div>
      </div>

      <!-- Diff simplifié -->
      <q-card flat bordered class="carte q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-sm">Diff simplifié (similarité Jaccard)</div>
          <p class="text-caption text-grey-7 q-mb-sm">
            Les blocs communs aux deux documents sont surlignés.
          </p>
          <div v-if="chargementTexte" class="row justify-center q-py-lg">
            <q-spinner color="primary" size="32px" />
          </div>
          <div v-else class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-caption text-grey-7 q-mb-xs">Document A</div>
              <pre class="diff-texte" v-html="surlignerCommun(texteA)" />
            </div>
            <div class="col-12 col-md-6">
              <div class="text-caption text-grey-7 q-mb-xs">Document B</div>
              <pre class="diff-texte" v-html="surlignerCommun(texteB)" />
            </div>
          </div>
          <div v-if="!chargementTexte && !texteA && !texteB" class="text-center text-grey-7 q-pa-md">
            <q-icon name="description" size="32px" color="grey-5" />
            <div class="q-mt-sm">Aucun texte extrait à comparer.</div>
          </div>
        </q-card-section>
      </q-card>

      <div class="row q-col-gutter-md">
        <!-- Décision -->
        <div class="col-12 col-md-7">
          <q-card flat bordered class="carte">
            <q-card-section>
              <div class="text-h6 q-mb-sm">Décision</div>

              <q-banner v-if="suspicion.statut !== 'EN_ATTENTE'" dense class="bg-grey-3 q-mb-md">
                <template #avatar><q-icon name="lock" /></template>
                Décision déjà prise — la suspicion n'est plus modifiable.
              </q-banner>

              <q-option-group
                v-model="decisionStatut"
                :options="[
                  { label: 'Acquitter la suspicion', value: 'ACQUITTE', color: 'positive' },
                  { label: 'Confirmer le plagiat', value: 'CONFIRME', color: 'negative' },
                ]"
                inline
                :disable="!peutDecider || suspicion.statut !== 'EN_ATTENTE'"
                class="q-mb-md"
              />

              <q-banner v-if="decisionStatut === 'CONFIRME'" dense class="bg-red-1 text-red-10 q-mb-md">
                <template #avatar><q-icon name="warning" color="negative" /></template>
                Confirmer ouvre une procédure disciplinaire — le motif sera inscrit au journal.
              </q-banner>

              <q-input
                v-model="decisionMotif"
                outlined
                dense
                type="textarea"
                autogrow
                label="Motif / commentaire"
                :disable="!peutDecider || suspicion.statut !== 'EN_ATTENTE'"
                :rules="decisionStatut === 'CONFIRME' ? [(v: string) => (v && v.trim().length > 0) || 'Motif obligatoire'] : []"
              />

              <div class="row justify-end q-mt-md">
                <q-btn
                  v-if="peutDecider && suspicion.statut === 'EN_ATTENTE'"
                  unelevated
                  no-caps
                  :color="decisionStatut === 'ACQUITTE' ? 'positive' : 'negative'"
                  :icon="decisionStatut === 'ACQUITTE' ? 'thumb_down' : 'gavel'"
                  :label="decisionStatut === 'ACQUITTE' ? 'Acquitter' : 'Confirmer le plagiat'"
                  :loading="decisionEnCours"
                  @click="validerDecision"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Journal -->
        <div class="col-12 col-md-5">
          <q-card flat bordered class="carte">
            <q-card-section>
              <div class="text-h6 q-mb-sm">Journal</div>

              <q-timeline color="primary" dense>
                <q-timeline-entry
                  :title="`Détection automatique`"
                  :subtitle="new Date(suspicion.detecteLe).toLocaleString('fr-FR')"
                  icon="policy"
                >
                  Suspicion créée par le moteur anti-plagiat (score {{ Math.round(suspicion.score) }} %).
                </q-timeline-entry>

                <q-timeline-entry
                  v-if="suspicion.acquitteLe"
                  :color="suspicion.statut === 'ACQUITTE' ? 'positive' : 'negative'"
                  :icon="suspicion.statut === 'ACQUITTE' ? 'thumb_down' : 'gavel'"
                  :title="suspicion.statut === 'ACQUITTE' ? 'Acquittement' : 'Confirmation de plagiat'"
                  :subtitle="new Date(suspicion.acquitteLe).toLocaleString('fr-FR')"
                >
                  <div v-if="suspicion.acquittePar" class="text-caption q-mb-xs">
                    Par <strong>{{ suspicion.acquittePar.prenom }} {{ suspicion.acquittePar.nom }}</strong>
                  </div>
                  <div v-if="suspicion.commentaire" class="text-caption text-grey-7">
                    « {{ suspicion.commentaire }} »
                  </div>
                </q-timeline-entry>
              </q-timeline>

              <div v-if="!suspicion.acquitteLe" class="text-caption text-grey-7 text-center q-pa-md">
                Aucune décision enregistrée pour l'instant.
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_STATUT_SUSPICION, LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { DocumentDepot, SuspicionPlagiat, TypeDocument } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();

const suspicion = ref<SuspicionPlagiat | null>(null);
const chargement = ref(false);
const chargementTexte = ref(false);
const texteA = ref('');
const texteB = ref('');

const decisionStatut = ref<'ACQUITTE' | 'CONFIRME'>('ACQUITTE');
const decisionMotif = ref('');
const decisionEnCours = ref(false);

const id = computed(() => String(route.params.id ?? ''));

const peutDecider = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const couleurStatut = (s: SuspicionPlagiat['statut']) =>
  ({ EN_ATTENTE: 'orange', ACQUITTE: 'positive', CONFIRME: 'negative' }[s]);

const iconeStatut = (s: SuspicionPlagiat['statut']) =>
  ({ EN_ATTENTE: 'hourglass_empty', ACQUITTE: 'thumb_down', CONFIRME: 'gavel' }[s]);

const couleurScore = (score: number) => {
  if (score >= 80) return 'negative';
  if (score >= 50) return 'warning';
  return 'positive';
};

const libelleType = (t?: TypeDocument) => LIBELLE_TYPE_DOCUMENT[t ?? 'AUTRE'] ?? 'Autre';

const dateComplete = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');

async function charger() {
  if (!id.value) return;
  chargement.value = true;
  try {
    const { data } = await api.get(`/documents/plagiat/${id.value}`);
    suspicion.value = data;
    decisionStatut.value = 'ACQUITTE';
    decisionMotif.value = data?.commentaire ?? '';
  } catch (e: any) {
    suspicion.value = null;
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Suspicion introuvable' });
  } finally {
    chargement.value = false;
  }
}

/**
 * Charge le contenu texte des deux documents en parallèle et calcule un surlignage
 * naïf style Jaccard : on découpe chaque texte en n-grammes (mots) et on
 * surligne les blocs qui apparaissent dans l'autre moitié.
 */
async function chargerTextes() {
  if (!suspicion.value) return;
  chargementTexte.value = true;
  try {
    const docs = [suspicion.value.documentA, suspicion.value.documentB];
    const promises = docs.map(async (d?: DocumentDepot | null) => {
      if (!d) return '';
      if (d.contenuTexte) return d.contenuTexte;
      try {
        const { data } = await api.get(`/documents/${d.id}`);
        return (data?.contenuTexte ?? '').toString();
      } catch {
        return '';
      }
    });
    const [a, b] = await Promise.all(promises);
    texteA.value = a;
    texteB.value = b;
  } finally {
    chargementTexte.value = false;
  }
}

/**
 * Surlignage des plages communes : on prend tous les mots ≥ 6 lettres de B et
 * on les surligne dans A (réciproquement). C'est volontairement fruste —
 * l'objectif est de donner au lecteur un point de départ visuel pour décider.
 */
function surlignerCommun(texte: string): string {
  if (!texte) return '';
  const echappe = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const autres = texte === texteA.value ? texteB.value : texteA.value;
  if (!autres) return echappe;
  // On construit un Set de mots ≥ 5 lettres de l'autre document, en ignorant
  // les ponctuations et la casse.
  const mots = autres.toLowerCase().match(/[a-zà-ÿ]{5,}/g) ?? [];
  const uniques = Array.from(new Set(mots)).slice(0, 250);
  if (!uniques.length) return echappe;
  const motif = uniques
    .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return echappe.replace(new RegExp(`\\b(${motif})\\b`, 'gi'), '<mark>$1</mark>');
}

async function validerDecision() {
  if (!suspicion.value) return;
  if (decisionStatut.value === 'CONFIRME' && !decisionMotif.value.trim()) {
    $q.notify({ type: 'warning', message: 'Le motif est obligatoire pour une confirmation' });
    return;
  }
  decisionEnCours.value = true;
  try {
    const { data } = await api.post(
      `/documents/plagiat/${suspicion.value.id}/acquitter`,
      {
        decision: decisionStatut.value,
        commentaire: decisionMotif.value.trim() || undefined,
      },
    );
    suspicion.value = { ...suspicion.value, ...data };
    $q.notify({
      type: 'positive',
      message: decisionStatut.value === 'ACQUITTE'
        ? 'Suspicion acquittée'
        : 'Plagiat confirmé — procédure ouverte',
    });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Décision impossible' });
  } finally {
    decisionEnCours.value = false;
  }
}

watch(id, async () => {
  await charger();
  await chargerTextes();
});

onMounted(async () => {
  await charger();
  await chargerTextes();
});
</script>

<style scoped>
.plagiat-detail__score {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1.5px;
}
.plagiat-detail__score-unite {
  font-size: 1.2rem;
  font-weight: 600;
  margin-left: 4px;
}
.diff-texte {
  font-family: monospace;
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.02);
  padding: 8px 10px;
  max-height: 420px;
  overflow: auto;
  margin: 0;
}
.diff-texte :deep(mark) {
  background: #fff3a0;
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
</style>
