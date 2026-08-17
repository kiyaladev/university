<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import type { BadgeAcces, TypeBadge } from '../types';

const $q = useQuasar();

const props = defineProps<{
  modelValue: boolean;
  badge?: BadgeAcces | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [b: BadgeAcces] }>();

const OPTIONS_TYPE: Array<{ value: TypeBadge; label: string }> = [
  { value: 'VISITEUR', label: 'Visiteur' },
  { value: 'INTERVENANT', label: 'Intervenant' },
  { value: 'TECHNICIEN', label: 'Technicien' },
  { value: 'VIP', label: 'Personnalité officielle' },
];

const formulaire = ref({
  type: 'VISITEUR' as TypeBadge,
  nom: '',
  prenom: '',
  fonction: '',
  organisation: '',
  telephone: '',
  email: '',
  pieceIdentite: '',
  numeroPiece: '',
  dateValidite: null as string | null,
  zonesAccess: '',
  photoUrl: '',
  motif: '',
});

const enregistrement = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      const b = props.badge;
      formulaire.value = {
        type: (b?.type as TypeBadge) ?? 'VISITEUR',
        nom: b?.nom ?? '',
        prenom: b?.prenom ?? '',
        fonction: b?.fonction ?? '',
        organisation: b?.organisation ?? '',
        telephone: b?.telephone ?? '',
        email: b?.email ?? '',
        pieceIdentite: b?.pieceIdentite ?? '',
        numeroPiece: b?.numeroPiece ?? '',
        dateValidite: b?.dateValidite?.slice(0, 10) ?? null,
        zonesAccess: b?.zonesAccess ?? '',
        photoUrl: b?.photoUrl ?? '',
        motif: b?.motif ?? '',
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.badge?.id));
const titre = computed(() => (enEdition.value ? 'Modifier le badge' : 'Émettre un badge'));

async function soumettre() {
  if (!formulaire.value.nom || !formulaire.value.prenom) {
    $q.notify({ type: 'warning', message: 'Nom et prénom sont obligatoires.' });
    return;
  }
  if (!formulaire.value.dateValidite) {
    $q.notify({ type: 'warning', message: 'Indiquez une date de validité.' });
    return;
  }
  enregistrement.value = true;
  try {
    const { default: api } = await import('../boot/axios');
    const url = enEdition.value ? `/badges/${props.badge!.id}` : '/badges';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      type: formulaire.value.type,
      nom: formulaire.value.nom,
      prenom: formulaire.value.prenom,
      dateValidite: formulaire.value.dateValidite,
    };
    const champsOptionnels = ['fonction', 'organisation', 'telephone', 'email', 'pieceIdentite', 'numeroPiece', 'zonesAccess', 'photoUrl', 'motif'];
    for (const champ of champsOptionnels) {
      const valeur = (formulaire.value as any)[champ];
      if (valeur) payload[champ] = valeur;
    }
    const { data } = await api[methode](url, payload);
    $q.notify({ type: 'positive', message: enEdition.value ? 'Badge mis à jour.' : 'Badge émis.' });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Émission impossible.' });
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
    <q-card style="min-width: 540px; max-width: 92vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ titre }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="fermer" />
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <q-select
          v-model="formulaire.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          label="Type de badge"
          outlined
          dense
        />
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.prenom" label="Prénom" outlined dense class="col" />
          <q-input v-model="formulaire.nom" label="Nom" outlined dense class="col" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.fonction" label="Fonction" outlined dense class="col" />
          <q-input v-model="formulaire.organisation" label="Organisation" outlined dense class="col" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.telephone" label="Téléphone" outlined dense class="col" />
          <q-input v-model="formulaire.email" label="Email" outlined dense class="col" type="email" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.pieceIdentite" label="Type de pièce" outlined dense class="col" />
          <q-input v-model="formulaire.numeroPiece" label="Numéro de pièce" outlined dense class="col" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.dateValidite" label="Valable jusqu'au" type="date" outlined dense class="col" />
          <q-input v-model="formulaire.zonesAccess" label="Zones autorisées (CSV)" outlined dense class="col" />
        </div>
        <q-input v-model="formulaire.photoUrl" label="Photo (URL)" outlined dense placeholder="https://…" />
        <q-input
          v-if="enEdition"
          v-model="formulaire.motif"
          label="Motif (si annulé)"
          outlined
          dense
          type="textarea"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="enEdition ? 'Enregistrer' : 'Émettre le badge'" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>