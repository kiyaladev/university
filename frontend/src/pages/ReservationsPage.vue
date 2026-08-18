<template>
  <q-page class="resas">
    <header class="resas__entete">
      <div>
        <h1 class="page-titre">Salles &amp; réservations</h1>
        <p class="page-sous-titre">
          Le calendrier des événements — soutenances, conférences, réunions — sur
          les amphis et salles de cours, superposé à l'emploi du temps.
        </p>
      </div>
      <div class="resas__actions">
        <q-btn
          v-if="peutReserver"
          unelevated
          color="primary"
          no-caps
          icon="event_available"
          label="Réserver une salle"
          @click="dialogReservation = true"
        />
        <view-toggle cle="reservations" :modes="['calendrier', 'tableau']" defaut="calendrier" @update:mode="(v: string) => (modeVue = v as 'calendrier' | 'tableau')" />
        <q-btn
          round
          color="primary"
          icon="refresh"
          aria-label="Recharger la période"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>Recharger</q-tooltip>
        </q-btn>
      </div>
    </header>

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
          :label-fn="(s) => `${s.code} — ${s.nom} (${s.capacite} places)`"
          label="Salle"
        />
        <champ-date v-model="filtresReservations.dateDebut" label="Du" />
        <champ-date v-model="filtresReservations.dateFin" label="Au" />
      </template>
      <template #actions>
        <q-btn
          flat
          dense
          no-caps
          icon="today"
          label="Aujourd'hui"
          @click="cadrerAujourdhui"
        />
        <q-btn flat dense no-caps icon="calendar_month" label="Ce mois-ci" @click="cadrerLeMois" />
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
        Emploi du temps (lecture seule)
      </span>
      <q-space />
      <span class="text-caption text-grey-7">
        {{ reservationsFiltrees.length }} réservation(s) sur la période
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
    <q-table
      v-else
      flat
      bordered
      class="carte"
      :rows="reservationsFiltrees"
      :columns="colonnesReservations"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
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
          <span class="champ champ-statut champ-statut--dense" :class="`calendrier-couleur-${p.row.statut.toLowerCase()}`">
            <span class="pochoir">{{ LIBELLE_STATUT_RESERVATION[p.row.statut] }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            aria-label="Voir le détail de la réservation"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Voir le détail</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <div class="full-width text-center text-grey-7 q-pa-lg">
          <q-icon name="event_busy" size="38px" color="grey-5" />
          <div class="q-mt-sm">Aucune réservation sur cette période.</div>
          <div class="text-caption q-mt-xs">
            Élargissez les dates, ou déposez une demande : elle part en « en
            attente » jusqu'à l'arbitrage de la scolarité.
          </div>
          <q-btn
            v-if="peutReserver"
            flat
            no-caps
            color="primary"
            icon="event_available"
            label="Réserver une salle"
            class="q-mt-sm"
            @click="dialogReservation = true"
          />
        </div>
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
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
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
import type { ReservationSalle, Role, Salle, ChipFiltre } from '../types';

const auth = useAuthStore();

const ROLES_RESERVATION: Role[] = ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'];
const peutReserver = computed(() => auth.aRole(ROLES_RESERVATION));

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
const modeVue = ref<'calendrier' | 'tableau'>('calendrier');

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
  EN_ATTENTE: '#EFB700',
  CONFIRMEE: '#0F7A45',
  REFUSEE: '#9ca3af',
  ANNULEE: '#9ca3af',
};
/** Gris sourd : les séances ne sont là que pour le repérage, en lecture seule. */
const COULEUR_SEANCE = '#6b7280';

function libelleSeance(s: SeanceCalendrier): string {
  return s.affectation?.matiere?.intitule ?? 'Séance';
}

const evenementsCalendrier = computed(() => [
  ...jours.value.flatMap((j) =>
    j.reservations.map((r) => ({
      id: r.id,
      date: r.dateJour,
      titre: `${r.heureDebut} ${r.motif}`,
      sousTitre: `${r.salle?.code ?? ''}${r.organisme ? ` — ${r.organisme}` : ''}`,
      couleur: COULEUR_STATUT[r.statut] ?? '#9ca3af',
      icone: 'event',
      onClick: () => ouvrir(r),
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

const colonnesReservations = [
  { name: 'creneau', label: 'Créneau', field: 'dateJour', align: 'left' as const },
  { name: 'salle', label: 'Salle', field: 'salle', align: 'left' as const },
  { name: 'motif', label: 'Motif', field: 'motif', align: 'left' as const },
  { name: 'organisme', label: 'Organisme', field: 'organisme', align: 'left' as const },
  { name: 'responsable', label: 'Responsable', field: 'responsable', align: 'left' as const },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
];

function ouvrir(r: ReservationSalle) {
  reservationChoisie.value = r;
  dialogDetail.value = true;
}

const chips = computed(() => {
  const f = filtresReservations.value;
  const cs: ChipFiltre[] = [];
  if (f.salleId) {
    const salle = salles.value.find((s) => s.id === f.salleId);
    cs.push({ label: `Salle : ${salle?.code ?? '…'}`, value: f.salleId, icone: 'meeting_room' });
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

.resas__entete {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
  margin-bottom: var(--up-3);
}

.resas__actions {
  display: flex;
  gap: var(--up-2);
  align-items: center;
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

  &--en_attente::before { background: #EFB700; }
  &--confirmee::before { background: #0F7A45; }
  &--refusee::before,
  &--annulee::before { background: #9ca3af; }
  &--seance::before { background: var(--up-encre-douce); }
}

.calendrier-couleur-en_attente { background: rgba(239, 183, 0, 0.22); }
.calendrier-couleur-confirmee { background: rgba(15, 122, 69, 0.14); }
.calendrier-couleur-refusee,
.calendrier-couleur-annulee { background: rgba(156, 163, 175, 0.18); }
</style>
