<template>
  <q-dialog v-model="dialogOuvert">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">
          {{ mode === 'declarer' ? 'Déclarer une réparation' : 'Résoudre la réparation' }}
        </div>
        <div class="text-caption text-grey-7">
          {{ equipement
            ? `${equipement.numeroInventaire} — ${equipement.libelle}`
            : 'Équipement' }}
        </div>
      </q-card-section>

      <q-card-section v-if="mode === 'declarer'">
        <q-input
          v-model="form.description"
          outlined
          dense
          type="textarea"
          autogrow
          label="Description *"
          hint="Symptôme, contexte, panne observée"
          autofocus
        />
        <div class="row q-col-gutter-md q-mt-sm">
          <div class="col-12 col-sm-7">
            <q-input
              v-model="form.prestataire"
              outlined
              dense
              label="Prestataire"
              hint="Si connu — interne ou externe"
            />
          </div>
          <div class="col-12 col-sm-5">
            <q-input
              v-model.number="form.cout"
              type="number"
              min="0"
              outlined
              dense
              label="Coût (GNF)"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md q-mt-sm">
          <div class="col-12">
            <champ-date v-model="form.dateResolution" label="Résolution prévue" />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-else>
        <q-banner class="bg-orange-1 text-orange-9 q-mb-md">
          <q-icon name="build" />
          Réparation en cours depuis le
          {{ dateHeureLisible(reparationOuverte?.dateDeclaration) }}
        </q-banner>
        <q-input
          v-model="form.noteResolution"
          outlined
          dense
          type="textarea"
          autogrow
          label="Note de résolution"
          hint="Ce qui a été fait, pièces changées, garantie"
          autofocus
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          :label="mode === 'declarer' ? 'Déclarer' : 'Marquer résolu'"
          :loading="enregistrement"
          :disable="mode === 'declarer' && form.description.trim().length < 5"
          @click="valider"
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
import { dateHeureLisible } from '../utils/libelles';
import type { EquipementPatrimoine, ReparationMateriel } from '../types';

const props = defineProps<{
  modelValue: boolean;
  mode: 'declarer' | 'resoudre';
  equipement?: EquipementPatrimoine | null;
  reparationOuverte?: ReparationMateriel | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();

const dialogOuvert = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const enregistrement = ref(false);
const form = ref({
  description: '',
  prestataire: '',
  cout: 0 as number | null,
  dateResolution: '',
  noteResolution: '',
});

watch(dialogOuvert, (ouvert) => {
  if (!ouvert) return;
  if (props.mode === 'declarer') {
    form.value = {
      description: '',
      prestataire: '',
      cout: 0,
      dateResolution: '',
      noteResolution: '',
    };
  } else {
    form.value = {
      description: '',
      prestataire: '',
      cout: 0,
      dateResolution: '',
      noteResolution: '',
    };
  }
});

async function valider() {
  if (!props.equipement) return;
  enregistrement.value = true;
  try {
    if (props.mode === 'declarer') {
      const payload: Record<string, unknown> = {
        description: form.value.description.trim(),
      };
      if (form.value.prestataire.trim()) payload.prestataire = form.value.prestataire.trim();
      if (form.value.cout != null) payload.cout = form.value.cout;
      if (form.value.dateResolution) payload.dateResolution = form.value.dateResolution;
      await api.post(`/patrimoine/equipements/${props.equipement.id}/reparation`, payload);
      $q.notify({ type: 'positive', message: 'Réparation consignée' });
    } else {
      const payload: Record<string, unknown> = {};
      if (form.value.noteResolution.trim()) {
        payload.noteResolution = form.value.noteResolution.trim();
      }
      await api.post(
        `/patrimoine/equipements/${props.equipement.id}/reparation/resoudre`,
        payload,
      );
      $q.notify({ type: 'positive', message: 'Réparation résolue — équipement remis en service' });
    }
    dialogOuvert.value = false;
    emit('enregistre');
  } finally {
    enregistrement.value = false;
  }
}
</script>
