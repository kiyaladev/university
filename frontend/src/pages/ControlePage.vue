<template>
  <q-page class="tournee">
    <!-- Bandeau de tournée : l'état de la journée, lisible d'un coup d'œil -->
    <header class="bandeau">
      <div class="bandeau__titre">
        <div>
          <h1 class="lettrage bandeau__jour">{{ jourLisible }}</h1>
          <p class="pochoir bandeau__mention">{{ $t('controle.header.mention', { nom: auth.nomComplet }) }}</p>
        </div>
        <div class="bandeau__nav">
          <q-btn flat dense round icon="chevron_left" :aria-label="$t('controle.header.navPrev')" @click="date = decalerJours(date, -1)" />
          <q-btn flat dense no-caps icon="event" :label="date === aujourdhui() ? $t('controle.header.today') : $t('controle.header.otherDay')">
            <q-popup-proxy transition-show="scale" transition-hide="scale">
              <q-date v-model="date" mask="YYYY-MM-DD" minimal />
            </q-popup-proxy>
          </q-btn>
          <q-btn flat dense round icon="chevron_right" :aria-label="$t('controle.header.navNext')" @click="date = decalerJours(date, 1)" />
        </div>
      </div>

      <!-- Le seul chiffre qui commande la tournée : ce qui reste à faire -->
      <p class="reste">
        <span v-if="restantes" class="lettrage chiffres reste__valeur">{{ restantes }}</span>
        <span v-else-if="total" class="champ champ--present reste__cachet se-peint">
          <q-icon name="check" size="26px" />
        </span>

        <span class="reste__mot">
          <span class="lettrage reste__unite">
            <template v-if="restantes">
              {{ restantes > 1 ? $t('controle.remaining.roomsToVisitPlural') : $t('controle.remaining.roomsToVisitSingular') }}
            </template>
            <template v-else-if="total">{{ $t('controle.remaining.complete') }}</template>
            <template v-else>{{ $t('controle.remaining.none') }}</template>
          </span>
          <span v-if="total" class="pochoir pochoir--brut reste__detail chiffres">
            {{ pointees }} {{ pointees > 1 ? $t('controle.remaining.pointeePlural') : $t('controle.remaining.pointeeSingular') }} {{ $t('controle.remaining.outOf') }} {{ total }}
            <template v-if="absences"> · {{ absences }} {{ absences > 1 ? $t('controle.remaining.absencePlural') : $t('controle.remaining.absenceSingular') }}</template>
          </span>
        </span>
      </p>
    </header>

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
        {{ seancesFiltrees.length }} {{ seancesFiltrees.length > 1 ? $t('controle.sort.activePlural') : $t('controle.sort.activeSingular') }}
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
      <q-chip
        v-if="pointages.enAttente > 0"
        color="warning"
        icon="cloud_sync"
        text-color="dark"
        class="q-ml-md"
      >
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
        {{
          seances.length
            ? $t('controle.emptyState.noneMatchFilter')
            : $t('controle.emptyState.noneScheduled')
        }}
      </span>
      <div class="etat-vide__actions">
        <q-btn
          v-if="filtreEtat !== 'toutes' || recherche"
          outline
          no-caps
          icon="filter_alt_off"
          :label="$t('controle.emptyState.clearFilters')"
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

    <ol v-else class="panneau">
      <li v-for="s in seancesFiltrees" :key="s.id">
        <article class="plaque seance" :class="{ 'seance--en-cours': estEnCours(s), 'seance--annulee': s.statut === 'ANNULEE' }">
          <div class="champ seance__heure" :class="{ 'seance__heure--en-cours': estEnCours(s) }">
            <span class="lettrage chiffres seance__debut">{{ s.heureDebut }}</span>
            <span class="pochoir chiffres seance__fin">{{ s.heureFin }}</span>
            <span v-if="estEnCours(s)" class="pochoir seance__marque">{{ $t('controle.seance.inProgress') }}</span>
          </div>

          <div class="seance__corps">
            <h2 class="lettrage seance__enseignant">
              {{ s.affectation?.enseignant?.nom }} {{ s.affectation?.enseignant?.prenom }}
            </h2>
            <p class="seance__matiere">
              {{ s.affectation?.matiere?.intitule }}
              <span class="pochoir seance__type" :title="LIBELLE_TYPE_COURS[s.type]">{{ s.type }}</span>
            </p>
            <p class="pochoir seance__lieu">
              {{ s.affectation?.promotion?.nom }}
              <span v-if="s.salle" class="plaque-salle">{{ s.salle.code }}</span>
            </p>

            <p v-if="s.controle" class="pochoir pochoir--brut seance__constat chiffres">
              {{ s.controle.heureArrivee ?? '—' }} → {{ s.controle.heureFinReelle ?? '—' }}
              · {{ dureeLisible(s.controle.dureeMinutes) }}
              <span v-if="s.controle.effectifPresent">{{ $t('controle.seance.studentCount', { n: s.controle.effectifPresent }) }}</span>
            </p>
            <p v-if="s.controle" class="pochoir seance__preuves">
              <q-icon
                v-if="s.controle.attestation && s.controle.attestation !== 'AUCUNE'"
                :name="ICONE_ATTESTATION[s.controle.attestation]"
                size="15px"
              />
              {{ LIBELLE_ATTESTATION[s.controle.attestation ?? 'AUCUNE'] }}
              <q-icon v-if="s.controle.qrSalleValide" name="qr_code_2" size="15px" />
              <q-icon v-if="s.controle.latitude" name="my_location" size="15px" />
              <q-icon v-if="s.controle.horsLigne" name="cloud_off" size="15px" />
              · {{ s.controle.controleur?.prenom }} {{ s.controle.controleur?.nom }}
            </p>
          </div>

          <button
            v-if="s.statut !== 'ANNULEE'"
            type="button"
            class="champ seance__action se-peint"
            :class="s.controle ? `champ--${classeStatut(s.controle.statut)}` : 'seance__action--vierge'"
            @click="ouvrirPointage(s)"
          >
            <span v-if="s.controle" class="lettrage seance__verdict">
              {{ LIBELLE_STATUT_PRESENCE[s.controle.statut] }}
            </span>
            <span v-else class="lettrage seance__appel">{{ $t('controle.seance.pointer') }}</span>
            <span class="pochoir seance__sous-action">
              {{ s.controle ? $t('controle.seance.correct') : $t('controle.seance.room', { code: s.salle?.code ?? '—' }) }}
            </span>
          </button>

          <div v-else class="champ seance__action seance__action--annulee">
            <span class="lettrage seance__verdict">{{ $t('controle.seance.cancelled') }}</span>
          </div>
        </article>
      </li>
    </ol>

    <!-- Fin de tournée : le panneau se referme sur ce qui reste à faire -->
    <footer v-if="seancesFiltrees.length" class="plaque fin-tournee">
      <div>
        <p class="lettrage fin-tournee__titre">
          {{ restantes
            ? $t('controle.footer.titleRemaining', { n: restantes, room: restantes > 1 ? $t('controle.footer.roomPlural') : $t('controle.footer.roomSingular') })
            : $t('controle.footer.titleComplete') }}
        </p>
        <p class="pochoir pochoir--brut fin-tournee__detail">
          {{ $t('controle.footer.detail', { pointees, total, jour: jourLisible }) }}
        </p>
      </div>
      <div class="fin-tournee__actions">
        <q-btn flat no-caps icon="event_note" :label="$t('controle.footer.registre')" :to="lienRegistreJour" />
        <q-btn
          outline
          no-caps
          icon="print"
          :label="$t('controle.footer.imprimer')"
          @click="imprimerRegistre"
        />
      </div>
    </footer>

    <!-- Cible du pouce : toujours atteignable, même quand la tournée est finie -->
    <q-page-sticky position="bottom-right" :offset="[16, 20]">
      <q-btn
        fab
        icon="add"
        color="primary"
        :aria-label="$t('controle.fab.aria')"
        @click="ouvrirSeanceNonProgrammee"
      >
        <q-tooltip anchor="center left" self="center right">{{ $t('controle.fab.tooltip') }}</q-tooltip>
      </q-btn>
    </q-page-sticky>

    <div class="q-pa-md">
      <q-btn outline no-caps icon="offline_pin" :label="$t('dashboard.actions.prepareRound')"
        :loading="preparationEnCours" @click="preparerTournee" />
    </div>

    <seance-dialog
      v-model="dialogSeance"
      :salles="salles"
      :date-imposee="date"
      @enregistre="apresCreation"
    />

    <pointage-dialog v-model="dialogOuvert" :seance="seanceSelectionnee" @enregistre="charger" />
  </q-page>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isAxiosError } from 'axios';
