<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="s"
    :titre="equipement ? $t('helpdesk.equipmentDialog.titleEdit') : $t('helpdesk.equipmentDialog.titleNew')"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('common.fields.identification') }}</span>
    <q-input v-model="form.libelle" outlined dense :label="$t('common.fields.labelRequired')" class="q-mb-md"
      :hint="$t('helpdesk.equipmentDialog.exampleLabel')"
      :rules="[(v: string) => (v ?? '').trim().length >= 2 || $t('common.messages.errors.tooShort')]" />
    <q-input v-model="form.emplacement" outlined dense :label="$t('helpdesk.table.columns.location')"
      :hint="$t('helpdesk.equipmentDialog.exampleLocation')" class="q-mb-md" />
    <q-toggle v-model="form.actif" :label="$t('helpdesk.equipmentDialog.inService')" />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import DialogueFormulaire from './DialogueFormulaire.vue';
import type { EquipementCampus } from '../types';

/**
 * Fiche de l'équipement du campus. La création génère le code QR (UP-IT-…) ;
 * seul le libellé et l'emplacement sont saisis, le code reste machine.
 */
const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ equipement?: EquipementCampus | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);

const form = ref({ libelle: '', emplacement: '', actif: true });

watch(ouvert, (o) => {
  if (!o) return;
  form.value = {
    libelle: props.equipement?.libelle ?? '',
    emplacement: props.equipement?.emplacement ?? '',
    actif: props.equipement?.actif ?? true,
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      libelle: form.value.libelle.trim(),
      emplacement: form.value.emplacement.trim() || undefined,
      actif: form.value.actif,
    };
    if (props.equipement) await api.put(`/equipements/${props.equipement.id}`, payload);
    else await api.post('/equipements', payload);
    $q.notify({ type: 'positive', message: t('helpdesk.equipmentDialog.saved') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
