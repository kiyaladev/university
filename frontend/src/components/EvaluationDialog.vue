<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(evaluation ? 'evaluations.dialogForm.editTitle' : 'evaluations.dialogForm.newTitle')"
    :envoi="enregistrement"
    :libelle-valider="$t('common.actions.register')"
    :desactive="!formulaireValide"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('evaluations.dialogForm.assessment') }}</span>
    <q-input
      v-model="form.intitule"
      outlined
      dense
      :label="$t('matieres.dialog.intituleLabel')"
      :hint="$t('evaluations.dialogForm.titleHint')"
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
          :label="$t('evaluations.dialogForm.type')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.coefficient"
          :options="optionsCoefficients"
          outlined
          dense
          emit-value
          map-options
          :label="$t('evaluations.dialogForm.coefficient')"
          :hint="$t('evaluations.dialogForm.coefficientHint')"
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
          :label="$t('evaluations.dialogForm.semester')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <champ-date v-model="form.date" :label="$t('evaluations.dialogForm.date')" />
      </div>
    </div>

    <span class="section-titre">{{ $t('evaluations.dialogForm.context') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          emit-value
          map-options
          :label="$t('common.fields.academicYearRequired')"
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
          :label="$t('affectations.dialog.fields.promotion')"
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
      :label="$t('evaluations.dialogForm.subject')"
    />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useReferentielsStore } from '../stores/referentiels';
import ChampDate from './ChampDate.vue';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { LIBELLE_TYPE_EVALUATION } from '../utils/libelles';
import type { AnneeAcademique, Evaluation, Matiere, Promotion, TypeEvaluation } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  evaluation?: Evaluation | null;
  annees: AnneeAcademique[];
  promotions: Promotion[];
  matieres: Matiere[];
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const referentiels = useReferentielsStore();
const { t } = useI18n();
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

watch(ouvert, (o) => {
  if (!o) return;
  const e = props.evaluation;
  form.value = {
    intitule: e?.intitule ?? '',
    type: e?.type ?? 'CC',
    coefficient: e?.coefficient ?? 1,
    semestre: e?.semestre ?? 1,
    date: e?.date?.slice(0, 10) ?? '',
    anneeId: e?.anneeId ?? referentiels.anneeCourante?.id ?? null,
    promotionId: e?.promotionId ?? null,
    matiereId: e?.matiereId ?? null,
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      ...form.value,
      date: form.value.date || undefined,
    };
    if (props.evaluation) await api.put(`/evaluations/${props.evaluation.id}`, payload);
    else await api.post('/evaluations', payload);
    $q.notify({ type: 'positive', message: t('evaluations.dialogForm.saved') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
