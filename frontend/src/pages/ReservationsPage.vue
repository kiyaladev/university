<template>
  <q-page class="resas">
    <header class="resas__entete">
      <div>
        <h1 class="page-titre">Réservations & salles</h1>
        <p class="page-sous-titre">
          Le calendrier des événements — soutenances, conférences, réunions — sur
          les amphis et salles de cours
        </p>
      </div>
      <div class="resas__actions">
        <q-btn
          v-if="peutReserver"
          unelevated
          color="primary"
          no-caps
          icon="event_available"
          label="Réserver"
          @click="dialogReservation = true"
        />
        <view-toggle cle="reservations" :modes="['calendrier', 'tableau']" defaut="calendrier" @update:mode="(v: string) => (modeVue = v as 'calendrier' | 'tableau')" />
        <q-btn round color="primary" icon="refresh" :loading="chargement" @click="charger" />
      </div>
    </header>

    <!-- Filtres -->
    <filter-bar
      v-model="filtresReservations"
      :recherche="false"
    >
      <template #avances>
        <autocomplete-async
          v-model="filtresReservations.salleId"
          endpoint="/salles"
          :label-fn="(s) => `${s.code} — ${s.nom} (${s.capacite} places)`"
          label="Salle"
        />
        <champ-date v-model="filtresReservations.dateDebut" label="Date début" />
        <champ-date v-model="filtresReservations.dateFin" label="Date fin" />
      </template>
      <template #actions>
        <q-btn flat dense no-caps icon="today" label="Aujourd'hui" @click="filtresReservations.dateDebut = aujourdhui(); filtresReservations.dateFin = aujourdhui(); charger()" />
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
          <q-btn flat dense round icon="visibility" @click="ouvrir(p.row)">
            <q-tooltip>Voir le détail</q-tooltip>
          </q-btn>
        </q-td>
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
import type { ReservationSalle, Role, Salle } from '../types';

const auth = useAuthStore();

const ROLES_RESERVATION: Role[] = ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'];
const peutReserver = computed(() => auth.aRole(ROLES_RESERVATION));

const LEGENDE = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

const salles = ref<Salle[]>([]);
const reservations = ref<ReservationSalle[]>([]);
const reservationsCalendrier = ref<ReservationSalle[]>([]);
const chargement = ref(false);
const dialogReservation = ref(false);
const dialogDetail = ref(false);
const reservationChoisie = ref<ReservationSalle | null>(null);
const modeVue = ref<'calendrier' | 'tableau'>('calendrier');

const filtresReservations = ref<Record<string, any>>({
  dateDebut: aujourdhui(),
  dateFin: aujourdhui(),
});

const moisCalendrier = computed(() =>
  (filtresReservations.value.dateDebut || aujourdhui()).slice(0, 7),
);

const reservationsFiltrees = computed(() => {
  const f = filtresReservations.value;
  let liste = reservations.value;
  if (f.salleId) liste = liste.filter((r) => r.salleId === f.salleId);
  return liste.sort((a, b) => (a.dateJour < b.dateJour ? -1 : a.dateJour > b.dateJour ? 1 : 0));
});

const evenementsCalendrier = computed(() => {
  const map: Record<string, string> = {
    EN_ATTENTE: '#EFB700',
    CONFIRMEE: '#0F7A45',
    REFUSEE: '#9ca3af',
    ANNULEE: '#9ca3af',
  };
  return reservationsCalendrier.value.map((r) => ({
    id: r.id,
    date: r.dateJour,
    titre: `${r.heureDebut} ${r.motif}`,
    sousTitre: `${r.salle?.code ?? ''} — ${r.organisme ?? ''}`,
    couleur: map[r.statut] ?? '#9ca3af',
    icone: 'event',
    onClick: () => ouvrir(r),
  }));
});

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

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, any> = {
      all: '1',
      dateDebut: filtresReservations.value.dateDebut || undefined,
      dateFin: filtresReservations.value.dateFin || undefined,
    };
    if (filtresReservations.value.salleId) {
      params.salleId = filtresReservations.value.salleId;
    }
    const { data } = await api.get('/reservations', { params });
    reservations.value = data.data;
    // Le calendrier agrège également les séances d'emploi du temps pour le repérage
    const calParams: Record<string, any> = {
      dateDebut: filtresReservations.value.dateDebut || undefined,
      dateFin: filtresReservations.value.dateFin || undefined,
    };
    if (filtresReservations.value.salleId) calParams.salleId = filtresReservations.value.salleId;
    const { data: cal } = await api.get('/reservations/calendrier', { params: calParams });
    const calData = cal?.data ?? cal;
    const reservationsApi: ReservationSalle[] = (calData?.reservations ?? calData?.data ?? []) as ReservationSalle[];
    reservationsCalendrier.value = Array.isArray(reservationsApi) ? reservationsApi : [];
    if (calData?.salles) {
      salles.value = calData.salles;
    } else {
      const { data: sallesData } = await api.get('/salles', { params: { all: '1' } });
      salles.value = sallesData.data;
    }
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
