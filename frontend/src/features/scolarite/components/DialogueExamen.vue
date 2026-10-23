<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('examens.actions.schedule')"
    :sous-titre="$t('examens.fields.codeHint')"
    taille="l"
    :envoi="envoi"
    :libelle-valider="$t('common.actions.register')"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <q-input v-model="form.intitule" outlined dense :label="$t('common.fields.intitule')" />
      <champ-recherche
        v-model="form.surveillantId"
        endpoint="/examens/surveillants"
        :label="$t('examens.fields.supervisor')"
        :label-fn="(u) => `${u.prenom} ${u.nom} — ${u.role}`"
        :clearable="true"
      />
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <q-select v-model="form.type" :options="optionsTypes" outlined dense emit-value map-options :label="$t('common.fields.type')" />
        </div>
        <div class="col-6">
          <q-input v-model="form.codeExamen" outlined dense :label="$t('examens.fields.code')" />
        </div>
      </div>
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <champ-recherche
            v-model="form.matiereId"
            endpoint="/matieres"
            :label="$t('common.fields.subjectRequired')"
            :label-fn="(m) => `${m.code} — ${m.intitule}`"
          />
        </div>
        <div class="col-6">
          <champ-recherche
            v-model="form.promotionId"
            endpoint="/referentiel/promotions"
            :label="$t('common.fields.promotionRequired')"
            :label-fn="(p) => `${p.nom} — ${p.niveau}`"
          />
        </div>
      </div>
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <champ-recherche
            v-model="form.anneeId"
            endpoint="/referentiel/annees"
            :label="$t('common.fields.academicYearRequired')"
            :label-fn="(a) => a.libelle"
          />
        </div>
        <div class="col-6">
          <champ-recherche
            v-model="form.salleId"
            endpoint="/salles"
            :label="$t('common.fields.classroom')"
            :label-fn="(s) => `${s.code} — ${s.nom}`"
            :clearable="true"
          />
        </div>
      </div>
      <div class="row q-col-gutter-md">
        <div class="col-4">
          <champ-date v-model="form.dateExamen" :label="$t('examens.fields.examDate')" />
        </div>
        <div class="col-4">
          <q-input v-model="form.heureDebut" outlined dense type="time" :label="$t('examens.fields.startTime')" />
        </div>
        <div class="col-4">
          <q-input v-model="form.heureFin" outlined dense type="time" :label="$t('examens.fields.endTime')" />
        </div>
      </div>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { LIBELLE_TYPE_EXAMEN } from '@/shared/utils/libelles';

const ouvert = defineModel<boolean>({ required: true });
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const optionsTypes = (['PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_EXAMEN[value],
}));

const form = ref({
  intitule: '',
  type: 'FINAL',
  codeExamen: '',
  matiereId: null as string | null,
  promotionId: null as string | null,
  anneeId: null as string | null,
  salleId: null as string | null,
  dateExamen: '',
  heureDebut: '08:00',
  heureFin: '10:00',
  surveillantId: null as string | null,
});

const envoi = ref(false);

async function enregistrer() {
  if (!form.value.intitule || !form.value.codeExamen || !form.value.matiereId || !form.value.promotionId || !form.value.anneeId || !form.value.dateExamen) {
    $q.notify({ type: 'warning', message: t('common.messages.requiredFields') });
    return;
  }
  envoi.value = true;
  try {
    await api.post('/examens', form.value);
    $q.notify({ type: 'positive', message: t('examens.messages.scheduled') });
    ouvert.value = false;
    emit('enregistre');
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}
</script>
