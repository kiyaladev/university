<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('evaluations.title')" :subtitle="$t('evaluations.subtitle')">
      <template v-if="peutGererEvaluation()" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('evaluations.actions.new')"
          @click="ouvrir(null)"
        />
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('evaluations.filters.search_placeholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('evaluations.filters.year')"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('evaluations.filters.promotion')"
        />
        <autocomplete-async
          v-model="filtres.matiereId"
          endpoint="/matieres"
          :label="$t('evaluations.filters.subject')"
          clearable
          :label-fn="(m) => `${m.code} — ${m.intitule}`"
        />
        <q-select
          v-model="filtres.type"
          :options="optionsTypes"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('evaluations.filters.type')"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('evaluations.filters.status')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="ev.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="ev.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="fact_check" :titre="messageVide">
          <template #action>
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('evaluations.actions.reset_filters')"
              @click="reinitialiser"
            />
            <q-btn
              v-if="peutGererEvaluation() && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('evaluations.actions.new')"
              @click="ouvrir(null)"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_EVALUATION[p.row.type] }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="evaluation" :statut="p.row.statut" />
        </q-td>
      </template>

      <template #body-cell-notes="p">
        <q-td :props="p">
          <q-badge outline color="primary" :label="libelleNotes(p.row)" />
        </q-td>
      </template>

      <template #body-cell-date="p">
        <q-td :props="p">{{ dateLisible(p.row.date) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            v-if="p.row.statut !== 'OUVERTE' || !peutSaisirNotes()"
            flat
            dense no-caps
            icon="visibility"
            :aria-label="$t('evaluations.table.view_notes_aria')" :label="$t('evaluations.table.view_notes_aria')"
            @click="voirNotes(p.row)"
          >
            <q-tooltip>{{ $t('evaluations.table.view_notes') }}</q-tooltip>
          </q-btn>
<q-btn
            v-if="p.row.statut === 'OUVERTE' && peutSaisirNotes()"
            flat
            dense no-caps
            icon="edit_note"
            color="primary"
            :aria-label="$t('evaluations.table.enter_notes_aria')" :label="$t('evaluations.table.enter_notes_aria')"
            @click="saisirNotes(p.row)"
          >
            <q-tooltip>{{ $t('evaluations.table.enter_notes') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            v-if="p.row.statut === 'OUVERTE' && peutGererEvaluation()"
            flat
            dense no-caps
            icon="lock"
            :aria-label="$t('evaluations.table.close_evaluation_aria')" :label="$t('evaluations.table.close_evaluation_aria')"
            @click="cloturer(p.row)"
          >
            <q-tooltip>{{ $t('evaluations.table.close_evaluation') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="p.row.statut === 'OUVERTE' && peutGererEvaluation()"
            flat
            dense no-caps
            icon="edit"
            :aria-label="$t('evaluations.table.edit_evaluation_aria')" :label="$t('evaluations.table.edit_evaluation_aria')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('evaluations.table.edit_evaluation') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutGererEvaluation()"
            flat
            dense no-caps
            color="negative"
            icon="delete"
            :aria-label="$t('evaluations.table.delete_aria')" :label="$t('evaluations.table.delete_aria')"
            :disable="nombreNotes(p.row) > 0"
            @click="supprimer(p.row)"
          >
            <q-tooltip>
              {{
                nombreNotes(p.row) > 0
                  ? $t('evaluations.table.delete_locked')
                  : $t('evaluations.table.delete')
              }}
            </q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <q-linear-progress
      v-if="modeVue === 'cartes' && ev.chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="evaluations-cartes">
      <q-card
        v-for="e in ev.lignes"
        :key="e.id"
        flat
        bordered
        class="carte evaluations-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <PastilleStatut domaine="evaluation" :statut="e.statut" />
            <q-badge outline color="primary" class="q-ml-sm">
              {{ LIBELLE_TYPE_EVALUATION[e.type] }}
            </q-badge>
            <q-badge outline color="grey-7" class="q-ml-sm">
              {{ $t('evaluations.cards.coefficient', { n: e.coefficient }) }}
            </q-badge>
            <q-space />
            <div class="text-caption text-grey-7">
              {{ dateLisible(e.date) }} · {{ $t('evaluations.cards.semester', { n: e.semestre }) }}
            </div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ e.intitule }}</div>
          <div class="text-caption text-grey-7">
            {{ e.matiere?.intitule }} {{ $t('rectoratPage.subtitleFallback') }} {{ e.promotion?.nom }}
          </div>
          <div class="q-mt-sm">
            <q-badge outline color="primary" :label="libelleNotes(e)" />
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
<q-btn v-if="e.statut !== 'OUVERTE' || !peutSaisirNotes()" flat dense icon="visibility" no-caps :label="$t('evaluations.cards.notes_view')" @click="voirNotes(e)" />
<q-btn
            v-if="e.statut === 'OUVERTE' && peutSaisirNotes()"
            flat
            dense
            color="primary"
            icon="edit_note"
            no-caps
            :label="$t('evaluations.cards.notes_enter')"
            @click="saisirNotes(e)"
          />
<actions-secondaires>
<q-btn v-close-popup
            v-if="e.statut === 'OUVERTE' && peutGererEvaluation()"
            flat
            dense
            icon="edit"
            no-caps
            :label="$t('evaluations.cards.edit')"
            @click="ouvrir(e)"
          />
<q-btn v-close-popup
            v-if="e.statut === 'OUVERTE' && peutGererEvaluation()"
            flat
            dense
            icon="lock"
            no-caps
            :label="$t('evaluations.cards.close')"
            @click="cloturer(e)"
          />
<q-btn v-close-popup
            v-if="peutGererEvaluation()"
            flat
            dense
            color="negative"
            icon="delete"
            no-caps
            :label="$t('evaluations.cards.delete')"
            :disable="nombreNotes(e) > 0"
            @click="supprimer(e)"
          />
</actions-secondaires>
</q-card-actions>
      </q-card>
      <etat-vide v-if="!ev.lignes.length" icone="fact_check" :titre="messageVide">
        <template #action>
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            :label="$t('evaluations.actions.reset_filters')"
            @click="reinitialiser"
          />
          <q-btn
            v-if="peutGererEvaluation() && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('evaluations.actions.new')"
            @click="ouvrir(null)"
          />
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-if="ev.lignes.length"
      v-model:page="ev.page"
      v-model:page-size="ev.pageSize"
      :total="ev.total"
      @tous="ev.pageSize = Math.max(ev.total, 1)"
    />

    <evaluation-dialog
      v-model="dialogOuvert"
      :evaluation="evaluationEditee"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="ev.recharger()"
    />

    <!-- Modale « Voir les notes » -->
    <q-dialog v-model="dialogNotes" :maximized="$q.screen.lt.md">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              {{ $t('evaluations.notes_modal.title', { name: evaluationSelectionnee?.intitule }) }}
            </div>
            <div class="text-caption text-grey-7">
              {{ $t('evaluations.notes_modal.subject_line', {
                subject: evaluationSelectionnee?.matiere?.intitule,
                promotion: evaluationSelectionnee?.promotion?.nom,
                status: evaluationSelectionnee?.statut === 'OUVERTE'
                  ? $t('evaluations.notes_modal.status_open')
                  : $t('evaluations.notes_modal.status_closed'),
              }) }}
            </div>
          </div>
          <q-btn
            v-if="evaluationSelectionnee?.statut === 'OUVERTE' && peutSaisirNotes()"
            unelevated
            color="primary"
            no-caps
            icon="edit_note"
            :label="$t('evaluations.notes_modal.enter_notes')"
            @click="saisirDepuisConsultation"
          />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-linear-progress
            v-if="chargementNotes"
            indeterminate
            color="primary"
            class="q-mb-sm"
          />
          <q-table
            v-else
            flat
            bordered
            :rows="notesConsultation"
            :columns="colonnesNotesConsultation"
            row-key="inscriptionId"
            :pagination="{ rowsPerPage: 0 }"
            dense
          >
            <template #no-data>
              <etat-vide icone="people_outline" :titre="$t('evaluations.notes_modal.empty')" />
            </template>
            <template #body-cell-note="p">
              <q-td :props="p" class="text-center chiffres">
                <span
                  :class="{
                    'text-negative': p.row.note !== null && p.row.note < 5,
                    'text-warning': p.row.note !== null && p.row.note >= 5 && p.row.note < 10,
                  }"
                >
                  {{ p.row.note !== null ? p.row.note.toFixed(2) : '—' }}
                </span>
              </q-td>
            </template>
            <template #body-cell-present="p">
              <q-td :props="p" class="text-center">
                <q-icon
                  :name="p.row.present ? 'check_circle' : 'cancel'"
                  :color="p.row.present ? 'positive' : 'grey-6'"
                />
              </q-td>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('evaluations.notes_modal.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import EvaluationDialog from '../components/EvaluationDialog.vue';
import EtatVide from '../components/EtatVide.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import {
  LIBELLE_STATUT_EVALUATION,
  LIBELLE_TYPE_EVALUATION,
  dateLisible,
} from '../utils/libelles';
import type {
  AnneeAcademique,
  Evaluation,
  Matiere,
  Promotion,
  StatutEvaluation,
  TypeEvaluation, ChipFiltre } from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const { confirmer, supprimerAvecConfirmation } = useConfirmation();

/**
 * Deux droits distincts, alignés sur l'API :
 * — créer / modifier / clôturer / supprimer une évaluation : SCOLARITE, ADMIN ;
 * — saisir les notes (`PUT /notes/saisie`) : + DIRECTION et CHEF_DEPARTEMENT.
 */
const peutGererEvaluation = () => auth.aRole(['ADMIN', 'SCOLARITE']);
const peutSaisirNotes = () =>
  auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT']);

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const dialogOuvert = ref(false);
const evaluationEditee = ref<Evaluation | null>(null);
const modeVue = usePresentationListe();

const FILTRES_VIDES = { recherche: '', anneeId: null, promotionId: null, matiereId: null, type: null, statut: null };
const filtres = ref<Record<string, any>>({ ...FILTRES_VIDES });
// `/evaluations?promotion=…` : arrivée depuis la fiche d'un étudiant.
if (typeof route.query.promotion === 'string' && route.query.promotion) {
  filtres.value.promotionId = route.query.promotion;
}

const ev = reactive(
  useListePaginee<Evaluation>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/evaluations', {
          params: {
            ...pageApi(p),
            anneeId: f.anneeId || undefined,
            promotionId: f.promotionId || undefined,
            matiereId: f.matiereId || undefined,
            type: f.type || undefined,
            statut: f.statut || undefined,
            search: texteApi(f.recherche),
          },
        })
        .then((r) => r.data),
  }),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('evaluations.chips.search', { q: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: t('evaluations.chips.year', { v: a?.libelle ?? '?' }), value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: t('evaluations.chips.promotion', { v: p?.nom ?? '?' }), value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.matiereId) {
    const m = matieres.value.find((x) => x.id === filtres.value.matiereId);
    cs.push({ label: t('evaluations.chips.subject', { v: m?.code ?? '?' }), value: filtres.value.matiereId, icone: 'menu_book' });
  }
  if (filtres.value.type) {
    cs.push({
      label: t('evaluations.chips.type', { v: LIBELLE_TYPE_EVALUATION[filtres.value.type as TypeEvaluation] ?? filtres.value.type }),
      value: filtres.value.type,
      icone: 'category',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('evaluations.chips.status', { v: LIBELLE_STATUT_EVALUATION[filtres.value.statut as StatutEvaluation] ?? filtres.value.statut }),
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  return cs;
});

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value ? t('evaluations.empty_state.filtered') : t('evaluations.empty_state.none'),
);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsTypes = computed(() =>
  (Object.keys(LIBELLE_TYPE_EVALUATION) as TypeEvaluation[]).map((t) => ({
    label: LIBELLE_TYPE_EVALUATION[t],
    value: t,
  })),
);
const optionsStatuts = computed(() =>
  (Object.keys(LIBELLE_STATUT_EVALUATION) as StatutEvaluation[]).map((s) => ({
    label: LIBELLE_STATUT_EVALUATION[s],
    value: s,
  })),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'intitule', label: t('evaluations.table.columns.title'), field: 'intitule', align: 'left', sortable: true },
  { name: 'type', label: t('evaluations.table.columns.type'), field: 'type', align: 'left' },
  { name: 'coefficient', label: t('evaluations.table.columns.coefficient'), field: 'coefficient', align: 'center' },
  { name: 'matiere', label: t('evaluations.table.columns.subject'), field: (r) => r.matiere?.intitule ?? '—', align: 'left' },
  {
    name: 'promotion',
    label: t('evaluations.table.columns.promotion'),
    field: (r) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'semestre', label: t('evaluations.table.columns.semester'), field: 'semestre', align: 'center' },
  { name: 'date', label: t('evaluations.table.columns.date'), field: 'date', align: 'left' },
  { name: 'statut', label: t('evaluations.table.columns.status'), field: 'statut', align: 'left' },
  { name: 'notes', label: t('evaluations.table.columns.notes'), field: 'id', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

/** Nombre de notes déjà saisies sur l'évaluation. */
const nombreNotes = (e: Evaluation) => e._count?.notes ?? 0;

const libelleNotes = (e: Evaluation) => {
  const n = nombreNotes(e);
  return t('evaluations.notes_count', { n, plural: n > 1 ? 's' : '' });
};

function ouvrir(e: Evaluation | null) {
  evaluationEditee.value = e;
  dialogOuvert.value = true;
}

/** Feuille de saisie plein écran, sur l'évaluation choisie. */
function saisirNotes(e: Evaluation) {
  void router.push({ path: '/notes', query: { evaluation: e.id } });
}

async function cloturer(e: Evaluation) {
  const ok = await confirmer({
    titre: t('evaluations.dialogs.close_title'),
    message: t('evaluations.dialogs.close_message', { name: e.intitule }),
    ok: t('evaluations.dialogs.close_confirm'),
  });
  if (!ok) return;
  try {
    await api.post(`/evaluations/${e.id}/cloturer`);
  } catch {
    return;
  }
  $q.notify({ type: 'positive', message: t('evaluations.messages.closed') });
  await ev.recharger();
}

function supprimer(e: Evaluation) {
  void supprimerAvecConfirmation(`/evaluations/${e.id}`, e.intitule, ev.recharger, {
    titre: t('evaluations.dialogs.delete_title'),
    message: t('evaluations.dialogs.delete_message', { name: e.intitule }),
    ok: t('evaluations.dialogs.delete_confirm'),
    succes: t('evaluations.messages.deleted'),
  });
}

// --- Consultation des notes ---------------------------------------------

const dialogNotes = ref(false);
const evaluationSelectionnee = ref<Evaluation | null>(null);
const notesConsultation = ref<Array<{
  inscriptionId: string;
  matricule: string;
  nom: string;
  prenom: string;
  numero: string;
  note: number | null;
  present: boolean;
}>>([]);
const chargementNotes = ref(false);

const colonnesNotesConsultation = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('evaluations.notes_modal.columns.matricule'), field: 'matricule', align: 'left' },
  { name: 'numero', label: t('evaluations.notes_modal.columns.number'), field: 'numero', align: 'left' },
  {
    name: 'etudiant',
    label: t('evaluations.notes_modal.columns.student'),
    field: (r) => `${r.nom} ${r.prenom}`,
    align: 'left',
  },
  { name: 'present', label: t('evaluations.notes_modal.columns.present'), field: 'present', align: 'center' },
  { name: 'note', label: t('evaluations.notes_modal.columns.note'), field: 'note', align: 'center' },
]);

