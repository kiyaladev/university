<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 600px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ evaluation ? 'Modifier l’évaluation' : 'Nouvelle évaluation' }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Épreuve</span>
        <q-input
          v-model="form.intitule"
          outlined
          dense
          label="Intitulé *"
          hint="Ex. : CC de programmation, Examen final…"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.type"
              :options="optionsTypes"
              outlined
              dense
              emit-value
              map-options
              label="Type d’épreuve *"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model.number="form.coefficient"
              :options="optionsCoefficients"
              outlined
              dense
              label="Coefficient *"
              hint="Pondération au sein de la matière"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.semestre"
              :options="[1, 2]"
              outlined
              dense
              label="Semestre *"
            />
          </div>
          <div class="col-12 col-sm-6">
            <champ-date v-model="form.date" label="Date de l’épreuve" />
          </div>
        </div>

        <span class="section-titre">Contexte</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.anneeId"
              :options="optionsAnnees"
              outlined
              dense
              emit-value
              map-options
              label="Année académique *"
              @update:model-value="resetAnneeChangee"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.promotionId"
              :options="optionsPromotions"
              outlined
              dense
              emit-value
              map-options
              clearable
              label="Promotion *"
            />
          </div>
        </div>

        <q-select
          v-model="form.matiereId"
          :options="optionsMatieres"
          outlined
          dense
          emit-value
          map-options
          label="Matière (UE) *"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          label="Enregistrer"
          :loading="enregistrement"
          :disable="!formulaireValide"
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
import ChampDate from './ChampDate.vue';
import { LIBELLE_TYPE_EVALUATION } from '../utils/libelles';
import type { AnneeAcademique, Evaluation, Matiere, Promotion, TypeEvaluation } from '../types';

const props = defineProps<{
  modelValue: boolean;
  evaluation?: Evaluation | null;
  annees: AnneeAcademique[];
  promotions: Promotion[];
  matieres: Matiere[];
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({
  intitule: '',
  type: 'CC' as TypeEvaluation,
  coefficient: 1,
  semestre: 1,
  date: '',
  anneeId: null as string | null,
  promotionId: null as string | null,
  matiereId: null as string | null,
});

const optionsTypes = computed(() =>
  (Object.keys(LIBELLE_TYPE_EVALUATION) as TypeEvaluation[]).map((t) => ({
    label: LIBELLE_TYPE_EVALUATION[t],
    value: t,
  })),
);

const optionsCoefficients = [1, 1.5, 2, 2.5, 3].map((c) => ({ label: String(c), value: c }));

const optionsAnnees = computed(() => props.annees.map((a) => ({ label: a.libelle, value: a.id })));

const optionsPromotions = computed(() =>
  props.promotions
    .filter((p) => !form.value.anneeId || p.anneeId === form.value.anneeId)
    .map((p) => ({ label: `${p.nom}${p.filiere ? ` — ${p.filiere.nom}` : ''}`, value: p.id })),
);

const optionsMatieres = computed(() =>
  props.matieres.map((m) => ({ label: `${m.code} — ${m.intitule} (${m.credits} cr.)`, value: m.id })),
);

const formulaireValide = computed(
  () =>
    form.value.intitule.trim().length > 0 &&
    !!form.value.type &&
    !!form.value.anneeId &&
    !!form.value.promotionId &&
    !!form.value.matiereId,
);

function resetAnneeChangee() {
  form.value.promotionId = null;
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const e = props.evaluation;
    form.value = {
      intitule: e?.intitule ?? '',
      type: e?.type ?? 'CC',
      coefficient: e?.coefficient ?? 1,
      semestre: e?.semestre ?? 1,
      date: e?.date?.slice(0, 10) ?? '',
      anneeId: e?.anneeId ?? props.annees.find((a) => a.active)?.id ?? null,
      promotionId: e?.promotionId ?? null,
      matiereId: e?.matiereId ?? null,
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      ...form.value,
      date: form.value.date || undefined,
    };
    if (props.evaluation) await api.put(`/evaluations/${props.evaluation.id}`, payload);
    else await api.post('/evaluations', payload);
    $q.notify({ type: 'positive', message: 'Évaluation enregistrée' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>