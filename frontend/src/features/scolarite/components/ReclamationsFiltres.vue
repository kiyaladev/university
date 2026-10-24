<template>
  <barre-filtres
    v-model="filtres"
    :placeholder="$t('reclamations.search.placeholder')"
    :recherche="true"
    @reinitialiser="emit('reinitialiser')"
  >
    <template #avances>
      <q-select
        v-model="filtres.statut"
        :options="OPTIONS_STATUTS"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('common.fields.status')"
      />
      <q-select
        v-model="filtres.type"
        :options="OPTIONS_TYPES"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('common.fields.type')"
      />
      <q-select
        v-model="filtres.priorite"
        :options="OPTIONS_PRIORITES"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('common.fields.priority')"
      />
      <champ-recherche
        v-model="filtres.departementId"
        endpoint="/departements"
        :label-fn="(d) => `${d.code} — ${d.nom}`"
        :label="$t('common.fields.department')"
      />
      <q-select
        v-model="filtres.assigneAId"
        :options="membresStaff.map((u) => ({ value: u.id, label: `${u.prenom} ${u.nom} (${u.role})` }))"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('reclamations.filters.assigneA')"
      />
      <q-select
        v-model="filtres.escalade"
        :options="OPTIONS_ESCALADE"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('reclamations.filters.escalade')"
      />
    </template>
  </barre-filtres>
</template>

<script setup lang="ts">
/**
 * Filtres du registre des réclamations.
 *
 * Le composant porte l'objet des filtres (modèle bidirectionnel) : la page
 * garde la requête, le composant ne fait que la saisie.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import {
  LIBELLE_PRIORITE_RECLAMATION,
  LIBELLE_STATUT_RECLAMATION,
  LIBELLE_TYPE_RECLAMATION,
  optionsDepuis,
} from '@/shared/utils/libelles';
import type { Utilisateur, FiltresPage } from '@/types';

const filtres = defineModel<FiltresPage>({ required: true });
const emit = defineEmits<{ reinitialiser: [] }>();

defineProps<{
  /** Agents affectables à une réclamation. */
  membresStaff: Utilisateur[];
}>();

const { t } = useI18n();

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_RECLAMATION);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_RECLAMATION);
const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);
const OPTIONS_ESCALADE = computed(() => [
  { label: t('reclamations.escaladeOptions.toutes'), value: '' },
  { label: t('reclamations.escaladeOptions.escaladees'), value: 'oui' },
  { label: t('reclamations.escaladeOptions.nonEscaladees'), value: 'non' },
]);
</script>
