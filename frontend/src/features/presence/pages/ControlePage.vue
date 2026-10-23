<template>
  <q-page class="tournee">
    <bandeau-tournee
      v-model:date="date"
      :jour-lisible="jourLisible"
      :nom-controleur="auth.nomComplet"
      :restantes="restantes"
      :total="total"
      :pointees="pointees"
      :absences="absences"
    />

    <!-- Le tri ne précède pas la tournée : il se déplie quand on le demande -->
    <div class="barre-tri">
      <q-btn
        flat
        dense
        no-caps
        :icon="triOuvert ? 'expand_less' : 'tune'"
        :label="etiquetteTri"
        class="barre-tri__bouton"
        @click="triOuvert = !triOuvert"
      />
      <span v-if="recherche || filtreEtat !== 'toutes'" class="pochoir barre-tri__actif">
        {{ seancesFiltrees.length }}
        {{ seancesFiltrees.length > 1 ? $t('controle.sort.activePlural') : $t('controle.sort.activeSingular') }}
      </span>

      <q-btn
        flat
        dense
        no-caps
        icon="query_stats"
        :label="$t('controle.sort.releves')"
        class="barre-tri__releves"
        :to="lienStatistiques"
      >
        <q-tooltip>{{ $t('controle.sort.relevesTooltip') }}</q-tooltip>
      </q-btn>
    </div>

    <div v-if="triOuvert" class="filtres">
      <q-input
        v-model="recherche"
        outlined
        dense
        clearable
        :placeholder="$t('controle.filters.searchPlaceholder')"
        class="filtres__recherche"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <div class="filtres__etat" role="group" :aria-label="$t('controle.filters.ariaGroup')">
        <button
          v-for="f in filtres"
          :key="f.value"
          class="pochoir bouton-filtre"
          :class="{ 'bouton-filtre--actif': filtreEtat === f.value }"
          type="button"
          @click="filtreEtat = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <q-banner v-if="!pointages.enLigne" class="hors-ligne">
      <template #avatar><q-icon name="cloud_off" size="24px" /></template>
      {{ $t('controle.offline.message') }}
      <q-chip v-if="pointages.enAttente > 0" color="warning" icon="cloud_sync" text-color="dark" class="q-ml-md">
        {{ $t('controle.offline.pending', { n: pointages.enAttente }) }}
      </q-chip>
    </q-banner>

    <!-- Le panneau : une plaque par séance, dans l'ordre des heures -->
    <div v-if="chargement" class="etat-vide">
      <q-spinner-tail size="34px" />
      <p class="pochoir">{{ $t('controle.loading') }}</p>
    </div>

    <div v-else-if="!seancesFiltrees.length" class="etat-vide">
      <q-icon name="event_busy" size="42px" />
      <span class="lettrage etat-vide__titre">{{ $t('controle.emptyState.title') }}</span>
      <span class="pochoir etat-vide__mention">
        {{ seances.length ? $t('controle.emptyState.noneMatchFilter') : $t('controle.emptyState.noneScheduled') }}
      </span>
      <div class="etat-vide__actions">
        <q-btn
          v-if="filtreEtat !== 'toutes' || recherche"
          outline
          no-caps
          icon="filter_alt_off"
          :label="$t('common.actions.clearFilters')"
          @click="((filtreEtat = 'toutes'), (recherche = ''))"
        />
        <template v-else>
          <q-btn
            outline
            no-caps
            icon="calendar_month"
            :label="$t('controle.emptyState.viewSchedule')"
            to="/emploi-du-temps"
          />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add_box"
            :label="$t('controle.emptyState.openUnscheduled')"
            @click="ouvrirSeanceNonProgrammee"
          />
        </template>
      </div>
    </div>

    <panneau-tournee v-else :seances="seancesFiltrees" :date="date" @pointer="ouvrirPointage" />

    <fin-tournee
      v-if="seancesFiltrees.length"
      :restantes="restantes"
      :pointees="pointees"
      :total="total"
      :jour-lisible="jourLisible"
      :lien-registre-jour="lienRegistreJour"
      @imprimer="imprimerRegistre"
    />

    <!-- Cible du pouce : toujours atteignable, même quand la tournée est finie -->
    <q-page-sticky position="bottom-right" :offset="[16, 20]">
      <q-btn fab icon="add" color="primary" :aria-label="$t('controle.fab.aria')" @click="ouvrirSeanceNonProgrammee">
        <q-tooltip anchor="center left" self="center right">{{ $t('controle.fab.tooltip') }}</q-tooltip>
      </q-btn>
    </q-page-sticky>

    <div class="q-pa-md">
      <q-btn
        outline
        no-caps
        icon="offline_pin"
        :label="$t('dashboard.actions.prepareRound')"
        :loading="preparationEnCours"
        @click="preparerTournee"
      />
    </div>

    <dialogue-seance v-model="dialogSeance" :salles="salles" :date-imposee="date" @enregistre="apresCreation" />

    <dialogue-pointage v-model="dialogOuvert" :seance="seanceSelectionnee" @enregistre="charger" />
  </q-page>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isAxiosError } from 'axios';

