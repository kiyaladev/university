<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="t('accueilScolarite.title')" :subtitle="t('accueilScolarite.subtitle')" />
    <q-banner v-if="erreur" class="bg-red-1 text-negative q-mb-md" role="alert">{{ erreur }}</q-banner>
    <div class="row q-col-gutter-md q-mb-lg">
      <div v-for="queue in files" :key="queue.to" class="col-12 col-md-4">
        <q-card flat bordered
          ><q-card-section>
            <q-icon :name="queue.icon" size="28px" color="primary" />
            <h2 class="text-subtitle1">{{ queue.title }}</h2>
            <div class="text-h4 q-mb-md">{{ chargement ? '…' : (queue.count ?? '—') }}</div>
            <q-btn
              :to="queue.to"
              color="primary"
              outline
              no-caps
              :label="t('accueilScolarite.open')"
            /> </q-card-section
        ></q-card>
      </div>
    </div>
    <h2 class="text-h6">{{ t('accueilScolarite.readyRegistrations') }}</h2>
    <q-list bordered separator role="presentation">
      <q-item v-for="dossier in dossiers" :key="dossier.id" clickable to="/inscriptions">
        <q-item-section
          ><q-item-label>{{ dossier.etudiant?.prenom }} {{ dossier.etudiant?.nom }}</q-item-label>
          <q-item-label caption>{{ dossier.numero }} · {{ dossier.promotion?.nom }}</q-item-label> </q-item-section
        ><q-item-section side><q-icon name="chevron_right" /></q-item-section>
      </q-item>
      <q-item v-if="!dossiers.length && !chargement"
        ><q-item-section>{{ t('accueilScolarite.empty') }}</q-item-section></q-item
      >
    </q-list>
    <div class="row q-gutter-sm q-mt-md">
      <q-btn to="/etudiants" flat icon="groups" :label="t('nav.etudiants')" />
      <q-btn to="/notes" flat icon="grading" :label="t('nav.notes')" />
      <q-btn to="/deliberations" flat icon="how_to_vote" :label="t('nav.deliberations')" />
      <q-btn flat icon="refresh" :label="t('common.actions.refresh')" :loading="chargement" @click="charger" />
    </div>
  </q-page>
</template>
<script setup lang="ts">
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
const { t } = useI18n();
const chargement = ref(false);
const erreur = ref('');
const dossiers = ref<any[]>([]);
const inscriptions = ref<number | null>(null);
const documents = ref<any>(null);
const files = computed(() => [
  {
    title: t('accueilScolarite.readyRegistrations'),
    count: inscriptions.value,
    icon: 'how_to_reg',
    to: '/inscriptions',
  },
  {
    title: t('accueilScolarite.documentsToProcess'),
    count: documents.value ? documents.value.PAYEE + documents.value.EN_TRAITEMENT : null,
    icon: 'description',
    to: '/demandes-docs',
  },
  {
    title: t('accueilScolarite.documentsToDeliver'),
    count: documents.value?.PRETE,
    icon: 'task_alt',
    to: '/demandes-docs',
  },
]);
async function charger() {
  chargement.value = true;
  erreur.value = '';
  const resultats = await Promise.allSettled([
    api.get('/inscriptions', { params: { statut: 'PAYEE', pageSize: 8 } }),
    api.get('/documents-demande/dashboard'),
  ]);
  if (resultats[0].status === 'fulfilled') {
    dossiers.value = resultats[0].value.data.data;
    inscriptions.value = resultats[0].value.data.total;
  }
  if (resultats[1].status === 'fulfilled') documents.value = resultats[1].value.data;
  if (resultats.some((resultat) => resultat.status === 'rejected')) erreur.value = t('accueilScolarite.error');
  chargement.value = false;
}
onMounted(() => {
  void charger();
});
</script>
