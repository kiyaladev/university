<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ residence ? $t('cites.residences.dialogs.form.titleEdit') : $t('cites.residences.dialogs.form.titleNew') }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">{{ $t('badges.table.columns.identity') }}</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-input v-model="form.code" outlined dense :label="$t('matieres.dialog.codeLabel')" />
          </div>
          <div class="col-12 col-sm-8">
            <q-input v-model="form.nom" outlined dense :label="$t('inscriptionPublique.form.step1.nom.label')" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.ville" outlined dense :label="$t('common.fields.city')" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.capacite"
              type="number"
              min="0"
              outlined
              dense
              :label="$t('cites.residences.dialogs.form.capacity')"
            />
          </div>
        </div>

        <span class="section-titre">{{ $t('cites.residences.dialogs.form.responsibilitySection') }}</span>
        <q-input v-model="form.adresse" outlined dense :label="$t('common.fields.address')" />
        <q-input
          v-model="form.responsable"
          outlined
          dense
          :label="$t('cites.residences.table.columns.responsable')"
          :hint="$t('cites.residences.dialogs.form.managerHint')"
          class="q-mt-md"
        />

        <q-toggle v-model="form.actif" :label="$t('cites.residences.dialogs.form.active')" class="q-mt-sm" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn color="primary" unelevated :label="$t('common.actions.register')" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import type { Residence } from '../types';

const props = defineProps<{
  modelValue: boolean;
  residence?: Residence | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);

const form = ref({
  code: '',
  nom: '',
  ville: '',
  adresse: '',
  capacite: 0,
  responsable: '',
  actif: true,
});

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const r = props.residence;
    form.value = {
      code: r?.code ?? '',
      nom: r?.nom ?? '',
      ville: r?.ville ?? '',
      adresse: r?.adresse ?? '',
      capacite: r?.capacite ?? 0,
      responsable: r?.responsable ?? '',
      actif: r?.actif ?? true,
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      ...form.value,
      ville: form.value.ville || undefined,
      adresse: form.value.adresse || undefined,
      responsable: form.value.responsable || undefined,
    };
    if (props.residence) await api.put(`/residences/${props.residence.id}`, payload);
    else await api.post('/residences', payload);
    $q.notify({ type: 'positive', message: t('cites.residences.dialogs.form.saved') });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
