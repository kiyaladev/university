<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('paie.title')" :subtitle="$t('paie.subtitle')">
      <template v-if="peutCreer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('paie.actions.newSheet')"
          @click="dialogCreation = true"
        />
      </template>
    </en-tete-page>

    <barre-filtres v-model="filtres" :recherche="false" :chips="chipsFiltres" @reinitialiser="liste.reinitialiser([])">
      <template #actions>
        <q-btn
          flat
          dense
          round
          color="primary"
          icon="refresh"
          :aria-label="$t('paie.ariaLabels.reload')"
          :loading="liste.chargement"
          @click="liste.recharger()"
        >
          <q-tooltip>{{ $t('common.actions.reload') }}</q-tooltip>
        </q-btn>
      </template>
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
        <q-select
          v-model="filtres.annee"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.year')"
        />
      </template>
    </barre-filtres>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ $t('paie.summary.sheetsCount', { count: liste.total }) }} {{ $t('common.format.emptyValue') }}
      {{ filtres.statut ? LIBELLE_STATUT_PAIE[filtres.statut].toLowerCase() : $t('paie.summary.allStatuses') }},
      {{ filtres.annee ?? $t('paie.summary.allYears') }} · {{ $t('paie.summary.totalShown') }}
      {{ montantLisible(totalMontant) }} {{ $t('common.units.gnf') }}
    </div>

    <!-- Vue tableau -->
    <tableau-feuilles-paie
      v-if="modeVue === 'tableau'"
      :lignes="liste.lignes"
      :chargement="liste.chargement"
      :a-des-filtres="aDesFiltres"
      :peut-creer="peutCreer"
      :peut-imprimer="peutImprimer"
      @detail="ouvrirDetail"
      @recalculer="recalculer"
      @valider="valider"
      @payer="payer"
      @imprimer="imprimer"
      @supprimer="supprimer"
      @reinitialiser="liste.reinitialiser([])"
      @creer="dialogCreation = true"
    />

    <!-- Vue cartes -->
    <cartes-feuilles-paie
      v-else
      :lignes="liste.lignes"
      :chargement="liste.chargement"
      :a-des-filtres="aDesFiltres"
      :peut-creer="peutCreer"
      :peut-imprimer="peutImprimer"
      @detail="ouvrirDetail"
      @recalculer="recalculer"
      @valider="valider"
      @payer="payer"
      @imprimer="imprimer"
      @supprimer="supprimer"
      @reinitialiser="liste.reinitialiser([])"
      @creer="dialogCreation = true"
    />

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <!-- Détail : lignes de la feuille -->
    <dialogue-detail-feuille-paie
      v-model:ouvert="dialogDetail"
      :feuille="detail"
      :peut-imprimer="peutImprimer"
      @imprimer="imprimer"
    />

    <dialogue-feuille-paie
      v-model="dialogCreation"
      :annees-existantes="anneesExistantes"
      @enregistre="liste.recharger()"
      @calculer="avecNouvelleFeuille"
    />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { pageApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';

import { useAuthStore } from '@/stores/auth';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import DialogueFeuillePaie from '../components/DialogueFeuillePaie.vue';
import DialogueDetailFeuillePaie from '../components/DialogueDetailFeuillePaie.vue';
import TableauFeuillesPaie from '../components/TableauFeuillesPaie.vue';
import CartesFeuillesPaie from '../components/CartesFeuillesPaie.vue';
import { paieService, type ActionFeuillePaie } from '../services/paie';
import { LIBELLE_STATUT_PAIE, montantLisible } from '@/shared/utils/libelles';
import type { FeuillePaie } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const modeVue = usePresentationListe();
const dialogCreation = ref(false);
const dialogDetail = ref(false);
const detail = ref<FeuillePaie | null>(null);

// La barre de filtres travaille sur un Record : la recherche plein texte est
// désactivée parce que l'API des feuilles n'indexe rien d'autre que le couple
// statut / année — un champ de recherche inerte serait un mensonge.
const filtres = ref<Record<string, any>>({ statut: null, annee: null });

/** Feuilles de paie : paginées côté serveur, filtres gardés dans l'URL. Un
 *  changement de filtre repart de la première page. */
const liste = reactive(
  useListePaginee<FeuillePaie>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      paieService.liste({ ...pageApi(p), statut: f.statut || undefined, annee: f.annee || undefined }),
  }),
);