import { usePointagesStore } from '@/stores/pointages';
import { useSeancesStore } from '@/stores/seances';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialoguePointage from '../components/DialoguePointage.vue';
import DialogueSeance from '../components/DialogueSeance.vue';
import BandeauTournee from '../components/BandeauTournee.vue';
import PanneauTournee from '../components/PanneauTournee.vue';
import FinTournee from '../components/FinTournee.vue';
import { cleTourneePreparee } from '@/shared/services/cles-stockage';
import { affectationsService } from '../services/affectations';
import { seancesService } from '../services/seances';
import { verifierServeur } from '../services/systeme';
import { aujourdhui, decalerJours } from '@/shared/utils/libelles';
import type { Salle, Seance } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { getAppLocale } from '@/boot/i18n';

const $q = useQuasar();
const pointages = usePointagesStore();
const seancesHorsLigne = useSeancesStore();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { t } = useI18n();

const preparationEnCours = ref(false);
async function preparerTournee() {
  if (!navigator.onLine || !navigator.serviceWorker?.controller || !auth.utilisateur?.id) {
    $q.notify({ type: 'warning', message: t('dashboard.actions.prepareRequiresNetwork') });
    return;
  }
  preparationEnCours.value = true;
  try {
    await verifierServeur();
    // `salles(true)` : la tournée doit repasser par le réseau, pas par le cache.
    const [, salles, affectations] = await Promise.all([
      seancesService.journee(date.value),
      referentiels.salles(true),
      affectationsService.toutes(),
    ]);
    seancesHorsLigne.enregistrerAffectations(affectations.data ?? []);
    seancesHorsLigne.enregistrerSalles(salles);
    localStorage.setItem(
      cleTourneePreparee(auth.utilisateur.id),
      JSON.stringify({ date: date.value, prepareeLe: new Date().toISOString() }),
    );
    $q.notify({ type: 'positive', message: t('dashboard.actions.roundPrepared') });
  } catch (e) {
    // Les erreurs de l'API sont notifiées par l'intercepteur ; reste le stockage local.
    if (!isAxiosError(e)) {
      $q.notify({ type: 'negative', message: t('dashboard.actions.prepareFailed') });
    }
  } finally {
    preparationEnCours.value = false;
  }
}

