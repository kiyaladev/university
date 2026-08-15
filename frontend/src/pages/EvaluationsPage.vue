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

    <q-table
      flat
      bordered
      class="carte"
      :rows="evaluations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :filter="recherche"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #top-left>
        <div class="row q-gutter-sm items-center">
          <q-input v-model="recherche" dense outlined clearable placeholder="Rechercher…">
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="filtres.anneeId"
            :options="optionsAnnees"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Année"
            style="min-width: 140px"
            @update:model-value="charger"
          />
          <q-select
            v-model="filtres.promotionId"
            :options="optionsPromotions"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Promotion"
            style="min-width: 190px"
            @update:model-value="charger"
          />
          <q-select
            v-model="filtres.matiereId"
            :options="optionsMatieres"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Matière"
            style="min-width: 190px"
            @update:model-value="charger"
          />
          <q-select
            v-model="filtres.type"
            :options="optionsTypes"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Type"
            style="min-width: 150px"
            @update:model-value="charger"
          />
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="État"
            style="min-width: 130px"
            @update:model-value="charger"
          />
        </div>
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
          <q-btn flat dense round icon="edit_note" color="primary" @click="saisirNotes(p.row)">
            <q-tooltip>Feuille de notes</q-tooltip>
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

    <evaluation-dialog
      v-model="dialogOuvert"
      :evaluation="evaluationEditee"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EvaluationDialog from '../components/EvaluationDialog.vue';
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
const recherche = ref('');
const dialogOuvert = ref(false);
const evaluationEditee = ref<Evaluation | null>(null);

const filtres = ref({
  anneeId: null as string | null,
  promotionId: null as string | null,
  matiereId: null as string | null,
  type: null as TypeEvaluation | null,
  statut: null as StatutEvaluation | null,
});

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsMatieres = computed(() =>
  matieres.value.map((m) => ({ label: `${m.code} — ${m.intitule}`, value: m.id })),
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

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/evaluations', {
      params: {
        all: '1',
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        matiereId: filtres.value.matiereId || undefined,
        type: filtres.value.type || undefined,
        statut: filtres.value.statut || undefined,
      },
    });
    evaluations.value = data.data;
  } finally {
    chargement.value = false;
  }
}

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