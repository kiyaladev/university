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
import { useI18n } from 'vue-i18n';
import type { ChipFiltre } from '../types';

const props = withDefaults(defineProps<{
  modelValue?: Record<string, any>;
  placeholder?: string;
  /**
   * Rappel des filtres actifs. Un chip n'est décrochable que si le parent dit
   * de quelle clé il provient (`cle`) — ou s'il s'agit du chip de recherche
   * (`defaut`) : sans cela, la croix serait un bouton qui ne fait rien.
   */
  chips?: ChipFiltre[];
  /** Affiche la recherche globale */
  recherche?: boolean;
  /** Slot right for custom actions */
}>(), {
  modelValue: () => ({}),
  placeholder: undefined,
  chips: () => [],
  recherche: true,
});
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>];
  'reinitialiser': [];
}>();
const { t } = useI18n();
/** Aide par défaut traduite : une valeur par défaut de prop ne suivrait pas la langue. */
const placeholderEffectif = computed(() => props.placeholder ?? t('common.search.defaultPlaceholder'));

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

function retirerChip(chip: ChipFiltre) {
  // Pour un chip « par défaut » c'est juste la valeur du champ `recherche`.
  if (chip.defaut) {
    setFiltre('recherche', '');
    return;
  }
  // Sinon on efface la clé que le parent a nommée. Sans clé, le chip n'est pas
  // décrochable (voir `removable` dans le gabarit) : on ne peut pas deviner
  // quel filtre il représente.
  if (chip.cle) setFiltre(chip.cle, undefined);
}

function reinit() {
  emit('update:modelValue', { recherche: filtres.value.recherche ?? '' });
  emit('reinitialiser');
}

/**
 * Le texte saisi. À ne surtout pas nommer `recherche` : la prop du même nom
 * serait masquée dans le gabarit, et `v-if="recherche"` testerait alors le
 * texte au lieu du drapeau d'affichage — le champ ne s'affichait jamais.
 */
const texteRecherche = computed({
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
        v-if="props.recherche"
        v-model="texteRecherche"
        :placeholder="placeholderEffectif"
        :aria-label="placeholderEffectif"
        outlined
        dense
        clearable
        class="barre-filtres__recherche"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <slot name="principaux" />
      <q-btn
        v-if="$slots.avances"
        flat
        dense
        :icon="developpe ? 'tune' : 'tune'"
        :label="developpe ? t('common.search.hideAdvanced') : t('common.search.advanced')"
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
        :label="$t('common.actions.reset')"
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
        :removable="!!chip.defaut || !!chip.cle"
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
  flex-wrap: wrap;
  gap: 8px;
}
.barre-filtres__ligne > * {
  min-width: 0;
}
.barre-filtres__recherche {
  flex: 1 1 320px;
  max-width: 480px;
}
.barre-filtres__avances--actif {
  background: var(--up-chaux);
}
/* Un panneau dépliable est une plaque de plus : filet tracé, angles vifs. */
.barre-filtres__avances-panneau {
  padding: var(--up-3);
  background: var(--up-craie);
  border: var(--up-filet-fin);
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