const date = ref(aujourdhui());
const seances = ref<Seance[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtreEtat = ref<'toutes' | 'attente' | 'faites'>('toutes');
const dialogOuvert = ref(false);
const dialogSeance = ref(false);
const salles = ref<Salle[]>([]);
const seanceSelectionnee = ref<Seance | null>(null);

const filtres = computed(() => [
  { label: t('controle.sort.filters.toutes'), value: 'toutes' as const },
  { label: t('controle.sort.filters.attente'), value: 'attente' as const },
  { label: t('controle.sort.filters.faites'), value: 'faites' as const },
]);

/** Les deux lectures voisines de la tournée, cadrées sur le jour affiché. */
const lienRegistreJour = computed(() => ({
  name: 'seances',
  query: { dateDebut: date.value, dateFin: date.value },
}));

const lienStatistiques = computed(() => ({
  name: 'statistiques',
  query: { dateDebut: decalerJours(date.value, -29), dateFin: date.value },
}));

const jourLisible = computed(() =>
  new Date(`${date.value}T12:00:00`).toLocaleDateString(getAppLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
);

const tenues = computed(() => seances.value.filter((s) => s.statut !== 'ANNULE'));
const total = computed(() => tenues.value.length);
const pointees = computed(() => tenues.value.filter((s) => s.controle).length);
const restantes = computed(() => total.value - pointees.value);
const absences = computed(() => tenues.value.filter((s) => s.controle?.statut === 'ABSENT').length);

const triOuvert = ref(false);

const etiquetteTri = computed(() => {
  if (triOuvert.value) return t('controle.sort.hide');
  const actif = filtres.value.find((f) => f.value === filtreEtat.value);
  return filtreEtat.value === 'toutes' && !recherche.value
    ? t('controle.sort.search')
    : t('controle.sort.filterLabel', { label: actif?.label ?? '' }) +
        (recherche.value ? t('controle.sort.filterRechercheSuffix') : '');
});

const seancesFiltrees = computed(() => {
  const q = (recherche.value ?? '').toLowerCase();
  return seances.value.filter((s) => {
    if (filtreEtat.value === 'attente' && s.controle) return false;
    if (filtreEtat.value === 'faites' && !s.controle) return false;
    if (!q) return true;
    return [
      s.affectation?.enseignant?.nom,
      s.affectation?.enseignant?.prenom,
      s.affectation?.matiere?.intitule,
      s.affectation?.promotion?.nom,
      s.salle?.code,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
});

function ouvrirPointage(s: Seance) {
  seanceSelectionnee.value = s;
  dialogOuvert.value = true;
}

function ouvrirSeanceNonProgrammee() {
  dialogSeance.value = true;
}

/**
 * Une séance ouverte à la main n'a d'intérêt que pointée : on enchaîne
 * directement sur la fiche, sans faire chercher la nouvelle plaque.
 */
async function apresCreation(creee: Seance) {
  await charger();
  const complete = seances.value.find((s) => s.id === creee?.id);
  if (complete) ouvrirPointage(complete);
}

function imprimerRegistre() {
  void ouvrirImpression('/impression/registre', { date: date.value });
}

async function charger() {
  chargement.value = true;
  try {
    const journee = await seancesService.journee(date.value);
    const combinees = new Map<string, Seance>();
    for (const seance of journee.seances ?? []) combinees.set(seance.id, seance);
    for (const seance of seancesHorsLigne.pourDate(date.value)) combinees.set(seance.id, seance);
    seances.value = [...combinees.values()];
  } catch (e) {
    const locales = seancesHorsLigne.pourDate(date.value);
    if (!locales.length) throw e;
    seances.value = locales;
  } finally {
    chargement.value = false;
  }
}

watch(date, charger);

onMounted(async () => {
  try {
    await charger();
  } catch {
    seances.value = seancesHorsLigne.pourDate(date.value);
  }
  // Les salles servent au formulaire de séance non programmée.
  try {
    salles.value = await referentiels.salles();
    seancesHorsLigne.enregistrerSalles(salles.value);
  } catch {
    salles.value = seancesHorsLigne.sallesCache;
  }
});
</script>

<style scoped lang="scss">
.tournee {
  padding-bottom: 96px;
}

// ------------------------------------------------------------- filtres
.barre-tri {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-2);
  padding: 0 var(--up-3);
  border-bottom: var(--up-filet);
  min-height: 46px;
}

.barre-tri__bouton {
  color: var(--up-encre);
}

.barre-tri__actif {
  color: var(--up-encre-douce);
}

.barre-tri__releves {
  margin-left: auto;
  color: var(--up-encre);
}

.filtres {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-3);
  flex-wrap: wrap;
  border-bottom: var(--up-filet);
}

.filtres__recherche {
  flex: 1 1 220px;
}

.filtres__etat {
  display: flex;
}

.bouton-filtre {
  appearance: none;
  background: var(--up-plaque);
  color: var(--up-encre);
  border: var(--up-filet);
  padding: 10px 12px;
  min-height: 44px;
  cursor: pointer;
  transition:
    background var(--up-transition),
    color var(--up-transition);

  & + & {
    border-left-width: 0;
  }

  &--actif {
    background: var(--up-plaque);
    color: var(--up-encre);
    box-shadow: var(--up-ombre-1);
  }
}

.hors-ligne {
  margin: var(--up-3) var(--up-3) 0;
  background: $jaune-fond;
  color: $jaune-texte;
  border: 0;
  border-radius: var(--up-rayon);
  font-weight: 500;
}

// --------------------------------------------------------------- vides

.etat-vide__titre {
  font-size: 1.3rem;
  color: var(--up-encre);
}

.etat-vide__mention {
  max-width: 42ch;
}

.etat-vide__actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-3);
}

// Sur grand écran le panneau garde une largeur de lecture : deux colonnes de
// plaques, pas une bande étirée sur 1 800 px.
@media (min-width: 1024px) {
  .barre-tri,
  .filtres {
    padding-inline: var(--up-4);
  }
}</style>
