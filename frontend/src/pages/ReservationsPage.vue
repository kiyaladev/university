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
        <q-btn round color="primary" icon="refresh" :loading="chargement" @click="charger" />
      </div>
    </header>

    <!-- Semaine affichée et choix de la salle -->
    <div class="resas__filtres">
      <div class="resas__semaine">
        <q-btn flat dense round icon="chevron_left" @click="decalerSemaine(-1)">
          <q-tooltip>Semaine précédente</q-tooltip>
        </q-btn>
        <champ-date v-model="semaineDu" label="Semaine du" style="width: 148px" />
        <q-btn flat dense round icon="chevron_right" @click="decalerSemaine(1)">
          <q-tooltip>Semaine suivante</q-tooltip>
        </q-btn>
        <button type="button" class="plaque resas__aujourdhui pochoir" @click="semaineDu = lundiDe(new Date())">
          cette semaine
        </button>
      </div>
      <q-select
        v-model="filtreSalleId"
        :options="optionsSalles"
        outlined
        dense
        clearable
        emit-value
        map-options
        label="Salle"
        style="min-width: 240px"
      />
    </div>

    <q-inner-loading :showing="chargement" />

    <!-- Légende : une couleur par état, à côté des blocs de la grille -->
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
    </div>

    <!-- Grille de la semaine : une colonne par salle, une ligne par jour -->
    <div v-if="salles.length" class="grille" :style="{ '--nb-colonnes': salles.length }">
      <div class="grille__coin">
        <span class="pochoir pochoir--brut">Semaine du {{ libelleSemaine }}</span>
      </div>

      <div v-for="s in salles" :key="s.id" class="grille__salle">
        <div class="grille__tete">
          <span class="lettrage">{{ s.code }}</span>
          <span class="pochoir pochoir--brut">{{ s.nom }} · {{ s.capacite }} places</span>
        </div>
      </div>

      <template v-for="j in jours" :key="j.date">
        <div class="grille__jour">
          <span class="lettrage">{{ libelleJour(j.date) }}</span>
          <span v-if="estAujourdhui(j.date)" class="grille__aujourdhui pochoir">aujourd’hui</span>
        </div>
        <div
          v-for="s in salles"
          :key="`${j.date}-${s.id}`"
          class="grille__cellule"
          :class="{ 'grille__cellule--gras': estAujourdhui(j.date) }"
        >
          <template v-for="bloc in blocsDuJour(j, s.id)" :key="bloc.cle">
            <button
              v-if="bloc.type === 'reservation'"
              type="button"
              class="bloc bloc--reservation"
              :class="`bloc--${bloc.r.statut.toLowerCase()}`"
              @click="ouvrir(bloc.r)"
            >
              <span class="bloc__heure pochoir chiffres">{{ bloc.r.heureDebut }}–{{ bloc.r.heureFin }}</span>
              <span class="bloc__titre">{{ bloc.r.motif }}</span>
              <span class="bloc__meta pochoir">
                {{ LIBELLE_STATUT_RESERVATION[bloc.r.statut] }}
              </span>
            </button>
            <div
              v-else
              class="bloc bloc--seance"
              :title="`Emploi du temps : ${bloc.s.affectation?.matiere?.intitule}`"
            >
              <span class="bloc__heure pochoir chiffres">{{ bloc.s.heureDebut }}–{{ bloc.s.heureFin }}</span>
              <span class="bloc__titre">{{ bloc.s.affectation?.matiere?.intitule }}</span>
              <span class="bloc__meta pochoir">
                {{ bloc.s.affectation?.promotion?.nom }}
              </span>
            </div>
          </template>
          <span v-if="!blocsDuJour(j, s.id).length" class="grille__vide pochoir">libre</span>
        </div>
      </template>
    </div>

    <p v-else class="resas__vide">
      <q-icon name="event_available" size="42px" />
      <span class="lettrage">Aucune salle à afficher.</span>
    </p>

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
import ChampDate from '../components/ChampDate.vue';
import ReservationDialog from '../components/ReservationDialog.vue';
import ReservationDetailDialog from '../components/ReservationDetailDialog.vue';
import { JOURS, LIBELLE_STATUT_RESERVATION } from '../utils/libelles';
import type { ReservationSalle, Role, Salle, Seance } from '../types';

