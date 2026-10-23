<template>
  <barre-filtres v-model="filtres" :chips="chips" :recherche="false" @reinitialiser="emit('reinitialiser')">
    <template #avances>
      <q-select
        v-model="filtres.type"
        :options="typesDocument"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('common.fields.type')"
      />
      <champ-recherche
        v-model="filtres.departementId"
        endpoint="/departements"
        :label-fn="(d) => `${d.code ? d.code + ' — ' : ''}${d.nom}`"
        :label="$t('common.fields.department')"
        :placeholder="$t('bibliotheque.filters.departmentPlaceholder')"
      />
      <q-input
        v-model.number="filtres.anneeEdition"
        type="number"
        dense
        outlined
        clearable
        :label="$t('bibliotheque.filters.editionYear')"
      />
      <q-select
        v-model="filtres.public"
        :options="statutsPublics"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('bibliotheque.filters.publication')"
      />
    </template>
  </barre-filtres>
</template>

<script setup lang="ts">
/**
 * Filtres du fonds documentaire.
 *
 * Les filtres restent dans la page : c'est elle qui les inscrit dans l'URL
 * (partage de lien) et qui déclenche le rechargement de la liste. Ce composant
 * ne fait que présenter les champs ; il reçoit l'objet de filtres et le
 * renvoie modifié.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import type { ChipFiltre } from '@/types';

/** Les filtres de la page : elle garde la main pour l'URL et le rechargement. */
const filtres = defineModel<Record<string, any>>('filtres', { required: true });

defineProps<{
  /** Chips des filtres actifs (la page les compose). */
  chips: ChipFiltre[];
}>();

const emit = defineEmits<{
  reinitialiser: [];
}>();

const { t } = useI18n();

const typesDocument = Object.entries(LIBELLE_TYPE_DOCUMENT).map(([value, label]) => ({ value, label }));
const statutsPublics = computed(() => [
  { value: '1', label: t('bibliotheque.filters.published') },
  { value: '0', label: t('bibliotheque.filters.unpublished') },
]);
</script>
