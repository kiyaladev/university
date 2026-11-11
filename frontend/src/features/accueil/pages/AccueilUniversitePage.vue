<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="t('accueilUniversity.title')" />
    <q-card v-if="liens.length" flat bordered class="accueil__taches">
      <q-card-section
        ><h2 class="text-h6 q-my-none">{{ t('layout.frequentTasks') }}</h2></q-card-section
      >
      <q-list padding>
        <q-item v-for="lien in liens" :key="lien.to" clickable :to="lien.to">
          <q-item-section avatar><q-icon :name="lien.icon" color="primary" /></q-item-section>
          <q-item-section
            ><q-item-label>{{ lien.label }}</q-item-label
            ><q-item-label v-if="services.pilote(lien.to)" caption>{{
              t('servicesActifs.pilot')
            }}</q-item-label></q-item-section
          >
          <q-item-section side><q-icon name="chevron_right" /></q-item-section>
        </q-item>
      </q-list>
    </q-card>
    <etat-vide v-else icone="inbox" :titre="t('accueilUniversity.emptyState.title')" :aide="t('accueilUniversity.emptyState.hint')" />
  </q-page>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useServicesActifsStore } from '@/stores/servicesActifs';
import EtatVide from '@/shared/components/EtatVide.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { titreRoute } from '@/shared/utils/titreRoute';
import { tachesAccueil } from '@/navigation/menu';
const { t } = useI18n();
const auth = useAuthStore();
const services = useServicesActifsStore();
/** Tâches fréquentes du rôle : déclarées dans le manifeste de navigation (`tacheAccueilPour`). */
const liens = computed(() =>
  tachesAccueil(auth.role, services.services).map((e) => ({
    to: e.path,
    icon: 'arrow_forward',
    label: titreRoute(e.titre),
  })),
);
</script>
<style scoped>
.accueil__taches {
  max-width: 720px;
}
</style>
