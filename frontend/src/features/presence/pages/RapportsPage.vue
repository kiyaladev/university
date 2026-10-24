<template>
  <q-page class="q-pa-md">
    <section-navigation section="presence" />
    <en-tete-page :title="$t('rapports.title')" :subtitle="$t('rapports.subtitle')" />

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm items-center">
        <div class="col-6 col-md-2">
          <champ-date v-model="filtres.dateDebut" :label="$t('common.actions.from')" />
        </div>
        <div class="col-6 col-md-2">
          <champ-date v-model="filtres.dateFin" :label="$t('common.actions.to')" />
        </div>
        <div class="col-12 col-md-3">
          <q-select
            v-model="filtres.departementId"
            :options="optionsDepartements"
            outlined
            dense
            clearable
            emit-value
            map-options
            :label="$t('common.fields.department')"
          />
        </div>
        <div class="col-12 col-md-3">
          <q-select
            v-model="filtres.promotionId"
            :options="optionsPromotions"
            outlined
            dense
            clearable
            emit-value
            map-options
            :label="$t('rapports.filters.promotion')"
          />
        </div>
        <div class="col-auto">
          <q-btn
            round
            color="primary"
            icon="refresh"
            :aria-label="$t('rapports.actions.reloadAria')"
            :loading="chargement"
            @click="charger"
          >
            <q-tooltip>{{ $t('rapports.actions.reloadTooltip') }}</q-tooltip>
          </q-btn>
        </div>
        <div class="col-auto">
          <q-btn
            v-if="onglet !== 'controleurs'"
            outline
            color="secondary"
            no-caps
            icon="table_view"
            :label="$t('rapports.actions.export', { onglet: libelleOnglet })"
            @click="exporter"
          >
            <q-tooltip>
              {{ $t('rapports.actions.exportTooltip', { onglet: libelleOnglet, periode: periodeLisible }) }}
            </q-tooltip>
          </q-btn>
        </div>
        <div class="col-12 text-caption text-grey-7">
          {{ $t('rapports.period.analyzed', { periode: periodeLisible }) }}
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="peutSignerReleve" flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">{{ $t('rapports.releveSigne.title') }}</div>
          <div class="text-caption text-grey-7">{{ $t('rapports.releveSigne.description') }}</div>
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn
            color="primary"
            unelevated
            icon="draw"
            no-caps
            :label="$t('rapports.releveSigne.action')"
            @click="dialogReleve = true"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="assiduite" icon="how_to_reg" :label="$t('rapports.tabs.assiduite')" no-caps />
      <q-tab name="volume" icon="timelapse" :label="$t('rapports.tabs.volume')" no-caps />
      <q-tab
        v-if="peutVoirCouverture"
        name="controleurs"
        icon="route"
        :label="$t('rapports.tabs.controleurs')"
        no-caps
      />
      <q-tab v-if="peutVoirPaiement" name="paiement" icon="payments" :label="$t('rapports.tabs.paiement')" no-caps />
      <q-tab name="registre" icon="menu_book" :label="$t('rapports.tabs.registre')" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- Assiduité -->
      <q-tab-panel name="assiduite" class="q-pa-none">
        <onglet-assiduite :rapport="assiduite" :chargement="chargement" @imprimer-fiche="imprimerFiche" />
      </q-tab-panel>

      <!-- Volume horaire -->
      <q-tab-panel name="volume" class="q-pa-none">
        <onglet-volume :rapport="volume" :chargement="chargement" />
      </q-tab-panel>

      <q-tab-panel v-if="peutVoirCouverture" name="controleurs" class="q-pa-none">
        <onglet-controleurs :rapport="couverture" :chargement="chargement" />
      </q-tab-panel>

      <!-- État de paiement -->
      <q-tab-panel v-if="peutVoirPaiement" name="paiement" class="q-pa-none">
        <onglet-paiement
          v-model:statut-enseignant="statutEnseignant"
          :rapport="paiement"
          :chargement="chargement"
          :periode-lisible="periodeLisible"
          @imprimer="imprimerPaiement"
        />
      </q-tab-panel>

      <!-- Registre -->
      <q-tab-panel name="registre" class="q-pa-none">
        <onglet-registre
          :rapport="registre"
          :chargement="chargement"
          :periode-lisible="periodeLisible"
          @imprimer="imprimerRegistre"
        />
      </q-tab-panel>
    </q-tab-panels>

    <dialogue-releve-signe
      v-model="dialogReleve"
      :departement-id="auth.utilisateur?.departementId ?? null"
      @genere="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import { useImpressionFicheEnseignant } from '@/shared/composables/useImpressionFicheEnseignant';
import OngletAssiduite from '../components/OngletAssiduite.vue';
import OngletVolume from '../components/OngletVolume.vue';
import OngletControleurs from '../components/OngletControleurs.vue';
import OngletPaiement from '../components/OngletPaiement.vue';
import OngletRegistre from '../components/OngletRegistre.vue';
import DialogueReleveSigne from '../components/DialogueReleveSigne.vue';
import { rapportsService } from '../services/rapports';
import type {
  RapportAssiduite,
  RapportCouverture,
  RapportPaiement,
  RapportRegistre,
  RapportVolumeHoraire,
} from '../services/rapports';
import { aujourdhui, dateLisible, decalerJours } from '@/shared/utils/libelles';
import type { Departement, Promotion } from '@/types';
import { ouvrirImpression, telechargerFichier } from '@/shared/services/impression';

