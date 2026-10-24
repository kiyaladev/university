<template>
  <!-- Guidage : sans promotion, la liste n'a pas de sens -->
  <etat-vide
    v-if="sansPromotion"
    class="plaque"
    icone="school"
    :titre="$t('bulletins.guidance.choisirPromotion')"
    :aide="$t('bulletins.guidance.text')"
  >
    <template #action>
      <q-btn
        unelevated
        color="primary"
        no-caps
        icon="gavel"
        :label="$t('bulletins.guidance.voirDeliberations')"
        @click="emit('voir-deliberations')"
      />
    </template>
  </etat-vide>

  <template v-else>
    <q-banner v-if="!chargement && !aucuneDeliberation" dense class="carte q-mb-md">
      <template #avatar><q-icon name="info" color="primary" /></template>
      {{ $t('bulletins.banners.infoImprimables', { nbImprimables, total }) }}
    </q-banner>

    <q-banner v-if="!chargement && aucuneDeliberation" dense class="carte q-mb-md">
      <template #avatar><q-icon name="warning" color="warning" /></template>
      {{ $t('bulletins.banners.aucuneDeliberation') }}
      <template #action>
        <q-btn
          flat
          dense
          no-caps
          :label="$t('bulletins.banners.creerDeliberation')"
          @click="emit('voir-deliberations')"
        />
      </template>
    </q-banner>
  </template>
</template>

<script setup lang="ts">
import EtatVide from '@/shared/components/EtatVide.vue';

defineProps<{
  /** Vrai quand aucune promotion n'est filtrée : on guide au lieu d'afficher. */
  sansPromotion: boolean;
  /** Vrai quand aucune délibération ne correspond aux filtres. */
  aucuneDeliberation: boolean;
  /** Nombre de lignes imprimables de la promotion. */
  nbImprimables: number;
  /** Nombre de lignes du listing filtré. */
  total: number;
  chargement: boolean;
}>();

const emit = defineEmits<{
  'voir-deliberations': [];
}>();
</script>
