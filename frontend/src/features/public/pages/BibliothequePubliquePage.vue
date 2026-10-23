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
        :label="$t('common.actions.login')"
        to="/connexion"
      />
    </div>
    <div class="row justify-center">
      <div class="col-12 col-md-10 col-lg-9">
        <div class="text-center q-mt-lg q-mb-lg">
          <h1 class="lettrage page-titre">{{ $t('bibliothequePublique.title') }}</h1>
          <div class="page-sous-titre biblio-intro">
            {{ $t('bibliothequePublique.subtitle') }}
          </div>
        </div>

        <div class="q-mb-md">
          <q-input
            v-model="filtre.recherche"
            dense
            outlined
            clearable
            :placeholder="$t('bibliothequePublique.search.placeholder')"
            class="biblio-recherche"
          >
            <template #prepend><q-icon name="search" /></template>
            <template #append>
              <q-icon
                v-if="filtre.recherche"
                name="close"
                class="cursor-pointer"
                @click="filtre.recherche = ''"
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
              :label="$t('bibliothequePublique.filters.type')"
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
              :label="$t('common.fields.department')"
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
              :label="$t('bibliothequePublique.filters.editionYear')"
              :min="1900"
              :max="2100"
            />
          </div>
          <div class="col-6 col-sm-4 text-right">
          </div>
        </div>

        <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
          <q-spinner color="primary" size="40px" />
        </div>

        <etat-vide
          v-else-if="!documents.length && filtrageActif"
          icone="search_off"
          :titre="$t('bibliothequePublique.emptyState.filteredTitle')"
          :aide="$t('bibliothequePublique.emptyState.filteredHint')"
        >
          <template #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="refresh"
              :label="$t('bibliothequePublique.emptyState.clearSearch')"
              @click="reinitialiser"
            />
          </template>
        </etat-vide>
        <etat-vide
          v-else-if="!documents.length"
          icone="library_books"
          :titre="$t('bibliothequePublique.emptyState.noDocsTitle')"
          :aide="$t('bibliothequePublique.emptyState.noDocsHint')"
        />

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
                  {{ $t('bibliothequePublique.card.year', { year: anneeDocument(doc) }) }}
                </span>
                <span
                  v-if="Array.isArray(doc.motsClefs) && doc.motsClefs.length"
                  class="text-caption text-grey-7 q-ml-md"
                >
                  <q-icon name="sell" size="14px" class="q-mr-xs" />
                  <span v-for="(m, i) in doc.motsClefs.slice(0, 4)" :key="m + i">
                    {{ m }}<span v-if="i < Math.min(doc.motsClefs.length, 4) - 1"> · </span>
                  </span>
                  <span v-if="doc.motsClefs.length > 4">{{ $t('common.units.moreCount', { n: doc.motsClefs.length - 4 }) }}</span>
                </span>
                <q-space />
                <span
                  v-if="doc.telechargements > 0"
                  class="text-caption text-grey-7"
                  :title="$t('bibliothequePublique.card.downloadsTitle', { count: doc.telechargements })"
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
                    :label="$t('common.actions.download')"
                    :title="doc.tailleKo ? $t('bibliothequePublique.card.sizeMo', { size: (doc.tailleKo / 1024).toFixed(1) }) : undefined"
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
                :label="$t('common.actions.download')"
                @click="telecharger(p.row)"
              />
            </q-td>
          </template>
        </q-table>

        <pagination-bar
          v-if="documents.length"
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :show-all="false"
        />

        <div class="text-center text-caption text-grey-7 q-pb-lg">
          {{ $t('bibliothequePublique.footer') }}
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/presentationListe';
/**
 * Bibliothèque publique (vitrine) : aucune garde d'authentification. Le même
 * fonds que l'écran de gestion `/bibliotheque-gestion`, mais restreint côté
 * serveur aux documents publiés. Tout passe par `bibliothequeService`, qui
 * choisit la liste ou la recherche plein texte selon le terme saisi — la route
 * FTS refuse un appel sans `q`. L'extrait renvoyé par le backend est surligné
 * via <mark> pour donner du contexte au visiteur.
 */
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import PaginationBar from '@/shared/components/PaginationBar.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { bibliothequeService, normaliserDocuments } from '@/shared/services/bibliotheque';
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import type { Departement, DocumentDepot } from '@/types';

interface OptionSimple { label: string; value: string }

const { t } = useI18n();

const departements = ref<Departement[]>([]);
const chargementDepartements = ref(false);
const mode = usePresentationListe();

/** `clearable` remet la recherche à null : le type l'assume. */
const filtre = ref<{
  recherche: string | null;
  type: string | null;
  departementId: string | null;
  anneeEdition: number | null;
}>({
  recherche: '',
  type: '',
  departementId: '',
  anneeEdition: null,
});

/**
 * Toute modification d'un critère ramène à la première page ; la saisie
 * libre attend 300 ms de silence. Erreurs silencieuses : la vitrine ne crie pas.
 */
const {
  lignes: documents,
  chargement,
  total,
  page,
  pageSize,
} = useListePaginee<DocumentDepot, typeof filtre.value>({
  filtres: filtre,
  pageSize: 10,
  charger: async ({ page: p, pageSize: n, filtres: f }) => {
    const params: Record<string, unknown> = { page: p, pageSize: n, public: 'true' };
    if (f.type) params.type = f.type;
    if (f.departementId) params.departementId = f.departementId;
    if (f.anneeEdition) params.anneeEdition = f.anneeEdition;
    const { data } = await bibliothequeService.rechercher(f.recherche ?? '', params, true);
    const resultat = normaliserDocuments(data);
    return { data: resultat.liste, total: resultat.total };
  },
});

/** Un visiteur a-t-il restreint la liste ? Distingue les deux états vides. */
const filtrageActif = computed(
  () =>
    !!filtre.value.recherche?.trim() ||
    !!filtre.value.type ||
    !!filtre.value.departementId ||
    !!filtre.value.anneeEdition,
);

function reinitialiser() {
  filtre.value = { recherche: '', type: '', departementId: '', anneeEdition: null };
}

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([v, l]) => ({ value: v, label: l }));
const optionsDepartements = computed<OptionSimple[]>(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const colonnesTableau = computed(() => [
  { name: 'titre', label: t('bibliothequePublique.table.columns.document'), field: 'titre', align: 'left' as const },
  { name: 'departement', label: t('common.fields.department'), field: 'departement', align: 'left' as const },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' as const },
  { name: 'annee', label: t('common.fields.year'), field: 'anneeEdition', align: 'center' as const },
  { name: 'telechargements', label: t('bibliothequePublique.table.columns.downloads'), field: 'telechargements', align: 'right' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]);

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
  const terme = filtre.value.recherche?.trim() ?? '';
  if (!terme) return echappe;
  // Échapper les caractères regex du terme.
  const motif = terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${motif})`, 'gi');
  return echappe.replace(regex, '<mark>$1</mark>');
}

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
    const { data } = await api.get('/departements/public', { silencieux: true });
    departements.value = Array.isArray(data) ? data : (data.data ?? []);
  } catch {
    /* silencieux : le filtre par département reste simplement vide */
  } finally {
    chargementDepartements.value = false;
  }
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
</style>
