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

    <releve-emploi-du-temps :creneaux="totalCreneaux" :heures="totalHeures" :jour-charge="jourLePlusCharge" />

    <!-- Sur téléphone, une grille de six jours est illisible : on choisit le jour -->
    <nav-jours-semaine v-if="ecranEtroit" v-model:jour-actif="jourActif" :semaine="semaine" />

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
    <grille-emploi-du-temps
      v-else-if="!ecranEtroit"
      :semaine="semaine"
      :peut-tenir="auth.peutTenirEmploiDuTemps"
      @ouvrir="ouvrir"
    />

    <!-- Sur téléphone : la journée choisie, dans l'ordre des heures -->
    <liste-creneaux-jour
      v-else
      :creneaux="creneauxDuJourActif"
      :peut-tenir="auth.peutTenirEmploiDuTemps"
      @ouvrir="ouvrir"
    />

    <dialogue-creneau v-model="dialogOuvert" :creneau="creneauEdite" :salles="salles" @enregistre="charger" />
    <dialogue-generation v-model="dialogGeneration" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueCreneau from '../components/DialogueCreneau.vue';
import DialogueGeneration from '../components/DialogueGeneration.vue';
import GrilleEmploiDuTemps from '../components/GrilleEmploiDuTemps.vue';
import ListeCreneauxJour from '../components/ListeCreneauxJour.vue';
import NavJoursSemaine from '../components/NavJoursSemaine.vue';
import ReleveEmploiDuTemps from '../components/ReleveEmploiDuTemps.vue';
import { decalerJours } from '@/shared/utils/libelles';
import { creneauxService, type JourEmploiDuTemps } from '../services/creneaux';
import { dureeHeuresCreneau } from '../utils/creneaux';
import type { Creneau, Enseignant, Promotion, Salle } from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();

const semaine = ref<JourEmploiDuTemps[]>([]);
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

const heuresDuJour = (j: { creneaux: Creneau[] }) => j.creneaux.reduce((t, c) => t + dureeHeuresCreneau(c), 0);

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
    const jours = await creneauxService.emploiDuTemps({
      promotionId: filtres.value.promotionId || undefined,
      enseignantId: filtres.value.enseignantId || undefined,
      salleId: filtres.value.salleId || undefined,
      semaineDu: semaineDu.value,
    });
    // Le week-end n'apparaît que s'il porte des cours.
    semaine.value = (jours ?? []).filter((j) => j.jour <= 5 || j.creneaux.length);
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
     n'ont plus à se tronquer, et le rafraîchi reste à portée de pouce. */
  .edt__filtres {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .edt__filtres > .q-field {
    grid-column: 1;
  }
}
</style>