const peutCreer = computed(() => auth.peut('paie.creer'));
const peutImprimer = computed(() => auth.peut('paie.imprimer'));
const aDesFiltres = computed(() => !!filtres.value.statut || !!filtres.value.annee);

const optionsStatuts = ['BROUILLON', 'VALIDE', 'PAYE'].map((v) => ({
  label: LIBELLE_STATUT_PAIE[v],
  value: v,
}));

const chipsFiltres = computed(() => {
  const chips: Array<{ label: string; value: string }> = [];
  if (filtres.value.statut) {
    chips.push({
      label: t('paie.filters.statutChip', { value: LIBELLE_STATUT_PAIE[filtres.value.statut] }),
      value: filtres.value.statut,
    });
  }
  if (filtres.value.annee) {
    chips.push({
      label: t('paie.filters.anneeChip', { value: filtres.value.annee }),
      value: filtres.value.annee,
    });
  }
  return chips;
});

const anneesExistantes = computed(() => liste.lignes.map((f) => f.annee));

const optionsAnnees = computed(() => {
  const courante = new Date().getFullYear();
  const annees = new Set<number>([
    courante,
    courante - 1,
    courante - 2,
    ...anneesExistantes.value,
    ...(filtres.value.annee ? [Number(filtres.value.annee)] : []),
  ]);
  return [...annees].sort((a, b) => b - a).map((a) => ({ label: String(a), value: a }));
});

const totalMontant = computed(() => liste.lignes.reduce((t, f) => t + (f.montantTotal ?? 0), 0));

function ouvrirDetail(f: FeuillePaie) {
  detail.value = f;
  dialogDetail.value = true;
}

async function avecNouvelleFeuille(f: FeuillePaie) {
  dialogDetail.value = false;
  await recalculer(f);
}

/** Action du cycle de vie après confirmation : la feuille rendue devient le détail. */
async function agir(
  f: FeuillePaie,
  action: ActionFeuillePaie,
  dialogue: 'recalculate' | 'validate' | 'markPaid',
  succes: string,
) {
  const ok = await confirmer({
    titre: t(`paie.dialogs.${dialogue}.title`),
    message: t(`paie.dialogs.${dialogue}.message`, { libelle: f.libelle, montant: montantLisible(f.montantTotal) }),
    ok: t(`paie.dialogs.${dialogue}.ok`),
    couleur: dialogue === 'validate' ? 'positive' : 'primary',
  });
  if (!ok) return;
  const feuille = await paieService.action(f.id, action);
  $q.notify({ type: 'positive', message: t(succes) });
  detail.value = feuille;
  await liste.recharger();
}

/** Recalcul idempotent des heures contrôlées de la période. */
const recalculer = (f: FeuillePaie) => agir(f, 'calculer', 'recalculate', 'paie.messages.recalculated');
const valider = (f: FeuillePaie) => agir(f, 'valider', 'validate', 'paie.messages.validated');
const payer = (f: FeuillePaie) => agir(f, 'payer', 'markPaid', 'paie.messages.paid');

function imprimer(f: FeuillePaie) {
  void ouvrirImpression(`/feuilles-paie/${f.id}/imprimer`);
}

async function supprimer(f: FeuillePaie) {
  const ok = await confirmer({
    titre: t('paie.dialogs.delete.title'),
    message: t('paie.dialogs.delete.message', { libelle: f.libelle }),
    ok: t('paie.dialogs.delete.ok'),
    danger: true,
  });
  if (!ok) return;
  // L'intercepteur axios affiche le motif d'un échec : on ne notifie que le succès.
  await paieService.supprimer(f.id);
  $q.notify({ type: 'positive', message: t('paie.messages.deleted') });
  if (detail.value?.id === f.id) dialogDetail.value = false;
  await liste.recharger();
}
</script>
