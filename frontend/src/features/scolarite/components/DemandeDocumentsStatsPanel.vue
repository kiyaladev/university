<template>
  <div class="resume-liste" role="status">
    <span v-for="s in plaques" :key="s.cle"
      >{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span
    >
  </div>
</template>

<script setup lang="ts">
/**
 * Compteurs du registre des demandes de documents : une ligne de résumé,
 * lisible d'un coup d'œil.
 *
 * Le composant ne fait aucune requête : la page charge le tableau de bord et
 * passe les compteurs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
  /** Compteurs du tableau de bord (`/documents-demande/dashboard`). */
  stats: Record<string, number | undefined> | null;
}>();

const { t } = useI18n();

const plaques = computed(() => [
  { cle: 'EN_ATTENTE_PAIEMENT', libelle: t('demandeDocuments.plaques.awaitingPayment'), alerte: false },
  { cle: 'EN_TRAITEMENT', libelle: t('demandeDocuments.plaques.processing'), alerte: false },
  { cle: 'PRET', libelle: t('demandeDocuments.plaques.ready'), alerte: false },
  { cle: 'pretesNonRemises', libelle: t('demandeDocuments.plaques.readyOverdue'), alerte: true },
]);
</script>