import { api } from '../boot/axios';

import { usePointagesStore } from '../stores/pointages';
import { useSeancesStore } from '../stores/seances';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import PointageDialog from '../components/PointageDialog.vue';
import SeanceDialog from '../components/SeanceDialog.vue';
import {
  ICONE_ATTESTATION,
  LIBELLE_ATTESTATION,
  LIBELLE_STATUT_PRESENCE,
  LIBELLE_TYPE_COURS,
  aujourdhui,
  decalerJours,
  dureeLisible,
  maintenantHHmm,
} from '../utils/libelles';
import type { Salle, Seance } from '../types';
import { ouvrirImpression } from '../services/impression';
import { getAppLocale } from '../boot/i18n';

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
    await api.get('/health', { params: { _tournee: Date.now() } });
    // `salles(true)` : la tournée doit repasser par le réseau, pas par le cache.
    const [, salles, affectations] = await Promise.all([
      api.get('/seances/journee', { params: { date: date.value } }),
      referentiels.salles(true),
      api.get('/affectations', { params: { all: '1' } }),
    ]);
    seancesHorsLigne.enregistrerAffectations(affectations.data.data ?? []);
    seancesHorsLigne.enregistrerSalles(salles);
    localStorage.setItem(`unipresence_tournee_preparee_${auth.utilisateur.id}`, JSON.stringify({ date: date.value, prepareeLe: new Date().toISOString() }));
    $q.notify({ type: 'positive', message: t('dashboard.actions.roundPrepared') });
  } catch (e) {
    // Les erreurs de l'API sont notifiées par l'intercepteur ; reste le stockage local.
    if (!isAxiosError(e)) {
      $q.notify({ type: 'negative', message: t('dashboard.actions.prepareFailed') });
    }
  } finally { preparationEnCours.value = false; }
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