/**
 * Feuille de l'évaluation. `GET /evaluations/:id/etudiants` renvoie
 * `{ evaluation, lignes }` — les inscrits sont dans `lignes`, jamais à la
 * racine ni dans `data`.
 */
async function voirNotes(e: Evaluation) {
  evaluationSelectionnee.value = e;
  dialogNotes.value = true;
  chargementNotes.value = true;
  try {
    const { data } = await api.get(`/evaluations/${e.id}/etudiants`);
    const liste = Array.isArray(data) ? data : data?.lignes ?? [];
    notesConsultation.value = liste.map((l: any) => ({
      inscriptionId: l.inscriptionId ?? l.id,
      matricule: l.matricule ?? '—',
      nom: l.nom ?? '',
      prenom: l.prenom ?? '',
      numero: l.numero ?? '—',
      note: l.note ?? null,
      present: l.present ?? true,
    }));
  } catch {
    notesConsultation.value = [];
  } finally {
    chargementNotes.value = false;
  }
}

function saisirDepuisConsultation() {
  const e = evaluationSelectionnee.value;
  if (!e) return;
  dialogNotes.value = false;
  saisirNotes(e);
}

// --- Chargement ---------------------------------------------------------

function reinitialiser() {
  filtres.value = { ...FILTRES_VIDES };
}

onMounted(async () => {
  try {
    [annees.value, promotions.value, matieres.value] = await Promise.all([
      referentiels.annees(),
      referentiels.promotions(),
      referentiels.matieres(),
    ]);
  } catch {
    annees.value = [];
    promotions.value = [];
    matieres.value = [];
  }
});
</script>

<style scoped lang="scss">
.evaluations-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.evaluations-cartes__carte {
  background: var(--up-plaque);
}
</style>