const auth = useAuthStore();

const ROLES_RESERVATION: Role[] = ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'];
const peutReserver = computed(() => auth.aRole(ROLES_RESERVATION));

/** Couleurs des états sur la grille — la légende au-dessus du tableau. */
const LEGENDE = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

const salles = ref<Salle[]>([]);
const jours = ref<JourGrille[]>([]);
const chargement = ref(false);
const dialogReservation = ref(false);
const dialogDetail = ref(false);
const reservationChoisie = ref<ReservationSalle | null>(null);
const filtreSalleId = ref<string | null>(null);

interface JourGrille {
  date: string;
  reservations: (ReservationSalle & { salleId: string })[];
  seances: (Seance & { salleId: string })[];
}

function lundiDe(d: Date) {
  const copie = new Date(d);
  copie.setDate(copie.getDate() - ((copie.getDay() + 6) % 7));
  return `${copie.getFullYear()}-${String(copie.getMonth() + 1).padStart(2, '0')}-${String(copie.getDate()).padStart(2, '0')}`;
}

const semaineDu = ref(lundiDe(new Date()));

const libelleSemaine = computed(() => {
  const lundi = new Date(semaineDu.value);
  const dimanche = new Date(lundi.getTime() + 6 * 86400000);
  const jj = (d: Date) => String(d.getDate()).padStart(2, '0');
  const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, '0');
  return `${jj(lundi)}/${mm(lundi)} → ${jj(dimanche)}/${mm(dimanche)}`;
});

function decalerSemaine(semaines: number) {
  const lundi = new Date(semaineDu.value);
  lundi.setDate(lundi.getDate() + semaines * 7);
  semaineDu.value = lundiDe(lundi);
}

