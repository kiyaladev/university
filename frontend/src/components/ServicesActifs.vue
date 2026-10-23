<template>
  <q-card flat bordered class="q-mb-lg">
    <q-card-section>
      <h2 class="text-h6 q-mt-none">{{ t('servicesActifs.title') }}</h2>
      <p>{{ t('servicesActifs.subtitle') }}</p>
      <q-banner v-if="store.erreur" class="note--erreur" role="alert">
        {{ t('servicesActifs.loadError') }}
        <template #action><q-btn flat :label="t('common.actions.retry')" @click="charger" /></template>
      </q-banner>
      <q-linear-progress v-if="chargement" indeterminate />
      <div v-if="services.length" class="row q-gutter-sm q-mb-md">
        <q-btn outline no-caps :label="t('servicesActifs.hidePilots')" @click="services.forEach(s => { if (s.pilote && !s.obligatoire) s.actif = false; })" />
        <q-btn color="primary" unelevated no-caps :label="t('servicesActifs.save')" :disable="!modifie" :loading="enregistrement" @click="enregistrer" />
      </div>
    </q-card-section>
    <q-list separator>
      <q-item v-for="service in services" :key="service.id">
        <q-item-section>
          <q-item-label>{{ t(`servicesActifs.names.${service.id}`) }}</q-item-label>
          <q-item-label caption>{{ t(service.obligatoire ? 'servicesActifs.required' : service.pilote ? 'servicesActifs.pilot' : 'servicesActifs.verified') }}</q-item-label>
        </q-item-section>
        <q-item-section side><q-toggle v-model="service.actif" :disable="service.obligatoire || enregistrement" :aria-label="t(`servicesActifs.names.${service.id}`)" /></q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useServicesActifsStore, type ServiceActif } from '../stores/servicesActifs';
const { t } = useI18n();
const $q = useQuasar();
const store = useServicesActifsStore();
const services = ref<ServiceActif[]>([]);
const chargement = ref(false);
const enregistrement = ref(false);
const modifie = computed(() => services.value.some(s => s.actif !== store.services.find(a => a.id === s.id)?.actif));
async function charger() {
  chargement.value = true;
  await store.charger(true);
  services.value = store.services.map(s => ({ ...s }));
  chargement.value = false;
}
async function enregistrer() {
  enregistrement.value = true;
  try {
    await store.enregistrer(services.value.map(({ id, actif }) => ({ id, actif })));
    services.value = store.services.map(s => ({ ...s }));
    $q.notify({ type: 'positive', message: t('servicesActifs.saved') });
  } catch {
    // L'intercepteur affiche le motif ; conserver les choix pour réessayer.
  } finally { enregistrement.value = false; }
}
onMounted(charger);
</script>
