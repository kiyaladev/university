<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="l"
    :titre="equipement ? $t('patrimoine.equipmentDialog.title.edit') : $t('patrimoine.equipmentDialog.title.new')"
    :sous-titre="equipement ? $t('patrimoine.equipmentDialog.subtitle.edit') : $t('patrimoine.equipmentDialog.subtitle.new')"
    :envoi="enregistrement"
    :desactive="!form.categorieId"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('common.fields.identification') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.libelle"
          outlined
          dense
          :label="$t('common.fields.labelRequired')"
          :hint="$t('patrimoine.equipmentDialog.fields.labelHint')"
          :rules="[(v: string) => (v ?? '').trim().length >= 2 || $t('common.messages.errors.tooShort')]"
          autofocus
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.numeroSerie"
          outlined
          dense
          :label="$t('patrimoine.equipmentDialog.fields.serial')"
          :hint="$t('patrimoine.equipmentDialog.fields.serialHint')"
          :rules="[(v: string) => !!(v ?? '').trim() || $t('common.messages.errors.required')]"
        />
      </div>
    </div>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.numeroInventaire"
          outlined
          dense
          :label="$t('patrimoine.equipmentDialog.fields.inventoryNumber')"
          :hint="$t('patrimoine.equipmentDialog.fields.inventoryHint')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <autocomplete-async
          v-model="form.categorieId"
          :label="$t('patrimoine.equipmentDialog.fields.category')"
          endpoint="/patrimoine/categories"
          :label-fn="(c) => `${c.libelle} (${c.code})`"
          :clearable="false"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('patrimoine.equipmentDialog.sections.assignment') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <autocomplete-async
          v-model="form.departementId"
          :label="$t('common.fields.department')"
          endpoint="/departements"
          :label-fn="(d) => d.nom"
          :clearable="true"
        />
      </div>
      <div class="col-12 col-sm-6">
        <autocomplete-async
          v-model="form.salleId"
          :label="$t('common.fields.classroom')"
          endpoint="/salles"
          :label-fn="(s) => `${s.code} — ${s.nom}`"
          :clearable="true"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('patrimoine.equipmentDialog.sections.acquisition') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-4">
        <champ-date v-model="form.dateAcquisition" :label="$t('patrimoine.equipmentDialog.fields.acquisitionDate')" />
      </div>
      <div class="col-12 col-sm-4">
        <q-input
          v-model.number="form.valeurAcquisition"
          type="number"
          min="0"
          outlined
          dense
          :label="$t('patrimoine.equipmentDialog.fields.value')"
          :hint="$t('patrimoine.equipmentDialog.fields.valueHint')"
        />
      </div>
      <div class="col-12 col-sm-4">
        <q-input
          v-model.number="form.obsolescenceMois"
          type="number"
          min="1"
          outlined
          dense
          :label="$t('patrimoine.equipmentDialog.fields.obsolescence')"
          :hint="$t('patrimoine.equipmentDialog.fields.obsolescenceHint')"
        />
      </div>
    </div>

    <div class="row items-center q-mt-md">
      <q-toggle v-model="form.actif" :label="$t('patrimoine.equipmentDialog.fields.active')" />
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import ChampDate from './ChampDate.vue';
import DialogueFormulaire from './DialogueFormulaire.vue';
import type { EquipementPatrimoine } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ equipement?: EquipementPatrimoine | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const enregistrement = ref(false);

const form = ref({
  libelle: '',
  numeroSerie: '',
  numeroInventaire: '',
  categorieId: null as string | null,
  departementId: null as string | null,
  salleId: null as string | null,
  dateAcquisition: '',
  valeurAcquisition: null as number | null,
  obsolescenceMois: 60 as number,
  actif: true,
});

watch(ouvert, (o) => {
  if (!o) return;
  const e = props.equipement;
  form.value = {
    libelle: e?.libelle ?? '',
    numeroSerie: e?.numeroSerie ?? '',
    numeroInventaire: e?.numeroInventaire ?? '',
    categorieId: e?.categorieId ?? null,
    departementId: e?.departementId ?? null,
    salleId: e?.salleId ?? null,
    dateAcquisition: e?.dateAcquisition ?? '',
    valeurAcquisition: e?.valeurAcquisition ?? null,
    obsolescenceMois: e?.obsolescenceMois ?? 60,
    actif: e?.actif ?? true,
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      libelle: form.value.libelle.trim(),
      numeroSerie: form.value.numeroSerie.trim(),
      numeroInventaire: form.value.numeroInventaire.trim(),
      categorieId: form.value.categorieId,
      departementId: form.value.departementId ?? undefined,
      salleId: form.value.salleId ?? undefined,
      dateAcquisition: form.value.dateAcquisition || undefined,
      valeurAcquisition: form.value.valeurAcquisition ?? undefined,
      obsolescenceMois: form.value.obsolescenceMois,
      actif: form.value.actif ? 'true' : 'false',
    };
    if (props.equipement) {
      await api.put(`/patrimoine/equipements/${props.equipement.id}`, payload);
      $q.notify({ type: 'positive', message: t('patrimoine.equipmentDialog.messages.updated') });
    } else {
      await api.post('/patrimoine/equipements', payload);
      $q.notify({ type: 'positive', message: t('patrimoine.equipmentDialog.messages.created') });
    }
    ouvert.value = false;
    emit('enregistre');
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
