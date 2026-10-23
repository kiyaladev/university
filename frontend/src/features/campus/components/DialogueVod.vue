<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { api } from '@/boot/axios';
import type { CoursVOD, Enseignant, Inscription, Matiere, TypeRessourceVOD } from '@/types';
import { useAuthStore } from '@/stores/auth';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  vod?: CoursVOD | null;
}>();

const emit = defineEmits<{ enregistre: [v: CoursVOD] }>();

const OPTIONS_TYPE = computed(() => [
  { value: 'AUDIO' as TypeRessourceVOD, label: t('vodPage.formDialog.types.audio') },
  { value: 'VIDEO' as TypeRessourceVOD, label: t('vodPage.formDialog.types.video') },
  { value: 'NOTES' as TypeRessourceVOD, label: t('common.fields.notes') },
  { value: 'TRANSCRIPTION' as TypeRessourceVOD, label: t('vodPage.formDialog.types.transcription') },
]);

const formulaire = ref({
  titre: '',
  description: '',
  type: 'VIDEO' as TypeRessourceVOD,
  matiereId: null as string | null,
  enseignantId: null as string | null,
  inscriptionId: null as string | null,
  url: '',
  thumbnailUrl: '',
  dureeSecondes: null as number | null,
  public: true,
});

const enregistrement = ref(false);

watch(ouvert, (visible) => {
  if (visible) {
    const v = props.vod;
    formulaire.value = {
      titre: v?.titre ?? '',
      description: v?.description ?? '',
      type: (v?.type as TypeRessourceVOD) ?? 'VIDEO',
      matiereId: v?.matiereId ?? null,
      enseignantId: v?.enseignantId ?? null,
      inscriptionId: v?.inscriptionId ?? null,
      url: v?.url ?? '',
      thumbnailUrl: v?.thumbnailUrl ?? '',
      dureeSecondes: v?.dureeSecondes ?? null,
      public: v?.public ?? true,
    };
  }
});

const enEdition = computed(() => Boolean(props.vod?.id));
const titre = computed(() => t(enEdition.value ? 'vodPage.formDialog.editTitle' : 'vodPage.formDialog.newTitle'));

async function soumettre() {
  if (!formulaire.value.titre || !formulaire.value.url) {
    $q.notify({ type: 'warning', message: t('vodPage.formDialog.required') });
    return;
  }
  enregistrement.value = true;
  try {
    // `api` est l'export nommé de boot/axios : l'import dynamique du default
    // (la fonction de boot) masquait l'instance et cassait l'enregistrement.
    const url = enEdition.value ? `/vod/${props.vod!.id}` : '/vod';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      titre: formulaire.value.titre,
      description: formulaire.value.description || undefined,
      type: formulaire.value.type,
      url: formulaire.value.url,
      thumbnailUrl: formulaire.value.thumbnailUrl || undefined,
      matiereId: formulaire.value.matiereId || undefined,
      enseignantId: formulaire.value.enseignantId || undefined,
      dureeSecondes: formulaire.value.dureeSecondes ?? undefined,
      public: formulaire.value.public,
      ...(auth.estAdmin ? { inscriptionId: formulaire.value.inscriptionId } : {}),
    };
    const { data } = methode === 'put' ? await api.put(url, payload) : await api.post(url, payload);
    $q.notify({
      type: 'positive',
      message: t(enEdition.value ? 'vodPage.formDialog.updated' : 'vodPage.formDialog.created'),
    });
    emit('enregistre', data);
    ouvert.value = false;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}
</script>

<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="titre"
    taille="m"
    :envoi="enregistrement"
    :libelle-valider="$t(enEdition ? 'common.actions.save' : 'common.actions.create')"
    @valider="soumettre"
  >
    <div class="q-gutter-md">
      <q-input v-model="formulaire.titre" :label="$t('common.fields.title')" outlined dense />
      <q-select
        v-model="formulaire.type"
        :options="OPTIONS_TYPE"
        emit-value
        map-options
        :label="$t('vodPage.filters.resourceType')"
        outlined
        dense
      />
      <q-input
        v-model="formulaire.url"
        :label="$t('vodPage.formDialog.mediaUrl')"
        outlined
        dense
        :placeholder="$t('vodPage.formDialog.mediaUrlPlaceholder')"
      />
      <q-input
        v-model="formulaire.thumbnailUrl"
        :label="$t('vodPage.formDialog.thumbnailUrl')"
        outlined
        dense
        :placeholder="$t('vodPage.formDialog.thumbnailUrlPlaceholder')"
      />
      <champ-recherche
        v-model="formulaire.matiereId"
        endpoint="/matieres"
        :label-fn="(m: Matiere) => `${m.code} — ${m.intitule}`"
        :label="$t('common.fields.subject')"
      />
      <champ-recherche
        v-model="formulaire.enseignantId"
        endpoint="/enseignants"
        :label-fn="(e: Enseignant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
        :label="$t('common.fields.teacher')"
      />
      <div class="row q-col-gutter-md">
        <q-input
          v-model.number="formulaire.dureeSecondes"
          type="number"
          :label="$t('vodPage.formDialog.duration')"
          outlined
          dense
          class="col-12 col-sm-6"
        />
        <q-toggle
          v-model="formulaire.public"
          :label="$t('vodPage.formDialog.publicResource')"
          class="col-12 col-sm-6"
        />
      </div>
      <template v-if="!formulaire.public">
        <champ-recherche
          v-if="auth.estAdmin"
          v-model="formulaire.inscriptionId"
          endpoint="/inscriptions"
          server-search
          :label-fn="
            (i: Inscription) =>
              `${i.numero} — ${i.etudiant?.prenom ?? ''} ${i.etudiant?.nom ?? ''} — ${i.annee?.libelle ?? ''} ${i.promotion?.nom ?? ''}`
          "
          :label="$t('vodPage.formDialog.privateEnrollment')"
        />
        <div class="text-caption text-grey-7">
          {{
            $t(
              auth.estAdmin
                ? 'vodPage.formDialog.privateEnrollmentHint'
                : 'vodPage.formDialog.privateEnrollmentManaged',
            )
          }}
        </div>
      </template>
      <q-input
        v-model="formulaire.description"
        :label="$t('common.fields.description')"
        outlined
        dense
        type="textarea"
        autogrow
      />
    </div>
  </dialogue-formulaire>
</template>