const tenues = computed(() => seances.value.filter((s) => s.statut !== 'ANNULEE'));
const total = computed(() => tenues.value.length);
const pointees = computed(() => tenues.value.filter((s) => s.controle).length);
const restantes = computed(() => total.value - pointees.value);
const absences = computed(
  () => tenues.value.filter((s) => s.controle?.statut === 'ABSENT').length,
);

const triOuvert = ref(false);

const etiquetteTri = computed(() => {
  if (triOuvert.value) return t('controle.sort.hide');
  const actif = filtres.value.find((f) => f.value === filtreEtat.value);
  return filtreEtat.value === 'toutes' && !recherche.value
    ? t('controle.sort.search')
    : t('controle.sort.filterLabel', { label: actif?.label ?? '' })
      + (recherche.value ? t('controle.sort.filterRechercheSuffix') : '');
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

const classeStatut = (statut: string) =>
  ({
    PRESENT: 'present',
    RETARD: 'retard',
    ABSENT: 'absent',
    EXCUSE: 'excuse',
    REMPLACE: 'remplace',
    DEPART_ANTICIPE: 'depart',
  })[statut] ?? 'attente';

/** Séance en cours à l'instant où le contrôleur regarde son panneau. */
function estEnCours(s: Seance) {
  if (date.value !== aujourdhui()) return false;
  const h = maintenantHHmm();
  return s.heureDebut <= h && h <= s.heureFin;
}

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
    const { data } = await api.get('/seances/journee', { params: { date: date.value } });
    const combinees = new Map<string, Seance>();
    for (const seance of data.seances ?? []) combinees.set(seance.id, seance);
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
  try { await charger(); } catch { seances.value = seancesHorsLigne.pourDate(date.value); }
  // Les salles servent au formulaire de séance non programmée.
  try {
    salles.value = await referentiels.salles();
    seancesHorsLigne.enregistrerSalles(salles.value);
  } catch { salles.value = seancesHorsLigne.sallesCache; }
});
</script>

<style scoped lang="scss">
.tournee {
  padding-bottom: 96px;
}

// ------------------------------------------------------------- bandeau
.bandeau {
  padding: var(--up-4) var(--up-3) 0;
}

.bandeau__titre {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.bandeau__jour {
  font-size: clamp(1.6rem, 1.2rem + 2vw, 2.4rem);
  color: var(--up-encre);
  &::first-letter { text-transform: uppercase; }
}

.bandeau__mention {
  color: var(--up-encre-douce);
  margin-top: 2px;
}

.bandeau__nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

// Le reste à faire : le chiffre que le contrôleur cherche en levant les yeux.
.reste {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  margin: var(--up-3) 0 0;
  padding: var(--up-3) 0 var(--up-4);
  border-top: var(--up-filet);
}

.reste__valeur {
  font-size: clamp(2.6rem, 2rem + 3.6vw, 4rem);
  color: var(--up-encre);
  line-height: 1;
}

// Tournée finie : un cachet, pas un zéro. Un « 0 » à côté de « complète » se
// contredit lui-même.
.reste__cachet {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  border: var(--up-filet);
}

.reste__mot { display: flex; flex-direction: column; gap: 3px; }

.reste__unite {
  font-size: clamp(1.05rem, 0.9rem + 1vw, 1.4rem);
  color: var(--up-encre);
}

.reste__detail { color: var(--up-encre-douce); }

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

.barre-tri__bouton { color: var(--up-encre); }

.barre-tri__actif { color: var(--up-encre-douce); }

.barre-tri__releves { margin-left: auto; color: var(--up-encre); }

.filtres {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-3);
  flex-wrap: wrap;
  border-bottom: var(--up-filet);
}

