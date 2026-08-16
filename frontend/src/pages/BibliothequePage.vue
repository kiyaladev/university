<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Bibliothèque</div>
        <div class="page-sous-titre">
          Dépôt institutionnel : mémoires, thèses, articles et supports de cours
          — le fonds qui porte les subventions AUF / UNESCO.
        </div>
      </div>
      <div class="col-auto row q-gutter-xs">
        <q-btn
          v-if="auth.estAdmin"
          unelevated
          color="negative"
          no-caps
          icon="policy"
          label="Nouvelle analyse anti-plagiat"
          :loading="recalculEnCours"
          @click="lancerRecalcul"
        />
        <q-btn
          v-if="peutDeposer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Déposer un document"
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
          placeholder="Recherche globale (titre, auteur, contenu, mots-clés…)"
          :loading="chargementSuggestions"
          @filter="rechercherSuggestions"
          @update:model-value="surSelectionSuggestion"
          @filter-abort="() => {}"
        >
          <template #prepend><q-icon name="search" /></template>
          <template #no-option>
            <q-item>
              <q-item-section class="text-grey">
                {{ rechercheTexte ? 'Aucun résultat' : 'Tapez pour rechercher' }}
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
      placeholder="Affiner (mots-clés, mot-clé principal)…"
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
          label="Type"
        />
        <autocomplete-async
          v-model="filtres.departementId"
          endpoint="/departements"
          :label-fn="(d) => `${d.code ? d.code + ' — ' : ''}${d.nom}`"
          label="Département"
          placeholder="Tapez le nom ou le code…"
        />
        <q-input
          v-model.number="filtres.anneeEdition"
          type="number"
          dense
          outlined
          clearable
          label="Année d'édition"
        />
        <q-select
          v-model="filtres.public"
          :options="statutsPublics"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Publication"
        />
        <q-input
          v-model="filtres.motsClefs"
          dense
          outlined
          label="Mots-clés (texte libre)"
          placeholder="machine learning, durabilité, Conakry…"
          hint="Recherche classique dans le champ motsClefs"
          clearable
        />
      </template>
      <template #actions>
        <view-toggle
          cle="biblio.gestion"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (mode = v as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      @update:page="(v) => { pagination.page = v; charger(true) }"
      @update:page-size="(v) => { pagination.pageSize = v; pagination.page = 1; charger(true); }"
      @tous="chargerTout"
    />

    <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="!documents.length" class="plaque q-pa-lg text-center text-grey-7">
      <q-icon name="library_books" size="38px" color="grey-5" />
      <div class="q-mt-sm">Aucun document ne correspond à ces critères.</div>
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
          <span v-else>—</span>
        </q-td>
      </template>
      <template #body-cell-publie="p">
        <q-td :props="p">
          <q-icon
            :name="p.row.public ? 'visibility' : 'visibility_off'"
            :color="p.row.public ? 'positive' : 'orange'"
            size="20px"
          >
            <q-tooltip>{{ p.row.public ? 'Publié' : 'Non publié' }}</q-tooltip>
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
              Risque élevé — vérifier les suspicions
            </q-tooltip>
          </q-badge>
          <span v-else class="text-grey-6 text-caption">—</span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn v-if="p.row.fichier" flat dense round icon="download" @click="telecharger(p.row)">
            <q-tooltip>Télécharger</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="visibility" @click="ouvrirApercu(p.row)">
            <q-tooltip>Aperçu contenu</q-tooltip>
          </q-btn>
          <q-btn v-if="peutGerer(p.row)" flat dense round icon="edit" @click="ouvrir(p.row)">
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn v-if="peutGerer(p.row)" flat dense round :icon="p.row.public ? 'visibility_off' : 'visibility'" :color="p.row.public ? 'orange' : 'primary'" @click="basculerPublic(p.row)">
            <q-tooltip>{{ p.row.public ? 'Dépublier' : 'Publier' }}</q-tooltip>
          </q-btn>
          <q-btn v-if="p.row.indicePlagiat !== null && p.row.indicePlagiat !== undefined && p.row.indicePlagiat > 0" flat dense round icon="policy" :color="couleurPlagiat(p.row.indicePlagiat)" @click="voirScore(p.row)">
            <q-tooltip>Voir le score de plagiat</q-tooltip>
          </q-btn>
          <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" @click="supprimer(p.row)">
            <q-tooltip>Supprimer</q-tooltip>
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
              <q-tooltip>Non publié</q-tooltip>
            </q-icon>
            <q-icon v-if="!doc.fichier" name="description" color="grey" size="20px">
              <q-tooltip>Déposé sans fichier</q-tooltip>
            </q-icon>
          </div>

          <div class="doc-titre q-mt-sm">{{ doc.titre }}</div>
          <div class="doc-auteurs">{{ doc.auteurs ?? 'Aucun auteur renseigné' }}</div>

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
              Risque : indice de plagiat {{ doc.indicePlagiat }}
            </div>
          </q-banner>

          <q-separator class="q-mt-sm q-mb-sm" />
          <div class="row items-center text-caption text-grey-7">
            <div class="col">
              <div>{{ doc.departement?.nom ?? '—' }}</div>
              <div>
                {{ `année ${anneeDocument(doc)}` }}
                <template v-if="doc.tailleKo">· {{ (doc.tailleKo / 1024).toFixed(1) }} Mo</template>
              </div>
            </div>
            <div class="col-auto" :title="`${doc.telechargements} téléchargement(s)`">
              <q-icon name="download" size="16px" class="q-mr-xs" />{{ doc.telechargements }}
            </div>
          </div>

          <div class="row q-mt-sm q-col-gutter-xs justify-end">
            <q-btn v-if="doc.fichier" flat dense outline color="primary" icon="download" label="Télécharger" @click="telecharger(doc)" />
            <q-btn flat dense outline icon="visibility" label="Aperçu" @click="ouvrirApercu(doc)" />
            <q-btn v-if="peutGerer(doc)" flat dense round icon="edit" @click="ouvrir(doc)" />
            <q-btn v-if="peutGerer(doc)" flat dense round :icon="doc.public ? 'visibility_off' : 'visibility'" :color="doc.public ? 'orange' : 'primary'" @click="basculerPublic(doc)" />
            <q-btn v-if="(doc.indicePlagiat ?? 0) > 0" flat dense round icon="policy" :color="couleurPlagiat(doc.indicePlagiat ?? 0)" @click="voirScore(doc)" />
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" @click="supprimer(doc)" />
          </div>
        </q-card>
      </div>
    </div>

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
            <div class="text-h6">Aperçu du contenu</div>
            <div class="text-caption text-grey-7">{{ apercuDoc?.titre }}</div>
          </div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator class="q-my-sm" />
        <q-card-section class="apercu-contenu">
          <div v-if="apercuChargement" class="row justify-center q-py-xl">
            <q-spinner color="primary" size="36px" />
          </div>
          <div v-else-if="!apercuTexte" class="text-center text-grey-7 q-py-xl">
            <q-icon name="description" size="38px" color="grey-5" />
            <div class="q-mt-sm">Aucun texte extrait pour ce document.</div>
          </div>
          <pre v-else class="apercu-texte" v-html="surligner(apercuTexte)" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import DocumentDialog from '../components/DocumentDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { DocumentDepot } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

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
  motsClefs: '',
});

