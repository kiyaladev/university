<template>
  <q-page class="stats">
    <section-navigation section="presence" />
    <en-tete-page :title="$t('statistiques.title')" :subtitle="$t('statistiques.subtitle')">
      <template #actions>
        <div class="stats__periode">
          <champ-date
            v-model="filtres.dateDebut"
            :label="$t('common.actions.from')"
            @update:model-value="raccourciActif = ''"
          />
          <champ-date
            v-model="filtres.dateFin"
            :label="$t('common.actions.to')"
            @update:model-value="raccourciActif = ''"
          />
          <q-btn
            round
            color="primary"
            icon="refresh"
            :aria-label="$t('statistiques.filters.recalculateAria')"
            :loading="chargement"
            @click="charger"
          >
            <q-tooltip>{{ $t('common.actions.recalculate') }}</q-tooltip>
          </q-btn>
        </div>
      </template>
    </en-tete-page>

    <div class="stats__raccourcis">
      <button
        v-for="r in raccourcis"
        :key="r.jours"
        type="button"
        class="pochoir raccourci"
        :class="{ 'raccourci--actif': raccourciActif === r.jours }"
        :aria-pressed="raccourciActif === r.jours"
        @click="appliquer(r)"
      >
        {{ r.label }}
      </button>
    </div>

    <div class="stats__barre">
      <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
        <q-tab name="salles" icon="meeting_room" :label="$t('statistiques.tabs.salles')" no-caps />
        <q-tab name="enseignants" icon="school" :label="$t('statistiques.tabs.enseignants')" no-caps />
      </q-tabs>
    </div>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------- par salle -->
      <q-tab-panel name="salles" class="q-pa-none">
        <onglet-salles
          :rapport="salles"
          :chargement="chargement"
          :vue="vue"
          :date-debut="filtres.dateDebut"
          :date-fin="filtres.dateFin"
        />
      </q-tab-panel>

      <!-- -------------------------------------------------- par enseignant -->
      <q-tab-panel name="enseignants" class="q-pa-none">
        <onglet-enseignants
          :rapport="enseignants"
          :chargement="chargement"
          :vue="vue"
          :date-debut="filtres.dateDebut"
          :date-fin="filtres.dateFin"
          @imprimer-fiche="imprimerFiche"
        />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ChampDate from '@/shared/components/ChampDate.vue';
import OngletSalles from '../components/OngletSalles.vue';
import OngletEnseignants from '../components/OngletEnseignants.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { useImpressionFicheEnseignant } from '@/shared/composables/useImpressionFicheEnseignant';
import { aujourdhui, decalerJours } from '@/shared/utils/libelles';
import { rapportsService, type RapportAssiduite, type RapportSalles } from '../services/rapports';

const route = useRoute();
const { t } = useI18n();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

const onglet = ref<'salles' | 'enseignants'>(route.query.onglet === 'enseignants' ? 'enseignants' : 'salles');
const vue = usePresentationListe();
const chargement = ref(false);
const salles = ref<RapportSalles | null>(null);
const enseignants = ref<RapportAssiduite | null>(null);

const filtres = ref({
  dateDebut: route.query.dateDebut ? String(route.query.dateDebut) : decalerJours(aujourdhui(), -29),
  dateFin: route.query.dateFin ? String(route.query.dateFin) : aujourdhui(),
});

const raccourcis = computed(() => [
  { label: t('statistiques.shortcuts.d7'), jours: 7 },
  { label: t('statistiques.shortcuts.d30'), jours: 30 },
  { label: t('statistiques.shortcuts.d90'), jours: 90 },
]);

// La période choisie doit se voir : sans état actif, les trois raccourcis
// ressemblent à trois boutons inertes.
const raccourciActif = ref<number | ''>(route.query.dateDebut ? '' : 30);

const appliquer = (r: (typeof raccourcis.value)[number]) => {
  raccourciActif.value = r.jours;
  filtres.value = {
    dateDebut: decalerJours(aujourdhui(), -(r.jours - 1)),
    dateFin: aujourdhui(),
  };
};

function imprimerFiche(id: string) {
  ouvrirFicheEnseignant(id, filtres.value.dateDebut, filtres.value.dateFin);
}

async function charger() {
  chargement.value = true;
  try {
    const [s, e] = await Promise.all([
      rapportsService.salles(filtres.value),
      rapportsService.presenceEnseignants(filtres.value),
    ]);
    salles.value = s;
    enseignants.value = e;
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });
onMounted(charger);
</script>

<style scoped lang="scss">
.stats {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.stats__periode {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

// Même gouttière que le registre des séances ; le reste vient de la règle
// globale `.raccourci` d'app.scss.
.stats__raccourcis {
  display: inline-flex;
  align-self: flex-start;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon);
  padding: 3px;
  gap: 2px;
  margin-bottom: var(--up-3);
}

.stats__barre {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .stats__barre {
    align-items: stretch;
  }
  .stats__periode {
    width: 100%;
  }
}
</style>
