<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('cites.actions.newAttribution')"
    :sous-titre="$t('cites.attributions.dialog.note')"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.chambreId"
          :options="optionsChambres"
          outlined
          dense
          emit-value
          map-options
          :label="$t('cites.attributions.dialog.roomLabel')"
          :rules="[requis]"
          @update:model-value="chambreChoisie"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          emit-value
          map-options
          :label="$t('common.fields.academicYear')"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('common.fields.student') }}</span>
    <q-select
      v-model="form.etudiantId"
      :options="optionsEtudiants"
      outlined
      dense
      use-input
      clearable
      emit-value
      map-options
      input-debounce="300"
      :label="$t('cites.attributions.dialog.studentSearch')"
      :rules="[requis]"
      @filter="filtrerEtudiants"
    />
    <p v-if="rechercheImpossible" class="text-caption text-negative q-mt-xs">
      {{ $t('cites.attributions.dialog.studentsUnavailable') }}
    </p>

    <span class="section-titre">{{ $t('cites.attributions.dialog.criteriaTitle') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-4">
        <q-input
          v-model.number="form.critereScore"
          type="number"
          min="0"
          max="100"
          outlined
          dense
          :label="$t('cites.attributions.dialog.scoreLabel')"
        />
      </div>
      <div class="col-12 col-sm-8">
        <q-input
          v-model="form.justificatif"
          outlined
          dense
          type="textarea"
          :label="$t('common.fields.supportingDocument')"
          :autogrow="true"
          :hint="$t('cites.attributions.dialog.proofHint')"
          rows="2"
        />
      </div>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { LIBELLE_STATUT_CHAMBRE } from '@/shared/utils/libelles';
import type { AnneeAcademique, Chambre, Etudiant } from '@/types';

/**
 * Recherche d'étudiants — contrat du module 1 (registre universitaire) :
 *   GET /api/etudiants?search=&all=1
 *   → { data: [{ id, matricule, nom, prenom, telephone }] }
 */
const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  chambres: Chambre[];
  annees: AnneeAcademique[];
  anneeDefautId?: string | null;
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const optionsEtudiants = ref<{ label: string; value: string }[]>([]);
const rechercheImpossible = ref(false);
const requis = (v: string | null) => !!v || t('common.messages.errors.required');

const form = ref({
  chambreId: null as string | null,
  etudiantId: null as string | null,
  anneeId: null as string | null,
  critereScore: null as number | null,
  justificatif: '',
});

const optionsChambres = computed(() =>
  props.chambres.map((c) => ({
    label: `${c.code} — ${c.residence?.nom ?? ''} (${LIBELLE_STATUT_CHAMBRE[c.statut] ?? c.statut})`,
    value: c.id,
  })),
);

const optionsAnnees = computed(() => props.annees.map((a) => ({ label: a.libelle, value: a.id })));

watch(ouvert, (o) => {
  if (!o) return;
  form.value = {
    chambreId: null,
    etudiantId: null,
    anneeId: props.anneeDefautId ?? null,
    critereScore: null,
    justificatif: '',
  };
  optionsEtudiants.value = [];
  rechercheImpossible.value = false;
});

function chambreChoisie(id: string | null) {
  const c = props.chambres.find((x) => x.id === id);
  if (c) {
    $q.notify({
      type: 'info',
      message: t('cites.attributions.dialog.rentNotice', { loyer: c.loyer, devise: c.devise }),
      icon: 'payments',
    });
  }
}

async function filtrerEtudiants(val: string, update: (cb: () => void) => void) {
  update(async () => {
    if (!val) {
      optionsEtudiants.value = [];
      return;
    }
    try {
      const { data } = await api.get('/etudiants', { params: { search: val, all: '1' } });
      optionsEtudiants.value = (data.data as Etudiant[]).map((e) => ({
        label: `${e.matricule} — ${e.nom} ${e.prenom}`,
        value: e.id,
      }));
      rechercheImpossible.value = false;
    } catch {
      optionsEtudiants.value = [];
      rechercheImpossible.value = true;
    }
  });
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    await api.post('/attributions-logement', {
      chambreId: form.value.chambreId!,
      etudiantId: form.value.etudiantId!,
      anneeId: form.value.anneeId || undefined,
      critereScore: form.value.critereScore ?? undefined,
      justificatif: form.value.justificatif || undefined,
    });
    $q.notify({ type: 'positive', message: t('cites.attributions.dialog.saved') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
