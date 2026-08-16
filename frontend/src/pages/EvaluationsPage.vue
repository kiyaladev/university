<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Évaluations</div>
        <div class="page-sous-titre">
          Les épreuves notées (CC, examen, rattrapage…) par matière et promotion
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutSaisir()"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle évaluation"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher par intitulé…"
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
          label="Année académique"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Promotion"
        />
        <autocomplete-async
          v-model="filtres.matiereId"
          endpoint="/matieres"
          label="Matière"
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
          label="Type d'épreuve"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="État"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="evaluations"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = (m as 'tableau' | 'cartes'))"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="evaluationsFiltrees"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">Aucune évaluation pour ces critères.</div>
      </template>

      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_EVALUATION[p.row.type] }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="p.row.statut === 'OUVERTE' ? 'positive' : 'grey-6'">
            {{ LIBELLE_STATUT_EVALUATION[p.row.statut] }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-notes="p">
        <q-td :props="p">
          <q-badge
            outline
            color="primary"
            :label="`${(p.row as any)._count?.notes ?? 0} note${(p.row as any)._count?.notes > 1 ? 's' : ''}`"
          />
        </q-td>
      </template>

      <template #body-cell-date="p">
        <q-td :props="p">{{ dateLisible(p.row.date) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" @click="voirNotes(p.row)">
            <q-tooltip>Voir les notes</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'OUVERTE' && peutSaisir()"
            flat
            dense
            round
            icon="edit_note"
            color="primary"
            @click="saisirNotes(p.row)"
          >
            <q-tooltip>Saisir les notes (plein écran)</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'OUVERTE' && peutSaisir()"
            flat
            dense
            round
            icon="lock"
            @click="cloturer(p.row)"
          >
            <q-tooltip>Clôturer l’évaluation (notes figées)</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'OUVERTE' && peutSaisir()"
            flat
            dense
            round
            icon="edit"
            @click="ouvrir(p.row)"
          />
          <q-btn
            v-if="peutSaisir()"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :disable="(p.row as any)._count?.notes > 0"
            @click="supprimer(p.row)"
          >
            <q-tooltip>
              {{
                (p.row as any)._count?.notes > 0
                  ? 'Des notes sont déjà saisies : suppression impossible'
                  : 'Supprimer'
              }}
            </q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="evaluations-cartes">
      <q-card
        v-for="e in evaluationsFiltrees"
        :key="e.id"
        flat
        bordered
        class="carte evaluations-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-badge
              :color="e.statut === 'OUVERTE' ? 'positive' : 'grey-6'"
              :label="LIBELLE_STATUT_EVALUATION[e.statut]"
            />
            <q-badge outline color="primary" class="q-ml-sm">
              {{ LIBELLE_TYPE_EVALUATION[e.type] }}
            </q-badge>
            <q-badge outline color="grey-7" class="q-ml-sm">
              coeff. {{ e.coefficient }}
            </q-badge>
            <q-space />
            <div class="text-caption text-grey-7">
              {{ dateLisible(e.date) }} · sem. {{ e.semestre }}
            </div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ e.intitule }}</div>
          <div class="text-caption text-grey-7">
            {{ e.matiere?.intitule }} — {{ e.promotion?.nom }}
          </div>
          <div class="q-mt-sm">
            <q-badge
              outline
              color="primary"
              :label="`${(e as any)._count?.notes ?? 0} note${(e as any)._count?.notes > 1 ? 's' : ''}`"
            />
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
          <q-btn flat dense icon="visibility" no-caps label="Notes" @click="voirNotes(e)" />
          <q-btn
            v-if="e.statut === 'OUVERTE' && peutSaisir()"
            flat
            dense
            color="primary"
            icon="edit_note"
            no-caps
            label="Saisir"
            @click="saisirNotes(e)"
          />
          <q-btn
            v-if="peutSaisir() && e.statut === 'OUVERTE'"
            flat
            dense
            icon="edit"
            no-caps
            label="Modifier"
            @click="ouvrir(e)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!evaluationsFiltrees.length" class="text-center q-pa-md text-grey-7">
        Aucune évaluation pour ces critères.
      </div>
    </div>

    <pagination-bar
      v-if="evaluations.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <evaluation-dialog
      v-model="dialogOuvert"
      :evaluation="evaluationEditee"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="charger"
    />

    <!-- Modale « Voir les notes » -->
    <q-dialog v-model="dialogNotes" :maximized="$q.screen.lt.md">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              Notes — {{ evaluationSelectionnee?.intitule }}
            </div>
            <div class="text-caption text-grey-7">
              {{ evaluationSelectionnee?.matiere?.intitule }} —
              {{ evaluationSelectionnee?.promotion?.nom }} ·
              {{ evaluationSelectionnee?.statut === 'OUVERTE' ? 'saisie ouverte' : 'clôturée' }}
            </div>
          </div>
          <q-btn
            v-if="evaluationSelectionnee?.statut === 'OUVERTE' && peutSaisir()"
            unelevated
            color="primary"
            no-caps
            icon="edit_note"
            label="Saisir"
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
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EvaluationDialog from '../components/EvaluationDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
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
  TypeEvaluation,
} from '../types';

const $q = useQuasar();
const router = useRouter();
const auth = useAuthStore();

