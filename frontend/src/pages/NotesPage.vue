<template>
  <q-page class="notes-page">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Saisie des notes</div>
        <div class="page-sous-titre">
          Saisie en lot, type tableur : Tab pour naviguer, Enter pour valider.
          Une ligne jamais saisie rend la matière défaillante à la délibération.
        </div>
      </div>
      <div class="col-auto" v-if="evaluationActive">
        <q-badge
          :color="evaluationActive.statut === 'OUVERTE' ? 'positive' : 'grey-7'"
          class="q-px-sm q-py-xs text-body2"
        >
          <q-icon
            :name="evaluationActive.statut === 'OUVERTE' ? 'lock_open' : 'lock'"
            class="q-mr-xs"
          />
          {{ LIBELLE_STATUT_EVALUATION[evaluationActive.statut] }}
        </q-badge>
      </div>
    </div>

    <div class="carte q-pa-md q-mb-md">
      <div class="row q-col-gutter-md items-end">
        <div class="col-12 col-md-8">
          <autocomplete-async
            v-model="selEvaluationId"
            endpoint="/evaluations"
            label="Évaluation à noter"
            placeholder="Tapez l’intitulé de l’épreuve…"
            :label-fn="libelleEvaluation"
            @update:model-value="(v, raw) => { if (raw) choisir(raw); else chargerDepuisId(v); }"
          />
        </div>
        <div class="col-12 col-md-4 text-right q-gutter-sm">
          <q-btn
            flat
            no-caps
            icon="fact_check"
            label="Toutes les évaluations"
            @click="allerAuxEvaluations"
          />
          <q-btn
            v-if="evaluationActive && evaluationActive.statut === 'OUVERTE' && peutCloturer()"
            outline
            no-caps
            icon="lock"
            label="Clôturer l’évaluation"
            @click="cloturer"
          />
        </div>
      </div>
    </div>

    <div v-if="chargementInitial" class="carte q-pa-lg text-center text-grey-6">
      <q-spinner size="36px" color="primary" />
      <div class="q-mt-sm">Chargement…</div>
    </div>

    <div v-else-if="evaluationActive" class="carte q-pa-md">
      <div class="row items-center q-mb-sm q-col-gutter-md">
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">
            {{ evaluationActive.intitule }}
          </div>
          <div class="text-caption text-grey-7">
            {{ evaluationActive.matiere?.intitule }} —
            {{ evaluationActive.promotion?.nom }} — semestre
            {{ evaluationActive.semestre }}
          </div>
        </div>
        <div class="col-auto" v-if="!cloturee">
          <q-chip outline color="primary" icon="edit_note">
            {{ lignes.length }} étudiants
          </q-chip>
        </div>
      </div>

      <notes-saisie-masse
        :evaluation-id="evaluationActive.id"
        :inscriptions="lignes"
        :notes-existantes="notesExistantes"
        :lecture-seule="cloturee || !peutSaisir()"
        :motif-lecture-seule="motifLectureSeule"
        @enregistrer="enregistrer"
      />
    </div>

    <div v-else class="carte q-pa-lg text-center text-grey-6">
      <q-icon name="table_chart" size="48px" class="q-mb-sm" />
      <div>Sélectionnez une évaluation ci-dessus pour ouvrir la feuille de notes.</div>
      <div class="text-caption q-mt-xs">
        La feuille reprend les étudiants dont le dossier d’inscription est validé.
      </div>
      <q-btn
        class="q-mt-md"
        unelevated
        color="primary"
        no-caps
        icon="fact_check"
        label="Parcourir les évaluations"
        @click="allerAuxEvaluations"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import NotesSaisieMasse from '../components/NotesSaisieMasse.vue';
