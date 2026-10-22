<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="chambre ? $t('cites.chambres.dialogs.form.titleEdit', { code: chambre.code }) : $t('cites.chambres.dialogs.form.titleNew')"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('salles.dialog.identificationSection') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-5">
        <q-input v-model="form.code" outlined dense :label="$t('matieres.dialog.codeLabel')" placeholder="R1-101" :rules="[requis]" />
      </div>
      <div class="col-12 col-sm-7">
        <q-select
          v-model="form.residenceId"
          :options="optionsResidences"
          outlined
          dense
          emit-value
          map-options
          :label="$t('cites.chambres.dialogs.form.residenceLabel')"
          :rules="[requis]"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.categorie"
          :options="optionsCategories"
          outlined
          dense
          emit-value
          map-options
          :label="$t('cites.chambres.dialogs.form.categoryLabel')"
        />
      </div>
      <div class="col-12 col-sm-3">
        <q-input v-model.number="form.lits" type="number" min="1" outlined dense :label="$t('cites.chambres.table.columns.lits')" />
      </div>
      <div class="col-12 col-sm-3">
        <q-select
          v-model="form.statut"
          :options="optionsStatuts"
          outlined
          dense
          emit-value
          map-options
          :label="$t('cites.chambres.dialogs.form.statusLabel')"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('cites.chambres.table.columns.loyer') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model.number="form.loyer"
          type="number"
          min="0"
          step="0.01"
          outlined
          dense
          :label="$t('cites.chambres.dialogs.form.monthlyRent')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.devise"
          outlined
          dense
          :label="$t('cites.chambres.dialogs.form.currency')"
          :hint="$t('cites.chambres.dialogs.form.currencyHint')"
        />
      </div>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { LIBELLE_CATEGORIE_CHAMBRE, LIBELLE_STATUT_CHAMBRE } from '../utils/libelles';
import type { Chambre, Residence } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  chambre?: Chambre | null;
  residences: Residence[];
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const requis = (v: string | null) => !!(v ?? '').trim() || t('common.messages.errors.required');

const form = ref({
  code: '',
  residenceId: null as string | null,
  categorie: 'CHAMBRE_PARTAGEE',
  lits: 2,
  loyer: 0,
  devise: 'GNF',
  statut: 'LIBRE',
});

const optionsResidences = computed(() =>
  props.residences.map((r) => ({ label: `${r.code} — ${r.nom}`, value: r.id })),
);
// `emit-value` : sans lui, le select rendait l'objet { value, label } et c'est
// lui qui partait au serveur à la place du code.
const optionsCategories = Object.entries(LIBELLE_CATEGORIE_CHAMBRE).map(([value, label]) => ({ value, label }));
const optionsStatuts = Object.entries(LIBELLE_STATUT_CHAMBRE).map(([value, label]) => ({ value, label }));

watch(ouvert, (o) => {
  if (!o) return;
  const c = props.chambre;
  form.value = {
    code: c?.code ?? '',
    residenceId: c?.residenceId ?? null,
    categorie: c?.categorie ?? 'CHAMBRE_PARTAGEE',
    lits: c?.lits ?? 1,
    loyer: c?.loyer ?? 0,
    devise: c?.devise ?? 'GNF',
    statut: c?.statut ?? 'LIBRE',
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = { ...form.value };
    if (props.chambre) await api.put(`/chambres/${props.chambre.id}`, payload);
    else await api.post('/chambres', payload);
    $q.notify({ type: 'positive', message: t('cites.chambres.dialogs.form.saved') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
