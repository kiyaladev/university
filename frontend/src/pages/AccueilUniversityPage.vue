<template>
  <q-page class="q-pa-md">
    <page-header :title="t('accueilUniversity.title')" :subtitle="t('accueilUniversity.subtitle')" />
    <div class="row q-col-gutter-md">
      <section v-for="groupe in groupes" :key="groupe.id" class="col-12 col-md-6 col-lg-4">
        <q-card flat bordered class="full-height">
          <q-card-section><h2 class="text-h6 q-my-none">{{ t(`layout.primary.${groupe.id}`) }}</h2></q-card-section>
          <q-list padding>
            <q-item v-for="lien in groupe.liens" :key="lien.to" clickable :to="lien.to">
              <q-item-section avatar><q-icon :name="lien.icon" color="primary" /></q-item-section>
              <q-item-section><q-item-label>{{ lien.label }}</q-item-label><q-item-label v-if="services.pilote(lien.to)" caption>{{ t('servicesActifs.pilot') }}</q-item-label></q-item-section>
              <q-item-section side><q-icon name="chevron_right" /></q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </section>
    </div>
  </q-page>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useServicesActifsStore } from '../stores/servicesActifs';
import PageHeader from '../components/PageHeader.vue';
import { titreRoute } from '../utils/titreRoute';
const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const services = useServicesActifsStore();
const groupes = computed(() => [
  { id: 'presence', liens: [['/synthese-presences', 'dashboard'], ['/controle', 'fact_check'], ['/seances', 'event_note'], ['/rapports', 'insights']] },
  { id: 'registrar', liens: [['/inscriptions', 'how_to_reg'], ['/notes', 'grading'], ['/deliberations', 'gavel'], ['/demandes-docs', 'description'], ['/attestations', 'verified']] },
  { id: 'finance', liens: [['/paiements', 'payments'], ['/recettes', 'request_quote'], ['/paie', 'account_balance_wallet']] },
  { id: 'campus', liens: [['/reservations', 'event_seat'], ['/bibliotheque-gestion', 'local_library'], ['/resto', 'restaurant'], ['/helpdesk', 'support_agent']] },
  { id: 'administration', liens: [['/audit', 'history'], ['/rectorat', 'account_balance'], ['/utilisateurs', 'manage_accounts'], ['/parametres', 'settings']] },
].map(groupe => ({ ...groupe, liens: groupe.liens.flatMap(([to, icon]) => {
  const meta = router.resolve(to).meta;
  return services.autorise(to) && (!meta.roles || !!auth.role && meta.roles.includes(auth.role)) ? [{ to, icon, label: titreRoute(meta.titre) }] : [];
}) })).filter(g => g.liens.length));
</script>
