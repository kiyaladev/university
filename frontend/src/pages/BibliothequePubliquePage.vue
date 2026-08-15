<template>
  <q-page class="q-pa-md">
    <div class="row justify-center">
      <div class="col-12 col-md-10 col-lg-8">
        <div class="text-center q-mt-lg q-mb-lg">
          <div class="lettrage page-titre">Bibliothèque numérique</div>
          <div class="page-sous-titre biblio-intro">
            Mémoires, thèses, articles et supports de cours de l'université :
            le dépôt institutionnel accessible à tous, pour le prestige de
            l'établissement et son éligibilité aux programmes AUF / UNESCO.
          </div>
        </div>

        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12 col-sm-7">
            <q-input
              v-model="recherche"
              dense
              outlined
              clearable
              debounce="300"
              placeholder="Rechercher un titre, un auteur…"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </div>
          <div class="col-12 col-sm-5">
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
        </div>

        <div v-if="chargement && !documents.length" class="row justify-center q-py-xl">
          <q-spinner color="primary" size="40px" />
        </div>

        <div
          v-else-if="!documents.length"
          class="plaque q-pa-lg text-center text-grey-7"
        >
          Aucun document publié ne correspond à votre recherche.
        </div>

        <q-list v-else bordered separator class="plaque q-mb-md">
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
              <q-item-label v-if="doc.resume" class="doc-resume q-mt-xs text-grey-7">
                {{ doc.resume }}
              </q-item-label>

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

        <div v-if="total > documents.length" class="row justify-center q-mb-lg">
          <q-btn outline color="primary" no-caps label="Voir plus de documents" @click="chargerPlus" />
        </div>

        <div class="text-center text-caption text-grey-7 q-pb-lg">
          La consultation et le téléchargement sont libres et gratuits. La
          numérisation des fonds papier fait l'objet d'un marché distinct.
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../boot/axios';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { DocumentDepot } from '../types';

/**
 * Page publique de la bibliothèque : aucune garde d'authentification, aucun
 * appel à l'API privée. La liste et les fichiers viennent des routes @Public()
 * — un jeton présent dans le navigateur n'y change rien d'autre que la
 * visibilité du fonds non publié pour le staff.
 */
const documents = ref<DocumentDepot[]>([]);
const chargement = ref(false);
const total = ref(0);
const page = ref(1);
const recherche = ref('');
const filtre = ref({ type: '' as '' | DocumentDepot['type'] });

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({
  value,
  label,
}));

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
        page: page.value,
        pageSize: 15,
      },
      // Erreurs locales silencieuses : un visiteur sans compte ne doit pas
      // être éjecté vers l'écran de connexion par un 401 d'usage de session.
      silencieux: true,
    } as never);
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

watch([recherche, filtre], () => void charger(true), { deep: true });

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
    // Silencieux : page publique sans compte, pas de notification intrusive.
  }
}

onMounted(() => charger(true));
</script>

<style scoped>
.biblio-intro {
  margin: 0 auto;
}

.doc-titre {
  font-weight: 800;
  font-size: 1.08rem;
  line-height: 1.3;
  color: var(--up-encre);
}

.doc-resume {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.86rem;
}
</style>