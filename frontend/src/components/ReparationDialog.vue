<template>
  <q-dialog v-model="dialogOuvert">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">
          {{ $t(mode === 'declarer' ? 'helpdesk.repairDialog.declareTitle' : 'helpdesk.repairDialog.resolveTitle') }}
        </div>
        <div class="text-caption text-grey-7">
          {{ equipement
            ? `${equipement.numeroInventaire} — ${equipement.libelle}`
            : $t('helpdesk.repairDialog.equipment') }}
        </div>
      </q-card-section>

      <q-card-section v-if="mode === 'declarer'">
        <q-input
          v-model="form.description"
          outlined
          dense
          type="textarea"
          autogrow
          :label="$t('helpdesk.repairDialog.description')"
          :hint="$t('helpdesk.repairDialog.descriptionHint')"
          autofocus
        />
        <div class="row q-col-gutter-md q-mt-sm">
          <div class="col-12 col-sm-7">
            <q-input
              v-model="form.prestataire"
              outlined
              dense
              :label="$t('helpdesk.repairDialog.provider')"
              :hint="$t('helpdesk.repairDialog.providerHint')"
            />
          </div>
          <div class="col-12 col-sm-5">
            <q-input
              v-model.number="form.cout"
              type="number"
              min="0"
              outlined
              dense
              :label="$t('helpdesk.repairDialog.cost')"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md q-mt-sm">
          <div class="col-12">
            <champ-date v-model="form.dateResolution" :label="$t('helpdesk.repairDialog.expectedResolution')" />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-else>
        <q-banner class="bg-orange-1 text-orange-9 q-mb-md">
          <q-icon name="build" />
          {{ $t('helpdesk.repairDialog.openedSince') }}
          {{ dateHeureLisible(reparationOuverte?.dateDeclaration) }}
        </q-banner>
        <q-input
          v-model="form.noteResolution"
          outlined
          dense
          type="textarea"
          autogrow
          :label="$t('helpdesk.repairDialog.resolutionNote')"
          :hint="$t('helpdesk.repairDialog.resolutionHint')"
          autofocus
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          :label="$t(mode === 'declarer' ? 'helpdesk.repairDialog.declare' : 'helpdesk.repairDialog.markResolved')"
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
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();

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
      $q.notify({ type: 'positive', message: t('helpdesk.repairDialog.saved') });
    } else {
      const payload: Record<string, unknown> = {};
      if (form.value.noteResolution.trim()) {
        payload.noteResolution = form.value.noteResolution.trim();
      }
      await api.post(
        `/patrimoine/equipements/${props.equipement.id}/reparation/resoudre`,
        payload,
      );
      $q.notify({ type: 'positive', message: t('helpdesk.repairDialog.resolved') });
    }
    dialogOuvert.value = false;
    emit('enregistre');
  } finally {
    enregistrement.value = false;
  }
}
</script>
