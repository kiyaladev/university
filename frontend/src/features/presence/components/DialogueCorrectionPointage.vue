<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('correctionsPointages.formDialog.title')"
    :sous-titre="$t('correctionsPointages.formDialog.subtitle')"
    taille="m"
    :envoi="envoi"
    :libelle-valider="$t('common.actions.save')"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <q-select
        v-model="form.statut"
        :options="optionsStatut"
        outlined
        dense
        emit-value
        map-options
        :label="$t('correctionsPointages.formDialog.status')"
      />
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-input
            v-model="form.heureArrivee"
            outlined
            dense
            mask="##:##"
            :label="$t('correctionsPointages.formDialog.arrival')"
            hint="HH:mm"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model="form.heureFinReelle"
            outlined
            dense
            mask="##:##"
            :label="$t('correctionsPointages.formDialog.departure')"
            hint="HH:mm"
          />
        </div>
      </div>
      <q-input
        v-model.number="form.effectifPresent"
        type="number"
        min="0"
        outlined
        dense
        :label="$t('correctionsPointages.formDialog.headcount')"
      />
      <q-input
        v-model="form.thematiqueTraitee"
        outlined
        dense
        :label="$t('correctionsPointages.formDialog.topic')"
      />
      <champ-recherche
        v-model="form.enseignantRemplacantId"
        endpoint="/enseignants"
        :label="$t('correctionsPointages.formDialog.substitute')"
        :label-fn="libelleEnseignant"
        :clearable="true"
      />
      <q-input
        v-model="form.observation"
        type="textarea"
        outlined
        dense
        autogrow
        :label="$t('correctionsPointages.formDialog.observation')"
      />
      <q-banner dense rounded class="bg-blue-1 text-blue-9">
        {{ $t('correctionsPointages.formDialog.proofsHint') }}
      </q-banner>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import { LIBELLE_STATUT_PRESENCE, optionsDepuis } from '@/shared/utils/libelles';
import type { Controle, StatutPresence } from '@/types';
import { pointagesService, type CorrectionPointage } from '../services/pointages';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ controle: Controle | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const { t } = useI18n();
const $q = useQuasar();

const form = ref<CorrectionPointage>({});
const envoi = ref(false);

const optionsStatut = computed(() =>
  optionsDepuis(LIBELLE_STATUT_PRESENCE).filter((o) => o.value !== 'NON_CONTROLE'),
);

function libelleEnseignant(enseignant: { nom?: string; prenom?: string; matricule?: string }): string {
  const nom = `${enseignant?.prenom ?? ''} ${enseignant?.nom ?? ''}`.trim();
  return nom ? `${nom}${enseignant?.matricule ? ` (${enseignant.matricule})` : ''}` : (enseignant?.matricule ?? '');
}

watch(
  ouvert,
  (v) => {
    if (!v || !props.controle) return;
    form.value = {
      statut: props.controle.statut,
      heureArrivee: props.controle.heureArrivee ?? '',
      heureFinReelle: props.controle.heureFinReelle ?? '',
      effectifPresent: props.controle.effectifPresent ?? undefined,
      thematiqueTraitee: props.controle.thematiqueTraitee ?? '',
      observation: props.controle.observation ?? '',
      enseignantRemplacantId: props.controle.enseignantRemplacant?.id ?? undefined,
    };
  },
  { immediate: true },
);

/** Seules les heures au format HH:mm sont acceptées par l'API. */
function heureValide(valeur?: string): boolean {
  return !valeur || /^([01]\d|2[0-3]):[0-5]\d$/.test(valeur);
}

async function enregistrer() {
  if (!props.controle) return;
  if (!heureValide(form.value.heureArrivee) || !heureValide(form.value.heureFinReelle)) {
    $q.notify({ type: 'warning', message: t('correctionsPointages.formDialog.invalidTime') });
    return;
  }
  const effectif = form.value.effectifPresent;
  if (effectif != null && (!Number.isInteger(effectif) || effectif < 0)) {
    $q.notify({ type: 'warning', message: t('correctionsPointages.formDialog.invalidCount') });
    return;
  }

  const corps: CorrectionPointage = {
    statut: form.value.statut as StatutPresence,
    heureArrivee: form.value.heureArrivee || undefined,
    heureFinReelle: form.value.heureFinReelle || undefined,
    effectifPresent: effectif ?? undefined,
    thematiqueTraitee: form.value.thematiqueTraitee || undefined,
    observation: form.value.observation || undefined,
  };
  if (form.value.enseignantRemplacantId) corps.enseignantRemplacantId = form.value.enseignantRemplacantId;

  envoi.value = true;
  try {
    await pointagesService.modifier(props.controle.id, corps);
    $q.notify({ type: 'positive', message: t('correctionsPointages.messages.updated') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    envoi.value = false;
  }
}
</script>
