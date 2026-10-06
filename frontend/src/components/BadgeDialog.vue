<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import type { BadgeAcces, TypeBadge } from '../types';
import {
  LIBELLE_TYPE_BADGE,
  optionsDepuis,
} from '../utils/libelles';

const $q = useQuasar();
const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  badge?: BadgeAcces | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean]; enregistre: [b: BadgeAcces] }>();

const OPTIONS_TYPE = optionsDepuis(LIBELLE_TYPE_BADGE);

const formulaire = ref({
  type: 'VISITEUR' as TypeBadge,
  nom: '',
  prenom: '',
  fonction: '',
  organisation: '',
  telephone: '',
  email: '',
  pieceIdentite: '',
  numeroPiece: '',
  dateValidite: null as string | null,
  zonesAccess: '',
  photoUrl: '',
  motif: '',
});

const enregistrement = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      const b = props.badge;
      formulaire.value = {
        type: (b?.type as TypeBadge) ?? 'VISITEUR',
        nom: b?.nom ?? '',
        prenom: b?.prenom ?? '',
        fonction: b?.fonction ?? '',
        organisation: b?.organisation ?? '',
        telephone: b?.telephone ?? '',
        email: b?.email ?? '',
        pieceIdentite: b?.pieceIdentite ?? '',
        numeroPiece: b?.numeroPiece ?? '',
        dateValidite: b?.dateValidite?.slice(0, 10) ?? null,
        zonesAccess: b?.zonesAccess ?? '',
        photoUrl: b?.photoUrl ?? '',
        motif: b?.motif ?? '',
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.badge?.id));
const titre = computed(() => t(enEdition.value ? 'badges.dialogs.form.titleEdit' : 'badges.dialogs.form.titleNew'));

async function soumettre() {
  if (!formulaire.value.nom || !formulaire.value.prenom) {
    $q.notify({ type: 'warning', message: t('badges.dialogs.form.nameRequired') });
    return;
  }
  if (!formulaire.value.dateValidite) {
    $q.notify({ type: 'warning', message: t('badges.dialogs.form.validityRequired') });
    return;
  }
  enregistrement.value = true;
  try {
    const url = enEdition.value ? `/badges/${props.badge!.id}` : '/badges';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      type: formulaire.value.type,
      nom: formulaire.value.nom,
      prenom: formulaire.value.prenom,
      dateValidite: formulaire.value.dateValidite,
    };
    const champsOptionnels = ['fonction', 'organisation', 'telephone', 'email', 'pieceIdentite', 'numeroPiece', 'zonesAccess', 'photoUrl', 'motif'];
    for (const champ of champsOptionnels) {
      const valeur = (formulaire.value as any)[champ];
      if (valeur) payload[champ] = valeur;
    }
    const { data } = await api[methode](url, payload);
    $q.notify({ type: 'positive', message: t(enEdition.value ? 'badges.dialogs.form.updated' : 'badges.dialogs.form.issued') });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? t('badges.dialogs.form.issueFailed') });
  } finally {
    enregistrement.value = false;
  }
}

function fermer() {
  emit('update:modelValue', false);
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="min-width: 540px; max-width: 92vw">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ titre }}</div>
        <q-space />
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" @click="fermer" />
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <q-select
          v-model="formulaire.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          :label="$t('badges.dialogs.form.typeLabel')"
          outlined
          dense
        />
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.prenom" :label="$t('common.fields.firstName')" outlined dense class="col" />
          <q-input v-model="formulaire.nom" :label="$t('common.fields.lastName')" outlined dense class="col" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.fonction" :label="$t('badges.dialogs.form.functionLabel')" outlined dense class="col" />
          <q-input v-model="formulaire.organisation" :label="$t('badges.table.columns.organization')" outlined dense class="col" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.telephone" :label="$t('common.fields.phone')" outlined dense class="col" />
          <q-input v-model="formulaire.email" :label="$t('badges.dialogs.form.emailLabel')" outlined dense class="col" type="email" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.pieceIdentite" :label="$t('badges.dialogs.form.idTypeLabel')" outlined dense class="col" />
          <q-input v-model="formulaire.numeroPiece" :label="$t('badges.dialogs.form.idNumberLabel')" outlined dense class="col" />
        </div>
        <div class="row q-col-gutter-md">
          <q-input v-model="formulaire.dateValidite" :label="$t('verificationCarte.result.table.validUntil')" type="date" outlined dense class="col" />
          <q-input v-model="formulaire.zonesAccess" :label="$t('badges.dialogs.form.zonesLabel')" outlined dense class="col" />
        </div>
        <q-input v-model="formulaire.photoUrl" :label="$t('badges.dialogs.form.photoLabel')" outlined dense />
        <q-input
          v-if="enEdition"
          v-model="formulaire.motif"
          :label="$t('badges.dialogs.cancel.reasonLabel')"
          :hint="$t('badges.dialogs.form.reasonHint')"
          outlined
          dense
          type="textarea"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" no-caps @click="fermer" />
        <q-btn unelevated color="primary" :loading="enregistrement" no-caps :label="$t(enEdition ? 'common.actions.save' : 'badges.actions.issueBadge')" @click="soumettre" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
