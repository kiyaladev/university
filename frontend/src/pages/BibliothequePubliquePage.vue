<template>
  <q-page class="q-pa-md">
    <!-- L'en-tête public (AuthLayout) porte déjà les liens du site : ici on ne
         garde que l'entrée vers l'espace de travail, utile au personnel. -->
    <div class="row justify-end q-mb-sm">
      <q-btn
        flat
        dense
        no-caps
        icon="login"
        label="Se connecter"
        to="/connexion"
      />
    </div>
    <div class="row justify-center">
      <div class="col-12 col-md-10 col-lg-9">
        <div class="text-center q-mt-lg q-mb-lg">
          <div class="lettrage page-titre">Bibliothèque numérique</div>
          <div class="page-sous-titre biblio-intro">
            Mémoires, thèses, articles et supports de cours de l'université :
            le dépôt institutionnel accessible à tous, pour le prestige de
            l'établissement et son éligibilité aux programmes AUF / UNESCO.
          </div>
        </div>

        <div class="q-mb-md">
          <q-input
            v-model="recherche"
            dense
            outlined
            clearable
            debounce="350"
            placeholder="Rechercher dans tout le fonds (intitulé, mots-clés, contenu…)"
            class="biblio-recherche"
          >
            <template #prepend><q-icon name="search" /></template>
            <template #append>
              <q-icon
                v-if="recherche"
                name="close"
                class="cursor-pointer"
                @click="recherche = ''"
              />
            </template>
          </q-input>
        </div>

        <div class="row q-col-gutter-sm q-mb-md items-center">
          <div class="col-12 col-sm-3">
            <q-select
              v-model="filtre.type"
              :options="typesDocument"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="Type de document"
            />
          </div>
          <div class="col-12 col-sm-3">
            <q-select
              v-model="filtre.departementId"
              :options="optionsDepartements"
              dense
              outlined
              clearable
              emit-value
              map-options
              label="Département"
              :loading="chargementDepartements"
            />
          </div>
          <div class="col-6 col-sm-2">
            <q-input
              v-model.number="filtre.anneeEdition"
              type="number"
              dense
              outlined
              clearable
              label="Année d'édition"
              :min="1900"
              :max="2100"
            />
          </div>
          <div class="col-6 col-sm-4 text-right">
            <view-toggle
              cle="biblio.publique"
              :modes="['tableau', 'cartes']"
              defaut="cartes"
              @update:mode="(v: string) => (mode = v as 'tableau' | 'cartes')"
            />
          </div>
        </div>

        <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
          <q-spinner color="primary" size="40px" />
        </div>

        <div
          v-else-if="!documents.length"
          class="plaque q-pa-lg text-center text-grey-7"
        >
          <q-icon :name="filtrageActif ? 'search_off' : 'library_books'" size="38px" color="grey-5" />
          <div v-if="filtrageActif" class="q-mt-sm">
            <div>Aucun document ne correspond à votre recherche.</div>
            <div class="text-caption q-mt-xs">
              Essayez un mot-clé plus court, ou élargissez le type et le département.
            </div>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="refresh"
              label="Effacer la recherche"
              class="q-mt-sm"
              @click="reinitialiser"
            />
          </div>
          <div v-else class="q-mt-sm">
            <div>Le fonds ne contient encore aucun document publié.</div>
            <div class="text-caption q-mt-xs">
              Les mémoires, thèses et supports de cours apparaîtront ici dès leur
              mise en ligne par la bibliothèque.
            </div>
          </div>
        </div>

        <q-list v-else-if="mode === 'cartes'" bordered separator class="plaque q-mb-md">
          <q-item v-for="doc in documents" :key="doc.id" class="q-pa-md">
            <q-item-section>
              <div class="row items-center q-col-gutter-sm">
                <q-chip
                  dense
                  outline
                  color="primary"
                  class="q-ma-none"
                  :label="LIBELLE_TYPE_DOCUMENT[doc.type] ?? doc.type"
                />
                <span class="doc-annee text-caption text-grey-7">
                  année {{ anneeDocument(doc) }}
                </span>
                <span
                  v-if="Array.isArray(doc.motsClefs) && doc.motsClefs.length"
                  class="text-caption text-grey-7 q-ml-md"
                >
                  <q-icon name="sell" size="14px" class="q-mr-xs" />
                  <span v-for="(m, i) in doc.motsClefs.slice(0, 4)" :key="m + i">
                    {{ m }}<span v-if="i < Math.min(doc.motsClefs.length, 4) - 1"> · </span>
                  </span>
                  <span v-if="doc.motsClefs.length > 4"> · +{{ doc.motsClefs.length - 4 }}</span>
                </span>
                <q-space />
                <span
                  v-if="doc.telechargements > 0"
                  class="text-caption text-grey-7"
                  :title="`${doc.telechargements} téléchargement(s)`"
                >
                  <q-icon name="download" size="15px" class="q-mr-xs" />{{ doc.telechargements }}
                </span>
              </div>

              <q-item-label class="doc-titre q-mt-xs">{{ doc.titre }}</q-item-label>
              <q-item-label v-if="doc.auteurs" caption class="q-mt-xs">
                {{ doc.auteurs }}
              </q-item-label>

              <div v-if="doc.extraitContexte" class="doc-extrait q-mt-sm" v-html="surligner(doc.extraitContexte)" />

              <div class="row items-center q-mt-sm text-caption text-grey-7">
                <div class="col">
                  <div v-if="doc.departement">{{ doc.departement.nom }}</div>
                  <div v-if="doc.enseignant">
                    {{ doc.enseignant.prenom }} {{ doc.enseignant.nom }}
                  </div>
                </div>
                <div class="col-auto">
                  <q-btn
                    v-if="doc.fichier"
                    unelevated
                    color="primary"
                    no-caps
                    icon="download"
                    label="Télécharger"
                    :title="doc.tailleKo ? `${(doc.tailleKo / 1024).toFixed(1)} Mo` : undefined"
                    @click="telecharger(doc)"
                  />
                </div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <q-table
          v-else
          flat
          bordered
          class="carte"
          :rows="documents"
          :columns="colonnesTableau"
          row-key="id"
          :loading="chargement"
          :rows-per-page-options="[0]"
          hide-bottom
        >
          <template #body-cell-titre="p">
            <q-td :props="p">
              <div class="text-weight-medium">{{ p.row.titre }}</div>
              <div v-if="p.row.auteurs" class="text-caption text-grey-7">{{ p.row.auteurs }}</div>
            </q-td>
          </template>
          <template #body-cell-departement="p">
            <q-td :props="p">{{ p.row.departement?.nom ?? '—' }}</q-td>
          </template>
          <template #body-cell-type="p">
            <q-td :props="p">{{ LIBELLE_TYPE_DOCUMENT[p.row.type] ?? p.row.type }}</q-td>
          </template>
          <template #body-cell-telechargements="p">
            <q-td :props="p" class="text-right">
              <q-icon name="download" size="15px" class="q-mr-xs" />
              {{ p.row.telechargements }}
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="p.row.fichier"
                flat
                dense
                no-caps
                icon="download"
                label="Télécharger"
                @click="telecharger(p.row)"
              />
            </q-td>
          </template>
        </q-table>

        <pagination-bar
          v-if="documents.length"
          :page="page"
          :page-size="pageSize"
          :total="total"
          :show-all="false"
          @update:page="(v) => { page = v; charger(); }"
          @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
        />

        <div class="text-center text-caption text-grey-7 q-pb-lg">
          La consultation et le téléchargement sont libres et gratuits. La
          numérisation des fonds papier fait l'objet d'un marché distinct.
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
/**
 * Bibliothèque publique (vitrine) : aucune garde d'authentification. Le même
 * fonds que l'écran de gestion `/bibliotheque-gestion`, mais restreint côté
 * serveur aux documents publiés. Tout passe par `bibliothequeService`, qui
 * choisit la liste ou la recherche plein texte selon le terme saisi — la route
 * FTS refuse un appel sans `q`. L'extrait renvoyé par le backend est surligné
 * via <mark> pour donner du contexte au visiteur.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../boot/axios';
import ViewToggle from '../components/ViewToggle.vue';
import PaginationBar from '../components/PaginationBar.vue';
import { bibliothequeService, normaliserDocuments } from '../services/bibliotheque';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { Departement, DocumentDepot } from '../types';

interface OptionSimple { label: string; value: string }

const documents = ref<DocumentDepot[]>([]);
const departements = ref<Departement[]>([]);
const chargementDepartements = ref(false);
const chargement = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
/** `clearable` remet la valeur à null : le type l'assume. */
const recherche = ref<string | null>('');
const mode = ref<'tableau' | 'cartes'>('cartes');

