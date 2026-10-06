<template><liens-croises :liens="liens" /></template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LiensCroises from './LiensCroises.vue';
import { titreRoute } from '../utils/titreRoute';
const props = defineProps<{ parcours: 'dossiers' | 'resultats' | 'documents' | 'finances' }>();
const router = useRouter();
const { locale } = useI18n();
const ETAPES = {
  dossiers: [['/etudiants', 'groups'], ['/inscriptions', 'how_to_reg'], ['/paiements', 'payments']],
  resultats: [['/evaluations', 'fact_check'], ['/notes', 'grading'], ['/deliberations', 'gavel'], ['/bulletins', 'school']],
  documents: [['/demandes-docs', 'description'], ['/attestations', 'verified'], ['/cartes-etudiantes', 'badge'], ['/badges', 'how_to_reg'], ['/demandes-docs/tarifs', 'price_change']],
  finances: [['/paiements', 'payments'], ['/recettes', 'request_quote'], ['/paie', 'account_balance_wallet']],
};
const liens = computed(() => {
  void locale.value;
  return ETAPES[props.parcours].map(([to, icone]) => ({ to, icone, libelle: titreRoute(router.resolve(to).meta.titre) }));
});
</script>
