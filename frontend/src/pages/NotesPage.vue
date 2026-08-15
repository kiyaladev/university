<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Feuilles de notes</div>
        <div class="page-sous-titre">
          Choisissez une évaluation puis saisissez les notes /20 de la promotion
        </div>
      </div>
      <div class="col-auto" v-if="feuille">
        <q-badge
          :color="feuille.evaluation.statut === 'OUVERTE' ? 'positive' : 'grey-7'"
          class="q-px-sm q-py-xs text-body2"
        >
          <q-icon
            :name="feuille.evaluation.statut === 'OUVERTE' ? 'lock_open' : 'lock'"
            class="q-mr-xs"
          />
          {{ LIBELLE_STATUT_EVALUATION[feuille.evaluation.statut] }}
        </q-badge>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <!-- Colonne de sélection : année → promotion → matière → évaluation -->
      <div class="col-12 col-md-4 col-lg-3">
        <div class="carte q-pa-md">
          <q-select
            v-model="selAnneeId"
            :options="optionsAnnees"
            dense
            outlined
            emit-value
            map-options
            label="Année académique"
            @update:model-value="surAnneeChangee"
          />
          <q-select
            v-model="selPromotionId"
            :options="optionsPromotions"
            dense
            outlined
            emit-value
            map-options
            label="Promotion"
            class="q-mt-sm"
            @update:model-value="surPromotionChangee"
          />
          <q-select
            v-model="selMatiereId"
            :options="optionsMatieres"
            dense
            outlined
            emit-value
            map-options
            clearable
            label="Matière"
            class="q-mt-sm"
            @update:model-value="chargerEvaluations"
          />

          <q-separator class="q-my-md" />

          <q-list v-if="evaluations.length" dense>
            <q-item
              v-for="e in evaluations"
              :key="e.id"
              clickable
              :active="feuille?.evaluation.id === e.id"
              active-class="text-primary"
              @click="choisir(e)"
            >
              <q-item-section>
                <q-item-label class="text-body2">{{ e.intitule }}</q-item-label>
                <q-item-label caption>
                  {{ LIBELLE_TYPE_EVALUATION[e.type] }} · c. {{ e.coefficient }} ·
                  {{ (e as any)._count?.notes ?? 0 }} note{{ (e as any)._count?.notes > 1 ? 's' : '' }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge
                  :color="e.statut === 'OUVERTE' ? 'positive' : 'grey-6'"
                  :label="e.statut === 'OUVERTE' ? 'ouverte' : 'clôturée'"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <p v-else class="text-grey-7 text-caption q-ma-none">
            Aucune évaluation pour ce contexte.
          </p>
        </div>
      </div>

      <!-- Feuille de saisie -->
      <div class="col-12 col-md-8 col-lg-9">
        <div v-if="chargementFeuille" class="carte q-pa-lg text-center text-grey-6">
          <q-spinner size="36px" color="primary" />
          <div class="q-mt-sm">Chargement de la feuille…</div>
        </div>

        <div v-else-if="feuille" class="carte q-pa-md">
          <div class="row items-center q-mb-sm q-col-gutter-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-medium">
                {{ feuille.evaluation.intitule }}
              </div>
              <div class="text-caption text-grey-7">
                {{ feuille.evaluation.matiere?.intitule }} —
                {{ feuille.evaluation.promotion?.nom }} — semestre
                {{ feuille.evaluation.semestre }}
              </div>
            </div>
            <div class="col-auto" style="min-width: 240px">
              <q-linear-progress
                :value="progression"
                size="18px"
                color="primary"
                track-color="grey-3"
                rounded
              >
                <div class="progress-texte text-caption">
                  {{ remplies }} / {{ lignes.length }} notes
                </div>
              </q-linear-progress>
            </div>
          </div>

          <q-table
            v-if="!$q.screen.lt.md"
            flat
            bordered
            :rows="lignes"
            :columns="colonnes"
            row-key="inscriptionId"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-actif="p">
              <q-td :props="p" class="text-center">
                <q-checkbox
                  v-model="p.row.present"
                  :disable="!peutSaisir() || cloturee"
                  dense
                  color="primary"
                />
              </q-td>
            </template>
            <template #body-cell-saisie="p">
              <q-td :props="p" class="text-center">
                <q-input
                  v-model.number="p.row.saisie"
                  dense
                  outlined
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  style="width: 110px"
                  :disable="!peutSaisir() || cloturee || !p.row.present"
                  :placeholder="p.row.manquante ? 'manquante' : 'note /20'"
                  @update:model-value="borner(p.row)"
                />
              </q-td>
            </template>
            <template #body-cell-etat="p">
              <q-td :props="p" class="text-center">
                <q-badge v-if="p.row.manquante" color="warning" label="manquante" />
                <q-icon v-else name="task_alt" color="positive" />
              </q-td>
            </template>
          </q-table>

          <div v-else class="row q-col-gutter-sm">
            <div v-for="l in lignes" :key="l.inscriptionId" class="col-12 col-xsm-6">
              <div class="carte q-pa-sm">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-body2 text-weight-medium">{{ l.prenom }} {{ l.nom }}</div>
                    <div class="text-caption text-grey-7">{{ l.matricule }} · {{ l.numero }}</div>
                  </div>
                  <div class="col-auto">
                    <q-checkbox
                      v-model="l.present"
                      :disable="!peutSaisir() || cloturee"
                      dense
                      color="primary"
                      label="présent"
                    />
                  </div>
                </div>
                <q-input
                  v-model.number="l.saisie"
                  dense
                  outlined
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  :disable="!peutSaisir() || cloturee || !l.present"
                  :placeholder="l.manquante ? 'manquante' : 'note /20'"
                  @update:model-value="borner(l)"
                />
              </div>
            </div>
          </div>

          <div class="row items-center q-mt-md">
            <div class="col text-caption text-grey-7">
              <template v-if="peutSaisir()">
                Une absence cochée « présent » à une évaluation clôturée sera comptée 0/20 à
                la délibération ; une ligne jamais saisie rend la matière défaillante.
              </template>
              <template v-else>
                La saisie est réservée à la scolarité et à la direction.
              </template>
            </div>
            <div class="col-auto q-gutter-sm">
              <q-btn
                v-if="peutSaisir()"
                unelevated
                color="primary"
                no-caps
                icon="save"
                label="Enregistrer les notes"
                :loading="enregistrement"
                :disable="cloturee"
                @click="enregistrer"
              />
              <q-btn
                v-if="peutSaisir() && !cloturee"
                outline
                no-caps
                icon="check_circle"
                label="Clôturer"
                @click="cloturer"
              />
            </div>
          </div>
        </div>

        <div v-else class="carte q-pa-lg text-center text-grey-6">
          <q-icon name="table_chart" size="48px" class="q-mb-sm" />
          <div>Sélectionnez une évaluation à gauche pour ouvrir sa feuille de notes.</div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_STATUT_EVALUATION, LIBELLE_TYPE_EVALUATION } from '../utils/libelles';