/** Qui saisit les notes et gère les évaluations. */
const peutSaisir = () => auth.aRole(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT']);

const evaluations = ref<Evaluation[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const evaluationEditee = ref<Evaluation | null>(null);
const modeVue = ref<'tableau' | 'cartes'>('tableau');

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const tousLesElements = ref(false);

const filtres = ref<Record<string, any>>({});

const chips = computed(() => {
  const cs: Array<{ label: string; value: any; icone?: string; defaut?: boolean }> = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: `Année : ${a?.libelle ?? '?'}`, value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.matiereId) {
    const m = matieres.value.find((x) => x.id === filtres.value.matiereId);
    cs.push({ label: `Matière : ${m?.code ?? '?'}`, value: filtres.value.matiereId, icone: 'menu_book' });
  }
  if (filtres.value.type) {
    cs.push({
      label: `Type : ${LIBELLE_TYPE_EVALUATION[filtres.value.type as TypeEvaluation] ?? filtres.value.type}`,
      value: filtres.value.type,
      icone: 'category',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: `État : ${LIBELLE_STATUT_EVALUATION[filtres.value.statut as StatutEvaluation] ?? filtres.value.statut}`,
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  return cs;
});

const evaluationsFiltrees = computed(() => {
  if (!tousLesElements.value && !filtres.value.recherche) return evaluations.value;
  return evaluations.value;
});

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

const colonnes: QTableColumn[] = [
  { name: 'intitule', label: 'Intitulé', field: 'intitule', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'coefficient', label: 'Coeff.', field: 'coefficient', align: 'center' },
  { name: 'matiere', label: 'Matière', field: (r) => r.matiere?.intitule ?? '—', align: 'left' },
  {
    name: 'promotion',
    label: 'Promotion',
    field: (r) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'semestre', label: 'Sem', field: 'semestre', align: 'center' },
  { name: 'date', label: 'Date', field: 'date', align: 'left' },
  { name: 'statut', label: 'État', field: 'statut', align: 'left' },
  { name: 'notes', label: 'Notes', field: 'id', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(e: Evaluation | null) {
  evaluationEditee.value = e;
  dialogOuvert.value = true;
}

function saisirNotes(e: Evaluation) {
  router.push({ path: '/notes', query: { evaluation: e.id } });
}

function cloturer(e: Evaluation) {
  $q.dialog({
    title: 'Clôturer l’évaluation',
    message: `Clôturer « ${e.intitule} » ? Les notes deviennent définitives et la saisie sera fermée.`,
    cancel: true,
    ok: { color: 'primary', label: 'Clôturer' },
  }).onOk(async () => {
    await api.post(`/evaluations/${e.id}/cloturer`);
    $q.notify({ type: 'positive', message: 'Évaluation clôturée' });
    await charger();
  });
}

function supprimer(e: Evaluation) {
  $q.dialog({
    title: 'Supprimer l’évaluation',
    message: `Supprimer définitivement « ${e.intitule} » ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/evaluations/${e.id}`);
    $q.notify({ type: 'positive', message: 'Évaluation supprimée' });
    await charger();
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

const colonnesNotesConsultation: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left' },
  { name: 'numero', label: 'N°', field: 'numero', align: 'left' },
  {
    name: 'etudiant',
    label: 'Étudiant',
    field: (r) => `${r.nom} ${r.prenom}`,
    align: 'left',
  },
  { name: 'present', label: 'Présent', field: 'present', align: 'center' },
  { name: 'note', label: 'Note', field: 'note', align: 'center' },
];

async function voirNotes(e: Evaluation) {
  evaluationSelectionnee.value = e;
  dialogNotes.value = true;
  chargementNotes.value = true;
  try {
    const { data } = await api.get(`/evaluations/${e.id}/etudiants`);
    const liste = Array.isArray(data) ? data : data?.data ?? [];
    notesConsultation.value = liste.map((l: any) => ({
      inscriptionId: l.inscriptionId ?? l.id,
      matricule: l.matricule ?? l.inscription?.etudiant?.matricule ?? '—',
      nom: l.nom ?? l.inscription?.etudiant?.nom ?? '',
      prenom: l.prenom ?? l.inscription?.etudiant?.prenom ?? '',
      numero: l.numero ?? l.inscription?.numero ?? '—',
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

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/evaluations', {
      params: {
        all: '1',
        page: page.value,
        pageSize: pageSize.value,
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        matiereId: filtres.value.matiereId || undefined,
        type: filtres.value.type || undefined,
        statut: filtres.value.statut || undefined,
        search: filtres.value.recherche || undefined,
      },
    });
    evaluations.value = data.data ?? [];
    total.value = data.total ?? evaluations.value.length;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/evaluations', {
      params: {
        all: '1',
        pageSize: 1000,
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        matiereId: filtres.value.matiereId || undefined,
        type: filtres.value.type || undefined,
        statut: filtres.value.statut || undefined,
        search: filtres.value.recherche || undefined,
      },
    });
    evaluations.value = data.data ?? [];
    total.value = evaluations.value.length;
    tousLesElements.value = true;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  tousLesElements.value = false;
  charger();
}

watch(
  () => [filtres.value.anneeId, filtres.value.promotionId, filtres.value.matiereId,
         filtres.value.type, filtres.value.statut, filtres.value.recherche],
  () => {
    page.value = 1;
    tousLesElements.value = false;
    charger();
  },
);

onMounted(async () => {
  const [a, promos, m] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
    api.get('/matieres', { params: { all: '1' } }),
  ]);
  annees.value = a.data.data;
  promotions.value = promos.data.data;
  matieres.value = m.data.data;
  await charger();
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