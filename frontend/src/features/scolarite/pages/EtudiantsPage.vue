<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('common.fields.students')" :subtitle="$t('etudiants.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('etudiants.actions.new')"
          @click="ouvrir(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('etudiants.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <champ-recherche
          v-model="filtres.promotionId"
          endpoint="/promotions"
          :label-fn="(p) => p.nom"
          :label="$t('etudiants.filters.promotion')"
          clearable
        />
        <q-select
          v-model="filtres.actif"
          :options="optionsActif"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
        <q-select
          v-model="filtres.sexe"
          :options="optionsSexe"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('etudiants.filters.gender')"
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('etudiants.filters.registeredFrom')" />
        <champ-date v-model="filtres.dateFin" :label="$t('etudiants.filters.registeredTo')" />
      </template>
    </barre-filtres>

    <etudiants-liste-panel
      :mode="modeVue"
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :peut-gerer="peutGerer"
      :peut-valider-voir="peutValiderVoir"
      :peut-voir-paiements="peutVoirPaiements"
      :est-admin="auth.estAdmin"
      @ouvrir="ouvrir"
      @basculer-actif="basculerActif"
      @voir-inscriptions="voirInscriptions"
      @aller-aux-inscriptions="allerAuxInscriptions"
      @aller-aux-paiements="allerAuxPaiements"
      @aller-aux-evaluations="allerAuxEvaluations"
      @imprimer-attestation="imprimerAttestation"
      @reinitialiser="reinitialiser"
      @creer="ouvrir(null)"
    />

    <barre-pagination
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-etudiant v-model="dialogOuvert" :etudiant="etudiantEdite" @enregistre="liste.recharger()" />

    <!-- Dialog : inscriptions de l'étudiant -->
    <etudiants-inscriptions-dialog
      v-model="dialogInscriptions"
      :etudiant="etudiantInscriptions"
      :lignes="listeInscriptions"
      :chargement="chargementInscriptions"
      :peut-valider-voir="peutValiderVoir"
      :peut-voir-paiements="peutVoirPaiements"
      @voir-paiements="allerAuxPaiementsDuDossier"
      @imprimer="imprimerDossier"
      @ouvrir-inscriptions="ouvrirInscriptionsEtudiant"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueEtudiant from '../components/DialogueEtudiant.vue';
import EtudiantsListePanel from '../components/EtudiantsListePanel.vue';
import EtudiantsInscriptionsDialog from '../components/EtudiantsInscriptionsDialog.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import { texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { dateLisible } from '@/shared/utils/libelles';
import { etudiantsService } from '../services/etudiants';
import { inscriptionsService } from '../services/inscriptions';
import { ouvrirImpression } from '@/shared/services/impression';
import type { EtudiantRegistre } from '../types';
import type { Inscription, Promotion, ChipFiltre } from '@/types';

const $q = useQuasar();
const router = useRouter();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const promotions = ref<Promotion[]>([]);
const dialogOuvert = ref(false);
const etudiantEdite = ref<EtudiantRegistre | null>(null);
const modeVue = usePresentationListe();

/**
 * Filtres appliqués par `GET /etudiants` (registre entier, total paginé) et
 * gardés dans l'URL : `/etudiants?recherche=…` arrive d'un dossier ou d'un
 * paiement. Promotion et dates portent sur les dossiers d'inscription.
 */
const filtres = ref<Record<string, any>>({
  recherche: '',
  promotionId: null,
  actif: null,
  sexe: null,
  dateDebut: null,
  dateFin: null,
});
const liste = reactive(
  useListePaginee<EtudiantRegistre>({
    filtres,
    syncUrl: true,
    charger: ({ page, pageSize, filtres: f }) =>
      etudiantsService.liste({
        page,
        pageSize,
        search: texteApi(f.recherche),
        actif: f.actif || undefined,
        promotionId: f.promotionId || undefined,
        sexe: f.sexe || undefined,
        dateDebut: f.dateDebut || undefined,
        dateFin: f.dateFin || undefined,
      }),
  }),
);

const dialogInscriptions = ref(false);
const listeInscriptions = ref<Inscription[]>([]);
const etudiantInscriptions = ref<EtudiantRegistre | null>(null);
const chargementInscriptions = ref(false);

const peutGerer = computed(() => auth.peut('etudiants.gerer'));
const peutValiderVoir = computed(() => auth.peut('etudiants.voirValidation'));
/** Le suivi financier n'est ouvert qu'aux écrans qui portent la route /paiements. */
const peutVoirPaiements = computed(() => auth.peut('paiements.voir'));

const optionsActif = computed(() => [
  { label: t('etudiants.options.status.active'), value: 'true' },
  { label: t('etudiants.options.status.inactive'), value: 'false' },
]);
const optionsSexe = computed(() => [
  { label: t('etudiants.options.gender.male'), value: 'M' },
  { label: t('etudiants.options.gender.female'), value: 'F' },
]);

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value ? t('etudiants.emptyState.filtered') : t('etudiants.emptyState.none'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('etudiants.chips.search', { search: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('etudiants.chips.promotion', { promotion: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  if (filtres.value.actif) {
    cs.push({
      label:
        filtres.value.actif === 'true' ? t('etudiants.options.status.active') : t('etudiants.options.status.inactive'),
      value: filtres.value.actif,
      icone: 'toggle_on',
      cle: 'actif',
    });
  }
  if (filtres.value.sexe) {
    cs.push({
      label: t('etudiants.chips.gender', {
        gender: filtres.value.sexe === 'F' ? t('etudiants.options.gender.female') : t('etudiants.options.gender.male'),
      }),
      value: filtres.value.sexe,
      icone: 'wc',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: t('etudiants.chips.since', { date: dateLisible(filtres.value.dateDebut) }),
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: t('etudiants.chips.until', { date: dateLisible(filtres.value.dateFin) }),
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

function ouvrir(e: EtudiantRegistre | null) {
  etudiantEdite.value = e;
  dialogOuvert.value = true;
}

/**
 * Désactiver un étudiant lui ferme le portail et le retire des feuilles de
 * notes : la bascule se confirme, comme toute décision de registre.
 */
async function basculerActif(e: EtudiantRegistre, v: unknown) {
  const actif = v === true;
  // Bascule refusée : la case reste pilotée par `actif`, rien à défaire.
  if (
    !actif &&
    !(await confirmer({
      titre: t('etudiants.confirmDeactivate.title'),
      message: t('etudiants.confirmDeactivate.message', { name: `${e.prenom} ${e.nom}`, matricule: e.matricule }),
      ok: t('etudiants.confirmDeactivate.confirm'),
      danger: true,
    }))
  )
    return;
  try {
    await etudiantsService.modifier(e.id, { actif });
    e.actif = actif;
    $q.notify({
      type: 'positive',
      message: actif ? t('etudiants.messages.reactivated') : t('etudiants.messages.deactivated'),
    });
  } catch {
    /* Notification gérée par l'intercepteur axios */
  }
}

/** Dossiers de l'étudiant, toutes années confondues (`etudiantId` côté serveur). */
async function voirInscriptions(e: EtudiantRegistre) {
  etudiantInscriptions.value = e;
  dialogInscriptions.value = true;
  chargementInscriptions.value = true;
  try {
    listeInscriptions.value = await inscriptionsService.tous({ all: '1', etudiantId: e.id });
  } catch {
    listeInscriptions.value = [];
  } finally {
    chargementInscriptions.value = false;
  }
}

/** Écran Inscriptions préfiltré sur l'étudiant. */
function allerAuxInscriptions(e: EtudiantRegistre) {
  void router.push({ path: '/inscriptions', query: { etudiant: e.id } });
}

/** Idem, depuis la liste des dossiers de l'étudiant. */
function ouvrirInscriptionsEtudiant() {
  if (!etudiantInscriptions.value) return;
  allerAuxInscriptions(etudiantInscriptions.value);
}

/** Écran Paiements préfiltré sur l'étudiant. */
function allerAuxPaiements(e: EtudiantRegistre) {
  void router.push({ path: '/paiements', query: { etudiant: e.id } });
}

/** Écran Paiements préfiltré sur un dossier précis. */
function allerAuxPaiementsDuDossier(dossier: Inscription) {
  void router.push({ path: '/paiements', query: { inscription: dossier.id } });
}

/**
 * Les notes se tiennent par évaluation, pas par étudiant : on ouvre les
 * épreuves de sa promotion, d'où la saisie et la consultation sont accessibles.
 */
function allerAuxEvaluations(e: EtudiantRegistre) {
  const promotionId = e.inscriptions?.[0]?.promotionId;
  if (!promotionId) {
    $q.notify({
      type: 'warning',
      message: t('etudiants.messages.noPromotion', { name: `${e.prenom} ${e.nom}` }),
    });
    return;
  }
  void router.push({ path: '/evaluations', query: { promotion: promotionId } });
}

/**
 * Le certificat d'inscription s'édite à partir d'un dossier, pas d'une fiche :
 * on imprime celui du dernier dossier de l'étudiant.
 */
function imprimerAttestation(e: EtudiantRegistre) {
  const dossier = e.inscriptions?.[0] ?? null;
  if (!dossier) {
    $q.notify({
      type: 'warning',
      message: t('etudiants.messages.noDossier', { name: `${e.prenom} ${e.nom}` }),
    });
    return;
  }
  void ouvrirImpression(`/inscriptions/${dossier.id}/attestation-inscription`);
}

/** Certificat d'un dossier précis, depuis la liste des dossiers de l'étudiant. */
function imprimerDossier(dossier: Inscription) {
  void ouvrirImpression(`/inscriptions/${dossier.id}/attestation-inscription`);
}

/** Tous les filtres tombent, recherche comprise. */
function reinitialiser() {
  liste.reinitialiser([]);
}

onMounted(async () => {
  try {
    promotions.value = await referentiels.promotions();
  } catch {
    promotions.value = [];
  }
});
</script>
