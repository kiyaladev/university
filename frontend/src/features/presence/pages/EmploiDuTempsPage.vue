<template>
  <q-page class="edt">
    <en-tete-page :title="$t('emploiDuTemps.title')" :subtitle="$t('emploiDuTemps.subtitle')">
      <template #actions>
        <q-btn
          v-if="auth.peutPlanifier"
          outline
          no-caps
          icon="auto_awesome_motion"
          :label="$t('emploiDuTemps.actions.generateSessions')"
          @click="dialogGeneration = true"
        />
        <q-btn
          v-if="peutVoirRegistre"
          flat
          no-caps
          icon="event_note"
          :label="$t('emploiDuTemps.actions.weekSessions')"
          :to="lienSeancesSemaine"
        >
          <q-tooltip>{{ $t('emploiDuTemps.actions.weekSessionsTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="auth.peutTenirEmploiDuTemps"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('emploiDuTemps.actions.newSlot')"
          @click="ouvrir(null)"
        />
      </template>
    </en-tete-page>

    <!-- Semaine affichée : la grille montre ce qui vaut cette semaine-là -->
    <div class="edt__semaine">
      <q-btn
        flat
        dense
        round
        icon="chevron_left"
        :aria-label="$t('emploiDuTemps.week.previous')"
        @click="decalerSemaine(-1)"
      >
        <q-tooltip>{{ $t('emploiDuTemps.week.previous') }}</q-tooltip>
      </q-btn>
      <button
        type="button"
        class="plaque edt__semaine-plaque"
        :aria-label="$t('emploiDuTemps.week.backToCurrentAria')"
        @click="semaineDu = lundiDe(new Date())"
      >
        <span class="pochoir">{{ $t('emploiDuTemps.week.of') }}</span>
        <span class="lettrage chiffres edt__semaine-dates">{{ libelleSemaine }}</span>
        <q-tooltip>{{ $t('emploiDuTemps.week.backToCurrentTooltip') }}</q-tooltip>
      </button>
      <q-btn
        flat
        dense
        round
        icon="chevron_right"
        :aria-label="$t('emploiDuTemps.week.next')"
        @click="decalerSemaine(1)"
      >
        <q-tooltip>{{ $t('emploiDuTemps.week.next') }}</q-tooltip>
      </q-btn>
      <span class="pochoir edt__semaine-note">
        {{ $t('emploiDuTemps.week.note') }}
      </span>
    </div>

    <!-- Filtres : trois lectures du même panneau -->
    <div class="edt__filtres">
      <q-select
        v-model="filtres.promotionId"
        :options="optionsPromotions"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('emploiDuTemps.filters.promotion')"
      />
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
      <q-btn
        round
        color="primary"
        icon="refresh"
        :aria-label="$t('emploiDuTemps.filters.reloadAria')"
        :loading="chargement"
        @click="charger"
      >
        <q-tooltip>{{ $t('common.actions.reload') }}</q-tooltip>
      </q-btn>
    </div>

    <!-- Relevé de la semaine affichée -->
    <section class="plaque edt__releve">
      <div class="edt__releve-cellule">
        <p class="pochoir">{{ $t('emploiDuTemps.summary.slots') }}</p>
        <p class="lettrage chiffres edt__releve-valeur">{{ totalCreneaux }}</p>
      </div>
      <div class="edt__releve-cellule">
        <p class="pochoir">{{ $t('emploiDuTemps.summary.hoursPerWeek') }}</p>
        <p class="lettrage avec-unite chiffres edt__releve-valeur">
          {{ heuresLisibles(totalHeures) }}
        </p>
      </div>
      <div class="edt__releve-cellule">
        <p class="pochoir">{{ $t('emploiDuTemps.summary.busiestDay') }}</p>
        <p class="lettrage edt__releve-valeur">{{ jourLePlusCharge }}</p>
      </div>
    </section>

    <!-- Sur téléphone, une grille de six jours est illisible : on choisit le jour -->
    <div v-if="ecranEtroit" class="edt__jours">
      <button
        v-for="j in semaine"
        :key="j.jour"
        type="button"
        class="pochoir edt__jour-bouton"
        :class="{ 'edt__jour-bouton--actif': jourActif === j.jour }"
        @click="jourActif = j.jour"
      >
        {{ j.libelle.slice(0, 3) }}
        <span class="edt__jour-compte chiffres">{{ j.creneaux.length }}</span>
      </button>
    </div>

    <q-inner-loading :showing="chargement" />

    <!-- Semaine sans le moindre créneau : on dit pourquoi, et par où sortir -->
    <div v-if="!chargement && !totalCreneaux" class="edt__etat-vide">
      <q-icon name="calendar_month" size="42px" />
      <span class="lettrage edt__etat-vide-titre">{{ $t('emploiDuTemps.emptyState.title') }}</span>
      <span class="pochoir edt__etat-vide-mention">
        {{ filtresActifs ? $t('emploiDuTemps.emptyState.filtered') : $t('emploiDuTemps.emptyState.default') }}
      </span>
      <div class="edt__etat-vide-actions">
        <q-btn
          v-if="filtresActifs"
          outline
          no-caps
          icon="filter_alt_off"
          :label="$t('emploiDuTemps.emptyState.removeFilters')"
          @click="reinitialiserFiltres"
        />
        <q-btn
          v-if="auth.peutTenirEmploiDuTemps"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('emploiDuTemps.emptyState.addSlot')"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <!-- La grille : axe des heures à gauche, une colonne par jour -->
    <div v-else-if="!ecranEtroit" class="grille">
      <div class="grille__axe">
        <div class="grille__coin" />
        <div v-for="h in heures" :key="h" class="grille__heure">
          <span class="pochoir chiffres">{{ $t('common.units.oClock', { h: String(h).padStart(2, '0') }) }}</span>
        </div>
      </div>

      <div v-for="j in semaine" :key="j.jour" class="grille__jour">
        <div class="grille__tete">
          <span class="lettrage grille__tete-nom">{{ j.libelle }}</span>
          <span class="pochoir pochoir--brut grille__tete-charge chiffres">
            {{
              $t('emploiDuTemps.week.dayHeader', { count: j.creneaux.length, hours: heuresLisibles(heuresDuJour(j)) })
            }}
          </span>
        </div>

        <div class="grille__colonne" :style="{ height: `${hauteurTotale}px` }">
          <div
            v-for="h in heures"
            :key="`l${h}`"
            class="grille__ligne"
            :style="{ top: `${(h - PREMIERE_HEURE) * HAUTEUR_HEURE}px` }"
          />

          <button
            v-for="c in disposer(j.creneaux)"
            :key="c.id"
            type="button"
            class="creneau"
            :class="{ 'creneau--inactif': !c.actif }"
            :style="c.style"
            @click="auth.peutTenirEmploiDuTemps && ouvrir(c)"
          >
            <span class="pochoir chiffres creneau__heure">{{ c.heureDebut }}–{{ c.heureFin }}</span>
            <span class="lettrage creneau__matiere">{{ c.affectation?.matiere?.intitule }}</span>
            <span class="creneau__enseignant">
              {{ c.affectation?.enseignant?.nom }} {{ c.affectation?.enseignant?.prenom }}
            </span>
            <span class="pochoir creneau__promotion">{{ c.affectation?.promotion?.nom }}</span>
            <span class="creneau__pied">
              <span class="pochoir creneau__type" :title="LIBELLE_TYPE_COURS[c.type]">{{ c.type }}</span>
              <span v-if="c.salle" class="plaque-salle">{{ c.salle.code }}</span>
            </span>
            <span v-if="libellePeriode(c)" class="pochoir creneau__periode chiffres">
              {{ libellePeriode(c) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Sur téléphone : la journée choisie, dans l'ordre des heures -->
    <ol v-else class="edt__liste">
      <li v-for="c in creneauxDuJourActif" :key="c.id">
        <button
          type="button"
          class="plaque creneau-ligne"
          :class="{ 'creneau--inactif': !c.actif }"
          :disabled="!auth.peutTenirEmploiDuTemps"
          @click="ouvrir(c)"
        >
          <span class="champ creneau-ligne__heure">
            <span class="lettrage chiffres">{{ c.heureDebut }}</span>
            <span class="pochoir chiffres">{{ c.heureFin }}</span>
          </span>
          <span class="creneau-ligne__corps">
            <span class="lettrage creneau-ligne__matiere">
              {{ c.affectation?.matiere?.intitule }}
            </span>
            <span class="creneau-ligne__enseignant">
              {{ c.affectation?.enseignant?.nom }} {{ c.affectation?.enseignant?.prenom }}
            </span>
            <span class="pochoir creneau-ligne__meta">
              {{ c.affectation?.promotion?.nom }}
              <span class="pochoir creneau__type" :title="LIBELLE_TYPE_COURS[c.type]">{{ c.type }}</span>
              <span v-if="c.salle" class="plaque-salle">{{ c.salle.code }}</span>
            </span>
            <span v-if="libellePeriode(c)" class="pochoir chiffres creneau__periode">
              {{ libellePeriode(c) }}
            </span>
          </span>
        </button>
      </li>
      <li v-if="!creneauxDuJourActif.length" class="edt__vide pochoir">
        {{ $t('emploiDuTemps.list.empty') }}
      </li>
    </ol>

    <dialogue-creneau v-model="dialogOuvert" :creneau="creneauEdite" :salles="salles" @enregistre="charger" />
    <dialogue-generation v-model="dialogGeneration" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueCreneau from '../components/DialogueCreneau.vue';
import DialogueGeneration from '../components/DialogueGeneration.vue';
import { LIBELLE_TYPE_COURS, decalerJours, heuresLisibles } from '@/shared/utils/libelles';
import type { Creneau, Enseignant, Promotion, Salle } from '@/types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const referentiels = useReferentielsStore();

/** Amplitude d'une journée universitaire, et échelle de la grille. */
const PREMIERE_HEURE = 7;
const DERNIERE_HEURE = 20;
const HAUTEUR_HEURE = 64;
const heures = Array.from({ length: DERNIERE_HEURE - PREMIERE_HEURE + 1 }, (_, i) => PREMIERE_HEURE + i);
const hauteurTotale = (DERNIERE_HEURE - PREMIERE_HEURE) * HAUTEUR_HEURE;

const semaine = ref<{ jour: number; libelle: string; creneaux: Creneau[] }[]>([]);
const salles = ref<Salle[]>([]);
const promotions = ref<Promotion[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const dialogGeneration = ref(false);
const creneauEdite = ref<Creneau | null>(null);
const jourActif = ref(1);

const filtres = ref({
  promotionId: null as string | null,
  enseignantId: null as string | null,
  salleId: null as string | null,
});

/** Lundi de la semaine affichée : un créneau limité à janvier ne doit pas
 *  encombrer la grille de mai. */
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

/** « du 01/01 au 31/01 » — ce qu'il faut lire sur le bloc, rien de plus. */
function libellePeriode(c: Creneau) {
  const jjmm = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
  if (c.dateDebut && c.dateFin) {
    return t('emploiDuTemps.period.fromTo', { from: jjmm(c.dateDebut), to: jjmm(c.dateFin) });
  }
  if (c.dateDebut) return t('emploiDuTemps.period.from', { from: jjmm(c.dateDebut) });
  if (c.dateFin) return t('emploiDuTemps.period.until', { to: jjmm(c.dateFin) });
  return '';
}

const ecranEtroit = computed(() => $q.screen.lt.md);

const optionsPromotions = computed(() => {
  if (auth.role === 'ETUDIANT') {
    const visibles = new Map(
      semaine.value.flatMap((jour) =>
        jour.creneaux.flatMap((c) =>
          c.affectation?.promotion ? [[c.affectation.promotion.id, c.affectation.promotion] as const] : [],
        ),
      ),
    );
    return [...visibles.entries()].map(([id, p]) => ({ label: p.nom, value: id }));
  }
  return promotions.value.map((p) => ({ label: p.nom, value: p.id }));
});
const optionsSalles = computed(() => salles.value.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })));

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const dureeH = (c: Creneau) => (minutes(c.heureFin) - minutes(c.heureDebut)) / 60;

const heuresDuJour = (j: { creneaux: Creneau[] }) => j.creneaux.reduce((t, c) => t + dureeH(c), 0);

const totalCreneaux = computed(() => semaine.value.reduce((t, j) => t + j.creneaux.length, 0));
const totalHeures = computed(() => semaine.value.reduce((t, j) => t + heuresDuJour(j), 0));

const jourLePlusCharge = computed(() => {
  const trie = [...semaine.value].sort((a, b) => heuresDuJour(b) - heuresDuJour(a))[0];
  return trie && heuresDuJour(trie) ? trie.libelle : '—';
});

const creneauxDuJourActif = computed(() => semaine.value.find((j) => j.jour === jourActif.value)?.creneaux ?? []);

/** Miroir des rôles que le menu principal autorise sur `/seances`. */
const peutVoirRegistre = computed(() => auth.peut('emploiDuTemps.voirRegistre'));

const filtresActifs = computed(
  () => !!filtres.value.promotionId || !!filtres.value.enseignantId || !!filtres.value.salleId,
);

function reinitialiserFiltres() {
  filtres.value = { promotionId: null, enseignantId: null, salleId: null };
}

/**
 * La semaine type produit les séances : le lien porte la même semaine et les
 * mêmes filtres, pour retrouver au registre ce qu'on lit sur la grille.
 */
const lienSeancesSemaine = computed(() => ({
  name: 'seances',
  query: {
    dateDebut: semaineDu.value,
    dateFin: decalerJours(semaineDu.value, 6),
    ...(filtres.value.enseignantId ? { enseignantId: filtres.value.enseignantId } : {}),
    ...(filtres.value.salleId ? { salleId: filtres.value.salleId } : {}),
  },
}));

/**
 * Place les créneaux dans la colonne du jour : position et hauteur selon
 * l'heure réelle, et répartition en couloirs quand deux cours se chevauchent —
 * c'est exactement ce qu'un panneau peint montre et qu'une pile de cartes cache.
 */
function disposer(creneaux: Creneau[]) {
  const tries = [...creneaux].sort((a, b) => minutes(a.heureDebut) - minutes(b.heureDebut));
  const couloirs: number[] = []; // fin du dernier créneau de chaque couloir

  const places = tries.map((c) => {
    const debut = minutes(c.heureDebut);
    const fin = minutes(c.heureFin);
    let couloir = couloirs.findIndex((f) => f <= debut);
    if (couloir === -1) {
      couloirs.push(fin);
      couloir = couloirs.length - 1;
    } else {
      couloirs[couloir] = fin;
    }
    return { c, debut, fin, couloir };
  });

  const nbCouloirs = Math.max(1, couloirs.length);

  return places.map(({ c, debut, fin, couloir }) => ({
    ...c,
    style: {
      top: `${((debut - PREMIERE_HEURE * 60) / 60) * HAUTEUR_HEURE}px`,
      height: `${Math.max(46, ((fin - debut) / 60) * HAUTEUR_HEURE - 4)}px`,
      left: `calc(${(couloir / nbCouloirs) * 100}% + 2px)`,
      width: `calc(${100 / nbCouloirs}% - 6px)`,
    },
  }));
}

function ouvrir(c: Creneau | null) {
  creneauEdite.value = c;
  dialogOuvert.value = true;
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
    const { data } = await api.get('/creneaux/emploi-du-temps', {
      params: {
        promotionId: filtres.value.promotionId || undefined,
        enseignantId: filtres.value.enseignantId || undefined,
        salleId: filtres.value.salleId || undefined,
        semaineDu: semaineDu.value,
      },
    });
    // Le week-end n'apparaît que s'il porte des cours.
    semaine.value = data.filter((j: any) => j.jour <= 5 || j.creneaux.length);
    if (!semaine.value.some((j) => j.jour === jourActif.value)) {
      jourActif.value = semaine.value[0]?.jour ?? 1;
    }
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });
watch(semaineDu, charger);

onMounted(async () => {
  // On ouvre sur le jour courant quand la semaine le contient.
  const js = new Date().getDay();
  jourActif.value = js === 0 ? 1 : js;
  await charger();

  // Les référentiels n'alimentent que les listes de filtres : leur échec ne
  // doit pas laisser la grille vide.
  try {
    [salles.value, promotions.value, enseignants.value] = await Promise.all([
      referentiels.salles(),
      auth.role === 'ETUDIANT' ? Promise.resolve([]) : referentiels.promotions(),
      referentiels.enseignants(),
    ]);
  } catch {
    // Les listes déroulantes restent vides : la grille, elle, est lisible.
  }
});
</script>

<style scoped lang="scss">
.edt {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.edt__semaine {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  margin-bottom: var(--up-3);
}

.edt__semaine-plaque {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--up-2) var(--up-3);
  cursor: pointer;
  color: var(--up-encre);

  &:hover {
    background: var(--up-craie);
  }
}

.edt__semaine-dates {
  font-size: 1.05rem;
}

.edt__semaine-note {
  color: var(--up-encre-douce);
  max-width: 34ch;
}

@media (max-width: 767px) {
  .edt__semaine-note {
    display: none;
  }
}

.edt__filtres {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: var(--up-2);
  align-items: center;
  margin-bottom: var(--up-3);
}

.edt__releve {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: var(--up-3);
}

.edt__releve-cellule {
  padding: var(--up-3);

  & + & {
    border-left: var(--up-filet);
  }
}

.edt__releve-valeur {
  font-size: clamp(1.3rem, 1rem + 1.4vw, 1.9rem);
  margin: var(--up-1) 0 0;
}

// ------------------------------------------------------------------ grille
.grille {
  display: grid;
  grid-template-columns: 62px repeat(auto-fit, minmax(0, 1fr));
  border: var(--up-filet);
  background: var(--up-plaque);
  overflow-x: auto;
}

.grille__axe {
  border-right: var(--up-filet);
}

.grille__coin {
  height: 54px;
  border-bottom: var(--up-filet);
  background: var(--up-chaux);
}

.grille__heure {
  height: 64px;
  padding: 2px 6px 0 0;
  text-align: right;
  color: var(--up-encre-douce);
  border-bottom: var(--up-filet-fin);

  &:last-child {
    border-bottom: 0;
  }
}

.grille__jour {
  min-width: 152px;
  border-right: var(--up-filet-fin);

  &:last-child {
    border-right: 0;
  }
}

// L'en-tête de colonne était un bandeau d'encre : sept aplats sombres en haut
// d'une grille, c'est le contraire d'une semaine qu'on lit d'un coup d'œil.
// Il devient un intitulé gris posé sur la surface, comme `.entete-jour`.
.grille__tete {
  height: 54px;
  padding: var(--up-2);
  background: var(--up-chaux);
  color: var(--up-encre);
  border-bottom: var(--up-filet);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.grille__tete-nom {
  font-size: 1rem;
}

.grille__tete-charge {
  color: var(--up-encre-douce);
}

.grille__colonne {
  position: relative;
}

.grille__ligne {
  position: absolute;
  left: 0;
  right: 0;
  border-top: var(--up-filet-fin);
}

// Une plaque de cours, posée à son heure.
.creneau {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 7px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--up-encre);
  background: var(--up-craie);
  border: var(--up-filet);
  transition: filter var(--up-transition);

  &:hover {
    filter: brightness(0.96);
  }
  &:focus-visible {
    outline: 2px solid #{$vert-action};
    outline-offset: -4px;
  }
}

.creneau--inactif {
  opacity: 0.55;
  background-image: repeating-linear-gradient(-45deg, rgba(16, 37, 30, 0.1) 0 6px, transparent 6px 12px);
}

.creneau__heure {
  color: var(--up-encre-douce);
}

.creneau__matiere {
  font-size: 0.82rem;
  line-height: 1.12;
}

.creneau__enseignant {
  font-size: 0.76rem;
  margin: 0;
}

.creneau__promotion {
  color: var(--up-encre-douce);
  font-size: 9.5px;
  letter-spacing: -0.01em;
}

.creneau__pied {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.creneau__periode {
  color: var(--up-jaune-fonce);
  letter-spacing: -0.01em;
}

.creneau__type {
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon-sm);
  color: var(--up-encre-douce);
  padding: 1px 6px;
}

// ----------------------------------------------------------------- mobile
.edt__jours {
  display: flex;
  margin-bottom: var(--up-3);
  overflow-x: auto;
}

.edt__jour-bouton {
  appearance: none;
  flex: 1 0 auto;
  background: var(--up-plaque);
  color: var(--up-encre);
  border: var(--up-filet);
  padding: 8px 12px;
  min-height: 52px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  & + & {
    border-left-width: 0;
  }

  &--actif {
    background: var(--up-plaque);
    color: var(--up-encre);
    box-shadow: var(--up-ombre-1);
  }
}

.edt__jour-compte {
  font-size: 13px;
}

.edt__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.creneau-ligne {
  appearance: none;
  width: 100%;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  min-height: 92px;
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  font: inherit;
  color: var(--up-encre);

  &:focus-visible {
    outline: 2px solid #{$vert-action};
    outline-offset: -4px;
  }
  &:disabled {
    cursor: default;
  }
}

.creneau-ligne__heure {
  flex-direction: column;
  background: var(--up-chaux);
  color: var(--up-encre);
  gap: 2px;
}

.creneau-ligne__corps {
  display: block;
  padding: var(--up-3);
  min-width: 0;
}

.creneau-ligne__matiere {
  display: block;
  font-size: 1rem;
}

.creneau-ligne__enseignant {
  display: block;
  margin-top: 3px;
  font-size: 0.9rem;
}

.creneau-ligne__meta {
  margin-top: 6px;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.edt__vide {
  padding: var(--up-6) var(--up-3);
  text-align: center;
  color: var(--up-encre-douce);
}

.edt__etat-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-6) var(--up-3);
  color: var(--up-encre-douce);
  text-align: center;
  border: var(--up-filet);
  background: var(--up-plaque);
}

.edt__etat-vide-titre {
  font-size: 1.3rem;
  color: var(--up-encre);
}

.edt__etat-vide-mention {
  max-width: 52ch;
}

.edt__etat-vide-actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-3);
}

@media (max-width: 767px) {
  /* Un filtre par ligne : les libellés « Promotion », « Enseignant »
     n’ont plus à se tronquer, et le rafraîchi reste à portée de pouce. */
  .edt__filtres {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .edt__filtres > .q-field {
    grid-column: 1;
  }
  .edt__releve {
    grid-template-columns: 1fr;
  }

  .edt__releve-cellule + .edt__releve-cellule {
    border-left: 0;
    border-top: var(--up-filet);
  }
}
</style>
