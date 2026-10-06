<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 480px; max-width: 95vw">
      <!-- Création : mois + année, le libellé et la période suivent. -->
      <template v-if="!creee">
        <q-card-section class="text-h6">{{ $t('paiePage.createDialog.title') }}</q-card-section>
        <q-card-section>
          <div class="section-titre">{{ $t('common.fields.period') }}</div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.mois"
                :options="optionsMois"
                outlined
                dense
                :label="$t('paiePage.createDialog.month')"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.annee"
                :options="optionsAnnees"
                outlined
                dense
                :label="$t('paiePage.createDialog.year')"
              />
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ $t('paiePage.createDialog.periodHint', { label: libelle }) }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            :label="$t('paiePage.createDialog.create')"
            :loading="enregistrement"
            :disable="!form.mois || !form.annee"
            @click="creer"
          />
        </q-card-actions>
      </template>

      <!-- Confirmation : statut et montant de la feuille créée. -->
      <template v-else>
        <q-card-section class="text-h6">{{ creee.libelle }}</q-card-section>
        <q-card-section class="q-gutter-sm">
          <div class="row items-center q-gutter-sm">
            <span class="champ champ--brouillon" style="min-width: 110px">
              {{ LIBELLE_STATUT_PAIE[creee.statut] }}
            </span>
          </div>
          <div class="q-pt-sm">
            <div class="text-caption text-grey-7">{{ $t('common.fields.period') }}</div>
            <div class="text-body1">
              {{ dateLisible(creee.dateDebut) }} – {{ dateLisible(creee.dateFin) }}
            </div>
          </div>
          <div>
            <div class="text-caption text-grey-7">{{ $t('paiePage.card.totalAmount') }}</div>
            <div class="text-h6">{{ montantLisible(creee.montantTotal) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</div>
          </div>
          <div class="text-caption text-grey-7">
            {{ $t('paiePage.createDialog.draftHint') }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            color="primary"
            unelevated
            icon="calculate"
            no-caps
            :label="$t('paiePage.createDialog.recalculateNow')"
            @click="emit('calculer', creee)"
          />
          <q-btn flat :label="$t('common.actions.close')" v-close-popup />
        </q-card-actions>
      </template>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { LIBELLE_STATUT_PAIE, dateLisible, montantLisible } from '../utils/libelles';
import type { FeuillePaie } from '../types';

const props = defineProps<{
  modelValue: boolean;
  /** Années déjà couvertes par une feuille — proposées en premier. */
  anneesExistantes?: number[];
}>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  cree: [FeuillePaie];
  calculer: [FeuillePaie];
}>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const creee = ref<FeuillePaie | null>(null);

const form = ref({ mois: null as number | null, annee: null as number | null });

const optionsMois = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({ label: t(`common.months.${i + 1}`), value: i + 1 })),
);

/** Années présentes, les deux précédentes et l'année courante. */
const optionsAnnees = computed(() => {
  const courante = new Date().getFullYear();
  const annees = new Set<number>([
    courante,
    courante - 1,
    courante - 2,
    ...(props.anneesExistantes ?? []),
  ]);
  return [...annees]
    .sort((a, b) => b - a)
    .map((a) => ({ label: String(a), value: a }));
});

const libelle = computed(() => {
  if (!form.value.mois) return '…';
  return `${t(`common.months.${form.value.mois}`)} ${form.value.annee ?? '…'}`;
});

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = { mois: null, annee: new Date().getFullYear() };
    creee.value = null;
  },
);

async function creer() {
  enregistrement.value = true;
  try {
    const { data } = await api.post('/feuilles-paie', form.value);
    creee.value = data;
    $q.notify({ type: 'positive', message: t('paiePage.createDialog.created', { label: data.libelle }) });
    emit('cree', data);
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? t('paiePage.createDialog.createFailed') });
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
// Le champ de statut de la feuille : même peinture que sur l'écran de la paie.
@use '../css/champs-admin' as *;
</style>
