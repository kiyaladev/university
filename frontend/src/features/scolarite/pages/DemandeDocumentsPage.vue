<template>
  <q-page class="q-pa-md">
    <section-navigation section="documents" />
    <en-tete-page :title="$t('demandeDocuments.title')" :subtitle="$t('demandeDocuments.subtitle')" />

    <q-banner v-if="filtres.etudiantId" class="note--info q-mb-md">
      {{ $t('demandeDocuments.studentBanner.message') }}
      <template #action>
        <q-btn flat no-caps :label="$t('demandeDocuments.studentBanner.seeAll')" @click="retirerFiltreEtudiant" />
      </template>
    </q-banner>

    <demande-documents-stats-panel :stats="stats" />

    <demande-documents-filtres v-model="filtres" @reinitialiser="liste.reinitialiser([])" />

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <demande-documents-tableau
      v-if="modeVue === 'tableau'"
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :en-cours="enCours"
      @selectionner="selectionner"
      @lancer-traitement="lancerTraitement"
      @marquer-prete="marquerPrete"
      @remettre="remettre"
      @confirmer-paiement="confirmerPaiement"
      @rejeter="rejeter"
    />

    <demande-documents-cartes
      v-else
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :en-cours="enCours"
      @selectionner="selectionner"
      @lancer-traitement="lancerTraitement"
      @marquer-prete="marquerPrete"
      @remettre="remettre"
      @confirmer-paiement="confirmerPaiement"
      @rejeter="rejeter"
    />

    <demande-documents-detail-panel
      v-model="detailOuvert"
      :demande="demandeSelectionnee"
      :en-cours="enCours"
      @confirmer-paiement="confirmerPaiement"
      @lancer-traitement="lancerTraitement"
      @marquer-prete="marquerPrete"
      @remettre="remettre"
      @rejeter="rejeter"
      @ouvrir-carte="ouvrirCarteEtudiante"
    />
  </q-page>
</template>

<script setup lang="ts">
/**
 * Registre des demandes de documents, côté scolarité.
 *
 * La page détient la liste, les compteurs et les actions de workflow ; le
 * rendu est réparti dans les composants `DemandeDocuments…`.
 */
import { onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import DemandeDocumentsCartes from '../components/DemandeDocumentsCartes.vue';
import DemandeDocumentsDetailPanel from '../components/DemandeDocumentsDetailPanel.vue';
import DemandeDocumentsFiltres from '../components/DemandeDocumentsFiltres.vue';
import DemandeDocumentsStatsPanel from '../components/DemandeDocumentsStatsPanel.vue';
import DemandeDocumentsTableau from '../components/DemandeDocumentsTableau.vue';
import { demandesDocumentsService, type ActionDemandeDocument } from '../services/documents-demande';
import type { DemandeDocument } from '../types';
import type { FiltresPage } from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { confirmerAvecSaisie } = useConfirmation();

const stats = ref<Record<string, number | undefined> | null>(null);
/**
 * Liaison depuis les autres écrans du dossier (réclamations, carte) :
 * `/demandes-docs?etudiantId=…` ouvre le registre filtré sur cet étudiant
 * (les filtres sont relus de l'URL par `syncUrl`).
 */
const filtres = ref<FiltresPage>({
  recherche: '',
  statut: null,
  type: null,
  etudiantId: undefined,
});
/** Même périmètre que l'écran /demandes-docs et que le traitement côté API. */
const peutVoir = () => auth.peut('demandesDocuments.traiter');
const liste = reactive(
  useListePaginee<DemandeDocument>({
    filtres,
    syncUrl: true,
    actif: peutVoir,
    charger: ({ filtres: f, ...p }) =>
      demandesDocumentsService.liste({
        ...pageApi(p),
        statut: f.statut || undefined,
        type: f.type || undefined,
        etudiantId: f.etudiantId || undefined,
        search: texteApi(f.recherche),
      }),
  }),
);
const modeVue = usePresentationListe();
const detailOuvert = ref(false);
const demandeSelectionnee = ref<DemandeDocument | null>(null);
const enCours = ref('');

function selectionner(d: DemandeDocument | null) {
  if (!d) return;
  demandeSelectionnee.value = d;
  detailOuvert.value = true;
}

/** Retire le filtre « un seul étudiant » posé par un lien entrant. */
function retirerFiltreEtudiant() {
  filtres.value = { ...filtres.value, etudiantId: undefined };
}

/** Rebond vers la carte étudiante du demandeur. */
function ouvrirCarteEtudiante(d: DemandeDocument | null) {
  if (!d?.etudiantId) return;
  detailOuvert.value = false;
  void router.push({ name: 'cartes-etudiantes', query: { etudiantId: d.etudiantId } });
}

async function chargerStats() {
  if (!peutVoir()) return;
  try {
    stats.value = await demandesDocumentsService.tableauBord();
  } catch {
    /* silencieux */
  }
}

/** Après une action : liste, compteurs et fiche ouverte à jour. */
async function rafraichir(d: DemandeDocument) {
  void liste.recharger();
  void chargerStats();
  if (demandeSelectionnee.value?.id === d.id) {
    demandeSelectionnee.value = await demandesDocumentsService.lire(d.id);
  }
}

/** Action de workflow : POST, notification, rafraîchissement. */
async function agir(
  d: DemandeDocument,
  cle: string,
  action: ActionDemandeDocument,
  corps: object,
  message: string,
  type: 'positive' | 'warning' = 'positive',
) {
  enCours.value = cle;
  try {
    await demandesDocumentsService.action(d.id, action, corps);
    $q.notify({ type, message });
    await rafraichir(d);
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enCours.value = '';
  }
}

async function confirmerPaiement(d: DemandeDocument | null) {
  if (!d) return;
  await agir(d, 'confirmer', 'confirmer-paiement', {}, t('demandeDocuments.messages.paymentConfirmed'));
}

async function lancerTraitement(d: DemandeDocument | null) {
  if (!d) return;
  await agir(d, 'traitement', 'lancer-traitement', {}, t('demandeDocuments.messages.processingStarted'));
}

async function marquerPrete(d: DemandeDocument | null) {
  if (!d) return;
  const message = await confirmerAvecSaisie({
    titre: t('demandeDocuments.markReadyDialog.title'),
    message: t('demandeDocuments.markReadyDialog.message'),
    libelleSaisie: t('demandeDocuments.detail.smsNotification'),
    ok: t('demandeDocuments.markReadyDialog.confirm'),
    couleur: 'positive',
  });
  if (message === null) return;
  await agir(d, 'prete', 'prete', { message: message.trim() || undefined }, t('demandeDocuments.messages.markedReady'));
}

async function remettre(d: DemandeDocument | null) {
  if (!d) return;
  const noteRemise = await confirmerAvecSaisie({
    titre: t('demandeDocuments.handOverDialog.title'),
    message: t('demandeDocuments.handOverDialog.message'),
    libelleSaisie: t('common.fields.notes'),
    ok: t('demandeDocuments.handOverDialog.confirm'),
    couleur: 'positive',
  });
  if (noteRemise === null) return;
  await agir(
    d,
    'remettre',
    'remettre',
    { noteRemise: noteRemise.trim() || undefined },
    t('demandeDocuments.messages.handedOver'),
  );
}

async function rejeter(d: DemandeDocument | null) {
  if (!d) return;
  const motif = await confirmerAvecSaisie({
    titre: t('demandeDocuments.rejectDialog.title'),
    message: t('demandeDocuments.rejectDialog.message'),
    libelleSaisie: t('common.fields.motif'),
    ok: t('common.actions.reject'),
    danger: true,
  });
  if (motif === null) return;
  // Le motif est obligatoire (3 caractères au moins), comme côté API.
  if (motif.trim().length < 3) {
    $q.notify({ type: 'warning', message: t('common.messages.errors.tooShort') });
    return;
  }
  await agir(d, 'rejeter', 'rejeter', { motif: motif.trim() }, t('demandeDocuments.messages.rejected'), 'warning');
}

onMounted(() => {
  void chargerStats();
});
</script>
