<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 600px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ document ? 'Modifier le document' : 'Déposer un document' }}
      </q-card-section>

      <q-card-section>
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
            <q-select
              v-model="form.departementId"
              :options="optionsDepartements"
              outlined
              dense
              clearable
              emit-value
              map-options
              label="Département"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.enseignantId"
              :options="optionsEnseignants"
              outlined
              dense
              clearable
              emit-value
              map-options
              label="Enseignant associé"
            />
          </div>
        </div>

        <span class="section-titre">Fichier (archivage natif)</span>
        <p class="text-caption text-grey-7 q-mt-xs q-mb-sm">
          La numérisation des fonds papier sera facturée à part : ici on dépose
          des fichiers PDF numériques.
        </p>
        <q-file
          v-model="fichierChoisi"
          accept=".pdf,application/pdf"
          :max-file-size="MAX_FICHIER_OCTETS"
          outlined
          dense
          label="PDF joint"
          hint="PDF jusqu'à 5 Mo : le data-url base64 pèse un tiers de plus, le serveur plafonne à 8 Mo"
          :disable="conversionFichier"
        >
          <template #prepend><q-icon name="attach_file" /></template>
        </q-file>
        <div v-if="document?.tailleKo" class="text-caption text-grey-7 q-mt-xs">
          Fichier actuel : PDF joint ({{ (document.tailleKo / 1024).toFixed(1) }} Mo) — en choisir
          un nouveau le remplace.
        </div>

        <q-toggle v-model="form.public" label="Visible sur la page publique" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          label="Enregistrer"
          :loading="enregistrement"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { Departement, DocumentDepot, Enseignant } from '../types';

const props = defineProps<{
  modelValue: boolean;
  document?: DocumentDepot | null;
  departements: Departement[];
  enseignants: Enseignant[];
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const auth = useAuthStore();
const enregistrement = ref(false);
const fichierChoisi = ref<File | null>(null);
const conversionFichier = ref(false);
const fichierDataUrl = ref<string>();

/** 5 Mo de PDF → ≈ 6,7 Mo de base64 : confortablement sous les 8 Mo du serveur. */
const MAX_FICHIER_OCTETS = 5 * 1024 * 1024;

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({
  value,
  label,
}));

const form = ref({
  titre: '',
  type: 'AUTRE',
  auteurs: '',
  anneeEdition: null as number | null,
  resume: '',
  departementId: null as string | null,
  enseignantId: null as string | null,
  public: true,
});

const optionsDepartements = computed(() =>
  props.departements.map((d) => ({ label: d.nom, value: d.id })),
);
const optionsEnseignants = computed(() =>
  props.enseignants.map((e) => ({ label: `${e.prenom} ${e.nom}`, value: e.id })),
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const d = props.document;
    fichierChoisi.value = null;
    fichierDataUrl.value = undefined;
    form.value = {
      titre: d?.titre ?? '',
      type: d?.type ?? 'AUTRE',
      auteurs: d?.auteurs ?? '',
      anneeEdition: d?.anneeEdition ?? null,
      resume: d?.resume ?? '',
      departementId: d?.departementId ?? null,
      // Un enseignant qui dépose est présélectionné d'office comme auteur.
      enseignantId: d?.enseignantId ?? (auth.estEnseignant ? (auth.utilisateur?.enseignantId ?? null) : null),
      public: d?.public ?? true,
    };
  },
);

watch(fichierChoisi, (f) => {
  if (!f) {
    fichierDataUrl.value = undefined;
    return;
  }
  if (f.size > MAX_FICHIER_OCTETS) {
    $q.notify({
      type: 'negative',
      message: 'Document refusé : il dépasse la limite de 5 Mo.',
    });
    fichierChoisi.value = null;
    return;
  }
  // Conversion FileReader → data-url base64, comme l'exige le schéma.
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

async function enregistrer() {
  if (!form.value.titre.trim()) {
    $q.notify({ type: 'warning', message: 'Le titre est obligatoire' });
    return;
  }
  enregistrement.value = true;
  try {
    const payload = {
      ...form.value,
      anneeEdition: form.value.anneeEdition || undefined,
      auteurs: form.value.auteurs.trim() || undefined,
      resume: form.value.resume.trim() || undefined,
      departementId: form.value.departementId || undefined,
      enseignantId: form.value.enseignantId || undefined,
      ...(fichierDataUrl.value ? { fichier: fichierDataUrl.value } : {}),
    };
    if (props.document) await api.put(`/documents/${props.document.id}`, payload);
    else await api.post('/documents', payload);
    $q.notify({ type: 'positive', message: 'Document enregistré' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>