import { LIBELLE_STATUT_EVALUATION, LIBELLE_TYPE_EVALUATION } from '../utils/libelles';
import type { Evaluation, Note, TypeEvaluation } from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/** Qui saisit les notes (direction comprise, elle arbitre) — cf. `PUT /notes/saisie`. */
const peutSaisir = () => auth.aRole(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION']);
/** Clôturer fige le registre : réservé à la scolarité, comme côté API. */
const peutCloturer = () => auth.aRole(['ADMIN', 'SCOLARITE']);

const selEvaluationId = ref<string | null>(null);
const evaluationActive = ref<Evaluation | null>(null);
const lignes = ref<Array<{
  inscriptionId: string;
  numero: string;
  matricule: string;
  nom: string;
  prenom: string;
  note: number | null;
  present: boolean;
}>>([]);
const notesExistantes = ref<Note[]>([]);
const chargementInitial = ref(true);

const cloturee = computed(() => evaluationActive.value?.statut === 'CLOTUREE');

/** Une ligne d'autocomplétion doit dire l'épreuve, la matière, la promo et l'état. */
function libelleEvaluation(e: any): string {
  const type = LIBELLE_TYPE_EVALUATION[e.type as TypeEvaluation] ?? e.type;
  const etat = LIBELLE_STATUT_EVALUATION[e.statut] ?? e.statut;
  return `${e.intitule} · ${type} · ${e.matiere?.intitule ?? ''} (${e.promotion?.nom ?? ''}) — ${etat}`;
}

function allerAuxEvaluations() {
  void router.push({ path: '/evaluations' });
}

const motifLectureSeule = computed(() => {
  if (!evaluationActive.value) return '';
  if (cloturee.value) {
    return 'L’évaluation est clôturée : les notes sont définitives.';
  }
  if (!peutSaisir()) {
    return 'La saisie est réservée à la scolarité et à la direction.';
  }
  return '';
});

async function choisir(e: Evaluation) {
  chargementInitial.value = true;
  try {
    const { data } = await api.get(`/notes/evaluation/${e.id}`);
    evaluationActive.value = data.evaluation ?? e;
    lignes.value = (data.lignes ?? []).map((l: any) => ({
      inscriptionId: l.inscriptionId,
      numero: l.numero,
      matricule: l.matricule,
      nom: l.nom,
      prenom: l.prenom,
      note: l.note ?? null,
      present: l.present ?? true,
    }));
    notesExistantes.value = (data.lignes ?? [])
      .filter((l: any) => l.note !== null && l.note !== undefined)
      .map((l: any) => ({
        id: l.id ?? l.inscriptionId,
        evaluationId: e.id,
        inscriptionId: l.inscriptionId,
        note: l.note,
        present: l.present ?? true,
        saisieLe: l.saisieLe ?? new Date().toISOString(),
      }));
  } finally {
    chargementInitial.value = false;
  }
}

async function chargerDepuisId(id: string | null) {
  if (!id) {
    evaluationActive.value = null;
    lignes.value = [];
    notesExistantes.value = [];
    return;
  }
  try {
    const { data } = await api.get(`/evaluations/${id}`);
    await choisir(data as Evaluation);
  } catch {
    evaluationActive.value = null;
    lignes.value = [];
    notesExistantes.value = [];
    $q.notify({
      type: 'warning',
      message: 'Évaluation introuvable : elle a pu être supprimée.',
    });
  }
}

async function enregistrer(payload: {
  evaluationId: string;
  notes: Array<{ inscriptionId: string; note: number | null; present: boolean }>;
}) {
  try {
    const { data } = await api.put('/notes/saisie', payload);
    $q.notify({
      type: 'positive',
      message: `${data.n ?? payload.notes.length} note${(data.n ?? payload.notes.length) > 1 ? 's' : ''} enregistrée${(data.n ?? payload.notes.length) > 1 ? 's' : ''}${data.ignorees ? ` · ${data.ignorees} ignorée${data.ignorees > 1 ? 's' : ''}` : ''}`,
    });
    if (evaluationActive.value) await choisir(evaluationActive.value);
  } catch {
    /* Notification gérée par l’intercepteur axios */
  }
}

function cloturer() {
  if (!evaluationActive.value) return;
  const e = evaluationActive.value;
  $q.dialog({
    title: 'Clôturer l’évaluation',
    message: `Clôturer « ${e.intitule} » ? Les notes deviennent définitives et un recalage de délibération les prendra en compte.`,
    cancel: true,
    ok: { color: 'primary', label: 'Clôturer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/evaluations/${e.id}/cloturer`);
      $q.notify({ type: 'positive', message: 'Évaluation clôturée' });
      await choisir({ ...e, statut: 'CLOTUREE' });
    } catch {
      /* Notification gérée par l’intercepteur axios */
    }
  });
}

/** Ouvre la feuille demandée par l'URL (`/notes?evaluation=…`). */
async function ouvrirDepuisRoute(id?: string) {
  if (!id || id === evaluationActive.value?.id) return;
  selEvaluationId.value = id;
  await chargerDepuisId(id);
}

// La navigation depuis Évaluations peut survenir alors que la page est déjà
// montée : on suit le paramètre, pas seulement le premier rendu.
watch(
  () => route.query.evaluation as string | undefined,
  (id) => void ouvrirDepuisRoute(id),
);

onMounted(async () => {
  await ouvrirDepuisRoute(route.query.evaluation as string | undefined);
  chargementInitial.value = false;
});
</script>

<style scoped lang="scss">
.notes-page {
  padding: var(--up-3);
  display: grid;
  gap: var(--up-3);
}
</style>