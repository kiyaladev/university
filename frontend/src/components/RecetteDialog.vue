<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t(existant ? 'recettes.formDialog.editTitle' : 'recettes.formDialog.newTitle') }}</div>
        <div class="text-caption text-grey-7">
          {{ $t('recettes.formDialog.numberHint') }}
        </div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <q-banner v-if="champsComptablesFiges" dense rounded class="bg-amber-1 text-brown-9">
          {{ $t('recettes.formDialog.accountingLocked') }}
        </q-banner>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.numero" :disable="!!existant" outlined dense :label="$t('recettes.formDialog.number')" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.type"
              :options="optionsTypes"
              :disable="champsComptablesFiges"
              outlined
              dense
              emit-value
              map-options
              :label="$t('common.fields.type')"
            />
          </div>
        </div>
        <q-input v-model="form.libelle" outlined dense :label="$t('patrimoine.categories.dialog.labelLabel')" />
        <q-input v-model="form.description" outlined dense type="textarea" rows="2" :label="$t('common.fields.description')" />
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <champ-date v-model="form.date" :disable="champsComptablesFiges" :label="$t('recettes.formDialog.date')" />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model.number="form.montant" :disable="champsComptablesFiges" type="number" min="0" outlined dense :label="$t('recettes.formDialog.amount')" />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="form.devise" :disable="champsComptablesFiges" outlined dense :label="$t('recettes.formDialog.currency')" />
          </div>
        </div>
        <q-input v-model="form.client" outlined dense :label="$t('recettes.table.columns.client')" />
        <q-input v-model="form.factureNum" outlined dense :label="$t('recettes.formDialog.invoiceNumber')" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn unelevated color="primary" :label="$t(existant ? 'common.actions.save' : 'recettes.actions.issueRecette')" :loading="envoi" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';
import { LIBELLE_TYPE_RECETTE, aujourdhui } from '../utils/libelles';

const props = defineProps<{
  modelValue: boolean;
  existant: any | null;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  cree: [];
}>();

const $q = useQuasar();
const { t } = useI18n();

const optionsTypes = computed(() => Object.entries(LIBELLE_TYPE_RECETTE).map(([value, label]) => ({
  value,
  label,
})));

const form = ref({
  numero: '',
  type: 'PRESTATION_FORMATION',
  libelle: '',
  description: '',
  montant: 0,
  devise: 'GNF',
  date: aujourdhui(),
  client: '',
  factureNum: '',
});

const envoi = ref(false);
const champsComptablesFiges = computed(() => !!props.existant?.paiementId);

watch(
  () => props.modelValue,
  (v) => {
    if (v && props.existant) {
      form.value = {
        numero: props.existant.numero,
        type: props.existant.type,
        libelle: props.existant.libelle,
        description: props.existant.description ?? '',
        montant: props.existant.montant,
        devise: props.existant.devise ?? 'GNF',
        date: props.existant.date?.slice(0, 10) ?? aujourdhui(),
        client: props.existant.client ?? '',
        factureNum: props.existant.factureNum ?? '',
      };
    } else if (v && !props.existant) {
      form.value = {
        numero: '',
        type: 'PRESTATION_FORMATION',
        libelle: '',
        description: '',
        montant: 0,
        devise: 'GNF',
        date: aujourdhui(),
        client: '',
        factureNum: '',
      };
    }
  },
);

async function enregistrer() {
  const montant = Number(form.value.montant);
  if ((!props.existant && !form.value.numero) || !form.value.libelle || !Number.isFinite(montant) || montant < 0 || !form.value.date) {
    $q.notify({ type: 'warning', message: t('recettes.formDialog.required') });
    return;
  }
  envoi.value = true;
  try {
    const payload = {
      type: form.value.type,
      libelle: form.value.libelle.trim(),
      description: form.value.description.trim() || null,
      montant,
      devise: form.value.devise.trim() || 'GNF',
      date: form.value.date,
      client: form.value.client.trim() || null,
      factureNum: form.value.factureNum.trim() || null,
    };
    if (props.existant) {
      await api.put(`/recettes/${props.existant.id}`, payload);
      $q.notify({ type: 'positive', message: t('recettes.formDialog.updated') });
    } else {
      await api.post('/recettes', { numero: form.value.numero.trim(), ...payload });
      $q.notify({ type: 'positive', message: t('recettes.formDialog.created') });
    }
    emit('update:modelValue', false);
    emit('cree');
  } catch (e: any) {
    const details = e?.response?.data?.message ?? e?.response?.data?.messages;
    $q.notify({
      type: 'negative',
      message: Array.isArray(details) ? details.join('\n') : details ?? t('recettes.formDialog.saveFailed'),
    });
  } finally {
    envoi.value = false;
  }
}
</script>
