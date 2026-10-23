<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 480px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('seances.detail.assignControllerTitle') }}</div>
        <div class="text-caption text-grey-7">{{ $t('seances.detail.assignControllerHelp') }}</div>
      </q-card-section>
      <q-card-section>
        <q-select
          v-model="controleurChoisi"
          :options="optionsControleurs"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('seances.detail.assignedController')"
          :loading="chargementControleurs"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          :label="$t('common.actions.cancel')"
          :disable="sauvegarde"
          @click="emit('update:modelValue', false)"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          :label="$t('common.actions.save')"
          :loading="sauvegarde"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { seancesService } from '../services/seances';
import type { Seance } from '@/types';

/**
 * Affectation d'un contrôleur à une séance.
 *
 * Le dialogue porte sa propre logique : il charge la liste des contrôleurs,
 * affecte, et prévient la page pour qu'elle recharge le registre.
 */
const props = defineProps<{ modelValue: boolean; seance: Seance | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const controleurChoisi = ref<string | null>(null);
const optionsControleurs = ref<{ label: string; value: string }[]>([]);
const chargementControleurs = ref(false);
const sauvegarde = ref(false);

watch(
  () => [props.modelValue, props.seance?.id],
  async ([ouvert]) => {
    if (!ouvert || !props.seance) return;
    controleurChoisi.value = props.seance.controleurAssigneId ?? null;
    chargementControleurs.value = true;
    try {
      const controleurs = await seancesService.controleurs();
      optionsControleurs.value = controleurs.map((u) => ({
        value: u.id,
        label: `${u.prenom} ${u.nom}`,
      }));
    } catch {
      /* notifié par l'intercepteur */
    } finally {
      chargementControleurs.value = false;
    }
  },
  { immediate: true },
);

async function enregistrer() {
  if (!props.seance) return;
  sauvegarde.value = true;
  try {
    await seancesService.affecterControleur(props.seance.id, controleurChoisi.value);
    emit('update:modelValue', false);
    emit('enregistre');
    $q.notify({ type: 'positive', message: t('seances.detail.controllerAssigned') });
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    sauvegarde.value = false;
  }
}
</script>
