<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section class="text-h6 row items-center">
        <q-icon name="library_books" class="q-mr-sm" />
        {{ document ? 'Modifier le document' : 'Déposer un document' }}
      </q-card-section>

      <q-card-section class="q-pt-none">
        <span class="section-titre">Fiche du document</span>
        <q-input
          v-model="form.titre"
          outlined
          dense
          label="Titre *"
          hint="Ex. « Impact du Téléphone mobile sur la scolarité des étudiantes à Kankan »"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.type"
              :options="typesDocument"
              outlined
              dense
              emit-value
              map-options
              label="Type *"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.anneeEdition"
              type="number"
              outlined
              dense
              label="Année d'édition"
              hint="Vide : l'année de dépôt est retenue"
              :max="2100"
              :min="1900"
            />
          </div>
        </div>

        <q-input
          v-model="form.auteurs"
          outlined
          dense
          label="Auteurs"
          hint="Plusieurs noms séparés par « ; », ex. « Diallo A. ; Barry M. »"
        />

        <q-input v-model="form.resume" outlined dense type="textarea" autogrow label="Résumé" />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.departementId"
              endpoint="/departements"
              :label-fn="(d) => `${d.code ? d.code + ' — ' : ''}${d.nom}`"
              label="Département"
              placeholder="Tapez le nom ou le code…"
            />
          </div>
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.enseignantId"
              endpoint="/enseignants"
              :label-fn="(e) => `${e.prenom} ${e.nom}${e.matricule ? ' — ' + e.matricule : ''}`"
              label="Encadrant"
              placeholder="Tapez le nom…"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.etudiantId"
              endpoint="/etudiants"
              :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
              label="Étudiant"
              placeholder="Tapez le matricule ou le nom…"
            />
          </div>
          <div class="col-12 col-sm-6 q-pt-md">
            <q-toggle v-model="form.public" label="Visible sur la page publique" />
          </div>
        </div>

        <span class="section-titre">Mots-clés</span>
        <q-input
          v-model="motCleSaisi"
          outlined
          dense
          label="Ajouter un mot-clé"
          placeholder="Tapez puis Entrée pour ajouter"
          @keydown.enter.prevent="ajouterMotCle"
        >
          <template #append>
            <q-icon
              v-if="motCleSaisi"
              name="add_circle"
              class="cursor-pointer"
              @click="ajouterMotCle"
            >
              <q-tooltip>Ajouter</q-tooltip>
            </q-icon>
          </template>
        </q-input>
        <div v-if="form.motsClefs.length" class="row q-gutter-xs q-mt-sm">
          <q-chip
            v-for="(mot, i) in form.motsClefs"
            :key="`${mot}-${i}`"
            dense
            removable
            color="primary"
            text-color="white"
            icon="sell"
            :label="mot"
            @remove="retirerMotCle(i)"
          />
        </div>
        <div v-else class="text-caption text-grey-7 q-mt-xs">
          Aucun mot-clé. Conseillé : « machine learning », « Conakry », « durabilité ».
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <span class="section-titre">Fichier (archivage natif)</span>
        <p class="text-caption text-grey-7 q-mt-xs q-mb-sm">
          PDF jusqu'à 8 Mo : converti en data-url base64 puis stocké côté serveur,
          où son contenu texte sera extrait pour la recherche full-text et l'analyse
          anti-plagiat.
        </p>
        <q-file
          v-model="fichierChoisi"
          accept=".pdf,application/pdf"
          :max-file-size="MAX_FICHIER_OCTETS"
          outlined
          dense
          label="PDF joint"
          :hint="`Max ${MAX_FICHIER_OCTETS_LABEL}`"
          :disable="conversionFichier || extractionEnCours"
        >
          <template #prepend><q-icon name="attach_file" /></template>
        </q-file>
        <div v-if="document?.tailleKo" class="text-caption text-grey-7 q-mt-xs">
          Fichier actuel : PDF ({{ (document.tailleKo / 1024).toFixed(1) }} Mo) — en choisir
          un nouveau le remplace.
        </div>
        <div v-if="conversionFichier" class="row items-center q-mt-sm text-caption text-grey-7">
          <q-spinner size="16px" class="q-mr-sm" /> Conversion en base64…
        </div>
        <div v-else-if="extractionEnCours" class="row items-center q-mt-sm text-caption text-primary">
          <q-spinner size="16px" class="q-mr-sm" /> Extraction du texte en cours (recherche full-text)…
        </div>
      </q-card-section>

      <q-banner
        v-if="!form.public && suspicionDetectee"
        dense
        class="bg-orange-1 text-orange-10 q-mx-md q-mb-md"
      >
        <template #avatar><q-icon name="warning" color="orange" /></template>
        <div class="text-weight-medium">Doublon potentiel détecté</div>
        <div class="q-mt-xs text-caption">
          Ce document pourrait être un doublon d'un document existant
          (score {{ suspicionDetectee.score }} %) — vérifiez avant de publier.
        </div>
        <q-btn
          flat
          dense
          no-caps
          color="orange"
          icon="open_in_new"
          label="Voir la suspicion"
          class="q-mt-xs"
          @click="voirSuspicion"
        />
      </q-banner>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          label="Enregistrer"
          :loading="enregistrement"
          :disable="conversionFichier || extractionEnCours"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { DocumentDepot, SuspicionPlagiat } from '../types';

