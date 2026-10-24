<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('evaluations.title')" :subtitle="$t('evaluations.subtitle')">
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
    </en-tete-page>

    <barre-filtres
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
          :label="$t('common.fields.academicYear')"
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
        <champ-recherche
          v-model="filtres.matiereId"
          endpoint="/matieres"
          :label="$t('common.fields.subject')"
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
    </barre-filtres>

    <evaluations-tableau
      v-if="modeVue === 'tableau'"
      :lignes="ev.lignes"
      :chargement="ev.chargement"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :peut-gerer="peutGererEvaluation()"
      :peut-saisir="peutSaisirNotes()"
      @voir-notes="voirNotes"
      @saisir-notes="saisirNotes"
      @cloturer="cloturer"
      @modifier="ouvrir"
      @supprimer="supprimer"
      @creer="ouvrir(null)"
      @reinitialiser="reinitialiser"
    />

    <q-linear-progress v-if="modeVue === 'cartes' && ev.chargement" indeterminate color="primary" class="q-mb-sm" />

    <evaluations-cartes-panel
      v-else-if="modeVue === 'cartes'"
      :lignes="ev.lignes"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :peut-gerer="peutGererEvaluation()"
      :peut-saisir="peutSaisirNotes()"
      @voir-notes="voirNotes"
      @saisir-notes="saisirNotes"
      @cloturer="cloturer"
      @modifier="ouvrir"
      @supprimer="supprimer"
      @creer="ouvrir(null)"
      @reinitialiser="reinitialiser"
    />

    <barre-pagination
      v-if="ev.lignes.length"
      v-model:page="ev.page"
      v-model:page-size="ev.pageSize"
      :total="ev.total"
      @tous="ev.toutAfficher()"
    />

    <dialogue-evaluation
      v-model="dialogOuvert"
      :evaluation="evaluationEditee"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="ev.recharger()"
    />

    <evaluations-notes-dialog
      v-model="dialogNotes"
      :evaluation="evaluationSelectionnee"
      :lignes="notesConsultation"
      :chargement="chargementNotes"
      :peut-saisir="peutSaisirNotes()"
      @saisir="saisirDepuisConsultation"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueEvaluation from '../components/DialogueEvaluation.vue';
import EvaluationsTableau from '../components/EvaluationsTableau.vue';
import EvaluationsCartesPanel from '../components/EvaluationsCartesPanel.vue';
import EvaluationsNotesDialog from '../components/EvaluationsNotesDialog.vue';
import { evaluationsService } from '../services/evaluations';
import type { LigneEvaluation } from '../services/evaluations';
import { LIBELLE_STATUT_EVALUATION, LIBELLE_TYPE_EVALUATION } from '@/shared/utils/libelles';
import type {
  AnneeAcademique,
  Evaluation,
  Matiere,
  Promotion,
  StatutEvaluation,
  TypeEvaluation,
  ChipFiltre,
  FiltresPage,
} from '@/types';

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
const peutGererEvaluation = () => auth.peut('evaluations.gerer');
const peutSaisirNotes = () => auth.peut('notes.saisir');

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const dialogOuvert = ref(false);
const evaluationEditee = ref<Evaluation | null>(null);
const modeVue = usePresentationListe();

const FILTRES_VIDES = { recherche: '', anneeId: null, promotionId: null, matiereId: null, type: null, statut: null };
const filtres = ref<FiltresPage>({ ...FILTRES_VIDES });
// `/evaluations?promotion=…` : arrivée depuis la fiche d'un étudiant.
if (typeof route.query.promotion === 'string' && route.query.promotion) {
  filtres.value.promotionId = route.query.promotion;
}

const ev = reactive(
  useListePaginee<Evaluation>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      evaluationsService.liste({
        ...pageApi(p),
        anneeId: f.anneeId || undefined,
        promotionId: f.promotionId || undefined,
        matiereId: f.matiereId || undefined,
        type: f.type || undefined,
        statut: f.statut || undefined,
        search: texteApi(f.recherche),
      }),
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
    cs.push({
      label: t('evaluations.chips.year', { v: a?.libelle ?? '?' }),
      value: filtres.value.anneeId,
      icone: 'calendar_today',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('evaluations.chips.promotion', { v: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  if (filtres.value.matiereId) {
    const m = matieres.value.find((x) => x.id === filtres.value.matiereId);
    cs.push({
      label: t('evaluations.chips.subject', { v: m?.code ?? '?' }),
      value: filtres.value.matiereId,
      icone: 'menu_book',
    });
  }
  if (filtres.value.type) {
    cs.push({
      label: t('evaluations.chips.type', {
        v: LIBELLE_TYPE_EVALUATION[filtres.value.type as TypeEvaluation] ?? filtres.value.type,
      }),
      value: filtres.value.type,
      icone: 'category',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('evaluations.chips.status', {
        v: LIBELLE_STATUT_EVALUATION[filtres.value.statut as StatutEvaluation] ?? filtres.value.statut,
      }),
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
    ok: t('common.actions.closeOut'),
  });
  if (!ok) return;
  try {
    await evaluationsService.cloturer(e.id);
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
    ok: t('common.actions.delete'),
    succes: t('evaluations.messages.deleted'),
  });
}

// --- Consultation des notes ---------------------------------------------

const dialogNotes = ref(false);
const evaluationSelectionnee = ref<Evaluation | null>(null);
const notesConsultation = ref<LigneEvaluation[]>([]);
const chargementNotes = ref(false);

/**
 * Feuille de l'évaluation : le service rend déjà le tableau des inscrits
 * (lignes), jamais une enveloppe.
 */
async function voirNotes(e: Evaluation) {
  evaluationSelectionnee.value = e;
  dialogNotes.value = true;
  chargementNotes.value = true;
  try {
    const liste = await evaluationsService.etudiants(e.id);
    notesConsultation.value = (Array.isArray(liste) ? liste : []).map((l) => ({
      inscriptionId: l.inscriptionId ?? l.id ?? '',
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
