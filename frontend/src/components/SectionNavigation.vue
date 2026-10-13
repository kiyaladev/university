<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useServicesActifsStore } from '../stores/servicesActifs';
const props = defineProps<{ section: 'presence' | 'documents' | 'bilan' | 'procedures' }>();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const services = useServicesActifsStore();
const sections = {
  presence: [['/synthese-presences', 'summary'], ['/statistiques', 'statistics'], ['/rapports', 'reports']],
  documents: [['/demandes-docs', 'requests'], ['/attestations', 'issued'], ['/cartes-etudiantes', 'cards']],
  bilan: [['/rectorat', 'current'], ['/statistiques-mesrs', 'archives']],
  procedures: [['/demandes-docs/mes', 'myRequests'], ['/reclamations/mes', 'myComplaints']],
};
const liens = computed(() => sections[props.section].filter(([to]) => {
  const roles = router.resolve(to).meta.roles;
  return services.autorise(to) && (!roles || !!auth.role && roles.includes(auth.role));
}));
</script>
<template>
  <nav v-if="liens.length > 1" :aria-label="t(`simplification.${section}`)" class="q-mb-md">
    <q-tabs :model-value="route.path" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-route-tab v-for="[to, label] in liens" :key="to" :to="to" exact :label="t(`simplification.${label}`)"
        no-caps />
    </q-tabs>
  </nav>
</template>
