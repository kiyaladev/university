<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section class="text-h6 row items-center">
        <q-icon name="library_books" class="q-mr-sm" />
        {{ document ? $t('bibliotheque.dialog.title.edit') : $t('bibliotheque.dialog.title.deposit') }}
      </q-card-section>

      <q-card-section class="q-pt-none">
        <span class="section-titre">{{ $t('bibliotheque.dialog.sections.document') }}</span>
        <q-input
          v-model="form.titre"
          outlined
          dense
          :label="$t('bibliotheque.dialog.fields.title')"
          :hint="$t('bibliotheque.dialog.fields.titleHint')"
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
              :label="$t('bibliotheque.dialog.fields.type')"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.anneeEdition"
              type="number"
              outlined
              dense
              :label="$t('bibliotheque.filters.editionYear')"
              :hint="$t('bibliotheque.dialog.fields.editionYearHint')"
              :max="2100"
              :min="1900"
            />
          </div>
        </div>

        <q-input
          v-model="form.auteurs"
          outlined
          dense
          :label="$t('bibliotheque.dialog.fields.authors')"
          :hint="$t('bibliotheque.dialog.fields.authorsHint')"
        />

        <q-input v-model="form.resume" outlined dense type="textarea" autogrow :label="$t('bibliotheque.dialog.fields.abstract')" />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.departementId"
              endpoint="/departements"
              :label-fn="(d) => `${d.code ? d.code + ' — ' : ''}${d.nom}`"
              :label="$t('common.fields.department')"
              :placeholder="$t('bibliotheque.filters.departmentPlaceholder')"
            />
          </div>
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.enseignantId"
              endpoint="/enseignants"
              :label-fn="(e) => `${e.prenom} ${e.nom}${e.matricule ? ' — ' + e.matricule : ''}`"
              :label="$t('common.fields.supervisor')"
              :placeholder="$t('bibliotheque.dialog.fields.supervisorPlaceholder')"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.etudiantId"
              endpoint="/etudiants"
              :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
              :label="$t('common.fields.student')"
              :placeholder="$t('bibliotheque.dialog.fields.studentPlaceholder')"
            />
          </div>
          <div class="col-12 col-sm-6 q-pt-md">
            <q-toggle v-model="form.public" :label="$t('bibliotheque.dialog.fields.public')" />
          </div>
        </div>

        <span class="section-titre">{{ $t('bibliotheque.dialog.sections.keywords') }}</span>
        <q-input
          v-model="motCleSaisi"
          outlined
          dense
          :label="$t('bibliotheque.dialog.fields.addKeyword')"
          :placeholder="$t('bibliotheque.dialog.fields.keywordPlaceholder')"
          @keydown.enter.prevent="ajouterMotCle"
        >
          <template #append>
            <q-icon
              v-if="motCleSaisi"
              name="add_circle"
              class="cursor-pointer"
              @click="ajouterMotCle"
            >
              <q-tooltip>{{ $t('common.actions.add') }}</q-tooltip>
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
          {{ $t('bibliotheque.dialog.fields.noKeywords') }}
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <span class="section-titre">{{ $t('bibliotheque.dialog.sections.file') }}</span>
        <p class="text-caption text-grey-7 q-mt-xs q-mb-sm">
          {{ $t('bibliotheque.dialog.file.description', { max: maxFichierLisible }) }}
        </p>
        <q-file
          v-model="fichierChoisi"
          accept=".pdf,application/pdf"
          :max-file-size="MAX_FICHIER_OCTETS"
          outlined
          dense
          :label="$t('bibliotheque.dialog.file.attachment')"
          :hint="$t('bibliotheque.dialog.file.maxSize', { max: maxFichierLisible })"
          :disable="conversionFichier || extractionEnCours"
        >
          <template #prepend><q-icon name="attach_file" /></template>
        </q-file>
        <div v-if="document?.tailleKo" class="text-caption text-grey-7 q-mt-xs">
          {{ $t('bibliotheque.dialog.file.current', { size: (document.tailleKo / 1024).toFixed(1) }) }}
        </div>
        <div v-if="conversionFichier" class="row items-center q-mt-sm text-caption text-grey-7">
          <q-spinner size="16px" class="q-mr-sm" /> {{ $t('bibliotheque.dialog.file.converting') }}
        </div>
        <div v-else-if="extractionEnCours" class="row items-center q-mt-sm text-caption text-primary">
          <q-spinner size="16px" class="q-mr-sm" /> {{ $t('bibliotheque.dialog.file.extracting') }}
        </div>
      </q-card-section>

      <q-banner
        v-if="!form.public && suspicionDetectee"
        dense
        class="bg-orange-1 text-orange-10 q-mx-md q-mb-md"
      >
        <template #avatar><q-icon name="warning" color="orange" /></template>
        <div class="text-weight-medium">{{ $t('bibliotheque.dialog.plagiarism.title') }}</div>
        <div class="q-mt-xs text-caption">
          {{ $t('bibliotheque.dialog.plagiarism.message', { score: suspicionDetectee.score }) }}
        </div>
        <q-btn
          flat
          dense
          no-caps
          color="orange"
          icon="open_in_new"
          :label="$t('bibliotheque.dialog.plagiarism.view')"
          class="q-mt-xs"
          @click="voirSuspicion"
        />
      </q-banner>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          :label="$t('common.actions.register')"
          :loading="enregistrement"
          :disable="conversionFichier || extractionEnCours"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import AutocompleteAsync from '@/shared/components/AutocompleteAsync.vue';
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import type { DocumentDepot, SuspicionPlagiat } from '@/types';

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
const { t: $t } = useI18n();
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
const maxFichierLisible = computed(() => $t('bibliotheque.dialog.file.maxSizeValue', { count: 8 }));

const typesDocument = computed(() => Object.keys(LIBELLE_TYPE_DOCUMENT).map((value) => ({
  value,
  label: $t(`libelles.type_document.${value}`),
})));

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
      message: $t('bibliotheque.dialog.file.tooLarge', { max: maxFichierLisible.value }),
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
    $q.notify({ type: 'negative', message: $t('bibliotheque.dialog.file.readFailed') });
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
    $q.notify({ type: 'warning', message: $t('bibliotheque.dialog.validation.titleRequired') });
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
      $q.notify({ type: 'positive', message: $t('bibliotheque.dialog.messages.saved') });
      emit('enregistre');
      emit('update:modelValue', false);
    } else {
      $q.notify({
        type: 'warning',
        message: $t('bibliotheque.dialog.messages.savedPlagiarismWarning'),
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
  letter-spacing: 0.5px;
  color: var(--up-encre);
}
</style>
