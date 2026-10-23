<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="s"
    :titre="$t(mode === 'declarer' ? 'helpdesk.repairDialog.declareTitle' : 'helpdesk.repairDialog.resolveTitle')"
    :sous-titre="equipement ? `${equipement.numeroInventaire} — ${equipement.libelle}` : $t('helpdesk.repairDialog.equipment')"
    :libelle-valider="$t(mode === 'declarer' ? 'helpdesk.repairDialog.declare' : 'helpdesk.repairDialog.markResolved')"
    :envoi="enregistrement"
    @valider="valider"
  >
    <template v-if="mode === 'declarer'">
      <q-input
        v-model="form.description"
        outlined
        dense
        type="textarea"
        autogrow
        :label="$t('common.fields.descriptionRequired')"
        :hint="$t('helpdesk.repairDialog.descriptionHint')"
        :rules="[(v: string) => (v ?? '').trim().length >= 5 || $t('common.messages.errors.tooShort')]"
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
          <q-input v-model.number="form.cout" type="number" min="0" outlined dense :label="$t('helpdesk.repairDialog.cost')" />
        </div>
      </div>
      <div class="q-mt-sm">
        <champ-date v-model="form.dateResolution" :label="$t('helpdesk.repairDialog.expectedResolution')" />
      </div>
    </template>

    <template v-else>
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
    </template>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { dateHeureLisible } from '@/shared/utils/libelles';
import type { EquipementPatrimoine, ReparationMateriel } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  mode: 'declarer' | 'resoudre';
  equipement?: EquipementPatrimoine | null;
  reparationOuverte?: ReparationMateriel | null;
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const enregistrement = ref(false);
const formVide = () => ({
  description: '',
  prestataire: '',
  cout: 0 as number | null,
  dateResolution: '',
  noteResolution: '',
});
const form = ref(formVide());

watch(ouvert, (o) => {
  if (o) form.value = formVide();
});

async function valider() {
  if (!props.equipement) return;
  const base = `/patrimoine/equipements/${props.equipement.id}/reparation`;
  enregistrement.value = true;
  try {
    if (props.mode === 'declarer') {
      const payload: Record<string, unknown> = { description: form.value.description.trim() };
      if (form.value.prestataire.trim()) payload.prestataire = form.value.prestataire.trim();
      if (form.value.cout != null) payload.cout = form.value.cout;
      if (form.value.dateResolution) payload.dateResolution = form.value.dateResolution;
      await api.post(base, payload);
      $q.notify({ type: 'positive', message: t('helpdesk.repairDialog.saved') });
    } else {
      const note = form.value.noteResolution.trim();
      await api.post(`${base}/resoudre`, note ? { noteResolution: note } : {});
      $q.notify({ type: 'positive', message: t('helpdesk.repairDialog.resolved') });
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
