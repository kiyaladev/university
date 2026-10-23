<template>
  <q-page class="notes-page">
    <en-tete-page :title="$t('notes.title')" :subtitle="$t('notes.subtitle')">
      <template v-if="evaluationActive" #actions>
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
      </template>
    </en-tete-page>

    <div class="carte q-pa-md q-mb-md">
      <div class="row q-col-gutter-md items-end">
        <div v-if="!evaluationActive" class="col-12 col-md-8">
          <champ-recherche
            v-model="selEvaluationId"
            endpoint="/evaluations"
            :label="$t('notes.form.evaluationLabel')"
            :placeholder="$t('notes.form.evaluationPlaceholder')"
            :label-fn="libelleEvaluation"
            @update:model-value="(v, raw) => { if (raw) choisir(raw); else chargerDepuisId(v); }"
          />
        </div>
        <div class="col-12 col-md-4 text-right q-gutter-sm">
          <q-btn
            flat
            no-caps
            icon="fact_check"
            :label="$t('notes.actions.allEvaluations')"
            @click="allerAuxEvaluations"
          />
          <q-btn
            v-if="evaluationActive && evaluationActive.statut === 'OUVERTE' && peutCloturer()"
            outline
            no-caps
            icon="lock"
            :label="$t('notes.actions.closeEvaluation')"
            @click="cloturer"
          />
        </div>
      </div>
    </div>

    <div v-if="chargementInitial" class="carte q-pa-lg text-center text-grey-6">
      <q-spinner size="36px" color="primary" />
      <div class="q-mt-sm">{{ $t('notes.loading') }}</div>
    </div>

    <div v-else-if="evaluationActive" class="carte q-pa-md">
      <div class="row items-center q-mb-sm q-col-gutter-md">
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">
            {{ evaluationActive.intitule }}
          </div>
          <div class="text-caption text-grey-7">
            {{ evaluationActive.matiere?.intitule }} {{ $t('common.format.emptyValue') }}
            {{ evaluationActive.promotion?.nom }} — {{ $t('notes.semester') }}
            {{ evaluationActive.semestre }}
          </div>
        </div>
        <div class="col-auto" v-if="!cloturee">
          <q-chip outline color="primary" icon="edit_note">
            {{ $t('notes.studentsCount', { count: lignes.length }) }}
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

    <etat-vide
      v-else
      class="carte"
      icone="table_chart"
      :titre="$t('notes.emptyState.title')"
      :aide="$t('notes.emptyState.hint')"
    >
      <template #action>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="fact_check"
          :label="$t('notes.actions.browseEvaluations')"
          @click="allerAuxEvaluations"
        />
      </template>
    </etat-vide>
  </q-page>
</template>

<script setup lang="ts">
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import NotesSaisieMasse from '../components/NotesSaisieMasse.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { LIBELLE_STATUT_EVALUATION, LIBELLE_TYPE_EVALUATION } from '@/shared/utils/libelles';
import type { Evaluation, Note, TypeEvaluation } from '@/types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

/** Qui saisit les notes (direction comprise, elle arbitre) — cf. `PUT /notes/saisie`. */
const peutSaisir = () => auth.peut('notes.saisir');
/** Clôturer fige le registre : réservé à la scolarité, comme côté API. */
const peutCloturer = () => auth.peut('evaluations.gerer');

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
    return t('notes.readOnly.closed');
  }
  if (!peutSaisir()) {
    return t('notes.readOnly.forbidden');
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
      message: t('notes.messages.evaluationNotFound'),
    });
  }
}

async function enregistrer(payload: {
  evaluationId: string;
  notes: Array<{ inscriptionId: string; note: number | null; present: boolean }>;
}) {
  try {
    const { data } = await api.put('/notes/saisie', payload);
    const count = data.n ?? payload.notes.length;
    $q.notify({
      type: 'positive',
      message: data.ignorees
        ? t('notes.messages.savedWithIgnored', { count, ignored: data.ignorees })
        : t('notes.messages.saved', { count }),
    });
    if (evaluationActive.value) await choisir(evaluationActive.value);
  } catch {
    /* Notification gérée par l’intercepteur axios */
  }
}

async function cloturer() {
  if (!evaluationActive.value) return;
  const e = evaluationActive.value;
  const ok = await confirmer({
    titre: t('notes.dialogs.close.title'),
    message: t('notes.dialogs.close.message', { name: e.intitule }),
    ok: t('common.actions.closeOut'),
  });
  if (!ok) return;
  try {
    await api.post(`/evaluations/${e.id}/cloturer`);
    $q.notify({ type: 'positive', message: t('notes.messages.closed') });
    await choisir({ ...e, statut: 'CLOTUREE' });
  } catch {
    /* Notification gérée par l’intercepteur axios */
  }
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