const mode = ref<'tableau' | 'cartes'>('cartes');
const dialogOuvert = ref(false);
const documentEdite = ref<DocumentDepot | null>(null);

const apercuOuvert = ref(false);
const apercuDoc = ref<DocumentDepot | null>(null);
const apercuTexte = ref('');
const apercuChargement = ref(false);

const recalculEnCours = ref(false);
const dernierRecap = ref<{ titre: string; message: string } | null>(null);

const peutDeposer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));

function peutGerer(doc: DocumentDepot) {
  return auth.estAdmin;
}

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({ value, label }));
const statutsPublics = [
  { value: '1', label: 'Publiés' },
  { value: '0', label: 'Non publiés' },
];

const colonnes: QTableColumn<DocumentDepot>[] = [
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'titre', label: 'Document', field: 'titre', align: 'left' },
  { name: 'departement', label: 'Département', field: 'departement', align: 'left' },
  { name: 'annee', label: 'Année', field: 'anneeEdition', align: 'center' },
  { name: 'taille', label: 'Taille', field: 'tailleKo', align: 'right' },
  { name: 'publie', label: 'État', field: 'public', align: 'center' },
  { name: 'plagiat', label: 'Plagiat', field: 'indicePlagiat', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

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
    const params: Record<string, any> = {
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
    if (f.motsClefs) params.search = f.motsClefs;

    const { data } = await api.get('/documents', { params });
    documents.value = data.data;
    pagination.value.total = data.total;
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
  filtres.value = { type: '', departementId: '', anneeEdition: null, public: '', motsClefs: '' };
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
      const { data } = await api.get('/documents/recherche', {
        params: { q: terme, pageSize: 10 },
      });
      const liste: DocumentDepot[] = Array.isArray(data) ? data : (data.data ?? []);
      suggestions.value = liste.slice(0, 10);
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
    const { data, headers } = await api.get(`/documents/${doc.id}/fichier`, {
      responseType: 'blob',
      timeout: 60000,
    });
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
    const { data } = await api.get(`/documents/${doc.id}`);
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
    title: doc.public ? 'Dépublier' : 'Publier',
    message: doc.public
      ? `Retirer « ${doc.titre} » de la page publique ?`
      : `Rendre « ${doc.titre} » visible sur la page publique ?`,
    cancel: true,
    ok: { color: 'primary', label: doc.public ? 'Dépublier' : 'Publier' },
  }).onOk(async () => {
    await api.put(`/documents/${doc.id}`, { public: !doc.public });
    doc.public = !doc.public;
  });
}

