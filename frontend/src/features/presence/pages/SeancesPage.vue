<template>
  <q-page class="registre">
    <en-tete-page :title="$t('common.fields.sessions')" :subtitle="$t('seances.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutAffecterControleur"
          outline
          no-caps
          icon="route"
          :label="$t('seances.actions.assignRound')"
          @click="dialogTournee = true"
        />
        <q-btn
          v-if="auth.peutPointer || auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add_box"
          :label="auth.peutPointer ? $t('seances.actions.newUnscheduled') : $t('seances.actions.newAdHoc')"
          @click="ouvrirSeance(null)"
        />
        <q-btn outline no-caps icon="print" :label="$t('common.actions.print')" @click="imprimer" />
      </template>
    </en-tete-page>

    <!-- Période : les trois lectures courantes en un geste -->
    <div class="registre__periode">
      <div class="registre__raccourcis">
        <button
          v-for="r in raccourcis"
          :key="r.id"
          type="button"
          class="pochoir raccourci"
          :class="{ 'raccourci--actif': raccourciActif === r.id }"
          @click="appliquer(r)"
        >
          {{ r.label }}
        </button>
      </div>

      <champ-date v-model="filtres.dateDebut" :label="$t('common.actions.from')" style="width: 148px" />
      <champ-date v-model="filtres.dateFin" :label="$t('common.actions.to')" style="width: 148px" />

      <q-btn
        flat
        dense
        no-caps
        :icon="filtresOuverts ? 'expand_less' : 'tune'"
        :label="etiquetteFiltres"
        @click="filtresOuverts = !filtresOuverts"
      />
      <q-btn
        round
        color="primary"
        icon="refresh"
        :aria-label="$t('seances.actions.reloadAria')"
        :loading="chargement"
        @click="charger"
      >
        <q-tooltip>{{ $t('common.actions.reload') }}</q-tooltip>
      </q-btn>
    </div>

    <div v-if="filtresOuverts" class="registre__filtres">
      <q-input v-model="recherche" outlined dense clearable :label="$t('seances.filters.search')">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-select
        v-model="filtres.enseignantId"
        :options="optionsEnseignants"
        outlined
        dense
        clearable
        emit-value
        map-options
        use-input
        :label="$t('common.fields.teacher')"
        @filter="filtrerEnseignants"
      />
      <q-select
        v-model="filtres.salleId"
        :options="optionsSalles"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('common.fields.room')"
      />
      <q-select
        v-model="filtres.statut"
        :options="optionsStatuts"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('seances.filters.status')"
      />
      <q-toggle v-model="seulementAPointer" :label="$t('seances.filters.onlyUnchecked')" />
    </div>

    <releve-seances
      :total="seancesFiltrees.length"
      :controlees="compte.controlees"
      :absences="compte.absences"
      :sans-controle="compte.sansControle"
    />

    <q-inner-loading :showing="chargement" />

    <div v-if="!chargement && !seancesFiltrees.length" class="registre__vide">
      <q-icon name="event_busy" size="42px" />
      <span class="lettrage registre__vide-titre">{{ $t('seances.emptyState.title') }}</span>
      <span class="pochoir">
        {{ filtresActifs ? $t('seances.emptyState.filtered') : $t('seances.emptyState.default') }}
      </span>
      <div class="registre__vide-actions">
        <q-btn
          v-if="filtresActifs"
          outline
          no-caps
          icon="filter_alt_off"
          :label="$t('seances.emptyState.removeFilters')"
          @click="reinitialiserFiltres"
        />
        <q-btn
          v-else
          outline
          no-caps
          icon="date_range"
          :label="$t('seances.emptyState.expand30')"
          @click="elargirA30Jours"
        />
        <q-btn
          v-if="auth.peutPlanifier"
          outline
          no-caps
          icon="calendar_month"
          :label="$t('nav.emploi-du-temps')"
          to="/emploi-du-temps"
        />
      </div>
    </div>

    <!-- Vue tableau : pour comparer et trier, quand la lecture par jour ne
         suffit plus (recherche d'une salle, d'un enseignant, tri par état). -->
    <tableau-seances
      v-if="vue === 'tableau' && seancesFiltrees.length"
      :seances="seancesFiltrees"
      :chargement="chargement"
      :peut-pointer="auth.peutPointer"
      @detail="detail = $event"
      @pointer="ouvrirPointage"
    />

    <journee-seances
      v-if="vue === 'cartes'"
      :seances="seancesFiltrees"
      :peut-pointer="auth.peutPointer"
      :peut-planifier="auth.peutPlanifier"
      @detail="detail = $event"
      @pointer="ouvrirPointage"
      @annuler="annuler"
    />

    <dialogue-seance v-model="dialogSeance" :seance="seanceEditee" :salles="salles" @enregistre="apresCreation" />
    <dialogue-pointage v-model="dialogPointage" :seance="seanceSelectionnee" @enregistre="charger" />

    <!-- Détail du contrôle consigné -->
    <dialogue-detail-seance
      :seance="detail"
      :peut-affecter-controleur="peutAffecterControleur"
      :peut-pointer="auth.peutPointer"
      @update:seance="detail = $event"
      @affecter-controleur="ouvrirAffectationControleur"
      @pointer="depuisDetail"
      @filtrer="filtrerDepuisDetail"
    />

    <dialogue-affectation-controleur
      v-model="dialogAffectationControleur"
      :seance="seanceAffectee"
      @enregistre="apresAffectation"
    />

    <dialogue-tournee
      v-model="dialogTournee"
      :date-debut="filtres.dateDebut"
      :date-fin="filtres.dateFin"
      @enregistre="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueSeance from '../components/DialogueSeance.vue';
