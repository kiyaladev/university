<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('stages.title')" :subtitle="$t('stages.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('stages.actions.new')"
          @click="ouvrirCreation"
        />
      </template>
    </en-tete-page>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="travaux" icon="view_kanban" :label="$t('stages.tabs.works')" no-caps />
      <q-tab name="soutenances" icon="event" :label="$t('stages.tabs.defenses')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- TRAVAUX : liste et suivi                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'travaux'" name="travaux" class="q-pa-none q-mt-md">
      <stages-travaux-panel
        v-model:filtres="filtresTravaux"
        :lignes="trav.lignes"
        :chargement="trav.chargement"
        :chips="chipsTravaux"
        @reinitialiser="trav.reinitialiser()"
        @creer="ouvrirCreation"
        @edition="ouvrirEdition"
        @soutenance="ouvrirSoutenance"
        @jury="ouvrirJury"
        @detail="ouvrirDetail"
        @transition="transition"
        @rapport="basculerRapport"
        @imprimer="imprimer"
        @supprimer="supprimer"
      />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- SOUTENANCES : calendrier des soutenances à venir                   -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'soutenances'" name="soutenances" class="q-pa-none q-mt-md">
      <stages-soutenances-panel
        v-model:filtres="filtresSoutenances"
        :soutenances="soutenancesAVenir"
        :travaux="trav.lignes"
        :chips="chipsSoutenances"
        @reinitialiser="filtresSoutenances = { recherche: '', statut: null }"
        @detail="ouvrirDetail"
      />
    </q-tab-panel>

    <!-- Dialog création / édition -->
    <dialogue-travail v-model="dialogTravail" :travail="travailEdite" @enregistre="charger" />

    <!-- Dialog soutenance (planification ou constat du jury) -->
    <dialogue-soutenance
      v-if="travailSoutenance"
      v-model="dialogSoutenance"
      :travail="travailSoutenance"
      :mode="modeSoutenance"
      @enregistre="charger"
    />

    <!-- Détail -->
    <stages-travail-detail :travail="detail" @close="detail = null" />
  </q-page>
</template>

<script setup lang="ts">
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueSoutenance from '../components/DialogueSoutenance.vue';
import DialogueTravail from '../components/DialogueTravail.vue';
import StagesSoutenancesPanel from '../components/StagesSoutenancesPanel.vue';
import StagesTravailDetail from '../components/StagesTravailDetail.vue';
import StagesTravauxPanel from '../components/StagesTravauxPanel.vue';
import { texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '@/stores/auth';
import { ouvrirImpression } from '@/shared/services/impression';
import { soutenancesService } from '../services/soutenances';
import { travauxService } from '../services/travaux';
import { LIBELLE_STATUT_ENCADREMENT, LIBELLE_TYPE_ENCADREMENT } from '@/shared/utils/libelles';
import { aujourdhui } from '@/shared/utils/format';
import type { ChipFiltre, StatutEncadrement, TravailEncadre } from '@/types';
import type { SoutenanceCalendrier } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer, supprimerAvecConfirmation } = useConfirmation();

const onglet = ref<'travaux' | 'soutenances'>('travaux');

const soutenancesAVenir = ref<SoutenanceCalendrier[]>([]);
const detail = ref<TravailEncadre | null>(null);

const filtresTravaux = ref<Record<string, any>>({
  recherche: '',
  type: null,
  statut: null,
  encadrantId: null,
});

/**
 * Travaux : l'API ne pagine pas, le q-table le fait. Le statut reste un filtre
 * d'affichage (`clesLocales`) : envoyé au serveur, il viderait les compteurs
 * des autres états.
 */
const trav = reactive(
  useListePaginee<TravailEncadre>({
    filtres: filtresTravaux,
    pageSize: 0,
    syncUrl: true,
    clesLocales: ['statut'],
    charger: ({ filtres: f }) =>
      travauxService
        .liste({
          all: '1',
          search: texteApi(f.recherche),
          type: f.type || undefined,
          encadrantId: f.encadrantId || undefined,
        })
        .then((data) => ({ data })),
  }),
);

// Les filtres de soutenance sont purement locaux : aucun rechargement.
const filtresSoutenances = ref<Record<string, any>>({
  recherche: '',
  statut: null,
});

const dialogTravail = ref(false);
const travailEdite = ref<TravailEncadre | null>(null);
const dialogSoutenance = ref(false);
const travailSoutenance = ref<TravailEncadre | null>(null);
const modeSoutenance = ref<'planifier' | 'jury'>('planifier');

function chipsCommuns(f: Record<string, any>): ChipFiltre[] {
  const cs: ChipFiltre[] = [];
  if (f.recherche) cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  if (f.type) cs.push({ label: LIBELLE_TYPE_ENCADREMENT[f.type] ?? f.type, value: f.type, icone: 'work', cle: 'type' });
  if (f.statut)
    cs.push({ label: LIBELLE_STATUT_ENCADREMENT[f.statut] ?? f.statut, value: f.statut, icone: 'flag', cle: 'statut' });
  return cs;
}

/** Chips des filtres actifs : sans elles, BarreFiltres masque « Réinitialiser ». */
const chipsTravaux = computed(() => {
  const f = filtresTravaux.value;
  const cs = chipsCommuns(f);
  if (f.encadrantId)
    cs.push({
      label: t('stages.filters.supervisorFiltered'),
      value: f.encadrantId,
      icone: 'person',
      cle: 'encadrantId',
    });
  return cs;
});

const chipsSoutenances = computed(() => chipsCommuns(filtresSoutenances.value));

const peutCreer = computed(() => auth.peut('stages.creer'));

function ouvrirCreation() {
  travailEdite.value = null;
  dialogTravail.value = true;
}

function ouvrirEdition(tr: TravailEncadre) {
  if (!peutCreer.value) return;
  travailEdite.value = tr;
  dialogTravail.value = true;
}

function ouvrirSoutenance(tr: TravailEncadre) {
  travailSoutenance.value = tr;
  modeSoutenance.value = 'planifier';
  dialogSoutenance.value = true;
}

function ouvrirJury(tr: TravailEncadre) {
  travailSoutenance.value = tr;
  modeSoutenance.value = 'jury';
  dialogSoutenance.value = true;
}

function ouvrirDetail(tr: TravailEncadre | null) {
  detail.value = tr;
}

async function transition(travail: TravailEncadre, cible: StatutEncadrement) {
  const libelle = LIBELLE_STATUT_ENCADREMENT[cible] ?? cible;
  const ok = await confirmer({
    titre: t('stages.dialogs.transition.title', { label: libelle }),
    message:
      cible === 'ABANDONNE'
        ? t('stages.dialogs.transition.abandonMessage')
        : cible === 'SOUTENU'
          ? t('stages.dialogs.transition.defendedMessage')
          : t('stages.dialogs.transition.defaultMessage'),
    danger: cible === 'ABANDONNE',
  });
  if (!ok) return;
  try {
    await travauxService.transition(travail.id, cible);
    $q.notify({ type: 'positive', message: t('stages.notifications.transitionSuccess', { label: libelle }) });
    await charger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

async function basculerRapport(travail: TravailEncadre, rendu: boolean) {
  try {
    await travauxService.modifier(travail.id, { rapportRendu: rendu });
    $q.notify({
      type: 'positive',
      message: rendu ? t('stages.notifications.reportMarkedDone') : t('stages.notifications.reportMarkedPending'),
    });
    await charger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

function imprimer(tr: TravailEncadre) {
  void ouvrirImpression(`/travaux-encadres/${tr.id}/fiche`);
}

function supprimer(travail: TravailEncadre) {
  void supprimerAvecConfirmation(`/travaux-encadres/${travail.id}`, travail.intitule, charger, {
    titre: t('stages.dialogs.delete.title'),
    message: t('stages.dialogs.delete.message', { title: travail.intitule }),
    ok: t('common.actions.delete'),
    succes: t('stages.notifications.deleted'),
  });
}

/** Calendrier des soutenances : réservé à la scolarité, fenêtre à venir. */
async function chargerSoutenances() {
  if (!peutCreer.value) return;
  try {
    const data = await soutenancesService.liste();
    const dateMin = aujourdhui();
    soutenancesAVenir.value = (data ?? []).filter((s) => s.date.slice(0, 10) >= dateMin);
  } catch {
    soutenancesAVenir.value = [];
  }
}

/** Après une action : la liste des travaux et le calendrier bougent ensemble. */
function charger() {
  return Promise.all([trav.recharger(), chargerSoutenances()]);
}

onMounted(() => {
  void chargerSoutenances();
});
</script>
