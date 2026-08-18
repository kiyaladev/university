<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { api } from '../boot/axios';
import type { CarteEtudiante, Etudiant } from '../types';

const $q = useQuasar();

const props = defineProps<{
  modelValue: boolean;
  carte?: CarteEtudiante | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [carte: CarteEtudiante] }>();

const formulaire = ref({
  etudiantId: null as string | null,
  dateValidite: null as string | null,
  photoUrl: null as string | null,
  nip: null as string | null,
});

const enregistrement = ref(false);

watch(
  () => props.modelValue,
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
const titre = computed(() => (enEdition.value ? 'Modifier la carte' : 'Émettre une carte'));

async function soumettre() {
  if (!formulaire.value.etudiantId) {
    $q.notify({ type: 'warning', message: "Sélectionnez l'étudiant." });
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
      message: enEdition.value ? 'Carte mise à jour.' : 'Carte émise.',
    });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Émission impossible.',
    });
  } finally {
    enregistrement.value = false;
  }
}

function fermer() {
  emit('update:modelValue', false);
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="min-width: 520px; max-width: 92vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ titre }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="fermer" />
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-md">
        <autocomplete-async
          v-if="!enEdition"
          v-model="formulaire.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e: Etudiant) => `${e.matricule} — ${e.prenom} ${e.nom}`"
          label="Étudiant"
        />
        <q-input
          v-else
          :model-value="carte?.etudiant ? `${carte.etudiant.matricule} — ${carte.etudiant.prenom} ${carte.etudiant.nom}` : ''"
          label="Étudiant"
          readonly
          outlined
          dense
        />

        <q-input
          v-model="formulaire.dateValidite"
          type="date"
          label="Date de validité"
          outlined
          dense
        />

        <q-input
          v-model="formulaire.photoUrl"
          label="Photo (URL)"
          outlined
          dense
          placeholder="https://…"
        />

        <q-banner v-if="enEdition" class="note--info">
          La révocation d'une carte se fait depuis la liste (bouton « Révoquer »)
          : elle exige un motif et invalide immédiatement le QR.
        </q-banner>

        <q-banner v-if="!enEdition" class="note--info">
          Le NIP est normalement défini par l'étudiant depuis « Ma carte
          étudiante ». Si vous devez l'initialiser pour lui, renseignez 4 à 6
          chiffres ci-dessous — lui seul pourra ensuite le changer.
        </q-banner>

        <q-input
          v-if="!enEdition"
          v-model="formulaire.nip"
          label="NIP initial (4 à 6 chiffres)"
          outlined
          dense
          mask="######"
          hint="Facultatif : l'étudiant pourra le redéfinir depuis son portail."
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="enEdition ? 'Enregistrer' : 'Émettre la carte'" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>