import DialoguePointage from '../components/DialoguePointage.vue';
import DialogueDetailSeance from '../components/DialogueDetailSeance.vue';
import DialogueAffectationControleur from '../components/DialogueAffectationControleur.vue';
import DialogueTournee from '../components/DialogueTournee.vue';
import TableauSeances from '../components/TableauSeances.vue';
import JourneeSeances from '../components/JourneeSeances.vue';
import ReleveSeances from '../components/ReleveSeances.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { LIBELLE_STATUT_SEANCE, aujourdhui, dateLisible, decalerJours } from '@/shared/utils/libelles';
import type { Enseignant, Salle, Seance } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { seancesService } from '../services/seances';

const $q = useQuasar();
const route = useRoute();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { confirmerAvecSaisie } = useConfirmation();
const peutAffecterControleur = computed(() => auth.peut('seances.affecterControleur'));
const vue = usePresentationListe();
const { t } = useI18n();

const seances = ref<Seance[]>([]);
const salles = ref<Salle[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtresOuverts = ref(false);
const seulementAPointer = ref(false);
const detail = ref<Seance | null>(null);
const dialogSeance = ref(false);
const dialogPointage = ref(false);
const seanceEditee = ref<Seance | null>(null);
const seanceSelectionnee = ref<Seance | null>(null);
const seanceAffectee = ref<Seance | null>(null);
const dialogAffectationControleur = ref(false);
const dialogTournee = ref(false);
const raccourciActif = ref('sevenDays');

const filtres = ref({
  dateDebut: decalerJours(aujourdhui(), -6),
  dateFin: aujourdhui(),
  enseignantId: null as string | null,
  statut: null as string | null,
  salleId: null as string | null,
});

const raccourcis = computed(() => [
  { id: 'today', label: t('seances.period.shortcuts.today'), debut: 0, fin: 0 },
  { id: 'sevenDays', label: t('seances.period.shortcuts.sevenDays'), debut: -6, fin: 0 },
  { id: 'thirtyDays', label: t('seances.period.shortcuts.thirtyDays'), debut: -29, fin: 0 },
  { id: 'upcoming', label: t('seances.period.shortcuts.upcoming'), debut: 1, fin: 14 },
]);

/** Les états de séance viennent du référentiel partagé, jamais d'une liste locale. */
const optionsStatuts = Object.entries(LIBELLE_STATUT_SEANCE).map(([value, label]) => ({
  label,
  value,
}));

const optionsSalles = computed(() => salles.value.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })));

const etiquetteFiltres = computed(() => {
  const actifs = [
    filtres.value.enseignantId && t('seances.filters.activeTeacher'),
    filtres.value.salleId && t('seances.filters.activeRoom'),
    filtres.value.statut && t('seances.filters.activeStatus'),
    recherche.value && t('seances.filters.activeSearch'),
    seulementAPointer.value && t('seances.filters.activeUnchecked'),
  ].filter(Boolean);
  return actifs.length ? t('seances.filters.labelActive', { list: actifs.join(', ') }) : t('seances.filters.label');
});

const filtresActifs = computed(
  () =>
    !!filtres.value.enseignantId ||
    !!filtres.value.salleId ||
    !!filtres.value.statut ||
    !!recherche.value ||
    seulementAPointer.value,
);

/** Le vide le plus courant vient d'une fenêtre trop courte : on l'élargit. */
function elargirA30Jours() {
  const trente = raccourcis.value.find((r) => r.id === 'thirtyDays');
  if (trente) appliquer(trente);
}

function reinitialiserFiltres() {
  recherche.value = '';
  seulementAPointer.value = false;
  filtres.value = { ...filtres.value, enseignantId: null, salleId: null, statut: null };
}

