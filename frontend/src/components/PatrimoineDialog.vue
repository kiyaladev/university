<template>
  <q-dialog v-model="dialogOuvert">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">
          {{ equipement ? $t('patrimoine.equipmentDialog.title.edit') : $t('patrimoine.equipmentDialog.title.new') }}
        </div>
        <div class="text-caption text-grey-7">
          {{ equipement ? $t('patrimoine.equipmentDialog.subtitle.edit') : $t('patrimoine.equipmentDialog.subtitle.new') }}
        </div>
      </q-card-section>

      <q-card-section>
        <span class="section-titre">{{ $t('salles.dialog.identificationSection') }}</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.libelle"
              outlined
              dense
              :label="$t('patrimoine.categories.dialog.labelLabel')"
              :hint="$t('patrimoine.equipmentDialog.fields.labelHint')"
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
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          :label="$t('common.actions.register')"
          :loading="enregistrement"
          :disable="form.libelle.trim().length < 2 || !form.numeroSerie.trim() || !form.categorieId"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import ChampDate from './ChampDate.vue';
import type { EquipementPatrimoine } from '../types';

const props = defineProps<{ modelValue: boolean; equipement?: EquipementPatrimoine | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const { t: $t } = useI18n();

const dialogOuvert = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

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

watch(dialogOuvert, (ouvert) => {
  if (!ouvert) return;
  const e = props.equipement;
  if (e) {
    form.value = {
      libelle: e.libelle,
      numeroSerie: e.numeroSerie,
      numeroInventaire: e.numeroInventaire,
      categorieId: e.categorieId,
      departementId: e.departementId ?? null,
      salleId: e.salleId ?? null,
      dateAcquisition: e.dateAcquisition ?? '',
      valeurAcquisition: e.valeurAcquisition ?? null,
      obsolescenceMois: e.obsolescenceMois ?? 60,
      actif: e.actif,
    };
  } else {
    form.value = {
      libelle: '',
      numeroSerie: '',
      numeroInventaire: '',
      categorieId: null,
      departementId: null,
      salleId: null,
      dateAcquisition: '',
      valeurAcquisition: null,
      obsolescenceMois: 60,
      actif: true,
    };
  }
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
      $q.notify({ type: 'positive', message: $t('patrimoine.equipmentDialog.messages.updated') });
    } else {
      await api.post('/patrimoine/equipements', payload);
      $q.notify({ type: 'positive', message: $t('patrimoine.equipmentDialog.messages.created') });
    }
    dialogOuvert.value = false;
    emit('enregistre');
  } finally {
    enregistrement.value = false;
  }
}
</script>