function libelleJour(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const js = d.getDay() === 0 ? 7 : d.getDay();
  return `${JOURS[js]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const aujourdhui = new Date().toISOString().slice(0, 10);
function estAujourdhui(iso: string) {
  return iso === aujourdhui;
}

const optionsSalles = computed(() =>
  salles.value.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Tout ce qui occupe la case (jour, salle) : réservations puis séances. */
function blocsDuJour(j: JourGrille, salleId: string) {
  const res = j.reservations
    .filter((r) => r.salleId === salleId)
    .map((r) => ({ cle: `r-${r.id}`, type: 'reservation' as const, r }));
  const sec = j.seances
    .filter((s) => s.salleId === salleId)
    .map((s) => ({ cle: `s-${s.id}`, type: 'seance' as const, s }));
  return [...res, ...sec].sort(
    (a, b) => minutes(a.type === 'reservation' ? a.r.heureDebut : a.s.heureDebut) - minutes(b.type === 'reservation' ? b.r.heureDebut : b.s.heureDebut),
  );
}

function ouvrir(r: ReservationSalle) {
  reservationChoisie.value = r;
  dialogDetail.value = true;
}

async function charger() {
  chargement.value = true;
  try {
    const fin = new Date(semaineDu.value);
    fin.setDate(fin.getDate() + 6);
    const finIso = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
    const { data } = await api.get('/reservations/calendrier', {
      params: {
        dateDebut: semaineDu.value,
        dateFin: finIso,
        ...(filtreSalleId.value ? { salleId: filtreSalleId.value } : {}),
      },
    });
    salles.value = data.salles;
    jours.value = data.jours;
  } finally {
    chargement.value = false;
  }
}

watch(filtreSalleId, charger);
watch(semaineDu, charger);

onMounted(async () => {
  const { data } = await api.get('/salles', { params: { all: '1' } });
  salles.value = data.data;
  await charger();
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
}

.resas__filtres {
  display: flex;
  align-items: flex-end;
  gap: var(--up-3);
  flex-wrap: wrap;
  margin-bottom: var(--up-3);
}

.resas__semaine {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

.resas__aujourdhui {
  padding: var(--up-2);
  cursor: pointer;
  color: var(--up-encre-douce);
}

.resas__legende {
  display: flex;
  gap: var(--up-3);
  flex-wrap: wrap;
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

  &--en_attente::before { background: $jaune; }
  &--confirmee::before { background: $vert; }
  &--refusee::before,
  &--annulee::before { background: $rouge; }
  &--seance::before { background: var(--up-encre-douce); }
}

.resas__vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  color: var(--up-encre-douce);
  padding: var(--up-6) 0;
}

// ----------------------------------------------------- grille de la semaine
.grille {
  display: grid;
  grid-template-columns: 130px repeat(var(--nb-colonnes, 1), minmax(190px, 1fr));
  border: var(--up-filet);
  background: var(--up-plaque);
  overflow-x: auto;
}

.grille__coin {
  padding: var(--up-2);
  background: var(--up-encre);
  color: $blanc-craie;
  display: flex;
  align-items: center;
}

.grille__salle {
  padding: var(--up-2);
  background: var(--up-encre);
  color: $blanc-craie;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: var(--up-filet-fin);
}

.grille__tete { font-size: 1rem; }

.grille__jour {
  padding: var(--up-2);
  background: var(--up-craie);
  border-top: var(--up-filet);
  border-right: var(--up-filet-fin);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-2);
}

.grille__aujourdhui {
  color: var(--up-jaune-fonce);
  border: 1px solid var(--up-jaune-fonce);
  padding: 0 4px;
}

.grille__cellule {
  border-top: var(--up-filet-fin);
  border-right: var(--up-filet-fin);
  padding: var(--up-1);
  min-height: 96px;
  display: flex;
  flex-direction: column;
  gap: var(--up-1);
}

.grille__cellule--gras {
  background: rgba(239, 183, 0, 0.07);
}

.grille__vide {
  color: var(--up-encre-douce);
  font-size: 0.75rem;
  align-self: center;
}

// ------------------------------------------------------------- les blocs
.bloc {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 6px;
  text-align: left;
  font: inherit;
  color: var(--up-encre);
  border-left: 5px solid var(--up-encre);
  border-right: 1px solid var(--up-encre-douce);
  border-top: 1px solid var(--up-encre-douce);
  border-bottom: 1px solid var(--up-encre-douce);
  min-height: 44px;
  cursor: pointer;
  transition: filter var(--up-transition);

  &:hover { filter: brightness(0.94); }
}

.bloc--en_attente { background: rgba(239, 183, 0, 0.22); border-left-color: $jaune; }
.bloc--confirmee { background: rgba(15, 122, 69, 0.14); border-left-color: $vert; }
.bloc--refusee,
.bloc--annulee {
  background: rgba(196, 18, 46, 0.1);
  border-left-color: $rouge;
  opacity: 0.75;
}

.bloc__heure {
  color: var(--up-encre-douce);
  font-size: 10px;
  letter-spacing: 0.05em;
}

.bloc__titre {
  font-weight: 700;
  font-size: 0.8rem;
  line-height: 1.15;
}

.bloc__meta {
  color: var(--up-encre-douce);
  font-size: 9.5px;
}

// L'emploi du temps se lit, il ne se touche pas : plaque grise, jamais cliquable.
.bloc--seance {
  background: repeating-linear-gradient(
    135deg,
    rgba(16, 37, 30, 0.06) 0 6px,
    transparent 6px 12px
  );
  border-left-color: var(--up-encre-douce);
  cursor: default;

  &:hover { filter: none; }
}
</style>