<script setup lang="ts">
/**
 * Barre de filtres : champ de recherche global + chips des filtres actifs +
 * bouton « Filtres avancés » qui ouvre un panneau dépliable contenant les
 * filtres supplémentaires passés dans le slot `avances`. Bouton réinitialiser.
 *
 * Le composant NE pilote pas lui-même la requête : il expose un `modelValue`
 * de type Record et émet `update:modelValue` à chaque modification. Le parent
 * déclenche lui-même le rechargement de la liste quand le watcher réagit.
 */
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const props = withDefaults(defineProps<{
  modelValue?: Record<string, any>;
  placeholder?: string;
  /** Liste affichée des chips à partir des filtres (libellé + clé) */
  chips?: Array<{ label: string; value: any; icone?: string; defaut?: boolean }>;
  /** Affiche la recherche globale */
  recherche?: boolean;
  /** Slot right for custom actions */
}>(), {
  modelValue: () => ({}),
  placeholder: 'Rechercher (matricule, nom, référence…)',
  chips: () => [],
  recherche: true,
});
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
  'reinitialiser': [];
}>();

const filtres = computed(() => ({ ...(props.modelValue ?? {}) }));

function setFiltre(cle: string, valeur: any) {
  const nv = { ...filtres.value };
  if (valeur === undefined || valeur === null || valeur === '' || (Array.isArray(valeur) && valeur.length === 0)) {
    delete nv[cle];
  } else {
    nv[cle] = valeur;
  }
  emit('update:modelValue', nv);
}

function retirerChip(chip: { value: any; defaut?: boolean }) {
  // Pour un chip « par défaut » c'est juste la valeur du champ `recherche`
  if (chip.defaut) {
    setFiltre('recherche', '');
    return;
  }
  // Pour un chip personnalisé, on ne sait pas à quelle clé il correspond —
  // convention : le composant parent passe des chips avec une `cle` supplémentaire
  // ; on l'utilise si présente, sinon on retombe sur la valeur stringifiée.
}

function reinit() {
  emit('update:modelValue', { recherche: filtres.value.recherche ?? '' });
  emit('reinitialiser');
}

const recherche = computed({
  get: () => filtres.value.recherche ?? '',
  set: (v) => setFiltre('recherche', v),
});

const nombreChipsPersonnalises = computed(() => props.chips.filter((c) => !c.defaut).length);
const developpe = ref(false);
</script>

<template>
  <div class="barre-filtres">
    <div class="barre-filtres__ligne">
      <q-input
        v-if="recherche"
        v-model="recherche"
        :placeholder="placeholder"
        outlined
        dense
        clearable
        class="barre-filtres__recherche"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-btn
        v-if="$slots.avances"
        flat
        dense
        :icon="developpe ? 'tune' : 'tune'"
        :label="developpe ? 'Masquer les filtres' : 'Filtres avancés'"
        no-caps
        class="barre-filtres__avances"
        :class="{ 'barre-filtres__avances--actif': developpe }"
        @click="developpe = !developpe"
      />
      <q-space />
      <slot name="actions" />
      <q-btn
        v-if="nombreChipsPersonnalises > 0"
        flat
        dense
        icon="refresh"
        label="Réinitialiser"
        no-caps
        class="barre-filtres__reset"
        @click="reinit"
      />
    </div>

    <div v-if="$slots.avances && developpe" class="barre-filtres__avances-panneau">
      <slot name="avances" />
    </div>

    <div v-if="chips.length" class="barre-filtres__chips">
      <q-chip
        v-for="chip in chips"
        :key="String(chip.value) + chip.label"
        removable
        :icon="chip.icone"
        :label="chip.label"
        @remove="retirerChip(chip)"
        dense
        class="barre-filtres__chip"
      />
    </div>
  </div>
</template>

<style scoped>
.barre-filtres {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}
.barre-filtres__ligne {
  display: flex;
  align-items: center;
  gap: 8px;
}
.barre-filtres__recherche {
  flex: 1 1 320px;
  max-width: 480px;
}
.barre-filtres__avances--actif {
  background: var(--up-chaux, #f2f3ee);
}
.barre-filtres__avances-panneau {
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.barre-filtres__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
