<template>
  <q-page class="tournee">
    <!-- Bandeau de tournée : l'état de la journée, lisible d'un coup d'œil -->
    <header class="bandeau">
      <div class="bandeau__titre">
        <div>
          <h1 class="lettrage bandeau__jour">{{ jourLisible }}</h1>
          <p class="pochoir bandeau__mention">Feuille de contrôle · {{ auth.nomComplet }}</p>
        </div>
        <div class="bandeau__nav">
          <q-btn flat dense round icon="chevron_left" color="white" aria-label="Jour précédent" @click="date = decalerJours(date, -1)" />
          <q-btn flat dense no-caps color="white" icon="event" :label="date === aujourdhui() ? 'Aujourd’hui' : 'Autre jour'">
            <q-popup-proxy transition-show="scale" transition-hide="scale">
              <q-date v-model="date" mask="YYYY-MM-DD" minimal />
            </q-popup-proxy>
          </q-btn>
          <q-btn flat dense round icon="chevron_right" color="white" aria-label="Jour suivant" @click="date = decalerJours(date, 1)" />
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
              {{ restantes > 1 ? 'salles à visiter' : 'salle à visiter' }}
            </template>
            <template v-else-if="total">Tournée complète</template>
            <template v-else>Aucune séance ce jour</template>
          </span>
          <span v-if="total" class="pochoir pochoir--brut reste__detail chiffres">
            {{ pointees }} pointée{{ pointees > 1 ? 's' : '' }} sur {{ total }}
            <template v-if="absences"> · {{ absences }} absence{{ absences > 1 ? 's' : '' }}</template>
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
        {{ seancesFiltrees.length }} affichée{{ seancesFiltrees.length > 1 ? 's' : '' }}
      </span>

      <!-- La ligne blanche du cahier : un cours trouvé en salle sans être au
           programme s'ouvre puis se pointe comme les autres. -->
      <q-btn
        flat
        dense
        no-caps
        icon="add_box"
        label="Séance non programmée"
        class="barre-tri__ajout"
        @click="ouvrirSeanceNonProgrammee"
      />
    </div>

    <div v-if="triOuvert" class="filtres">
      <q-input
        v-model="recherche"
        outlined
        dense
        clearable
        placeholder="Enseignant, matière, salle…"
        class="filtres__recherche"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <div class="filtres__etat" role="group" aria-label="Filtrer les séances">
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
      Hors ligne — vos pointages restent sur l’appareil et partiront au retour du réseau.
    </q-banner>

    <!-- Le panneau : une plaque par séance, dans l'ordre des heures -->
    <div v-if="chargement" class="etat-vide">
      <q-spinner-tail size="34px" />
      <p class="pochoir">Chargement de la tournée…</p>
    </div>

    <div v-else-if="!seancesFiltrees.length" class="etat-vide">
      <q-icon name="event_busy" size="42px" />
      <span class="lettrage etat-vide__titre">Rien à pointer ici</span>
      <span class="pochoir etat-vide__mention">
        {{
          seances.length
            ? 'Aucune séance ne correspond à ce filtre.'
            : 'Aucune séance n’est programmée ce jour.'
        }}
      </span>
      <div class="etat-vide__actions">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add_box"
          label="Ouvrir une séance non programmée"
          @click="ouvrirSeanceNonProgrammee"
        />
        <q-btn
          v-if="filtreEtat !== 'toutes' || recherche"
          outline
          no-caps
          icon="filter_alt_off"
          label="Retirer les filtres"
          @click="((filtreEtat = 'toutes'), (recherche = ''))"
        />
      </div>
    </div>

    <ol v-else class="panneau">
      <li v-for="s in seancesFiltrees" :key="s.id">
        <article class="plaque seance" :class="{ 'seance--en-cours': estEnCours(s), 'seance--annulee': s.statut === 'ANNULEE' }">
          <div class="champ seance__heure" :class="{ 'seance__heure--en-cours': estEnCours(s) }">
            <span class="lettrage chiffres seance__debut">{{ s.heureDebut }}</span>
            <span class="pochoir chiffres seance__fin">{{ s.heureFin }}</span>
            <span v-if="estEnCours(s)" class="pochoir seance__marque">en cours</span>
          </div>

          <div class="seance__corps">
            <h2 class="lettrage seance__enseignant">
              {{ s.affectation?.enseignant?.nom }} {{ s.affectation?.enseignant?.prenom }}
            </h2>
            <p class="seance__matiere">
              {{ s.affectation?.matiere?.intitule }}
              <span class="pochoir seance__type">{{ s.type }}</span>
            </p>
            <p class="pochoir seance__lieu">
              {{ s.affectation?.promotion?.nom }}
              <span v-if="s.salle" class="plaque-salle">{{ s.salle.code }}</span>
            </p>

            <p v-if="s.controle" class="pochoir pochoir--brut seance__constat chiffres">
              {{ s.controle.heureArrivee ?? '—' }} → {{ s.controle.heureFinReelle ?? '—' }}
              · {{ dureeLisible(s.controle.dureeMinutes) }}
              <span v-if="s.controle.effectifPresent"> · {{ s.controle.effectifPresent }} étud.</span>
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
            <span v-else class="lettrage seance__appel">Pointer</span>
            <span class="pochoir seance__sous-action">
              {{ s.controle ? 'corriger' : 'salle ' + (s.salle?.code ?? '—') }}
            </span>
          </button>

          <div v-else class="champ seance__action seance__action--annulee">
            <span class="lettrage seance__verdict">Annulée</span>
          </div>
        </article>
      </li>
    </ol>

    <!-- Fin de tournée : le panneau se referme sur ce qui reste à faire -->
    <footer v-if="seancesFiltrees.length" class="plaque fin-tournee">
      <div>
        <p class="lettrage fin-tournee__titre">
          {{ restantes ? `${restantes} salle${restantes > 1 ? 's' : ''} à visiter` : 'Tournée complète' }}
        </p>
        <p class="pochoir pochoir--brut fin-tournee__detail">
          {{ pointees }} séance(s) pointée(s) sur {{ total }} · {{ jourLisible }}
        </p>
      </div>
      <q-btn
        outline
        no-caps
        icon="print"
        label="Imprimer le registre du jour"
        @click="imprimerRegistre"
      />
    </footer>

    <!-- Cible du pouce : toujours atteignable, même quand la tournée est finie -->
    <q-page-sticky position="bottom-right" :offset="[16, 20]">
      <q-btn
        fab
        icon="add"
        color="primary"
        aria-label="Ouvrir une séance non programmée"
        @click="ouvrirSeanceNonProgrammee"
      >
        <q-tooltip anchor="center left" self="center right">Séance non programmée</q-tooltip>
      </q-btn>
    </q-page-sticky>

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
import { computed, onMounted, ref, watch } from 'vue';
import { api, API_URL } from '../boot/axios';
import { usePointagesStore } from '../stores/pointages';
import { useAuthStore } from '../stores/auth';
import PointageDialog from '../components/PointageDialog.vue';
import SeanceDialog from '../components/SeanceDialog.vue';
import {
  ICONE_ATTESTATION,
  LIBELLE_ATTESTATION,
  LIBELLE_STATUT_PRESENCE,
  aujourdhui,
  decalerJours,
  dureeLisible,
  maintenantHHmm,
} from '../utils/libelles';
import type { Salle, Seance } from '../types';

