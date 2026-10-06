<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('examens.actions.schedule') }}</div>
        <div class="text-caption text-grey-7">{{ $t('examens.fields.codeHint') }}</div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <q-input v-model="form.intitule" outlined dense :label="$t('evaluations.table.columns.title')" />
        <autocomplete-async
          v-model="form.surveillantId"
          endpoint="/examens/surveillants"
          :label="$t('examens.fields.supervisor')"
          :label-fn="(u) => `${u.prenom} ${u.nom} — ${u.role}`"
          :clearable="true"
        />
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-select v-model="form.type" :options="optionsTypes" outlined dense emit-value map-options :label="$t('common.fields.type')" />
          </div>
          <div class="col-6">
            <q-input v-model="form.codeExamen" outlined dense :label="$t('examens.fields.code')" />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <autocomplete-async
              v-model="form.matiereId"
              endpoint="/matieres"
              :label="$t('affectations.dialog.fields.subject')"
              :label-fn="(m) => `${m.code} — ${m.intitule}`"
            />
          </div>
          <div class="col-6">
            <autocomplete-async
              v-model="form.promotionId"
              endpoint="/referentiel/promotions"
              :label="$t('affectations.dialog.fields.promotion')"
              :label-fn="(p) => `${p.nom} — ${p.niveau}`"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <autocomplete-async
              v-model="form.anneeId"
              endpoint="/referentiel/annees"
              :label="$t('affectations.dialog.fields.year')"
              :label-fn="(a) => a.libelle"
            />
          </div>
          <div class="col-6">
            <autocomplete-async
              v-model="form.salleId"
              endpoint="/salles"
              :label="$t('common.fields.classroom')"
              :label-fn="(s) => `${s.code} — ${s.nom}`"
              :clearable="true"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-4">
            <champ-date v-model="form.dateExamen" :label="$t('examens.fields.examDate')" />
          </div>
          <div class="col-4">
            <q-input v-model="form.heureDebut" outlined dense type="time" :label="$t('examens.fields.startTime')" />
          </div>
          <div class="col-4">
            <q-input v-model="form.heureFin" outlined dense type="time" :label="$t('examens.fields.endTime')" />
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn unelevated no-caps color="primary" :label="$t('common.actions.register')" :loading="envoi" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import ChampDate from './ChampDate.vue';
import { LIBELLE_TYPE_EXAMEN } from '../utils/libelles';

defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  cree: [];
}>();

const $q = useQuasar();

const optionsTypes = (['PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_EXAMEN[value],
}));

const form = ref({
  intitule: '',
  type: 'FINAL',
  codeExamen: '',
  matiereId: null as string | null,
  promotionId: null as string | null,
  anneeId: null as string | null,
  salleId: null as string | null,
  dateExamen: '',
  heureDebut: '08:00',
  heureFin: '10:00',
  surveillantId: null as string | null,
});

const envoi = ref(false);

async function enregistrer() {
  if (!form.value.intitule || !form.value.codeExamen || !form.value.matiereId || !form.value.promotionId || !form.value.anneeId || !form.value.dateExamen) {
    $q.notify({ type: 'warning', message: 'Champs obligatoires manquants' });
    return;
  }
  envoi.value = true;
  try {
    await api.post('/examens', form.value);
    $q.notify({ type: 'positive', message: 'Examen planifié' });
    emit('update:modelValue', false);
    emit('cree');
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Enregistrement impossible' });
  } finally {
    envoi.value = false;
  }
}
</script>
