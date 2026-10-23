<template>
  <q-page class="resas">
    <en-tete-page :title="$t('reservations.title')" :subtitle="$t('reservations.subtitle')">
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
          :loading="liste.chargement"
          @click="charger"
        >
          <q-tooltip>{{ $t('common.actions.reload') }}</q-tooltip>
        </q-btn>
      </template>
    </en-tete-page>

    <!-- Filtres -->
    <barre-filtres v-model="filtresReservations" :chips="chips" :recherche="false" @reinitialiser="reinitialiser">
      <template #avances>
        <champ-recherche
          v-model="filtresReservations.salleId"
          endpoint="/salles"
          :label-fn="(s) => $t('reservations.filters.roomOption', { code: s.code, name: s.nom, capacity: s.capacite })"
          :label="$t('common.fields.room')"
        />
        <champ-date v-model="filtresReservations.dateDebut" :label="$t('common.actions.from')" />
        <champ-date v-model="filtresReservations.dateFin" :label="$t('common.actions.to')" />
      </template>
      <template #actions>
        <q-btn flat dense no-caps icon="today" :label="$t('reservations.actions.today')" @click="cadrerAujourdhui" />
        <q-btn
          flat
          dense
          no-caps
          icon="calendar_month"
          :label="$t('reservations.actions.thisMonth')"
          @click="cadrerLeMois"
        />
      </template>
    </barre-filtres>

    <!-- Légende -->
    <reservation-legende :libelles="legende" :total="reservationsFiltrees.length" />

    <!-- Vue calendrier mensuel -->
    <reservation-calendrier
      v-if="modeVue === 'calendrier'"
      :jours="jours"
      :salles="salles"
      :mois="moisCalendrier"
      @selectionner="ouvrir"
    />

    <!-- Vue tableau liste -->
    <reservation-tableau
      v-else
      :reservations="reservationsFiltrees"
      :chargement="liste.chargement"
      :peut-reserver="peutReserver"
      @ouvrir="ouvrir"
      @reserver="dialogReservation = true"
    />

    <dialogue-reservation v-model="dialogReservation" :salles="salles" @enregistre="charger" />
    <dialogue-detail-reservation
      v-model="dialogDetail"
      :reservation="reservationChoisie"
      :salles="salles"
      @change="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { aujourdhui, dateLisible } from '@/shared/utils/format';
import { LIBELLE_STATUT_RESERVATION } from '@/shared/utils/libelles';
import ReservationLegende from '../components/ReservationLegende.vue';
import ReservationCalendrier from '../components/ReservationCalendrier.vue';
import ReservationTableau from '../components/ReservationTableau.vue';
import DialogueReservation from '../components/DialogueReservation.vue';
import DialogueDetailReservation from '../components/DialogueDetailReservation.vue';
import { reservationsService, type ParametresCalendrier } from '../services/reservations';
import type { ReservationDetail, JourCalendrier } from '../types';
import type { ReservationSalle, Salle, ChipFiltre } from '@/types';

const auth = useAuthStore();
const { t } = useI18n();

const peutReserver = computed(() => auth.peut('reservations.reserver'));

/** Une seule source pour les libellés de statut : shared/utils/libelles. */
const legende = LIBELLE_STATUT_RESERVATION;

const salles = ref<Salle[]>([]);
const jours = ref<JourCalendrier[]>([]);
const dialogReservation = ref(false);
const dialogDetail = ref(false);
const reservationChoisie = ref<ReservationDetail | null>(null);
const $q = useQuasar();
const modeVue = computed(() => ($q.screen.lt.md ? 'tableau' : 'calendrier'));

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

const moisCalendrier = computed(() => (filtresReservations.value.dateDebut || aujourdhui()).slice(0, 7));

/** La fenêtre est déjà filtrée par le serveur : on ne fait qu'aplatir et trier. */
function trierReservations(reservations: ReservationSalle[]): ReservationSalle[] {
  return reservations
    .slice()
    .sort((a, b) =>
      a.dateJour === b.dateJour ? a.heureDebut.localeCompare(b.heureDebut) : a.dateJour.localeCompare(b.dateJour),
    );
}

/**
 * Une seule requête pour les deux vues : `/reservations/calendrier` est la
 * seule route qui filtre réellement sur une période (la liste `/reservations`
 * n'accepte qu'un `dateJour`). Elle renvoie déjà les salles et les séances.
 */
const liste = reactive(
  useListePaginee<ReservationSalle, Record<string, any>>({
    filtres: filtresReservations,
    // L'API ne pagine pas : la période arrive entière, le tri reste local.
    pageSize: 0,
    charger: async ({ filtres: f }) => {
      const debut = f.dateDebut || premierJourDuMois();
      const fin = f.dateFin || dernierJourDuMois(debut);
      const params: ParametresCalendrier = { dateDebut: debut, dateFin: fin };
      if (f.salleId) params.salleId = f.salleId;
      const data = await reservationsService.calendrier(params);
      jours.value = data.jours ?? [];
      salles.value = (data.salles ?? []) as Salle[];
      return { data: trierReservations(jours.value.flatMap((j) => j.reservations)) };
    },
  }),
);

/** La liste affichée : les réservations de la période, triées. */
const reservationsFiltrees = computed(() => liste.lignes);

function charger() {
  return liste.recharger();
}

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
</script>

<style scoped lang="scss">
.resas {
  padding: var(--up-4) var(--up-3) var(--up-6);
}
</style>