const pointages = usePointagesStore();
const auth = useAuthStore();

const date = ref(aujourdhui());
const seances = ref<Seance[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtreEtat = ref<'toutes' | 'attente' | 'faites'>('toutes');
const dialogOuvert = ref(false);
const dialogSeance = ref(false);
const salles = ref<Salle[]>([]);
const seanceSelectionnee = ref<Seance | null>(null);

const filtres = [
  { label: 'Toutes', value: 'toutes' as const },
  { label: 'À pointer', value: 'attente' as const },
  { label: 'Pointées', value: 'faites' as const },
];

const jourLisible = computed(() =>
  new Date(`${date.value}T12:00:00`).toLocaleDateString('fr-FR', {
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
  if (triOuvert.value) return 'Masquer le tri';
  const actif = filtres.find((f) => f.value === filtreEtat.value);
  return filtreEtat.value === 'toutes' && !recherche.value
    ? 'Rechercher, filtrer'
    : `Filtre : ${actif?.label ?? ''}${recherche.value ? ' · recherche' : ''}`;
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
  window.open(`${API_URL}/impression/registre?date=${date.value}&token=${auth.token}`, '_blank');
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/seances/journee', { params: { date: date.value } });
    seances.value = data.seances;
  } finally {
    chargement.value = false;
  }
}

watch(date, charger);

onMounted(async () => {
  await charger();
  // Les salles servent au formulaire de séance non programmée.
  const { data } = await api.get('/salles', { params: { all: '1' } });
  salles.value = data.data;
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
  color: #fff;
  &::first-letter { text-transform: uppercase; }
}

.bandeau__mention {
  color: rgba(255, 255, 255, 0.72);
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
  border-top: 2px solid rgba(255, 255, 255, 0.34);
}

.reste__valeur {
  font-size: clamp(2.6rem, 2rem + 3.6vw, 4rem);
  color: $jaune;
  line-height: 1;
}

// Tournée finie : un cachet, pas un zéro. Un « 0 » à côté de « complète » se
// contredit lui-même.
.reste__cachet {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  border: 2px solid rgba(255, 255, 255, 0.55);
}

.reste__mot { display: flex; flex-direction: column; gap: 3px; }

.reste__unite {
  font-size: clamp(1.05rem, 0.9rem + 1vw, 1.4rem);
  color: #fff;
}

.reste__detail { color: rgba(255, 255, 255, 0.78); }

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

.barre-tri__ajout { margin-left: auto; color: var(--up-encre); }

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
  border: 2px solid var(--up-encre);
  padding: 10px 12px;
  min-height: 44px;
  cursor: pointer;
  transition: background var(--up-transition), color var(--up-transition);

  & + & { border-left-width: 0; }

  &--actif {
    background: var(--up-encre);
    color: var(--up-craie);
  }
}

.hors-ligne {
  margin: var(--up-3) var(--up-3) 0;
  background: $jaune;
  color: $encre;
  border: 2px solid $encre;
  font-weight: 600;
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
  background: var(--up-encre);
  padding: var(--up-2) var(--up-1);

  // La séance se déroule à l'instant : marquée au pochoir, pas par un aplat qui
  // volerait une couleur de statut.
  &--en-cours { box-shadow: inset 0 0 0 3px #{$jaune}; }
}

.seance__debut {
  font-size: 1.5rem;
  color: #fff;
}

.seance__fin {
  color: rgba(255, 255, 255, 0.72);
  &::before { content: '→ '; }
}

.seance__marque {
  margin-top: 2px;
  color: $jaune;
  border-top: 1px solid rgba(255, 255, 255, 0.5);
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
  border: 1px solid var(--up-encre);
  padding: 1px 4px;
  margin-left: 4px;
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
  &:focus-visible { outline: 3px solid $blanc-craie; outline-offset: -6px; }

  &--vierge {
    background: $encre;
    color: #fff;
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
  opacity: 0.82;
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

// --------------------------------------------------------------- vides
.etat-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-6) var(--up-3);
  color: var(--up-encre-douce);
  text-align: center;
}

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
