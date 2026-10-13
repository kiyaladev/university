<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('bibliotheque.title') }}</h1>
        <div class="page-sous-titre">{{ $t('bibliotheque.subtitle') }}</div>
      </div>
      <div class="col-auto row q-gutter-xs">
        <q-btn
          flat
          no-caps
          icon="public"
          :label="$t('bibliotheque.actions.viewShowcase')"
          to="/bibliotheque"
        >
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
      </div>
    </div>

    <!-- Recherche globale + auto-complétion preview -->
    <div class="row q-col-gutter-md q-mb-md items-start">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="rechercheSelectionnee"
          use-input
          hide-selected
          fill-input
          input-debounce="350"
          clearable
          outlined
          dense
          :options="suggestions"
          option-value="id"
          option-label="titre"
          emit-value
          map-options
          :placeholder="$t('bibliotheque.search.placeholder')"
          :loading="chargementSuggestions"
          @filter="rechercherSuggestions"
          @update:model-value="surSelectionSuggestion"
          @filter-abort="() => {}"
        >
          <template #prepend><q-icon name="search" /></template>
          <template #no-option>
            <q-item>
              <q-item-section class="text-grey">
                {{ rechercheTexte ? $t('bibliotheque.search.noResults') : $t('bibliotheque.search.typeToSearch') }}
              </q-item-section>
            </q-item>
          </template>
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.titre }}</q-item-label>
                <q-item-label caption>
                  <span>{{ LIBELLE_TYPE_DOCUMENT[scope.opt.type] ?? scope.opt.type }}</span>
                  <span v-if="scope.opt.auteurs"> · {{ scope.opt.auteurs }}</span>
                  <span v-if="scope.opt.departement?.nom"> · {{ scope.opt.departement.nom }}</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
      <div class="col-12 col-sm-6">
        <q-banner v-if="dernierRecap" dense class="bg-positive text-white q-pa-sm">
          <template #avatar><q-icon name="check_circle" /></template>
          <div class="text-weight-medium">{{ dernierRecap.titre }}</div>
          <div class="text-caption">{{ dernierRecap.message }}</div>
        </q-banner>
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :recherche="false"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="typesDocument"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('bibliotheque.filters.type')"
        />
        <autocomplete-async
          v-model="filtres.departementId"
          endpoint="/departements"
          :label-fn="(d) => `${d.code ? d.code + ' — ' : ''}${d.nom}`"
          :label="$t('bibliotheque.filters.department')"
          :placeholder="$t('bibliotheque.filters.departmentPlaceholder')"
        />
        <q-input
          v-model.number="filtres.anneeEdition"
          type="number"
          dense
          outlined
          clearable
          :label="$t('bibliotheque.filters.editionYear')"
        />
        <q-select
          v-model="filtres.public"
          :options="statutsPublics"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('bibliotheque.filters.publication')"
        />
      </template>
    </filter-bar>

    <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="!documents.length" class="plaque q-pa-lg text-center text-grey-7">
      <q-icon name="library_books" size="38px" color="grey-5" />
      <div class="q-mt-sm">{{ $t('bibliotheque.emptyState.title') }}</div>
      <div class="text-caption q-mt-xs">
        {{ $t('bibliotheque.emptyState.hint') }}
      </div>
      <q-btn
        v-if="peutDeposer"
        flat
        no-caps
        color="primary"
        icon="add"
        :label="$t('bibliotheque.actions.depositDocument')"
        class="q-mt-sm"
        @click="ouvrir(null)"
      />
    </div>

    <q-table
      v-else-if="mode === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="documents"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-chip dense outline color="primary" :label="LIBELLE_TYPE_DOCUMENT[p.row.type] ?? p.row.type" />
        </q-td>
      </template>
      <template #body-cell-titre="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.titre }}</div>
          <div v-if="p.row.auteurs" class="text-caption text-grey-7">{{ p.row.auteurs }}</div>
          <div v-if="p.row.motsClefs?.length" class="text-caption text-grey-7 q-mt-xs">
            <q-icon name="sell" size="13px" class="q-mr-xs" />
            <span v-for="(m, i) in p.row.motsClefs.slice(0, 4)" :key="m + i">
              {{ m }}<span v-if="i < Math.min(p.row.motsClefs.length, 4) - 1"> · </span>
            </span>
            <span v-if="p.row.motsClefs.length > 4"> +{{ p.row.motsClefs.length - 4 }}</span>
          </div>
        </q-td>
      </template>
      <template #body-cell-departement="p">
        <q-td :props="p">{{ p.row.departement?.nom ?? '—' }}</q-td>
      </template>
      <template #body-cell-taille="p">
        <q-td :props="p" class="text-right">
          <span v-if="p.row.tailleKo">{{ (p.row.tailleKo / 1024).toFixed(1) }} Mo</span>
          <span v-else>{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>
      <template #body-cell-publie="p">
        <q-td :props="p">
          <q-icon
            :name="p.row.public ? 'visibility' : 'visibility_off'"
            :color="p.row.public ? 'positive' : 'orange'"
            size="20px"
          >
            <q-tooltip>{{ p.row.public ? $t('bibliotheque.status.published') : $t('bibliotheque.status.unpublished') }}</q-tooltip>
          </q-icon>
        </q-td>
      </template>
      <template #body-cell-plagiat="p">
        <q-td :props="p">
          <q-badge
            v-if="p.row.indicePlagiat !== null && p.row.indicePlagiat !== undefined"
            :color="couleurPlagiat(p.row.indicePlagiat)"
            text-color="white"
            dense
          >
            <q-icon :name="iconePlagiat(p.row.indicePlagiat)" size="14px" class="q-mr-xs" />
            {{ p.row.indicePlagiat }}
            <q-tooltip v-if="p.row.indicePlagiat > 50" class="bg-negative text-white">
              {{ $t('bibliotheque.riskHighTooltip') }}
            </q-tooltip>
          </q-badge>
          <span v-else class="text-grey-6 text-caption">{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn v-if="p.row.fichier" flat dense round icon="download" :aria-label="$t('bibliotheque.actionsColumn.downloadAria')" @click="telecharger(p.row)">
            <q-tooltip>{{ $t('bibliotheque.actionsColumn.downloadTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="visibility" :aria-label="$t('bibliotheque.actionsColumn.previewAria')" @click="ouvrirApercu(p.row)">
            <q-tooltip>{{ $t('bibliotheque.actionsColumn.previewTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn v-if="peutGerer" flat dense round icon="edit" :aria-label="$t('bibliotheque.actionsColumn.editAria')" @click="ouvrir(p.row)">
            <q-tooltip>{{ $t('bibliotheque.actionsColumn.editTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat dense round
            :icon="p.row.public ? 'visibility_off' : 'visibility'"
            :color="p.row.public ? 'orange' : 'primary'"
            :aria-label="p.row.public ? $t('bibliotheque.actionsColumn.unpublishAria') : $t('bibliotheque.actionsColumn.publishAria')"
            @click="basculerPublic(p.row)"
          >
            <q-tooltip>{{ p.row.public ? $t('bibliotheque.actionsColumn.unpublishTooltip') : $t('bibliotheque.actionsColumn.publishTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutVoirPlagiat && (p.row.indicePlagiat ?? 0) > 0"
            flat dense round icon="policy"
            :color="couleurPlagiat(p.row.indicePlagiat ?? 0)"
            :aria-label="$t('bibliotheque.actionsColumn.viewScoreAria')"
            @click="voirScore(p.row)"
          >
            <q-tooltip>{{ $t('bibliotheque.actionsColumn.viewScoreTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" :aria-label="$t('bibliotheque.actionsColumn.deleteAria')" @click="supprimer(p.row)">
            <q-tooltip>{{ $t('bibliotheque.actionsColumn.deleteTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="doc in documents" :key="doc.id" class="col-12 col-sm-6 col-lg-4">
        <q-card class="carte carte-document q-pa-md full-height">
          <div class="row items-start no-wrap">
            <q-chip dense outline color="primary" class="q-ma-none" :label="LIBELLE_TYPE_DOCUMENT[doc.type] ?? doc.type" />
            <q-space />
            <q-icon v-if="!doc.public" name="visibility_off" color="orange" size="20px">
              <q-tooltip>{{ $t('bibliotheque.card.unpublished') }}</q-tooltip>
            </q-icon>
            <q-icon v-if="!doc.fichier" name="description" color="grey" size="20px">
              <q-tooltip>{{ $t('bibliotheque.card.depositedWithoutFile') }}</q-tooltip>
            </q-icon>
          </div>

          <div class="doc-titre q-mt-sm">{{ doc.titre }}</div>
          <div class="doc-auteurs">{{ doc.auteurs ?? $t('bibliotheque.card.noAuthor') }}</div>

          <div v-if="doc.motsClefs?.length" class="text-caption text-grey-7 q-mt-xs">
            <q-icon name="sell" size="13px" class="q-mr-xs" />
            <span v-for="(m, i) in doc.motsClefs.slice(0, 3)" :key="m + i">
              {{ m }}<span v-if="i < Math.min(doc.motsClefs.length, 3) - 1"> · </span>
            </span>
          </div>

          <div v-if="doc.extraitContexte" class="doc-extrait q-mt-sm" v-html="surligner(doc.extraitContexte)" />

          <q-banner v-if="(doc.indicePlagiat ?? 0) > 50" dense class="bg-red-1 text-red-10 q-mt-sm q-pa-sm">
            <template #avatar><q-icon name="policy" color="negative" /></template>
            <div class="text-caption text-weight-medium">
              {{ $t('bibliotheque.card.plagiarismRisk', { score: doc.indicePlagiat }) }}
            </div>
          </q-banner>

          <q-separator class="q-mt-sm q-mb-sm" />
          <div class="row items-center text-caption text-grey-7">
            <div class="col">
              <div>{{ doc.departement?.nom ?? '—' }}</div>
              <div>
                {{ $t('bibliotheque.card.year', { year: anneeDocument(doc) }) }}
                <template v-if="doc.tailleKo">· {{ (doc.tailleKo / 1024).toFixed(1) }} Mo</template>
              </div>
            </div>
            <div class="col-auto" :title="$t('bibliotheque.card.downloads', { count: doc.telechargements })">
              <q-icon name="download" size="16px" class="q-mr-xs" />{{ doc.telechargements }}
            </div>
          </div>

          <div class="row q-mt-sm q-col-gutter-xs justify-end">
            <q-btn v-if="doc.fichier" flat dense outline color="primary" icon="download" :label="$t('bibliotheque.actionsColumn.download')" no-caps @click="telecharger(doc)" />
            <q-btn flat dense outline icon="visibility" :label="$t('bibliotheque.actionsColumn.preview')" no-caps @click="ouvrirApercu(doc)" />
            <q-btn v-if="peutGerer" flat dense round icon="edit" :aria-label="$t('bibliotheque.actionsColumn.editAria')" @click="ouvrir(doc)">
              <q-tooltip>{{ $t('bibliotheque.actionsColumn.editTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGerer"
              flat dense round
              :icon="doc.public ? 'visibility_off' : 'visibility'"
              :color="doc.public ? 'orange' : 'primary'"
              :aria-label="doc.public ? $t('bibliotheque.actionsColumn.unpublishAria') : $t('bibliotheque.actionsColumn.publishAria')"
              @click="basculerPublic(doc)"
            >
              <q-tooltip>{{ doc.public ? $t('bibliotheque.actionsColumn.unpublishTooltip') : $t('bibliotheque.actionsColumn.publishTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutVoirPlagiat && (doc.indicePlagiat ?? 0) > 0"
              flat dense round icon="policy"
              :color="couleurPlagiat(doc.indicePlagiat ?? 0)"
              :aria-label="$t('bibliotheque.actionsColumn.viewScoreAria')"
              @click="voirScore(doc)"
            >
              <q-tooltip>{{ $t('bibliotheque.actionsColumn.viewScoreTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" :aria-label="$t('bibliotheque.actionsColumn.deleteAria')" @click="supprimer(doc)">
              <q-tooltip>{{ $t('bibliotheque.actionsColumn.deleteTooltip') }}</q-tooltip>
            </q-btn>
          </div>
        </q-card>
      </div>
    </div>

    <pagination-bar
      v-if="documents.length"
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      @update:page="(v) => { pagination.page = v; charger(false); }"
      @update:page-size="(v) => { pagination.pageSize = v; charger(true); }"
      @tous="chargerTout"
    />

    <document-dialog
      v-model="dialogOuvert"
      :document="documentEdite"
      @enregistre="charger(true)"
    />

    <!-- Dialog : aperçu du contenu extrait -->
    <q-dialog v-model="apercuOuvert" maximized>
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="col">
            <div class="text-h6">{{ $t('bibliotheque.preview.title') }}</div>
            <div class="text-caption text-grey-7">{{ apercuDoc?.titre }}</div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
        </q-card-section>
        <q-separator class="q-my-sm" />
        <q-card-section class="apercu-contenu">
          <div v-if="apercuChargement" class="row justify-center q-py-xl">
            <q-spinner color="primary" size="36px" />
          </div>
          <div v-else-if="!apercuTexte" class="text-center text-grey-7 q-py-xl">
            <q-icon name="description" size="38px" color="grey-5" />
            <div class="q-mt-sm">{{ $t('bibliotheque.preview.empty') }}</div>
          </div>
          <pre v-else class="apercu-texte" v-html="surligner(apercuTexte)" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { bibliothequeService, normaliserDocuments } from '../services/bibliotheque';
import DocumentDialog from '../components/DocumentDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { DocumentDepot, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const documents = ref<DocumentDepot[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 12, total: 0 });
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
const peutDeposer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));
/** Modifier / (dé)publier suit le droit de dépôt ; supprimer reste à l'admin. */
const peutGerer = computed(() => peutDeposer.value);
/** Le tableau de bord anti-plagiat est réservé à l'admin et à la direction. */
const peutVoirPlagiat = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({ value, label }));
const statutsPublics = computed(() => [
  { value: '1', label: t('bibliotheque.filters.published') },
  { value: '0', label: t('bibliotheque.filters.unpublished') },
]);

/** Chips des filtres actifs : sans elles, FilterBar masque « Réinitialiser ». */
const chips = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.type) {
    cs.push({ label: LIBELLE_TYPE_DOCUMENT[f.type] ?? f.type, value: f.type, icone: 'category', cle: 'type'});
  }
  if (f.departementId) cs.push({ label: t('bibliotheque.filters.departmentFiltered'), value: f.departementId, icone: 'account_tree', cle: 'departementId'});
  if (f.anneeEdition) cs.push({ label: t('bibliotheque.filters.yearChip', { year: f.anneeEdition }), value: f.anneeEdition, icone: 'event' });
  if (f.public) {
    cs.push({
      label: f.public === '1' ? t('bibliotheque.filters.published') : t('bibliotheque.filters.unpublished'),
      value: f.public,
      icone: f.public === '1' ? 'visibility' : 'visibility_off', cle: 'public'});
  }
  if (rechercheTexte.value) {
    cs.push({ label: t('bibliotheque.filters.searchChip', { value: rechercheTexte.value }), value: rechercheTexte.value, icone: 'search' });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'type', label: t('bibliotheque.table.columns.type'), field: 'type', align: 'left' },
  { name: 'titre', label: t('bibliotheque.table.columns.document'), field: 'titre', align: 'left' },
  { name: 'departement', label: t('bibliotheque.table.columns.department'), field: 'departement', align: 'left' },
  { name: 'annee', label: t('bibliotheque.table.columns.year'), field: 'anneeEdition', align: 'center' },
  { name: 'taille', label: t('bibliotheque.table.columns.size'), field: 'tailleKo', align: 'right' },
  { name: 'publie', label: t('bibliotheque.table.columns.state'), field: 'public', align: 'center' },
  { name: 'plagiat', label: t('bibliotheque.table.columns.plagiarism'), field: 'indicePlagiat', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function anneeDocument(doc: DocumentDepot): number {
  return doc.anneeEdition ?? new Date(doc.createdAt).getFullYear();
}

function couleurPlagiat(score: number): string {
  if (score >= 80) return 'negative';
  if (score >= 50) return 'warning';
  return 'positive';
}

function iconePlagiat(score: number): string {
  if (score >= 80) return 'report';
  if (score >= 50) return 'warning';
  return 'verified';
}

function surligner(texte: string): string {
  const echappe = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const terme = (rechercheTexte.value || rechercheSelectionnee.value || '').toString().trim();
  if (!terme) return echappe;
  const motif = terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return echappe.replace(new RegExp(`(${motif})`, 'gi'), '<mark>$1</mark>');
}

async function charger(reinit = true) {
  if (reinit) pagination.value.page = 1;
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    if (rechercheTexte.value) params.search = rechercheTexte.value;
    const f = filtres.value;
    if (f.type) params.type = f.type;
    if (f.departementId) params.departementId = f.departementId;
    if (f.anneeEdition) params.anneeEdition = f.anneeEdition;
    if (f.public === '1') params.public = 'true';
    if (f.public === '0') params.public = 'false';

    const { data } = await bibliothequeService.liste(params);
    const resultat = normaliserDocuments(data);
    documents.value = resultat.liste;
    pagination.value.total = resultat.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await charger(true);
}

function reinitialiser() {
  rechercheSelectionnee.value = null;
  rechercheTexte.value = '';
  filtres.value = { type: '', departementId: '', anneeEdition: null, public: '' };
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

function surSelectionSuggestion(id: string | null) {
  if (!id) {
    rechercheTexte.value = '';
    void charger(true);
    return;
  }
  const doc = documents.value.find((d) => d.id === id) ?? suggestions.value.find((d) => d.id === id);
  if (doc) rechercheTexte.value = doc.titre;
  else rechercheTexte.value = '';
  void charger(true);
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
    apercuTexte.value = (data?.contenuTexte ?? doc.contenuTexte ?? '').toString();
    rechercheTexte.value = doc.titre;
  } catch {
    apercuTexte.value = '';
  } finally {
    apercuChargement.value = false;
  }
}

function voirScore(doc: DocumentDepot) {
  void router.push({ path: '/plagiat', query: { documentId: doc.id } });
}

function basculerPublic(doc: DocumentDepot) {
  $q.dialog({
    title: doc.public ? t('bibliotheque.dialogs.publish.unpublishTitle') : t('bibliotheque.dialogs.publish.publishTitle'),
    message: doc.public
      ? t('bibliotheque.dialogs.publish.unpublishMessage', { titre: doc.titre })
      : t('bibliotheque.dialogs.publish.publishMessage', { titre: doc.titre }),
    cancel: true,
    ok: { color: 'primary', label: doc.public ? t('bibliotheque.dialogs.publish.unpublishOk') : t('bibliotheque.dialogs.publish.publishOk') },
  }).onOk(async () => {
    await bibliothequeService.modifier(doc.id, { public: !doc.public });
    doc.public = !doc.public;
    $q.notify({
      type: 'positive',
      message: doc.public
        ? t('bibliotheque.messages.published')
        : t('bibliotheque.messages.unpublished'),
    });
  });
}

function supprimer(doc: DocumentDepot) {
  $q.dialog({
    title: t('bibliotheque.dialogs.delete.title'),
    message: t('bibliotheque.dialogs.delete.message', { titre: doc.titre }),
    cancel: true,
    ok: { color: 'negative', label: t('bibliotheque.dialogs.delete.ok') },
  }).onOk(async () => {
    await bibliothequeService.supprimer(doc.id);
    $q.notify({ type: 'warning', message: t('bibliotheque.messages.deleted') });
    await charger(true);
  });
}

function ouvrir(doc: DocumentDepot | null) {
  documentEdite.value = doc;
  dialogOuvert.value = true;
}

async function lancerRecalcul() {
  $q.dialog({
    title: t('bibliotheque.dialogs.recalculate.title'),
    message: t('bibliotheque.dialogs.recalculate.message'),
    cancel: true,
    ok: { color: 'negative', label: t('bibliotheque.dialogs.recalculate.ok'), unelevated: true },
  }).onOk(async () => {
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
      await charger(true);
    } finally {
      recalculEnCours.value = false;
    }
  });
}

watch(filtres, () => charger(true), { deep: true });

onMounted(() => charger(true));
</script>

<style scoped>
.carte-document {
  display: flex;
  flex-direction: column;
}
.doc-titre {
  font-weight: 800;
  font-size: 1.05rem;
  line-height: 1.3;
  color: var(--up-encre);
}
.doc-auteurs {
  font-size: 0.85rem;
  color: var(--up-encre-douce);
}
/* Un extrait cité est une plaque cernée, pas une carte à bandeau latéral :
   le monde « panneau peint » trace des filets entiers. */
.doc-extrait {
  font-size: 0.83rem;
  line-height: 1.4;
  color: var(--up-encre-douce);
  background: var(--up-craie);
  padding: var(--up-2);
  border: var(--up-filet-fin);
  white-space: pre-wrap;
}
/* Le surlignage se pose en jaune très dilué. Ce bloc est du CSS simple : la
   variable Sass `$jaune` qui s'y trouvait n'y était jamais résolue, et le
   surlignage n'avait donc aucun fond. */
.doc-extrait :deep(mark) {
  background: #FFF6C2;
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
.apercu-contenu {
  max-height: calc(100vh - 80px);
  overflow: auto;
}
.apercu-texte {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.apercu-texte :deep(mark) {
  background: #FFF6C2;
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
</style>