const filtre = ref<{
  type: string | null;
  departementId: string | null;
  anneeEdition: number | null;
}>({
  type: '',
  departementId: '',
  anneeEdition: null,
});

/** Un visiteur a-t-il restreint la liste ? Distingue les deux états vides. */
const filtrageActif = computed(
  () =>
    !!recherche.value?.trim() ||
    !!filtre.value.type ||
    !!filtre.value.departementId ||
    !!filtre.value.anneeEdition,
);

function reinitialiser() {
  recherche.value = '';
  filtre.value = { type: '', departementId: '', anneeEdition: null };
}

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([v, l]) => ({ value: v, label: l }));
const optionsDepartements = computed<OptionSimple[]>(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const colonnesTableau = [
  { name: 'titre', label: 'Document', field: 'titre', align: 'left' as const },
  { name: 'departement', label: 'Département', field: 'departement', align: 'left' as const },
  { name: 'type', label: 'Type', field: 'type', align: 'left' as const },
  { name: 'annee', label: 'Année', field: 'anneeEdition', align: 'center' as const },
  { name: 'telechargements', label: 'Téléchargements', field: 'telechargements', align: 'right' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
];

function anneeDocument(doc: DocumentDepot): number {
  return doc.anneeEdition ?? new Date(doc.createdAt).getFullYear();
}

/**
 * Surligne toutes les occurrences du terme de recherche dans l'extrait. On
 * opère côté client (le texte est déjà extrait par le backend) pour ne pas
 * réintroduire de HTML non échappé.
 */
function surligner(texte: string): string {
  const echappe = texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const terme = recherche.value?.trim() ?? '';
  if (!terme) return echappe;
  // Échapper les caractères regex du terme.
  const motif = terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${motif})`, 'gi');
  return echappe.replace(regex, '<mark>$1</mark>');
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
      public: 'true',
    };
    if (filtre.value.type) params.type = filtre.value.type;
    if (filtre.value.departementId) params.departementId = filtre.value.departementId;
    if (filtre.value.anneeEdition) params.anneeEdition = filtre.value.anneeEdition;

    const { data } = await bibliothequeService.rechercher(
      recherche.value ?? '',
      params,
      true,
    );
    const resultat = normaliserDocuments(data);
    documents.value = resultat.liste;
    total.value = resultat.total;
  } finally {
    chargement.value = false;
  }
}

/** Toute modification d'un critère ramène à la première page. */
watch([recherche, filtre], () => { page.value = 1; void charger(); }, { deep: true });

async function telecharger(doc: DocumentDepot) {
  if (!doc.fichier) return;
  try {
    const { data, headers } = await bibliothequeService.fichier(doc.id, true);
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
    /* silencieux : un visiteur public ne doit pas voir de notification */
  }
}

onMounted(async () => {
  chargementDepartements.value = true;
  try {
    const { data } = await api.get('/departements?all=1', { silencieux: true });
    departements.value = Array.isArray(data) ? data : (data.data ?? []);
  } finally {
    chargementDepartements.value = false;
  }
  await charger();
});
</script>

<style scoped>
.biblio-intro {
  margin: 0 auto;
  max-width: 720px;
}
.biblio-recherche :deep(.q-field__control) {
  font-size: 1rem;
}
.doc-titre {
  font-weight: 800;
  font-size: 1.08rem;
  line-height: 1.3;
  color: var(--up-encre);
}
/* Un extrait cité est une plaque cernée, pas une carte à bandeau latéral :
   le monde « panneau peint » trace des filets entiers. */
.doc-extrait {
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--up-encre-douce);
  background: var(--up-craie);
  padding: var(--up-2);
  border: var(--up-filet-fin);
  white-space: pre-wrap;
}
/* Le surlignage reprend le jaune signal du panneau, qui porte toujours de
   l'encre et jamais du blanc. */
.doc-extrait :deep(mark) {
  background: $jaune;
  color: var(--up-encre);
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
</style>
