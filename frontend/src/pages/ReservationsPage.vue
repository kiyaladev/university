<template>
  <q-page class="resas">
    <page-header :title="$t('reservations.title')" :subtitle="$t('reservations.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutReserver"
          unelevated
          color="primary"
          no-caps
          icon="event_available"
          :label="$t('reservations.actions.reserve')"
          @click="dialogReservation = true"
        />
        <q-btn
          round
          color="primary"
          icon="refresh"
          :aria-label="$t('reservations.actions.reloadPeriod')"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>{{ $t('common.actions.reload') }}</q-tooltip>
        </q-btn>
      </template>
    </page-header>

    <!-- Filtres -->
    <filter-bar
      v-model="filtresReservations"
      :chips="chips"
      :recherche="false"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <autocomplete-async
          v-model="filtresReservations.salleId"
          endpoint="/salles"
          :label-fn="(s) => $t('reservations.filters.roomOption', { code: s.code, name: s.nom, capacity: s.capacite })"
          :label="$t('common.fields.room')"
        />
        <champ-date v-model="filtresReservations.dateDebut" :label="$t('common.actions.from')" />
        <champ-date v-model="filtresReservations.dateFin" :label="$t('common.actions.to')" />
      </template>
      <template #actions>
        <q-btn
          flat
          dense
          no-caps
          icon="today"
          :label="$t('reservations.actions.today')"
          @click="cadrerAujourdhui"
        />
        <q-btn flat dense no-caps icon="calendar_month" :label="$t('reservations.actions.thisMonth')" @click="cadrerLeMois" />
      </template>
    </filter-bar>

    <!-- Légende -->
    <div class="resas__legende">
      <span
        v-for="(lib, statut) in LEGENDE"
        :key="statut"
        class="resas__legende-entree"
        :class="`resas__legende-entree--${statut.toLowerCase()}`"
      >
        {{ lib }}
      </span>
      <span class="resas__legende-entree resas__legende-entree--seance">
        {{ $t('reservations.legend.timetable') }}
      </span>
      <q-space />
      <span class="text-caption text-grey-7">
        {{ $t('reservations.legend.count', { count: reservationsFiltrees.length }) }}
      </span>
    </div>

    <!-- Vue calendrier mensuel -->
    <calendar-grid
      v-if="modeVue === 'calendrier'"
      :evenements="evenementsCalendrier"
      :mois-initial="moisCalendrier"
      :compact="false"
    />

    <!-- Vue tableau liste -->
    <q-table :grid="$q.screen.lt.md"
      v-else
      flat
      bordered
      class="carte"
      :rows="reservationsFiltrees"
      :columns="colonnesReservations"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || reservationsFiltrees.length > 0"
    >
