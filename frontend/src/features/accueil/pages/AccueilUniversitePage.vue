<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="t('accueilUniversity.title')" :subtitle="t('accueilUniversity.subtitle')" />
    <div class="row q-col-gutter-md">
      <section v-for="groupe in groupes" :key="groupe.id" class="col-12 col-md-8">
        <q-card flat bordered class="full-height">
          <q-card-section
            ><h2 class="text-h6 q-my-none">{{ t('layout.frequentTasks') }}</h2></q-card-section
          >
          <q-list padding>
            <q-item v-for="lien in groupe.liens" :key="lien.to" clickable :to="lien.to">
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
      </section>
    </div>
  </q-page>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useServicesActifsStore } from '@/stores/servicesActifs';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { titreRoute } from '@/shared/utils/titreRoute';
import { tachesAccueil } from '@/navigation/menu';
const { t } = useI18n();
const auth = useAuthStore();
const services = useServicesActifsStore();
/** Tâches fréquentes du rôle : déclarées dans le manifeste de navigation (`tacheAccueilPour`). */
const groupes = computed(() =>
  [
    {
      id: 'presence',
      liens: tachesAccueil(auth.role, services.services).map((e) => ({
        to: e.path,
        icon: 'arrow_forward',
        label: titreRoute(e.titre),
      })),
    },
  ].filter((g) => g.liens.length),
);
</script>