import type {
  AnneeAcademique,
  Evaluation,
  Matiere,
  Promotion,
} from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/** Qui saisit les notes (direction comprise, elle arbitre). */
const peutSaisir = () => auth.aRole(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION']);

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const evaluations = ref<Evaluation[]>([]);

const selAnneeId = ref<string | null>(null);
const selPromotionId = ref<string | null>(null);
const selMatiereId = ref<string | null>(null);
const chargementFeuille = ref(false);
const enregistrement = ref(false);

interface LigneFeuille {
  inscriptionId: string;
  numero: string;
  matricule: string;
  nom: string;
  prenom: string;
  note: number | null;
  saisie: number | null;
  present: boolean;
  manquante: boolean;
}

const feuille = ref<{ evaluation: Evaluation; lignes: LigneFeuille[] } | null>(null);
const lignes = ref<LigneFeuille[]>([]);

const cloturee = computed(() => feuille.value?.evaluation.statut === 'CLOTUREE');

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !selAnneeId.value || p.anneeId === selAnneeId.value)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsMatieres = computed(() =>
  matieres.value.map((m) => ({ label: `${m.code} — ${m.intitule}`, value: m.id })),
);

const remplies = computed(
  () => lignes.value.filter((l) => l.saisie !== null || !l.present).length,
);
const progression = computed(() =>
  lignes.value.length ? remplies.value / lignes.value.length : 0,
);