<template #item="p">
    <div class="col-12 q-pb-sm"><q-card flat bordered class="carte">
      <q-card-section>
        <div v-for="c in p.cols.filter(c => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
          <div class="text-caption text-grey-7">{{ c.label }}</div>
          <template v-if="c.name === 'creneau'">{{ dateLisible(p.row.dateJour) }} · {{ p.row.heureDebut }}–{{ p.row.heureFin }}</template>
  <template v-else-if="c.name === 'salle'">{{ p.row.salle?.code }} · {{ p.row.salle?.nom }}</template>
  <template v-else-if="c.name === 'statut'">{{ LIBELLE_STATUT_RESERVATION[p.row.statut] }}</template>
  <span v-else>{{ c.value }}</span>
        </div>
      </q-card-section>
      <q-card-actions align="right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('reservations.table.viewDetail')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('reservations.table.viewDetailTooltip') }}</q-tooltip>
          </q-btn>
        </q-card-actions>
    </q-card></div>
  </template>
      <template #body-cell-creneau="p">
        <q-td :props="p">
          <div class="chiffres">{{ p.row.heureDebut }}–{{ p.row.heureFin }}</div>
          <div class="text-caption text-grey-7">{{ dateLisible(p.row.dateJour) }}</div>
        </q-td>
      </template>
      <template #body-cell-salle="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.salle?.code }}</div>
          <div class="text-caption text-grey-7">{{ p.row.salle?.nom }}</div>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="reservation" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('reservations.table.viewDetail')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('reservations.table.viewDetailTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide icone="event_busy" :titre="$t('reservations.emptyState.title')" :aide="$t('reservations.emptyState.description')">
          <template #action>
            <q-btn
              v-if="peutReserver"
              flat
              no-caps
              color="primary"
              icon="event_available"
              :label="$t('reservations.actions.reserve')"
              @click="dialogReservation = true"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <reservation-dialog v-model="dialogReservation" :salles="salles" @enregistre="charger" />
    <reservation-detail-dialog
      v-model="dialogDetail"
      :reservation="reservationChoisie"
      :salles="salles"
      @change="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import CalendarGrid from '../components/CalendarGrid.vue';
import ChampDate from '../components/ChampDate.vue';
import ReservationDialog from '../components/ReservationDialog.vue';
import ReservationDetailDialog from '../components/ReservationDetailDialog.vue';
import {
  LIBELLE_STATUT_RESERVATION,
  aujourdhui,
  dateLisible,
} from '../utils/libelles';
import type { ReservationSalle, Salle, ChipFiltre } from '../types';

const auth = useAuthStore();
const { t } = useI18n();

const peutReserver = computed(() => auth.peut('reservations.reserver'));

/** Une seule source pour les libellés de statut : utils/libelles.ts. */
const LEGENDE = LIBELLE_STATUT_RESERVATION;

/** Séance d'emploi du temps telle que la renvoie `/reservations/calendrier`. */
interface SeanceCalendrier {
  id: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  salleId: string | null;
  affectation?: {
    matiere?: { intitule: string } | null;
    promotion?: { nom: string } | null;
    enseignant?: { nom: string; prenom: string } | null;
  } | null;
}

/** Un jour de la fenêtre : ses réservations et ses séances. */
interface JourCalendrier {
  date: string;
  reservations: ReservationSalle[];
  seances: SeanceCalendrier[];
}

const salles = ref<Salle[]>([]);
const jours = ref<JourCalendrier[]>([]);
const chargement = ref(false);
const dialogReservation = ref(false);
const dialogDetail = ref(false);
const reservationChoisie = ref<ReservationSalle | null>(null);
const $q = useQuasar();
const modeVue = computed(() => $q.screen.lt.md ? 'tableau' : 'calendrier');

/** Par défaut : le mois courant en entier — le calendrier affiche un mois. */
function premierJourDuMois(iso = aujourdhui()): string {
  return `${iso.slice(0, 7)}-01`;
}
function dernierJourDuMois(iso = aujourdhui()): string {
  const [annee, mois] = iso.split('-').map(Number);
  const dernier = new Date(annee!, mois!, 0).getDate();
  return `${iso.slice(0, 7)}-${String(dernier).padStart(2, '0')}`;
}

const filtresReservations = ref<Record<string, any>>({
  dateDebut: premierJourDuMois(),
  dateFin: dernierJourDuMois(),
});

const moisCalendrier = computed(() =>
  (filtresReservations.value.dateDebut || aujourdhui()).slice(0, 7),
);

/** La fenêtre est déjà filtrée par le serveur : on ne fait qu'aplatir et trier. */
const reservationsFiltrees = computed(() =>
  jours.value
    .flatMap((j) => j.reservations)
    .slice()
    .sort((a, b) =>
      a.dateJour === b.dateJour
        ? a.heureDebut.localeCompare(b.heureDebut)
        : a.dateJour.localeCompare(b.dateJour),
    ),
);

const COULEUR_STATUT: Record<string, string> = {
  EN_ATTENTE: '#FCD116',
  CONFIRMEE: '#007A4D',
  REFUSEE: '#86868b',
  ANNULEE: '#86868b',
};
/** Gris sourd : les séances ne sont là que pour le repérage, en lecture seule. */
const COULEUR_SEANCE = '#86868b';

function libelleSeance(s: SeanceCalendrier): string {
  return s.affectation?.matiere?.intitule ?? t('common.fields.session');
}

const evenementsCalendrier = computed(() => [
  ...jours.value.flatMap((j) =>
    j.reservations.map((r) => ({
      id: r.id,
      date: r.dateJour,
      titre: r.demandeurId ? `${r.heureDebut} ${r.motif}` : `${r.heureDebut} ${t('reservations.calendar.reserved')}`,
      sousTitre: `${r.salle?.code ?? ''}${r.organisme ? ` — ${r.organisme}` : ''}`,
      couleur: COULEUR_STATUT[r.statut] ?? '#86868b',
      icone: 'event',
      onClick: r.demandeurId ? () => ouvrir(r) : undefined,
    })),
  ),
  // Les séances de l'emploi du temps : repère d'occupation, non cliquables.
  ...jours.value.flatMap((j) =>
    j.seances.map((s) => ({
      id: `seance-${s.id}`,
      date: j.date,
      titre: `${s.heureDebut} ${libelleSeance(s)}`,
      sousTitre: [nomSalle(s.salleId), s.affectation?.promotion?.nom]
        .filter(Boolean)
        .join(' — '),
      couleur: COULEUR_SEANCE,
      icone: 'school',
    })),
  ),
]);

function nomSalle(salleId: string | null): string {
  if (!salleId) return '';
  return salles.value.find((s) => s.id === salleId)?.code ?? '';
}

const colonnesReservations = computed(() => [
  { name: 'creneau', label: t('reservations.table.columns.slot'), field: 'dateJour', align: 'left' as const },
  { name: 'salle', label: t('common.fields.room'), field: 'salle', align: 'left' as const },
  { name: 'motif', label: t('common.fields.motif'), field: 'motif', align: 'left' as const },
  { name: 'organisme', label: t('reservations.table.columns.organization'), field: 'organisme', align: 'left' as const },
  { name: 'responsable', label: t('reservations.table.columns.responsible'), field: 'responsable', align: 'left' as const },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]);

function ouvrir(r: ReservationSalle) {
  reservationChoisie.value = r;
  dialogDetail.value = true;
}

const chips = computed(() => {
  const f = filtresReservations.value;
  const cs: ChipFiltre[] = [];
  if (f.salleId) {
    const salle = salles.value.find((s) => s.id === f.salleId);
    cs.push({
      label: t('reservations.chips.room', { code: salle?.code ?? t('reservations.chips.roomFallback') }),
      value: f.salleId,
      icone: 'meeting_room',
    });
  }
  if (f.dateDebut || f.dateFin) {
    cs.push({
      label: `${dateLisible(f.dateDebut)} → ${dateLisible(f.dateFin)}`,
      value: `${f.dateDebut}-${f.dateFin}`,
      icone: 'date_range',
    });
  }
  return cs;
});

function cadrerAujourdhui() {
  filtresReservations.value = {
    ...filtresReservations.value,
    dateDebut: aujourdhui(),
    dateFin: aujourdhui(),
  };
}

function cadrerLeMois() {
  filtresReservations.value = {
    ...filtresReservations.value,
    dateDebut: premierJourDuMois(),
    dateFin: dernierJourDuMois(),
  };
}

/** Retour à la fenêtre par défaut : le mois courant, toutes salles. */
function reinitialiser() {
  filtresReservations.value = {
    dateDebut: premierJourDuMois(),
    dateFin: dernierJourDuMois(),
  };
}

/**
 * Une seule requête pour les deux vues : `/reservations/calendrier` est la
 * seule route qui filtre réellement sur une période (la liste `/reservations`
 * n'accepte qu'un `dateJour`). Elle renvoie déjà les salles et les séances.
 */
async function charger() {
  const debut = filtresReservations.value.dateDebut || premierJourDuMois();
  const fin = filtresReservations.value.dateFin || dernierJourDuMois(debut);
  chargement.value = true;
  try {
    const params: Record<string, any> = { dateDebut: debut, dateFin: fin };
    if (filtresReservations.value.salleId) params.salleId = filtresReservations.value.salleId;
    const { data } = await api.get('/reservations/calendrier', { params });
    jours.value = Array.isArray(data?.jours) ? data.jours : [];
    salles.value = Array.isArray(data?.salles) ? data.salles : [];
  } finally {
    chargement.value = false;
  }
}

watch(filtresReservations, () => charger(), { deep: true });

onMounted(() => {
  void charger();
});
</script>

<style scoped lang="scss">
.resas {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.resas__legende {
  display: flex;
  gap: var(--up-3);
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: var(--up-2);
  font-size: 0.8rem;
}

.resas__legende-entree {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: var(--up-craie);
    border: 1px solid var(--up-encre);
  }

  &--en_attente::before { background: #FCD116; }
  &--confirmee::before { background: #007A4D; }
  &--refusee::before,
  &--annulee::before { background: #86868b; }
  &--seance::before { background: var(--up-encre-douce); }
}
</style>
