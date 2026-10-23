<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 540px; max-width: 95vw">
      <q-card-section class="text-h6">{{ $t('cites.attributions.dialogs.decision.title') }}</q-card-section>
      <q-card-section v-if="attribution" class="q-pt-none text-caption text-grey-7">
        {{ attribution.etudiant?.nom }} {{ attribution.etudiant?.prenom }}
        <span v-if="attribution.etudiant?.matricule">
          {{ $t('common.format.emptyValue') }} {{ attribution.etudiant.matricule }}</span
        >
        <br />
        <i18n-t keypath="cites.attributions.dialogs.decision.chambreLabel" tag="span">
          <template #code
            ><strong>{{ attribution.chambre?.code }}</strong></template
          >
          <template #residence>{{ attribution.chambre?.residence?.nom }}</template>
        </i18n-t>
        <template v-if="attribution.critereScore !== null && attribution.critereScore !== undefined">
          · {{ $t('cites.attributions.dialogs.decision.scoreLabel', { score: attribution.critereScore }) }}
        </template>
      </q-card-section>
      <q-card-section>
        <q-option-group
          v-model="statut"
          :options="[
            { label: $t('cites.attributions.dialogs.decision.optionAccorder'), value: 'ACCORDE', color: 'positive' },
            { label: $t('cites.attributions.dialogs.decision.optionRefuser'), value: 'REFUSE', color: 'negative' },
          ]"
          inline
          class="q-mb-md"
        />
        <q-banner dense class="note--info q-mb-md">
          <template #avatar><q-icon name="info" /></template>
          <span v-if="statut === 'ACCORDE'">
            <i18n-t keypath="cites.attributions.dialogs.decision.infoAccorder" tag="span">
              <template #statut
                ><strong>{{ $t('cites.attributions.dialogs.decision.statutOccupee') }}</strong></template
              >
            </i18n-t>
          </span>
          <span v-else>
            <i18n-t keypath="cites.attributions.dialogs.decision.infoRefuser" tag="span">
              <template #statut
                ><strong>{{ $t('cites.attributions.dialogs.decision.statutLibre') }}</strong></template
              >
            </i18n-t>
          </span>
        </q-banner>
        <q-input
          v-model="motif"
          outlined
          dense
          type="textarea"
          :label="$t('cites.attributions.dialogs.decision.motifLabel')"
          :autogrow="true"
          rows="2"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          unelevated
          :color="statut === 'ACCORDE' ? 'positive' : 'negative'"
          :icon="statut === 'ACCORDE' ? 'check' : 'close'"
          :label="
            statut === 'ACCORDE'
              ? $t('cites.attributions.dialogs.decision.accorder')
              : $t('cites.attributions.dialogs.decision.refuser')
          "
          :loading="enCours"
          @click="emit('confirme', statut, motif || undefined)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Décision du jury sur une demande de logement : la page envoie la décision,
 * ce dialogue ne fait que la recueillir.
 */
import { ref, watch } from 'vue';
import type { AttributionLogement } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  attribution: AttributionLogement | null;
  /** Vrai pendant l'enregistrement : le bouton se met en attente. */
  enCours?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [ouvert: boolean];
  confirme: [statut: 'ACCORDE' | 'REFUSE', commentaire?: string];
}>();

const statut = ref<'ACCORDE' | 'REFUSE'>('ACCORDE');
const motif = ref('');

// Chaque ouverture repart d'une décision « accorder », sans motif.
watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    statut.value = 'ACCORDE';
    motif.value = '';
  },
);
</script>
