<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 95vw">
      <q-card-section class="text-h6">Nouvelle inscription (guichet)</q-card-section>

      <q-card-section>
        <span class="section-titre">Étudiant</span>
        <q-select
          v-model="form.etudiantId"
          :options="optionsEtudiants"
          outlined
          dense
          use-input
          input-debounce="300"
          emit-value
          map-options
          label="Étudiant *"
          placeholder="Typez nom, prénom ou matricule…"
          :loading="rechercheEtudiants"
          @filter="filtrerEtudiants"
        />

        <span class="section-titre">Parcours</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.anneeId"
              :options="optionsAnnees"
              outlined
              dense
              emit-value
              map-options
              label="Année académique *"
              @update:model-value="rechargerPromotions"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.promotionId"
              :options="optionsPromotions"
              outlined
              dense
              emit-value
              map-options
              label="Promotion *"
              @update:model-value="chargerTarif"
            />
          </div>
        </div>

        <span class="section-titre">Frais</span>
        <q-input
          v-model.number="form.montantFrais"
          type="number"
          outlined
          dense
          label="Montant des frais (GNF)"
          :disable="tarifOfficiel !== null"
          :hint="tarifOfficiel !== null ? `Tarif officiel : ${montantLisible(tarifOfficiel)} GNF` : 'Aucun tarif paramétré : saisissez le montant'"
        >
          <template #append>
            <q-icon
              v-if="tarifOfficiel !== null"
              name="verified"
              color="positive"
            >
              <q-tooltip>Tarif officiel appliqué automatiquement</q-tooltip>
            </q-icon>
          </template>
        </q-input>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          label="Enregistrer l’inscription"
          :loading="enregistrement"
          :disable="!form.etudiantId || !form.promotionId || form.montantFrais === null"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { montantLisible } from '../utils/libelles';
import type { AnneeAcademique, Etudiant, Promotion } from '../types';

interface EtudiantOption extends Etudiant {
  inscriptions?: { promotion?: Promotion | null }[];
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const rechercheEtudiants = ref(false);

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const etudiants = ref<EtudiantOption[]>([]);
const tarifOfficiel = ref<number | null>(null);

const form = ref({
  etudiantId: '',
  anneeId: '',
  promotionId: '',
  montantFrais: null as number | null,
});

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !form.value.anneeId || p.anneeId === form.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsEtudiants = computed(() =>
  etudiants.value.map((e) => ({
    label: `${e.matricule} — ${e.nom} ${e.prenom}${
      e.inscriptions?.length ? ` (inscrit·e : ${e.inscriptions[0].promotion?.nom ?? '—'})` : ''
    }`,
    value: e.id,
  })),
);

async function filtrerEtudiants(terme: string, update: (callbackFn: () => void) => void) {
  if (terme === '') {
    update(() => {
      etudiants.value = [];
    });
    return;
  }
  rechercheEtudiants.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: { all: '1', search: terme },
    });
    update(() => {
      etudiants.value = data.data;
    });
  } finally {
    rechercheEtudiants.value = false;
  }
}

async function chargerAnnees() {
  const { data } = await api.get('/annees', { params: { all: '1' } });
  annees.value = data.data;
  form.value.anneeId =
    annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '';
  await rechargerPromotions();
}

async function rechargerPromotions() {
  promotions.value = [];
  form.value.promotionId = '';
  tarifOfficiel.value = null;
  if (!form.value.anneeId) return;
  const { data } = await api.get('/promotions', { params: { all: '1' } });
  promotions.value = data.data;
}

async function chargerTarif() {
  tarifOfficiel.value = null;
  if (!form.value.promotionId) return;
  const { data } = await api.get('/frais', {
    params: { all: '1', promotionId: form.value.promotionId, anneeId: form.value.anneeId || undefined },
  });
  if (data.data.length) {
    tarifOfficiel.value = data.data[0].montant;
    form.value.montantFrais = data.data[0].montant;
  } else {
    form.value.montantFrais = null;
  }
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = {
      etudiantId: '',
      anneeId: annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '',
      promotionId: '',
      montantFrais: null,
    };
    tarifOfficiel.value = null;
    etudiants.value = [];
    if (!annees.value.length) void chargerAnnees();
    else void rechargerPromotions();
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    await api.post('/inscriptions', {
      etudiantId: form.value.etudiantId,
      anneeId: form.value.anneeId || undefined,
      promotionId: form.value.promotionId,
      montantFrais: form.value.montantFrais === null ? undefined : form.value.montantFrais,
    });
    $q.notify({ type: 'positive', message: 'Inscription créée — en attente de paiement' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>