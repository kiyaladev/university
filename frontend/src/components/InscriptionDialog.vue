<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 95vw">
      <q-card-section class="text-h6">{{ $t('inscriptions.createDialog.title') }}</q-card-section>

      <q-card-section>
        <span class="section-titre">{{ $t('common.fields.student') }}</span>
        <autocomplete-async
          v-model="form.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}${e.actif ? '' : ` (${$t('inscriptions.createDialog.inactive')})`}`"
          :label="$t('inscriptions.createDialog.student')"
          :placeholder="$t('inscriptions.createDialog.studentPlaceholder')"
        />

        <span class="section-titre">{{ $t('verification.result.table.parcours') }}</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.anneeId"
              endpoint="/annees"
              :label-fn="(a) => a.libelle"
              :label="$t('affectations.dialog.fields.year')"
              @update:model-value="onAnneeChange"
            />
          </div>
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.promotionId"
              endpoint="/promotions"
              :label-fn="(p) => p.nom"
              :label="$t('affectations.dialog.fields.promotion')"
              :disable="!form.anneeId"
              @update:model-value="chargerTarif"
            />
          </div>
        </div>

        <span class="section-titre">{{ $t('demandeDocuments.detail.fees') }}</span>
        <div v-if="tarifOfficiel !== null" class="plaque acces-tarif q-mb-sm">
          <div class="text-caption acces-tarif__libelle">{{ $t('inscriptions.createDialog.officialFee') }}</div>
          <div class="lettrage chiffres acces-tarif__montant">
            {{ montantLisible(tarifOfficiel) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}
          </div>
        </div>
        <q-input
          v-model.number="form.montantFrais"
          type="number"
          outlined
          dense
          :label="$t('inscriptions.createDialog.amount')"
          :disable="tarifOfficiel !== null"
          :hint="$t(tarifOfficiel !== null ? 'inscriptions.createDialog.officialFeeApplied' : 'inscriptions.createDialog.noFee')"
        >
          <template #append>
            <q-icon
              v-if="tarifOfficiel !== null"
              name="verified"
              color="positive"
            >
              <q-tooltip>{{ $t('inscriptions.createDialog.officialFeeApplied') }}</q-tooltip>
            </q-icon>
          </template>
        </q-input>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          :label="$t('inscriptions.createDialog.save')"
          :loading="enregistrement"
          :disable="!form.etudiantId || !form.promotionId || form.montantFrais === null"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { montantLisible } from '../utils/libelles';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const tarifOfficiel = ref<number | null>(null);

const form = ref({
  etudiantId: '',
  anneeId: '',
  promotionId: '',
  montantFrais: null as number | null,
});

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = { etudiantId: '', anneeId: '', promotionId: '', montantFrais: null };
    tarifOfficiel.value = null;
    void chargerAnneeDefaut();
  },
);

async function chargerAnneeDefaut() {
  try {
    const { data } = await api.get('/annees', { params: { all: '1' } });
    const liste = Array.isArray(data) ? data : data.data ?? [];
    form.value.anneeId = liste.find((a: any) => a.active)?.id ?? liste[0]?.id ?? '';
  } catch {
    form.value.anneeId = '';
  }
}

async function onAnneeChange() {
  form.value.promotionId = '';
  tarifOfficiel.value = null;
  form.value.montantFrais = null;
}

async function chargerTarif() {
  tarifOfficiel.value = null;
  if (!form.value.promotionId) return;
  try {
    const { data } = await api.get('/frais', {
      params: {
        all: '1',
        promotionId: form.value.promotionId,
        anneeId: form.value.anneeId || undefined,
      },
    });
    const liste = Array.isArray(data) ? data : data.data ?? [];
    if (liste.length) {
      tarifOfficiel.value = liste[0].montant;
      form.value.montantFrais = liste[0].montant;
    } else {
      form.value.montantFrais = null;
    }
  } catch {
    form.value.montantFrais = null;
  }
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    await api.post('/inscriptions', {
      etudiantId: form.value.etudiantId,
      anneeId: form.value.anneeId || undefined,
      promotionId: form.value.promotionId,
      montantFrais: form.value.montantFrais === null ? undefined : form.value.montantFrais,
    });
    $q.notify({ type: 'positive', message: t('inscriptions.createDialog.created') });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.acces-tarif {
  padding: var(--up-3) var(--up-4);
  display: grid;
  gap: var(--up-1);
}
.acces-tarif__libelle {
  color: var(--up-encre-douce);
  letter-spacing: -0.01em;
}
.acces-tarif__montant {
  font-size: 1.3rem;
  color: $vert;
}
</style>
