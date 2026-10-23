<template>
  <barre-filtres
    v-model="filtres"
    :placeholder="$t('demandeDocuments.filters.searchPlaceholder')"
    :recherche="true"
    @reinitialiser="emit('reinitialiser')"
  >
    <template #principaux>
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
    </template>
    <template #avances>
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
      <champ-recherche
        v-model="filtres.etudiantId"
        endpoint="/etudiants"
        :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
        :label="$t('common.fields.student')"
      />
    </template>
  </barre-filtres>
</template>

<script setup lang="ts">
/**
 * Filtres du registre des demandes de documents.
 *
 * Le composant porte l'objet des filtres (modèle bidirectionnel) : la page
 * garde la requête, le composant ne fait que la saisie.
 */
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import { LIBELLE_STATUT_DEMANDE, LIBELLE_TYPE_DEMANDE, optionsDepuis } from '@/shared/utils/libelles';

const filtres = defineModel<Record<string, any>>({ required: true });
const emit = defineEmits<{ reinitialiser: [] }>();

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_DEMANDE);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_DEMANDE);
</script>
