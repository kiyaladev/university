<template>
  <q-select
    :model-value="selection"
    use-input
    hide-selected
    fill-input
    input-debounce="350"
    clearable
    outlined
    dense
    :options="suggestions"
    option-value="id"
    option-label="titre"
    emit-value
    map-options
    :placeholder="$t('bibliotheque.search.placeholder')"
    :loading="chargement"
    @filter="surFiltre"
    @update:model-value="emit('update:selection', $event)"
    @filter-abort="() => {}"
  >
    <template #prepend><q-icon name="search" /></template>
    <template #no-option>
      <q-item>
        <q-item-section class="text-grey">
          {{ texte ? $t('bibliotheque.search.noResults') : $t('bibliotheque.search.typeToSearch') }}
        </q-item-section>
      </q-item>
    </template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section>
          <q-item-label>{{ scope.opt.titre }}</q-item-label>
          <q-item-label caption>
            <span>{{ LIBELLE_TYPE_DOCUMENT[scope.opt.type] ?? scope.opt.type }}</span>
            <span v-if="scope.opt.auteurs"> · {{ scope.opt.auteurs }}</span>
            <span v-if="scope.opt.departement?.nom"> · {{ scope.opt.departement.nom }}</span>
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup lang="ts">
/**
 * Recherche globale de la bibliothèque : un champ qui propose les documents
 * trouvés en plein texte. La page garde l'état (terme saisi, suggestions) et
 * recharge la liste ; ce composant ne fait que présenter et rendre les choix.
 */
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import type { DocumentDepot } from '@/types';

defineProps<{
  /** Identifiant du document choisi dans les suggestions. */
  selection: string | null;
  /** Suggestions proposées par le serveur. */
  suggestions: DocumentDepot[];
  /** Chargement des suggestions en cours. */
  chargement: boolean;
  /** Texte de recherche courant : sert au message « aucun résultat ». */
  texte: string;
}>();

const emit = defineEmits<{
  'update:selection': [id: string | null];
  filtre: [terme: string, miseAJour: (cb: () => void) => void];
}>();

/** La page fait la recherche : le composant lui transmet le terme et le rappel. */
function surFiltre(terme: string, miseAJour: (cb: () => void) => void) {
  emit('filtre', terme, miseAJour);
}
</script>