.filtres__recherche { flex: 1 1 220px; }

.filtres__etat { display: flex; }

.bouton-filtre {
  appearance: none;
  background: var(--up-plaque);
  color: var(--up-encre);
  border: var(--up-filet);
  padding: 10px 12px;
  min-height: 44px;
  cursor: pointer;
  transition: background var(--up-transition), color var(--up-transition);

  & + & { border-left-width: 0; }

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

// -------------------------------------------------------------- panneau
.panneau {
  list-style: none;
  margin: 0;
  padding: var(--up-3);
  display: grid;
  gap: var(--up-2);
}

.seance {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 116px;
  min-height: 104px;
  overflow: hidden;
}

.seance--annulee { opacity: 0.55; }

.seance__heure {
  flex-direction: column;
  gap: 2px;
  background: var(--up-chaux);
  color: var(--up-encre);
  padding: var(--up-2) var(--up-1);

  // La séance se déroule à l'instant : un liséré bleu, la couleur de ce qui est
  // actif — pas une couleur de statut qu'on lui volerait.
  &--en-cours { box-shadow: inset 0 0 0 2px #{$vert-action}; }
}

.seance__debut {
  font-size: 1.5rem;
  color: var(--up-encre);
}

.seance__fin {
  color: var(--up-encre-douce);
  &::before { content: '→ '; }
}

.seance__marque {
  margin-top: 2px;
  color: $jaune;
  border-top: var(--up-filet);
  padding-top: 2px;
}

.seance__corps {
  padding: var(--up-3);
  min-width: 0;
}

.seance__enseignant {
  font-size: 1.12rem;
  margin: 0;
}

.seance__matiere {
  margin: 3px 0 0;
  font-size: 0.94rem;
  color: var(--up-encre);
}

.seance__type {
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon-sm);
  color: var(--up-encre-douce);
  padding: 1px 6px;
  margin-left: 6px;
}

.seance__lieu {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.seance__constat,
.seance__preuves {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.seance__action {
  appearance: none;
  border: 0;
  border-left: var(--up-filet);
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  padding: var(--up-2);
  font: inherit;
  transition: filter var(--up-transition);

  &:hover { filter: brightness(1.08); }
  &:focus-visible { outline: 2px solid #{$vert-action}; outline-offset: -4px; }

  &--vierge {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
  }

  &--annulee {
    background: repeating-linear-gradient(
      -45deg,
      rgba(16, 37, 30, 0.13) 0 6px,
      transparent 6px 12px
    );
    color: var(--up-encre-douce);
    cursor: default;
  }
}

.seance__verdict,
.seance__appel {
  font-size: 1rem;
  line-height: 1.05;
}

.seance__sous-action {
  opacity: 1;
  font-size: 10px;
}

.fin-tournee {
  margin: 0 var(--up-3) var(--up-4);
  padding: var(--up-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.fin-tournee__titre { font-size: 1.15rem; margin: 0; }

.fin-tournee__detail {
  margin: 4px 0 0;
  color: var(--up-encre-douce);
  font-weight: 600;
}

.fin-tournee__actions {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  flex-wrap: wrap;
}

// --------------------------------------------------------------- vides

.etat-vide__titre { font-size: 1.3rem; color: var(--up-encre); }

.etat-vide__mention { max-width: 42ch; }

.etat-vide__actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-3);
}

// L'écran du contrôleur est un téléphone tenu à une main.
@media (max-width: 599px) {
  .seance {
    grid-template-columns: 76px minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .seance__heure { grid-row: 1 / span 2; }

  .seance__action {
    grid-column: 2;
    border-left: 0;
    border-top: var(--up-filet);
    flex-direction: row;
    gap: var(--up-2);
    min-height: 56px;
  }
}

// Sur grand écran le panneau garde une largeur de lecture : deux colonnes de
// plaques, pas une bande étirée sur 1 800 px.
@media (min-width: 1024px) {
  .panneau {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-inline: var(--up-4);
    max-width: 1180px;
  }

  .fin-tournee {
    max-width: 1180px;
    margin-inline: var(--up-4);
  }

  .bandeau,
  .barre-tri,
  .filtres { padding-inline: var(--up-4); }
}
</style>
