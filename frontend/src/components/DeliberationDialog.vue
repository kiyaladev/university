<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="text-h6">Nouvelle délibération</q-card-section>

      <q-card-section>
        <q-select
          v-model="form.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          emit-value
          map-options
          label="Année académique *"
          @update:model-value="resetPromotion"
        />
        <q-select
          v-model="form.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          emit-value
          map-options
          label="Promotion *"
          class="q-mt-sm"
        />
        <q-select
          v-model="form.session"
          :options="optionsSessions"
          outlined
          dense
          emit-value
          map-options
          label="Session *"
          class="q-mt-sm"
          hint="Rattrapage : seuls les AJOURNÉ de la session normale sont repositionnés"
        />

        <q-banner class="note--valide q-mt-md" dense>
          <template #avatar><q-icon name="gavel" /></template>
          La délibération est créée en brouillon : les moyennes sont calculées
          automatiquement, puis le jury (direction) les valide.
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          label="Créer"
          :loading="enregistrement"
          :disable="!form.anneeId || !form.promotionId"
          @click="creer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { LIBELLE_SESSION_DELIBERATION } from '../utils/libelles';
import type { AnneeAcademique, Promotion, SessionDeliberation } from '../types';

const props = defineProps<{
  modelValue: boolean;
  annees: AnneeAcademique[];
  promotions: Promotion[];
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({
  anneeId: null as string | null,
  promotionId: null as string | null,
  session: 'NORMALE' as SessionDeliberation,
});

const optionsAnnees = computed(() => props.annees.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  props.promotions
    .filter((p) => !form.value.anneeId || p.anneeId === form.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsSessions = computed(() =>
  (Object.keys(LIBELLE_SESSION_DELIBERATION) as SessionDeliberation[]).map((s) => ({
    label: LIBELLE_SESSION_DELIBERATION[s],
    value: s,
  })),
);

function resetPromotion() {
  form.value.promotionId = null;
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = {
      anneeId: props.annees.find((a) => a.active)?.id ?? null,
      promotionId: null,
      session: 'NORMALE',
    };
  },
);

async function creer() {
  enregistrement.value = true;
  try {
    await api.post('/deliberations', {
      anneeId: form.value.anneeId,
      promotionId: form.value.promotionId,
      session: form.value.session,
    });
    $q.notify({ type: 'positive', message: 'Délibération créée, moyennes calculées' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>