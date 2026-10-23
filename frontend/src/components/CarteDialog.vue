<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import AutocompleteAsync from './AutocompleteAsync.vue';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { api } from '../boot/axios';
import type { CarteEtudiante, Etudiant } from '../types';

const $q = useQuasar();
const { t } = useI18n();

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  carte?: CarteEtudiante | null;
}>();

const emit = defineEmits<{ enregistre: [carte: CarteEtudiante] }>();

const formulaire = ref({
  etudiantId: null as string | null,
  dateValidite: null as string | null,
  photoUrl: null as string | null,
  nip: null as string | null,
});

const enregistrement = ref(false);

watch(
  ouvert,
  (visible) => {
    if (visible) {
      formulaire.value = {
        etudiantId: props.carte?.etudiantId ?? null,
        dateValidite: props.carte?.dateValidite?.slice(0, 10) ?? null,
        photoUrl: props.carte?.photoUrl ?? null,
        nip: null,
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.carte?.id));
const titre = computed(() => t(enEdition.value ? 'carteEtudiante.formDialog.titleEdit' : 'carteEtudiante.formDialog.titleNew'));

async function soumettre() {
  if (!formulaire.value.etudiantId) {
    $q.notify({ type: 'warning', message: t('carteEtudiante.formDialog.studentRequired') });
    return;
  }
  enregistrement.value = true;
  try {
    const url = enEdition.value ? `/cartes-etudiantes/${props.carte!.id}` : '/cartes-etudiantes';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      etudiantId: formulaire.value.etudiantId,
      dateValidite: formulaire.value.dateValidite || undefined,
      photoUrl: formulaire.value.photoUrl || undefined,
    };
    if (formulaire.value.nip) payload.nip = formulaire.value.nip;
    const { data } = await api[methode](url, payload);
    $q.notify({
      type: 'positive',
      message: t(enEdition.value ? 'carteEtudiante.formDialog.updated' : 'carteEtudiante.formDialog.issued'),
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
    taille="s"
    :envoi="enregistrement"
    :libelle-valider="$t(enEdition ? 'common.actions.save' : 'carteEtudiante.actions.issue')"
    @valider="soumettre"
  >
    <div class="q-gutter-md">
      <autocomplete-async
        v-if="!enEdition"
        v-model="formulaire.etudiantId"
        endpoint="/etudiants"
        :label-fn="(e: Etudiant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
        :label="$t('common.fields.student')"
      />
      <q-input
        v-else
        :model-value="carte?.etudiant ? `${carte.etudiant.matricule} — ${carte.etudiant.prenom} ${carte.etudiant.nom}` : ''"
        :label="$t('common.fields.student')"
        readonly
        outlined
        dense
      />

      <q-input
        v-model="formulaire.dateValidite"
        type="date"
        :label="$t('carteEtudiante.formDialog.validityLabel')"
        outlined
        dense
      />

      <q-input
        v-model="formulaire.photoUrl"
        :label="$t('carteEtudiante.formDialog.photoLabel')"
        outlined
        dense
      />

      <q-banner v-if="enEdition" class="note--info">
        {{ $t('carteEtudiante.formDialog.revokeHint') }}
      </q-banner>

      <q-banner v-if="!enEdition" class="note--info">
        {{ $t('carteEtudiante.formDialog.pinHint') }}
      </q-banner>

      <q-input
        v-if="!enEdition"
        v-model="formulaire.nip"
        :label="$t('carteEtudiante.formDialog.initialPinLabel')"
        outlined
        dense
        mask="######"
        :hint="$t('carteEtudiante.formDialog.pinHintOptional')"
      />
    </div>
  </dialogue-formulaire>
</template>
