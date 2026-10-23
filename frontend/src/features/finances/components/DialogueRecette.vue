<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(existant ? 'recettes.formDialog.editTitle' : 'recettes.formDialog.newTitle')"
    :sous-titre="$t('recettes.formDialog.numberHint')"
    taille="l"
    :envoi="envoi"
    :libelle-valider="$t(existant ? 'common.actions.save' : 'recettes.actions.issueRecette')"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <q-banner v-if="champsComptablesFiges" dense rounded class="bg-amber-1 text-brown-9">
        {{ $t('recettes.formDialog.accountingLocked') }}
      </q-banner>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-input
            v-model="form.numero"
            :disable="!!existant"
            outlined
            dense
            :label="$t('recettes.formDialog.number')"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-select
            v-model="form.type"
            :options="optionsTypes"
            :disable="champsComptablesFiges"
            outlined
            dense
            emit-value
            map-options
            :label="$t('common.fields.type')"
          />
        </div>
      </div>
      <q-input v-model="form.libelle" outlined dense :label="$t('common.fields.labelRequired')" />
      <q-input
        v-model="form.description"
        outlined
        dense
        type="textarea"
        rows="2"
        :label="$t('common.fields.description')"
      />
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <champ-date v-model="form.date" :disable="champsComptablesFiges" :label="$t('common.fields.dateRequired')" />
        </div>
        <div class="col-12 col-sm-4">
          <q-input
            v-model.number="form.montant"
            :disable="champsComptablesFiges"
            type="number"
            min="0"
            outlined
            dense
            :label="$t('recettes.formDialog.amount')"
          />
        </div>
        <div class="col-12 col-sm-4">
          <q-input
            v-model="form.devise"
            :disable="champsComptablesFiges"
            outlined
            dense
            :label="$t('common.fields.currency')"
          />
        </div>
      </div>
      <q-input v-model="form.client" outlined dense :label="$t('recettes.table.columns.client')" />
      <q-input v-model="form.factureNum" outlined dense :label="$t('recettes.formDialog.invoiceNumber')" />
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { aujourdhui, DEVISE, LIBELLE_TYPE_RECETTE } from '@/shared/utils/libelles';
import { recettesService } from '../services/recettes';
import type { RecetteExterne, TypeRecette } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  existant: RecetteExterne | null;
}>();
const emit = defineEmits<{
  enregistre: [];
}>();

const $q = useQuasar();
const { t } = useI18n();

const optionsTypes = computed(() =>
  Object.entries(LIBELLE_TYPE_RECETTE).map(([value, label]) => ({
    value,
    label,
  })),
);

const form = ref({
  numero: '',
  type: 'PRESTATION_FORMATION' as TypeRecette,
  libelle: '',
  description: '',
  montant: 0,
  devise: DEVISE,
  date: aujourdhui(),
  client: '',
  factureNum: '',
});

const envoi = ref(false);
const champsComptablesFiges = computed(() => !!props.existant?.paiementId);

watch(ouvert, (v) => {
  if (v && props.existant) {
    form.value = {
      numero: props.existant.numero,
      type: props.existant.type,
      libelle: props.existant.libelle,
      description: props.existant.description ?? '',
      montant: props.existant.montant,
      devise: props.existant.devise ?? DEVISE,
      date: props.existant.date?.slice(0, 10) ?? aujourdhui(),
      client: props.existant.client ?? '',
      factureNum: props.existant.factureNum ?? '',
    };
  } else if (v && !props.existant) {
    form.value = {
      numero: '',
      type: 'PRESTATION_FORMATION',
      libelle: '',
      description: '',
      montant: 0,
      devise: DEVISE,
      date: aujourdhui(),
      client: '',
      factureNum: '',
    };
  }
});

async function enregistrer() {
  const montant = Number(form.value.montant);
  if (
    (!props.existant && !form.value.numero) ||
    !form.value.libelle ||
    !Number.isFinite(montant) ||
    montant < 0 ||
    !form.value.date
  ) {
    $q.notify({ type: 'warning', message: t('common.messages.requiredFields') });
    return;
  }
  envoi.value = true;
  try {
    const payload = {
      type: form.value.type,
      libelle: form.value.libelle.trim(),
      description: form.value.description.trim() || null,
      montant,
      devise: form.value.devise.trim() || DEVISE,
      date: form.value.date,
      client: form.value.client.trim() || null,
      factureNum: form.value.factureNum.trim() || null,
    };
    if (props.existant) {
      await recettesService.modifier(props.existant.id, payload);
      $q.notify({ type: 'positive', message: t('recettes.formDialog.updated') });
    } else {
      await recettesService.creer({ numero: form.value.numero.trim(), ...payload });
      $q.notify({ type: 'positive', message: t('recettes.formDialog.created') });
    }
    emit('enregistre');
    ouvert.value = false;
  } finally {
    envoi.value = false;
  }
}
</script>
