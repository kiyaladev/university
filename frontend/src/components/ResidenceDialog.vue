<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="residence ? $t('cites.residences.dialogs.form.titleEdit') : $t('cites.residences.dialogs.form.titleNew')"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('common.fields.identity') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-4">
        <q-input v-model="form.code" outlined dense :label="$t('common.fields.codeRequired')" :rules="[requis]" />
      </div>
      <div class="col-12 col-sm-8">
        <q-input v-model="form.nom" outlined dense :label="$t('inscriptionPublique.form.step1.nom.label')" :rules="[requis]" />
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
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import DialogueFormulaire from './DialogueFormulaire.vue';
import type { Residence } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ residence?: Residence | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const requis = (v: string) => !!(v ?? '').trim() || t('common.messages.errors.required');

const form = ref({
  code: '',
  nom: '',
  ville: '',
  adresse: '',
  capacite: 0,
  responsable: '',
  actif: true,
});

watch(ouvert, (o) => {
  if (!o) return;
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
});

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
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
