<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { api } from '../boot/axios';
import { OPTIONS_TYPE_ELECTION } from '../services/elections';
import type { Departement, Election, Promotion, TypeElection } from '../types';

const $q = useQuasar();

const props = defineProps<{
  modelValue: boolean;
  election?: Election | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [e: Election] }>();

const OPTIONS_TYPE = OPTIONS_TYPE_ELECTION;

const formulaire = ref({
  titre: '',
  type: 'DELEGUE_PROMOTION' as TypeElection,
  promotionId: null as string | null,
  departementId: null as string | null,
  description: '',
  dateOuverture: null as string | null,
  dateCloture: null as string | null,
  nbSieges: 1,
  bulletin: '',
});

const enregistrement = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      const e = props.election;
      formulaire.value = {
        titre: e?.titre ?? '',
        type: (e?.type as TypeElection) ?? 'DELEGUE_PROMOTION',
        promotionId: e?.promotionId ?? null,
        departementId: e?.departementId ?? null,
        description: e?.description ?? '',
        dateOuverture: e?.dateOuverture ? e.dateOuverture.slice(0, 16) : null,
        dateCloture: e?.dateCloture ? e.dateCloture.slice(0, 16) : null,
        nbSieges: e?.nbSieges ?? 1,
        bulletin: e?.bulletin ?? '',
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.election?.id));
const titre = computed(() => (enEdition.value ? 'Modifier l\'élection' : 'Nouvelle élection'));

async function soumettre() {
  if (!formulaire.value.titre || !formulaire.value.dateOuverture || !formulaire.value.dateCloture) {
    $q.notify({ type: 'warning', message: 'Titre, ouverture et clôture sont obligatoires.' });
    return;
  }
  enregistrement.value = true;
  try {
    const url = enEdition.value ? `/elections/${props.election!.id}` : '/elections';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      titre: formulaire.value.titre,
      type: formulaire.value.type,
      dateOuverture: new Date(formulaire.value.dateOuverture).toISOString(),
      dateCloture: new Date(formulaire.value.dateCloture).toISOString(),
      nbSieges: formulaire.value.nbSieges,
    };
    if (formulaire.value.promotionId) payload.promotionId = formulaire.value.promotionId;
    if (formulaire.value.departementId) payload.departementId = formulaire.value.departementId;
    if (formulaire.value.description) payload.description = formulaire.value.description;
    if (formulaire.value.bulletin) payload.bulletin = formulaire.value.bulletin;
    const { data } = await api[methode](url, payload);
    $q.notify({ type: 'positive', message: enEdition.value ? 'Élection mise à jour.' : 'Élection créée.' });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Enregistrement impossible.' });
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
        <q-input v-model="formulaire.titre" label="Titre" outlined dense />
        <q-select
          v-model="formulaire.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          label="Type"
          outlined
          dense
        />
        <div class="row q-col-gutter-md">
          <autocomplete-async
            v-model="formulaire.promotionId"
            endpoint="/promotions"
            :label-fn="(p: Promotion) => `${p.nom} (${p.filiere?.code ?? ''})`"
            label="Promotion (optionnel)"
            class="col"
          />
          <autocomplete-async
            v-model="formulaire.departementId"
            endpoint="/departements"
            :label-fn="(d: Departement) => `${d.code} — ${d.nom}`"
            label="Département (optionnel)"
            class="col"
          />
        </div>
        <div class="row q-col-gutter-md">
          <q-input
            v-model="formulaire.dateOuverture"
            type="datetime-local"
            label="Ouverture"
            outlined
            dense
            class="col"
          />
          <q-input
            v-model="formulaire.dateCloture"
            type="datetime-local"
            label="Clôture"
            outlined
            dense
            class="col"
          />
        </div>
        <q-input
          v-model.number="formulaire.nbSieges"
          type="number"
          label="Nombre de sièges à pourvoir"
          outlined
          dense
        />
        <q-input
          v-model="formulaire.description"
          label="Description"
          outlined
          dense
          type="textarea"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="enEdition ? 'Enregistrer' : 'Créer'" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>