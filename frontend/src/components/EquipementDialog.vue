<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ equipement ? 'Modifier l’équipement' : 'Nouvel équipement' }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Identification</span>
        <q-input v-model="form.libelle" outlined dense label="Libellé *" class="q-mb-md"
          hint="Ex. : Vidéoprojecteur salle S204, micro d'amphi, poste info — bibliothèque" />
        <q-input v-model="form.emplacement" outlined dense label="Emplacement"
          hint="Ex. : Bâtiment A — étage 2, salle 204" class="q-mb-md" />
        <q-toggle v-model="form.actif" label="Équipement en service" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import type { EquipementCampus } from '../types';

/**
 * Fiche de l'équipement du campus. La création génère le code QR (UP-IT-…) ;
 * seul le libellé et l'emplacement sont saisis, le code reste machine.
 */
const props = defineProps<{ modelValue: boolean; equipement?: EquipementCampus | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({ libelle: '', emplacement: '', actif: true });

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = {
      libelle: props.equipement?.libelle ?? '',
      emplacement: props.equipement?.emplacement ?? '',
      actif: props.equipement?.actif ?? true,
    };
  },
);

async function enregistrer() {
  if (form.value.libelle.trim().length < 2) return;
  enregistrement.value = true;
  try {
    const payload = {
      libelle: form.value.libelle.trim(),
      emplacement: form.value.emplacement.trim() || undefined,
      actif: form.value.actif,
    };
    if (props.equipement) await api.put(`/equipements/${props.equipement.id}`, payload);
    else await api.post('/equipements', payload);
    $q.notify({ type: 'positive', message: 'Équipement enregistré' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>