const props = defineProps<{
  modelValue: boolean;
  document?: DocumentDepot | null;
  departements?: { id: string; nom: string; code?: string | null }[];
  enseignants?: { id: string; prenom: string; nom: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [boolean];
  enregistre: [];
}>();

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const enregistrement = ref(false);
const fichierChoisi = ref<File | null>(null);
const conversionFichier = ref(false);
const fichierDataUrl = ref<string>();
const extractionEnCours = ref(false);
const suspicionDetectee = ref<SuspicionPlagiat | null>(null);
const motCleSaisi = ref('');

/** 8 Mo côté frontend — l'extraction PDF côté serveur se fait en parallèle. */
const MAX_FICHIER_OCTETS = 8 * 1024 * 1024;
const MAX_FICHIER_OCTETS_LABEL = '8 Mo';

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({
  value,
  label,
}));

const form = ref({
  titre: '',
  type: 'AUTRE' as DocumentDepot['type'],
  auteurs: '',
  anneeEdition: null as number | null,
  resume: '',
  departementId: null as string | null,
  enseignantId: null as string | null,
  etudiantId: null as string | null,
  public: true,
  motsClefs: [] as string[],
});

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const d = props.document;
    fichierChoisi.value = null;
    fichierDataUrl.value = undefined;
    suspicionDetectee.value = null;
    motCleSaisi.value = '';
    extractionEnCours.value = false;
    form.value = {
      titre: d?.titre ?? '',
      type: d?.type ?? 'AUTRE',
      auteurs: d?.auteurs ?? '',
      anneeEdition: d?.anneeEdition ?? null,
      resume: d?.resume ?? '',
      departementId: d?.departementId ?? null,
      enseignantId: d?.enseignantId ?? (auth.estEnseignant ? (auth.utilisateur?.enseignantId ?? null) : null),
      etudiantId: d?.etudiantId ?? null,
      public: d?.public ?? true,
      motsClefs: Array.isArray(d?.motsClefs) ? [...(d!.motsClefs as string[])] : [],
    };
  },
);

function ajouterMotCle() {
  const mot = motCleSaisi.value.trim();
  if (!mot) return;
  if (!form.value.motsClefs.includes(mot)) form.value.motsClefs.push(mot);
  motCleSaisi.value = '';
}

function retirerMotCle(index: number) {
  form.value.motsClefs.splice(index, 1);
}

watch(fichierChoisi, (f) => {
  if (!f) {
    fichierDataUrl.value = undefined;
    return;
  }
  if (f.size > MAX_FICHIER_OCTETS) {
    $q.notify({
      type: 'negative',
      message: `Document refusé : il dépasse la limite de ${MAX_FICHIER_OCTETS_LABEL}.`,
    });
    fichierChoisi.value = null;
    return;
  }
  conversionFichier.value = true;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    fichierDataUrl.value = String(lecteur.result);
    conversionFichier.value = false;
  };
  lecteur.onerror = () => {
    $q.notify({ type: 'negative', message: "La lecture du fichier a échoué." });
    fichierChoisi.value = null;
    conversionFichier.value = false;
  };
  lecteur.readAsDataURL(f);
});

function nettoyable(v: any) {
  return v === undefined || v === null || v === '';
}

async function enregistrer() {
  if (!form.value.titre.trim()) {
    $q.notify({ type: 'warning', message: 'Le titre est obligatoire' });
    return;
  }
  if (fichierDataUrl.value) extractionEnCours.value = true;
  enregistrement.value = true;
  try {
    const payload: Record<string, any> = {
      titre: form.value.titre.trim(),
      type: form.value.type,
      auteurs: form.value.auteurs.trim() || undefined,
      anneeEdition: form.value.anneeEdition || undefined,
      resume: form.value.resume.trim() || undefined,
      departementId: form.value.departementId || undefined,
      enseignantId: form.value.enseignantId || undefined,
      etudiantId: form.value.etudiantId || undefined,
      public: form.value.public,
      motsClefs: form.value.motsClefs.length ? form.value.motsClefs : undefined,
      ...(fichierDataUrl.value ? { fichier: fichierDataUrl.value } : {}),
    };
    // Nettoyage des clés vides.
    Object.keys(payload).forEach((k) => nettoyable(payload[k]) && delete payload[k]);

    const url = props.document ? `/documents/${props.document.id}` : '/documents';
    const methode = props.document ? 'put' : 'post';
    const reponse = await api[methode](url, payload);
    const data = reponse.data;

    // Le backend peut renvoyer des suspicions de plagiat nouvellement créées.
    const suspicions: SuspicionPlagiat[] | undefined =
      data?.suspicionsPlagiat ?? data?.data?.suspicionsPlagiat;
    if (Array.isArray(suspicions) && suspicions.length && !suspicionDetectee.value) {
      // On retient la suspicion la plus haute pour alerter avant publication.
      const top = suspicions.slice().sort((a, b) => b.score - a.score)[0];
      suspicionDetectee.value = top;
    }

    if (!suspicionDetectee.value) {
      $q.notify({ type: 'positive', message: 'Document enregistré' });
      emit('enregistre');
      emit('update:modelValue', false);
    } else {
      $q.notify({
        type: 'warning',
        message: 'Document enregistré — vérifiez l’avertissement anti-plagiat',
        timeout: 4000,
      });
    }
  } catch {
    // Notification déjà émise par l’intercepteur axios.
  } finally {
    enregistrement.value = false;
    extractionEnCours.value = false;
  }
}

function voirSuspicion() {
  if (!suspicionDetectee.value) return;
  emit('update:modelValue', false);
  void router.push(`/plagiat/${suspicionDetectee.value.id}`);
}
</script>

<style scoped>
.section-titre {
  display: block;
  margin-top: 12px;
  margin-bottom: 4px;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--up-encre);
}
</style>
