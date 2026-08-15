<template>
  <q-input
    :model-value="affichage"
    :label="label"
    outlined
    :dense="dense"
    readonly
    class="champ-date"
    @click="ouvert = true"
  >
    <template #prepend><q-icon name="event" /></template>
    <q-popup-proxy v-model="ouvert" cover transition-show="scale" transition-hide="scale">
      <q-date
        :model-value="modelValue"
        mask="YYYY-MM-DD"
        minimal
        today-btn
        @update:model-value="choisir"
      />
    </q-popup-proxy>
  </q-input>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

/**
 * Champ de date en français. Le `type="date"` natif suit la langue du système
 * et affiche 07/14/2026 sur un appareil anglophone : dans un produit qui ne
 * parle que français, la date se saisit ici au calendrier, en JJ/MM/AAAA.
 */
const props = withDefaults(
  defineProps<{ modelValue: string; label?: string; dense?: boolean }>(),
  { label: '', dense: true },
);
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const ouvert = ref(false);

const affichage = computed(() => {
  if (!props.modelValue) return '';
  const [a, m, j] = props.modelValue.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
});

function choisir(valeur: string | null) {
  if (valeur) emit('update:modelValue', valeur);
  ouvert.value = false;
}
</script>

<style scoped lang="scss">
// Cible tactile : le contrôleur et la scolarité travaillent au doigt.
.champ-date :deep(.q-field__control) { min-height: 48px; cursor: pointer; }
.champ-date :deep(.q-field__native) { cursor: pointer; }

// Le champ est en lecture seule pour forcer le calendrier, mais il s'actionne :
// il garde donc le filet plein du panneau, pas le pointillé des champs inertes.
.champ-date :deep(.q-field__control::before) { border-style: solid !important; }
</style>