const seancesFiltrees = computed(() => {
  const q = (recherche.value ?? '').toLowerCase();
  return seances.value.filter((s) => {
    if (seulementAPointer.value && s.controle) return false;
    if (!q) return true;
    return [
      s.affectation?.enseignant?.nom,
      s.affectation?.enseignant?.prenom,
      s.affectation?.matiere?.intitule,
      s.affectation?.promotion?.nom,
      s.salle?.code,
      s.thematique,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
});

const compte = computed(() => {
  const tenues = seancesFiltrees.value.filter((s) => s.statut !== 'ANNULE');
  return {
    controlees: tenues.filter((s) => s.controle).length,
    absences: tenues.filter((s) => s.controle?.statut === 'ABSENT').length,
    sansControle: tenues.filter((s) => !s.controle).length,
  };
});

function appliquer(r: (typeof raccourcis.value)[number]) {
  raccourciActif.value = r.id;
  filtres.value = {
    ...filtres.value,
    dateDebut: decalerJours(aujourdhui(), r.debut),
    dateFin: decalerJours(aujourdhui(), r.fin),
  };
}

function ouvrirSeance(s: Seance | null) {
  seanceEditee.value = s;
  dialogSeance.value = true;
}

function ouvrirPointage(s: Seance) {
  seanceSelectionnee.value = s;
  dialogPointage.value = true;
}

function ouvrirAffectationControleur(seance: Seance) {
  seanceAffectee.value = seance;
  dialogAffectationControleur.value = true;
}

/** Rebondir depuis une séance vers la même lecture, élargie à un enseignant
 *  ou à une salle : la fiche se ferme, le registre se recadre. */
function filtrerDepuisDetail(cle: 'enseignantId' | 'salleId', valeur: string) {
  detail.value = null;
  filtresOuverts.value = true;
  filtres.value = { ...filtres.value, [cle]: valeur };
}

function depuisDetail(s: Seance) {
  detail.value = null;
  ouvrirPointage(s);
}

/** Une séance ouverte à la main enchaîne sur son pointage. */
async function apresCreation(creee: Seance) {
  await charger();
  const complete = seances.value.find((s) => s.id === creee?.id);
  if (complete) ouvrirPointage(complete);
}

/** Le contrôleur a été affecté : le registre doit refléter la nouvelle affectation. */
async function apresAffectation() {
  detail.value = null;
  await charger();
}

async function annuler(s: Seance) {
  const motif = await confirmerAvecSaisie({
    titre: t('seances.dialogs.cancelTitle'),
    message:
      t('seances.dialogs.cancelMessagePrefix', { date: dateLisible(s.date), heure: s.heureDebut }) +
      t('seances.dialogs.cancelMessageSuffix'),
    ok: t('seances.dialogs.cancelConfirm'),
    couleur: 'negative',
    libelleAnnuler: t('seances.dialogs.cancelDismiss'),
  });
  if (motif === null) return;
  await seancesService.annuler(s.id, motif);
  $q.notify({ type: 'positive', message: t('seances.messages.cancelled') });
  await charger();
}

function imprimer() {
  void ouvrirImpression('/impression/registre', {
    dateDebut: filtres.value.dateDebut,
    dateFin: filtres.value.dateFin,
  });
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom}`, value: e.id }));
  });
}

async function charger() {
  chargement.value = true;
  try {
    const page = await seancesService.liste({
      dateDebut: filtres.value.dateDebut,
      dateFin: filtres.value.dateFin,
      enseignantId: filtres.value.enseignantId || undefined,
      statut: filtres.value.statut || undefined,
      salleId: filtres.value.salleId || undefined,
      pageSize: 500,
      sort: 'date',
      order: 'desc',
    });
    seances.value = page.data;
  } finally {
    chargement.value = false;
  }
}

/**
 * Le registre est la destination des liens du tableau de bord et des relevés :
 * il accepte donc la même période et les mêmes clés de filtre en paramètres.
 */
function appliquerParametresUrl() {
  const q = route.query;
  const lire = (cle: string) => (q[cle] ? String(q[cle]) : null);
  const debut = lire('dateDebut');
  const fin = lire('dateFin');
  const enseignantId = lire('enseignantId');
  const salleId = lire('salleId');
  const statut = lire('statut');

  if (!debut && !fin && !enseignantId && !salleId && !statut) return;

  raccourciActif.value = '';
  filtres.value = {
    dateDebut: debut ?? filtres.value.dateDebut,
    dateFin: fin ?? filtres.value.dateFin,
    enseignantId,
    salleId,
    statut,
  };
  // Les filtres arrivés par l'URL doivent se voir : sinon on lit un registre
  // restreint sans savoir pourquoi.
  filtresOuverts.value = !!(enseignantId || salleId || statut);
}

// Appliqué avant l'observateur : l'arrivée par lien ne déclenche qu'un chargement.
appliquerParametresUrl();
watch(filtres, charger, { deep: true });

onMounted(async () => {
  await charger();
  // Les référentiels n'alimentent que des listes déroulantes : ils ne doivent
  // pas retarder l'affichage du registre.
  [salles.value, enseignants.value] = await Promise.all([referentiels.salles(), referentiels.enseignants()]);
});
</script>

<style scoped lang="scss">
.registre {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.registre__periode {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  flex-wrap: wrap;
  padding-bottom: var(--up-3);
  border-bottom: var(--up-filet);
}

// La gouttière du segmented control ; le reste vient de la règle globale
// `.raccourci` d'app.scss, partagée avec l'écran des statistiques.
.registre__raccourcis {
  display: flex;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon);
  padding: 3px;
  gap: 2px;
}

.registre__filtres {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--up-3);
  align-items: center;
  padding: var(--up-3) 0;
  border-bottom: var(--up-filet);
}

.registre__vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-6) var(--up-3);
  color: var(--up-encre-douce);
  text-align: center;
}

.registre__vide-titre {
  font-size: 1.3rem;
  color: var(--up-encre);
}

.registre__vide-actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-3);
}
</style>
