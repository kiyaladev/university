<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('bibliotheque.title')" :subtitle="$t('bibliotheque.subtitle')">
      <template #actions>
        <q-btn flat no-caps icon="public" :label="$t('bibliotheque.actions.viewShowcase')" to="/bibliotheque">
          <q-tooltip>{{ $t('bibliotheque.actions.viewShowcaseTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="auth.estAdmin"
          unelevated
          color="negative"
          no-caps
          icon="policy"
          :label="$t('bibliotheque.actions.recalculatePlagiarism')"
          :loading="recalculEnCours"
          @click="lancerRecalcul"
        />
        <q-btn
          v-if="peutDeposer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('bibliotheque.actions.depositDocument')"
          @click="ouvrir(null)"
        />
      </template>
    </en-tete-page>

    <!-- Recherche globale + auto-complétion preview -->
    <div class="row q-col-gutter-md q-mb-md items-start">
      <div class="col-12 col-sm-6">
        <bibliotheque-recherche
          :selection="rechercheSelectionnee"
          :suggestions="suggestions"
          :chargement="chargementSuggestions"
          :texte="rechercheTexte"
          @update:selection="surSelection"
          @filtre="rechercherSuggestions"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-banner v-if="dernierRecap" dense class="bg-positive text-white q-pa-sm">
          <template #avatar><q-icon name="check_circle" /></template>
          <div class="text-weight-medium">{{ dernierRecap.titre }}</div>
          <div class="text-caption">{{ dernierRecap.message }}</div>
        </q-banner>
      </div>
    </div>

    <bibliotheque-filtres v-model:filtres="filtres" :chips="chips" @reinitialiser="reinitialiser" />

    <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <etat-vide
      v-else-if="!documents.length"
      icone="library_books"
      :titre="$t('bibliotheque.emptyState.title')"
      :aide="$t('bibliotheque.emptyState.hint')"
    >
      <template v-if="peutDeposer" #action>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="add"
          :label="$t('bibliotheque.actions.depositDocument')"
          @click="ouvrir(null)"
        />
      </template>
    </etat-vide>

    <bibliotheque-tableau
      v-else-if="mode === 'tableau'"
      :documents="documents"
      :colonnes="colonnes"
      :chargement="chargement"
      :peut-gerer="peutGerer"
      :peut-voir-plagiat="peutVoirPlagiat"
      :est-admin="auth.estAdmin"
      @telecharger="telecharger"
      @apercu="ouvrirApercu"
      @modifier="ouvrir"
      @basculer="basculerPublic"
      @score="voirScore"
      @supprimer="supprimer"
    />

    <bibliotheque-cartes
      v-else
      :documents="documents"
      :terme="rechercheTexte"
      :peut-gerer="peutGerer"
      :peut-voir-plagiat="peutVoirPlagiat"
      :est-admin="auth.estAdmin"
      @telecharger="telecharger"
      @apercu="ouvrirApercu"
      @modifier="ouvrir"
      @basculer="basculerPublic"
      @score="voirScore"
      @supprimer="supprimer"
    />

    <barre-pagination
      v-if="documents.length"
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      @tous="chargerTout"
    />

    <dialogue-document v-model="dialogOuvert" :document="documentEdite" @enregistre="premierePage" />

    <!-- Dialog : aperçu du contenu extrait -->
    <bibliotheque-apercu
      v-model="apercuOuvert"
      :apercu="apercuDoc"
      :texte="apercuTexte"
      :chargement="apercuChargement"
      :terme="rechercheTexte"
    />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { computed, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { bibliothequeService, normaliserDocuments } from '@/shared/services/bibliotheque';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import DialogueDocument from '../components/DialogueDocument.vue';
import BibliothequeRecherche from '../components/BibliothequeRecherche.vue';
import BibliothequeFiltres from '../components/BibliothequeFiltres.vue';
import BibliothequeTableau from '../components/BibliothequeTableau.vue';
import BibliothequeCartes from '../components/BibliothequeCartes.vue';
import BibliothequeApercu from '../components/BibliothequeApercu.vue';
import { useAuthStore } from '@/stores/auth';
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import type { DocumentDepot, ChipFiltre } from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { confirmer, supprimerAvecConfirmation } = useConfirmation();

const rechercheSelectionnee = ref<string | null>(null);
const rechercheTexte = ref('');
const suggestions = ref<DocumentDepot[]>([]);
const chargementSuggestions = ref(false);
let timerSuggestions: any = null;

const filtres = ref<Record<string, any>>({
  type: '',
  departementId: '',
  anneeEdition: null,
  public: '',
});

/**
 * Liste paginée côté serveur. Le terme de recherche (`rechercheTexte`) vit
 * hors des filtres : il ne relance la liste que lorsqu'une suggestion est
 * choisie.
 */
const {
  lignes: documents,
  chargement,
  total,
  page,
  pageSize,
} = useListePaginee<DocumentDepot>({
  filtres,
  pageSize: 12,
  syncUrl: true,
  charger: async ({ page: p, pageSize: n, filtres: f }) => {
    const { data } = await bibliothequeService.liste({
      page: p,
      pageSize: n,
      search: rechercheTexte.value || undefined,
      type: f.type || undefined,
      departementId: f.departementId || undefined,
      anneeEdition: f.anneeEdition || undefined,
      public: f.public === '1' ? 'true' : f.public === '0' ? 'false' : undefined,
    });
    const resultat = normaliserDocuments(data);
    return { data: resultat.liste, total: resultat.total };
  },
});

/** Retour en page 1 et rechargement (le setter de `page` relance la requête). */
function premierePage() {
  page.value = 1;
}

const mode = usePresentationListe();
const dialogOuvert = ref(false);
const documentEdite = ref<DocumentDepot | null>(null);

const apercuOuvert = ref(false);
const apercuDoc = ref<DocumentDepot | null>(null);
const apercuTexte = ref('');
const apercuChargement = ref(false);

const recalculEnCours = ref(false);
const dernierRecap = ref<{ titre: string; message: string } | null>(null);

/** Les mêmes rôles que le backend : PUT/POST /documents. */
const peutDeposer = computed(() => auth.peut('bibliotheque.deposer'));
/** Modifier / (dé)publier suit le droit de dépôt ; supprimer reste à l'admin. */
const peutGerer = computed(() => peutDeposer.value);
/** Le tableau de bord anti-plagiat est réservé à l'admin et à la direction. */
const peutVoirPlagiat = computed(() => auth.peut('plagiat.decider'));

/** Chips des filtres actifs : sans elles, BarreFiltres masque « Réinitialiser ». */
const chips = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.type) {
    cs.push({ label: LIBELLE_TYPE_DOCUMENT[f.type] ?? f.type, value: f.type, icone: 'category', cle: 'type' });
  }
  if (f.departementId)
    cs.push({
      label: t('bibliotheque.filters.departmentFiltered'),
      value: f.departementId,
      icone: 'account_tree',
      cle: 'departementId',
    });
  if (f.anneeEdition)
    cs.push({
      label: t('bibliotheque.filters.yearChip', { year: f.anneeEdition }),
      value: f.anneeEdition,
      icone: 'event',
    });
  if (f.public) {
    cs.push({
      label: f.public === '1' ? t('bibliotheque.filters.published') : t('bibliotheque.filters.unpublished'),
      value: f.public,
      icone: f.public === '1' ? 'visibility' : 'visibility_off',
      cle: 'public',
    });
  }
  if (rechercheTexte.value) {
    cs.push({
      label: t('bibliotheque.filters.searchChip', { value: rechercheTexte.value }),
      value: rechercheTexte.value,
      icone: 'search',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'titre', label: t('bibliotheque.table.columns.document'), field: 'titre', align: 'left' },
  { name: 'departement', label: t('common.fields.department'), field: 'departement', align: 'left' },
  { name: 'annee', label: t('common.fields.year'), field: 'anneeEdition', align: 'center' },
  { name: 'taille', label: t('bibliotheque.table.columns.size'), field: 'tailleKo', align: 'right' },
  { name: 'publie', label: t('common.fields.state'), field: 'public', align: 'center' },
  { name: 'plagiat', label: t('bibliotheque.table.columns.plagiarism'), field: 'indicePlagiat', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function chargerTout() {
  pageSize.value = Math.max(total.value, 200) || 200;
}

function reinitialiser() {
  const avaitTerme = !!rechercheTexte.value;
  rechercheSelectionnee.value = null;
  rechercheTexte.value = '';
  filtres.value = { type: '', departementId: '', anneeEdition: null, public: '' };
  // Le terme n'est pas un filtre : son effacement ne relance rien tout seul.
  if (avaitTerme) premierePage();
}

async function rechercherSuggestions(terme: string, miseAJour: (cb: () => void) => void) {
  if (timerSuggestions) clearTimeout(timerSuggestions);
  if (!terme || terme.length < 2) {
    suggestions.value = [];
    miseAJour(() => {});
    return;
  }
  timerSuggestions = setTimeout(async () => {
    chargementSuggestions.value = true;
    try {
      const { data } = await bibliothequeService.rechercheFts({ q: terme, pageSize: 10 });
      suggestions.value = normaliserDocuments(data).liste.slice(0, 10);
      miseAJour(() => {});
    } finally {
      chargementSuggestions.value = false;
    }
  }, 350);
}

function surSelection(id: string | null) {
  rechercheSelectionnee.value = id;
  surSelectionSuggestion(id);
}

function surSelectionSuggestion(id: string | null) {
  if (!id) {
    rechercheTexte.value = '';
    premierePage();
    return;
  }
  const doc = documents.value.find((d) => d.id === id) ?? suggestions.value.find((d) => d.id === id);
  if (doc) rechercheTexte.value = doc.titre;
  else rechercheTexte.value = '';
  premierePage();
}

async function telecharger(doc: DocumentDepot) {
  if (!doc.fichier) return;
  try {
    const { data, headers } = await bibliothequeService.fichier(doc.id);
    const disposition: string | undefined = headers['content-disposition'];
    const correspondance = /filename="?([^";]+)"?/i.exec(disposition ?? '');
    const nom = correspondance?.[1] ?? `${doc.titre || 'document'}.pdf`;
    const url = URL.createObjectURL(data as Blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    doc.telechargements += 1;
  } catch {
    // Notification déjà émise.
  }
}

async function ouvrirApercu(doc: DocumentDepot) {
  apercuDoc.value = doc;
  apercuOuvert.value = true;
  apercuTexte.value = '';
  apercuChargement.value = true;
  try {
    const { data } = await bibliothequeService.detail(doc.id);
    // L'aperçu ne touche pas à la recherche : y recopier le titre créait une
    // puce non décrochable et filtrait la liste au rechargement suivant.
    apercuTexte.value = (data?.contenuTexte ?? doc.contenuTexte ?? '').toString();
  } catch {
    apercuTexte.value = '';
  } finally {
    apercuChargement.value = false;
  }
}

function voirScore(doc: DocumentDepot) {
  void router.push({ path: '/plagiat', query: { documentId: doc.id } });
}

async function basculerPublic(doc: DocumentDepot) {
  const ok = await confirmer({
    titre: doc.public ? t('common.actions.unpublish') : t('common.actions.publish'),
    message: doc.public
      ? t('bibliotheque.dialogs.publish.unpublishMessage', { titre: doc.titre })
      : t('bibliotheque.dialogs.publish.publishMessage', { titre: doc.titre }),
    ok: doc.public ? t('common.actions.unpublish') : t('common.actions.publish'),
  });
  if (!ok) return;
  try {
    await bibliothequeService.modifier(doc.id, { public: !doc.public });
  } catch {
    return; // l'intercepteur axios affiche le motif
  }
  doc.public = !doc.public;
  $q.notify({
    type: 'positive',
    message: doc.public ? t('bibliotheque.messages.published') : t('bibliotheque.messages.unpublished'),
  });
}

function supprimer(doc: DocumentDepot) {
  void supprimerAvecConfirmation(`/documents/${doc.id}`, doc.titre, premierePage, {
    titre: t('common.actions.delete'),
    message: t('bibliotheque.dialogs.delete.message', { titre: doc.titre }),
    ok: t('common.actions.delete'),
    succes: t('bibliotheque.messages.deleted'),
  });
}

function ouvrir(doc: DocumentDepot | null) {
  documentEdite.value = doc;
  dialogOuvert.value = true;
}

async function lancerRecalcul() {
  const ok = await confirmer({
    titre: t('bibliotheque.dialogs.recalculate.title'),
    message: t('bibliotheque.dialogs.recalculate.message'),
    ok: t('bibliotheque.dialogs.recalculate.ok'),
    danger: true,
  });
  if (!ok) return;
  recalculEnCours.value = true;
  try {
    const { data } = await bibliothequeService.recalculerPlagiat();
    const total = (data?.total ?? data?.suspicionsCreees ?? data?.data?.total) as number | undefined;
    const docAnalyses = (data?.documentsAnalyses ?? data?.data?.documentsAnalyses) as number | undefined;
    dernierRecap.value = {
      titre: t('bibliotheque.messages.analysisSummaryTitle'),
      message: t('bibliotheque.messages.analysisSummaryLine', {
        analysed: docAnalyses ?? '?',
        suspicions: total ?? '?',
      }),
    };
    $q.notify({ type: 'positive', message: t('bibliotheque.messages.analysisDone') });
    premierePage();
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    recalculEnCours.value = false;
  }
}
</script>
