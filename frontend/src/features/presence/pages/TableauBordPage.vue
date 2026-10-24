<template>
  <q-page class="q-pa-md">
    <section-navigation section="presence" />
    <en-tete-page
      :title="$t('dashboard.title')"
      :subtitle="$t('dashboard.subtitle', { debut: dateLisible(dateDebut), fin: dateLisible(dateFin) })"
    >
      <template #actions>
        <champ-date v-model="dateDebut" :label="$t('common.actions.from')" style="width: 160px" />
        <champ-date v-model="dateFin" :label="$t('common.actions.to')" style="width: 160px" />
        <q-select
          v-model="departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.department')"
          style="min-width: 180px"
        />
        <q-btn
          round
          class="self-center"
          color="primary"
          icon="refresh"
          :aria-label="$t('dashboard.actions.refreshAria')"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>{{ $t('dashboard.actions.refreshTooltip') }}</q-tooltip>
        </q-btn>
      </template>
    </en-tete-page>

    <bandeau-situation-jour
      :jour="d?.jour ?? null"
      :peut-pointer="auth.peutPointer"
      :preparation-en-cours="preparationEnCours"
      :tournee-preparee-le="tourneePrepareeLe"
      :heure-preparation="heurePreparation"
      :lien-seances-jour="lienSeancesJour"
      @preparer-tournee="preparerTournee"
    />

    <releve-tableau-bord :kpis="kpis" />

    <tuiles-tableau-bord
      :rapport="d"
      :departement-id="departementId"
      :peut-voir-statistiques="peutVoirStatistiques"
      :lien-statistiques="lienStatistiques"
      :lien-seances-enseignant="lienSeancesEnseignant"
      @basculer-departement="basculerDepartement"
    />

    <q-inner-loading :showing="chargement" />
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { isAxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import { useSeancesStore } from '@/stores/seances';
import BandeauSituationJour from '../components/BandeauSituationJour.vue';
import ReleveTableauBord from '../components/ReleveTableauBord.vue';
import TuilesTableauBord from '../components/TuilesTableauBord.vue';
import { cleTourneePreparee } from '@/shared/services/cles-stockage';
import { aujourdhui, dateLisible, decalerJours, heuresLisibles, pourcentLisible } from '@/shared/utils/libelles';
import type { Departement } from '@/types';
import { rapportsService, type RapportTableauBord } from '../services/rapports';
import { affectationsService } from '../services/affectations';
import { seancesService } from '../services/seances';
import { verifierServeur } from '../services/systeme';
import type { KpiTableauBord } from '../types';

const auth = useAuthStore();
const referentiels = useReferentielsStore();
const seancesHorsLigne = useSeancesStore();
const $q = useQuasar();
const { t, locale } = useI18n();

const dateDebut = ref(decalerJours(aujourdhui(), -29));
const dateFin = ref(aujourdhui());
const departementId = ref<string | null>(null);
const departements = ref<Departement[]>([]);
const d = ref<RapportTableauBord | null>(null);
const chargement = ref(false);
const preparationEnCours = ref(false);
const tourneePrepareeLe = ref<string | null>(null);
const clePreparation = computed(() => {
  const userId = auth.utilisateur?.id;
  return userId ? cleTourneePreparee(userId) : null;
});
const heurePreparation = computed(() => {
  if (!tourneePrepareeLe.value) return '';
  return new Date(tourneePrepareeLe.value).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
});

const optionsDepartements = computed(() => departements.value.map((x) => ({ label: x.nom, value: x.id })));

const peutVoirStatistiques = computed(() => auth.peut('statistiques.voir'));

/** Les liens sortants transportent la période lue ici : on retrouve le même
 *  cadrage sur le registre et sur les relevés, pas les valeurs par défaut. */
const lienStatistiques = computed(() => ({
  name: 'statistiques',
  query: { onglet: 'enseignants', dateDebut: dateDebut.value, dateFin: dateFin.value },
}));

const lienSeancesJour = computed(() => ({
  name: 'seances',
  query: { dateDebut: dateDebut.value, dateFin: dateFin.value },
}));

function basculerDepartement(id: string) {
  if (id === 'sans') return;
  departementId.value = departementId.value === id ? null : id;
}

const lienSeancesEnseignant = (enseignantId: string) => ({
  name: 'seances',
  query: { enseignantId, dateDebut: dateDebut.value, dateFin: dateFin.value },
});

const kpis = computed<KpiTableauBord[]>(() => {
  const g = d.value?.global;
  return [
    {
      libelle: t('dashboard.kpis.plannedSessions'),
      valeur: g?.planifiees ?? 0,
      detail: t('dashboard.kpis.plannedSessionsDetail', {
        count: g?.controlees ?? 0,
        percent: pourcentLisible(g?.tauxControle),
      }),
    },
    {
      libelle: t('dashboard.kpis.presenceRate'),
      valeur: pourcentLisible(g?.tauxPresence),
      detail: t('dashboard.kpis.presenceRateDetail', { count: g?.assurees ?? 0 }),
    },
    {
      libelle: t('common.fields.absences'),
      valeur: g?.absent ?? 0,
      detail: t('dashboard.kpis.absencesDetail', {
        excused: g?.excuse ?? 0,
        late: g?.retard ?? 0,
      }),
    },
    {
      libelle: t('dashboard.kpis.hoursWorked'),
      valeur: heuresLisibles(g?.heuresRealisees),
      detail: t('dashboard.kpis.hoursWorkedDetail', { planned: heuresLisibles(g?.heuresPrevues) }),
    },
  ];
});

async function charger() {
  chargement.value = true;
  try {
    d.value = await rapportsService.dashboard({
      dateDebut: dateDebut.value,
      dateFin: dateFin.value,
      departementId: departementId.value || undefined,
    });
  } finally {
    chargement.value = false;
  }
}

/** Précharge les lectures utilisées par la tournée dans le cache PWA, lié au JWT courant. */
async function preparerTournee() {
  if (!navigator.onLine || !navigator.serviceWorker?.controller || !clePreparation.value) {
    $q.notify({ type: 'warning', message: t('dashboard.actions.prepareRequiresNetwork') });
    return;
  }

  preparationEnCours.value = true;
  const date = aujourdhui();
  try {
    // Le nonce empêche une ancienne réponse santé en cache de faire croire que
    // les données de la tournée viennent d'être rafraîchies.
    await verifierServeur();
    // `salles(true)` : la tournée doit repasser par le réseau, pas par le cache.
    const [, salles, affectations] = await Promise.all([
      seancesService.journee(date),
      referentiels.salles(true),
      affectationsService.toutes(),
    ]);
    await seancesHorsLigne.enregistrerAffectations(affectations.data ?? []);
    await seancesHorsLigne.enregistrerSalles(salles);
    const maintenant = new Date().toISOString();
    localStorage.setItem(clePreparation.value, JSON.stringify({ date, prepareeLe: maintenant }));
    tourneePrepareeLe.value = maintenant;
    $q.notify({ type: 'positive', message: t('dashboard.actions.roundPrepared') });
  } catch (e) {
    // Les erreurs de l'API sont notifiées par l'intercepteur ; reste le stockage local.
    if (!isAxiosError(e)) {
      $q.notify({ type: 'negative', message: t('dashboard.actions.prepareFailed') });
    }
  } finally {
    preparationEnCours.value = false;
  }
}

onMounted(async () => {
  if (clePreparation.value) {
    try {
      const preparation = JSON.parse(localStorage.getItem(clePreparation.value) ?? 'null');
      const age = preparation?.prepareeLe ? Date.now() - new Date(preparation.prepareeLe).getTime() : Infinity;
      if (preparation?.date === aujourdhui() && age >= 0 && age < 24 * 60 * 60 * 1000) {
        tourneePrepareeLe.value = preparation.prepareeLe;
      }
    } catch {
      tourneePrepareeLe.value = null;
    }
  }
  // Le référentiel n'aliment qu'une liste déroulante : son échec ne doit pas
  // priver la page de son tableau.
  try {
    departements.value = await referentiels.departements();
  } catch {
    departements.value = [];
  }
  await charger();
});

watch([dateDebut, dateFin, departementId], charger);
</script>
