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
      <div class="col-auto">
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

    <div class="row q-col-gutter-sm q-mb-md items-center">
      <div class="col-12 col-sm-4">
        <q-input v-model="recherche" dense outlined clearable debounce="300" placeholder="Rechercher un titre, un auteur…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </div>
      <div class="col-6 col-sm-2">
        <q-select
          v-model="filtre.type"
          :options="typesDocument"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Type"
        />
      </div>
      <div class="col-6 col-sm-2">
        <q-select
          v-model="filtre.departementId"
          :options="optionsDepartements"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Département"
        />
      </div>
      <div class="col-6 col-sm-2">
        <q-select
          v-model="filtre.public"
          :options="statutsPublics"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Publication"
        />
      </div>
    </div>

    <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="!documents.length" class="plaque q-pa-lg text-center text-grey-7">
      Aucun document ne correspond à ces critères.
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="doc in documents" :key="doc.id" class="col-12 col-sm-6 col-lg-4">
        <q-card class="carte carte-document q-pa-md full-height">
          <div class="row items-start no-wrap">
            <q-chip
              dense
              outline
              color="primary"
              class="q-ma-none"
              :label="LIBELLE_TYPE_DOCUMENT[doc.type] ?? doc.type"
            />
            <q-space />
            <q-icon v-if="!doc.public" name="visibility_off" color="orange" size="20px">
              <q-tooltip>Document non publié : invisible sur la page publique</q-tooltip>
            </q-icon>
            <q-icon v-if="!doc.fichier" name="description" color="grey" size="20px">
              <q-tooltip>Déposé sans fichier (métadonnées seules)</q-tooltip>
            </q-icon>
          </div>

          <div class="doc-titre q-mt-sm">{{ doc.titre }}</div>
          <div class="doc-auteurs">{{ doc.auteurs ?? 'Aucun auteur renseigné' }}</div>
          <div v-if="doc.resume" class="doc-resume q-mt-xs">{{ doc.resume }}</div>

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
            <q-btn
              v-if="doc.fichier"
              flat
              dense
              outline
              color="primary"
              icon="download"
              label="Télécharger"
              @click="telecharger(doc)"
            />
            <q-btn
              v-if="peutGerer(doc)"
              flat
              dense
              round
              icon="edit"
              @click="ouvrir(doc)"
            />
            <q-btn
              v-if="peutGerer(doc)"
              flat
              dense
              round
              :icon="doc.public ? 'visibility_off' : 'visibility'"
              :color="doc.public ? 'orange' : 'primary'"
              @click="basculerPublic(doc)"
            />
            <q-btn
              v-if="peutGerer(doc)"
              flat
              dense
              round
              color="negative"
              icon="delete"
              @click="supprimer(doc)"
            />
          </div>
        </q-card>
      </div>
    </div>

    <div v-if="total > documents.length" class="row justify-center q-mt-lg">
      <q-btn outline color="primary" no-caps label="Plus de documents" @click="chargerPlus" />
    </div>

    <document-dialog
      v-model="dialogOuvert"
      :document="documentEdite"
      :departements="departements"
      :enseignants="enseignants"
      @enregistre="recharger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import DocumentDialog from '../components/DocumentDialog.vue';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { Departement, DocumentDepot, Enseignant } from '../types';

/** Le dépôt renvoie le déposant ; le type partagé ne le déclare pas (fichiers
 *  du chantier public, non modifiables ici). */
type DocumentLigne = DocumentDepot & { deposeParId?: string | null };

const $q = useQuasar();
const auth = useAuthStore();

const documents = ref<DocumentDepot[]>([]);
const departements = ref<Departement[]>([]);
const enseignants = ref<Enseignant[]>([]);
const chargement = ref(false);
const total = ref(0);
const page = ref(1);
const recherche = ref('');
const dialogOuvert = ref(false);
const documentEdite = ref<DocumentDepot | null>(null);

const filtre = ref({
  type: '' as '' | DocumentDepot['type'],
  departementId: '' as string,
  public: '' as '' | '1' | '0',
});

const peutDeposer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));

// Sauf administrateur, seul le déposant initial modifie ou supprime.
function peutGerer(doc: DocumentLigne): boolean {
  return auth.estAdmin || auth.utilisateur?.id === doc.deposeParId;
}

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({
  value,
  label,
}));
const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);
const statutsPublics = [
  { value: '1', label: 'Publiés' },
  { value: '0', label: 'Non publiés' },
];

function anneeDocument(doc: DocumentDepot): number {
  return doc.anneeEdition ?? new Date(doc.createdAt).getFullYear();
}

async function charger(reinit = true) {
  if (reinit) page.value = 1;
  chargement.value = true;
  try {
    const { data } = await api.get('/documents', {
      params: {
        ...(recherche.value ? { search: recherche.value } : {}),
        ...(filtre.value.type ? { type: filtre.value.type } : {}),
        ...(filtre.value.departementId ? { departementId: filtre.value.departementId } : {}),
        ...(filtre.value.public ? { public: filtre.value.public } : {}),
        page: page.value,
        pageSize: 12,
      },
    });
    documents.value = reinit ? data.data : [...documents.value, ...data.data];
    total.value = data.total;
  } finally {
    chargement.value = false;
  }
}

function chargerPlus() {
  page.value += 1;
  void charger(false);
}

function recharger() {
  void charger(true);
}

watch([filtre, recherche], () => void charger(true), { deep: true });

/** Téléchargement : la route renvoie les octets du data-url décodé, on les
 *  empaquette dans un blob côté navigateur. */
async function telecharger(doc: DocumentDepot) {
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
    // L'intercepteur axios affiche déjà le motif.
  }
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

onMounted(async () => {
  const [dep, ens] = await Promise.all([
    api.get('/departements', { params: { all: '1' } }),
    api.get('/enseignants', { params: { all: '1' } }),
  ]);
  departements.value = dep.data.data;
  enseignants.value = ens.data.data;
  await charger(true);
});
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

.doc-resume {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.83rem;
  color: var(--up-encre-douce);
}
</style>