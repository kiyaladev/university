<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', false)">
    <q-card style="width: 650px; max-width: 95vw">
      <q-card-section><h2 class="text-h6 q-my-none">{{ t('filePointages.title') }}</h2></q-card-section>
      <q-card-section class="q-pt-none">
        <p>{{ t('filePointages.help') }}</p>
        <q-list separator>
          <q-item v-for="pointage in pointages.file" :key="pointage.seanceId" class="q-px-none">
            <q-item-section>
              <q-item-label>{{ LIBELLE_STATUT_PRESENCE[pointage.statut || 'NON_CONTROLE'] }} · {{ dateHeureLisible(pointage.horodatage) }}</q-item-label>
              <q-item-label caption>{{ t('filePointages.session') }} : {{ pointage.seanceId }}</q-item-label>
              <p v-if="pointages.erreurs[pointage.seanceId]" class="text-negative q-mt-sm" role="status">{{ pointages.erreurs[pointage.seanceId] }}</p>
              <q-btn flat dense color="negative" :label="t('filePointages.remove')" class="self-start" @click="retirer(pointage.seanceId)" />
            </q-item-section>
          </q-item>
        </q-list>
        <h3 v-if="seancesHorsLigne.enAttente" class="text-subtitle1 q-mt-lg q-mb-sm">{{ t('seances.offline.pendingTitle') }}</h3>
        <p v-if="seancesHorsLigne.enAttente" class="text-body2">{{ t('seances.offline.pendingHelp') }}</p>
        <q-list separator>
          <q-item v-for="seance in seancesHorsLigne.file" :key="seance.idClient" class="q-px-none">
            <q-item-section>
              <q-item-label>{{ seance.heureDebut }}–{{ seance.heureFin }} · {{ seance.affectation.enseignant?.nom }} {{ seance.affectation.enseignant?.prenom }}</q-item-label>
              <q-item-label caption>{{ seance.date }} · {{ seance.affectation.matiere?.code }} · {{ seance.affectation.promotion?.nom }}</q-item-label>
              <p v-if="seancesHorsLigne.erreurs[seance.idClient]" class="text-negative q-mt-sm" role="status">{{ seancesHorsLigne.erreurs[seance.idClient] }}</p>
              <q-btn flat dense color="negative" :label="t('seances.offline.remove')" class="self-start" @click="retirerSeance(seance.idClient)" />
            </q-item-section>
          </q-item>
        </q-list>
        <p v-if="!pointages.enAttente">{{ t('filePointages.empty') }}</p>
        <p v-if="!seancesHorsLigne.enAttente">{{ t('seances.offline.empty') }}</p>
        <q-banner v-if="Object.keys(pointages.erreurs).length" class="bg-orange-1 text-dark">{{ t('filePointages.conflictHelp') }}</q-banner>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat v-close-popup :label="t('filePointages.close')" />
        <q-btn color="primary" :label="t('filePointages.retry')" :disable="!pointages.enLigne || (!pointages.enAttente && !seancesHorsLigne.enAttente)" :loading="pointages.synchronisation || seancesHorsLigne.synchronisation" @click="pointages.synchroniser()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { usePointagesStore } from '../stores/pointages';
import { useSeancesStore } from '../stores/seances';
import { dateHeureLisible, LIBELLE_STATUT_PRESENCE } from '../utils/libelles';
defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const pointages = usePointagesStore();
const seancesHorsLigne = useSeancesStore();
const { t } = useI18n();
const $q = useQuasar();
function retirer(id: string) {
  $q.dialog({ title: t('filePointages.remove'), message: t('filePointages.removeConfirm'), cancel: true, persistent: true })
    .onOk(() => pointages.retirer(id));
}
function retirerSeance(idClient: string) {
  $q.dialog({ title: t('seances.offline.remove'), message: t('seances.offline.removeConfirm'), cancel: true, persistent: true })
    .onOk(() => seancesHorsLigne.retirer(idClient));
}
</script>