const colonnes: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left' },
  { name: 'numero', label: 'N° inscription', field: 'numero', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.nom} ${r.prenom}`, align: 'left' },
  { name: 'actif', label: 'Présent', field: 'present', align: 'center' },
  { name: 'saisie', label: 'Note /20', field: 'saisie', align: 'center' },
  { name: 'etat', label: 'Saisie', field: 'manquante', align: 'center' },
];

function borner(l: LigneFeuille) {
  if (l.saisie === null || l.saisie === undefined) return;
  if (l.saisie < 0) l.saisie = 0;
  if (l.saisie > 20) l.saisie = 20;
}

async function chargerEvaluations() {
  if (!selAnneeId.value || !selPromotionId.value || !selMatiereId.value) {
    evaluations.value = [];
    return;
  }
  const { data } = await api.get('/evaluations', {
    params: {
      all: '1',
      anneeId: selAnneeId.value,
      promotionId: selPromotionId.value,
      matiereId: selMatiereId.value,
    },
  });
  evaluations.value = data.data;
}

async function surAnneeChangee() {
  selPromotionId.value = null;
  feuille.value = null;
  lignes.value = [];
  await chargerEvaluations();
}

async function surPromotionChangee() {
  feuille.value = null;
  lignes.value = [];
  await chargerEvaluations();
}

async function choisir(e: Evaluation) {
  chargementFeuille.value = true;
  try {
    const { data } = await api.get(`/notes/evaluation/${e.id}`);
    feuille.value = data;
    lignes.value = data.lignes.map((l: any) => ({ ...l, saisie: l.note }));
    router.replace({ path: '/notes', query: { evaluation: e.id } });
  } finally {
    chargementFeuille.value = false;
  }
}

async function enregistrer() {
  if (!feuille.value) return;
  enregistrement.value = true;
  try {
    const { data } = await api.put('/notes/saisie', {
      evaluationId: feuille.value.evaluation.id,
      notes: lignes.value.map((l) => ({
        inscriptionId: l.inscriptionId,
        note: l.saisie,
        present: l.present,
      })),
    });
    $q.notify({
      type: 'positive',
      message: `${data.n} note${data.n > 1 ? 's' : ''} enregistrée${data.n > 1 ? 's' : ''}${data.ignorees ? ` · ${data.ignorees} ignorée${data.ignorees > 1 ? 's' : ''}` : ''}`,
    });
    if (feuille.value) await choisir(feuille.value.evaluation);
  } finally {
    enregistrement.value = false;
  }
}

function cloturer() {
  if (!feuille.value) return;
  const e = feuille.value.evaluation;
  $q.dialog({
    title: 'Clôturer l’évaluation',
    message: `Clôturer « ${e.intitule} » ? Les notes deviennent définitives et un recalage de délibération les prendra en compte.`,
    cancel: true,
    ok: { color: 'primary', label: 'Clôturer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    await api.post(`/evaluations/${e.id}/cloturer`);
    const id = e.id;
    feuille.value = null;
    lignes.value = [];
    await chargerEvaluations();
    const maj = evaluations.value.find((x) => x.id === id);
    if (maj) await choisir(maj);
  });
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

  const demande = route.query.evaluation as string | undefined;
  if (demande) {
    const { data } = await api.get(`/notes/evaluation/${demande}`);
    if (data?.evaluation) {
      selAnneeId.value = data.evaluation.anneeId;
      selPromotionId.value = data.evaluation.promotionId;
      selMatiereId.value = data.evaluation.matiereId;
      await chargerEvaluations();
      await choisir(data.evaluation);
    }
  }
});
</script>