function supprimer(doc: DocumentDepot) {
  $q.dialog({
    title: 'Supprimer',
    message: `Supprimer « ${doc.titre} » ? Le fichier joint sera perdu.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/documents/${doc.id}`);
    await charger(true);
  });
}

function ouvrir(doc: DocumentDepot | null) {
  documentEdite.value = doc;
  dialogOuvert.value = true;
}

async function lancerRecalcul() {
  $q.dialog({
    title: 'Recalculer les suspicions de plagiat',
    message:
      'Cette opération balaye tous les documents et compare leurs empreintes. ' +
      'Elle peut prendre plusieurs minutes : un compte rendu sera affiché à la fin.',
    cancel: true,
    ok: { color: 'negative', label: 'Lancer l’analyse', unelevated: true },
  }).onOk(async () => {
    recalculEnCours.value = true;
    try {
      const { data } = await api.post('/documents/recalculer-plagiat', {});
      const total = (data?.total ?? data?.suspicionsCreees ?? data?.data?.total) as number | undefined;
      const docAnalyses = (data?.documentsAnalyses ?? data?.data?.documentsAnalyses) as number | undefined;
      dernierRecap.value = {
        titre: 'Analyse terminée',
        message:
          `${docAnalyses ?? '?'} document(s) analysés — `
          + `${total ?? '?'} suspicion(s) détectée(s).`,
      };
      $q.notify({ type: 'positive', message: 'Analyse anti-plagiat terminée' });
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
.doc-extrait {
  font-size: 0.83rem;
  line-height: 1.4;
  color: var(--up-encre-douce);
  background: rgba(0, 0, 0, 0.02);
  padding: 6px 8px;
  border-left: 3px solid var(--q-primary);
  white-space: pre-wrap;
}
.doc-extrait :deep(mark) {
  background: #fff3a0;
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
  background: #fff3a0;
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
</style>