const auth = useAuthStore();
const referentiels = useReferentielsStore();
const peutVoirPaiement = computed(() => auth.peut('rapports.voirEtatPaiement'));
const peutVoirCouverture = computed(() => auth.peut('rapports.voirCouverture'));
const peutSignerReleve = computed(() => auth.peut('rapports.signerReleve') && !!auth.utilisateur?.departementId);
const { t } = useI18n();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

/** Périmètre de chaque onglet : sert au libellé du bouton d'export et au chemin d'API. */
const ONGLETS: Record<string, { chemin: string }> = {
  assiduite: { chemin: 'presence-enseignants' },
  volume: { chemin: 'volume-horaire' },
  paiement: { chemin: 'etat-paiement' },
  registre: { chemin: 'registre' },
};

const onglet = ref('assiduite');
const chargement = ref(false);
const assiduite = ref<RapportAssiduite | null>(null);
const volume = ref<RapportVolumeHoraire | null>(null);
const paiement = ref<RapportPaiement | null>(null);
const registre = ref<RapportRegistre | null>(null);
const couverture = ref<RapportCouverture | null>(null);
const departements = ref<Departement[]>([]);
const promotions = ref<Promotion[]>([]);
const statutEnseignant = ref<string | null>('VACATAIRE');
const dialogReleve = ref(false);

const filtres = ref({
  dateDebut: decalerJours(aujourdhui(), -30),
  dateFin: aujourdhui(),
  departementId: null as string | null,
  promotionId: null as string | null,
});

const optionsDepartements = computed(() => departements.value.map((d) => ({ label: d.nom, value: d.id })));
const optionsPromotions = computed(() => promotions.value.map((p) => ({ label: p.nom, value: p.id })));

const libelleOnglet = computed(() => {
  const cles = ['assiduite', 'volume', 'paiement', 'registre'];
  return cles.includes(onglet.value) ? t(`rapports.onglets.${onglet.value}`) : t('rapports.onglets.defaut');
});
const periodeLisible = computed(() =>
  t('rapports.period.range', { debut: dateLisible(filtres.value.dateDebut), fin: dateLisible(filtres.value.dateFin) }),
);

function parametres() {
  return {
    dateDebut: filtres.value.dateDebut,
    dateFin: filtres.value.dateFin,
    departementId: filtres.value.departementId || undefined,
    promotionId: filtres.value.promotionId || undefined,
  };
}

/**
 * Une impression ou un export porte exactement les mêmes filtres que le tableau
 * affiché — promotion comprise, sans quoi le CSV ne correspondrait pas à ce que
 * l'écran montre.
 */
function chemin(base: string, suffixe: string, extra: Record<string, string | undefined> = {}) {
  return { chemin: `/${base}/${suffixe}`, params: { ...parametres(), ...extra } };
}

const extraStatutEnseignant = (): Record<string, string | undefined> =>
  onglet.value === 'paiement' || statutEnseignant.value
    ? { statutEnseignant: statutEnseignant.value ?? undefined }
    : {};

/** Export CSV de l'onglet affiché, filtres et période inclus. */
function exporter() {
  const { chemin: c, params } = chemin('export', ONGLETS[onglet.value].chemin, extraStatutEnseignant());
  void telechargerFichier(c, params, `${onglet.value}.csv`);
}

const imprimerRegistre = () => {
  const { chemin: c, params } = chemin('impression', 'registre');
  void ouvrirImpression(c, params);
};

const imprimerPaiement = () => {
  const { chemin: c, params } = chemin('impression', 'etat-paiement', extraStatutEnseignant());
  void ouvrirImpression(c, params);
};
const imprimerFiche = (id: string) => ouvrirFicheEnseignant(id, filtres.value.dateDebut, filtres.value.dateFin);

async function charger() {
  chargement.value = true;
  try {
    const p = parametres();
    const [a, v, pa, r, c] = await Promise.all([
      rapportsService.presenceEnseignants(p),
      rapportsService.volumeHoraire(p),
      peutVoirPaiement.value
        ? rapportsService.etatPaiement({ ...p, statutEnseignant: statutEnseignant.value || undefined })
        : Promise.resolve(null),
      rapportsService.registre(p),
      peutVoirCouverture.value ? rapportsService.couvertureControleurs(p) : Promise.resolve(null),
    ]);
    assiduite.value = a;
    volume.value = v;
    paiement.value = pa;
    registre.value = r;
    couverture.value = c;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });
watch(statutEnseignant, charger);

onMounted(async () => {
  try {
    [departements.value, promotions.value] = await Promise.all([
      referentiels.departements(),
      referentiels.promotions(),
    ]);
  } catch {
    /* l'intercepteur axios a déjà affiché le motif ; la page reste utilisable sans filtres */
  }
  await charger();
});
</script>

<style scoped lang="scss"></style>
