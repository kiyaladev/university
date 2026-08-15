<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 600px; max-width: 95vw">
      <q-card-section class="text-h6">Nouvelle attribution</q-card-section>
      <q-card-section class="q-pt-none text-caption text-grey-7">
        La demande est posée sur pièce (score social/mérite) ; seule la direction la tranche.
      </q-card-section>

      <q-card-section>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.chambreId"
              :options="optionsChambres"
              outlined
              dense
              emit-value
              map-options
              label="Chambre *"
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
              label="Année académique"
            />
          </div>
        </div>

        <span class="section-titre">Étudiant</span>
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
          label="Rechercher un étudiant (matricule, nom, prénom)"
          @filter="filtrerEtudiants"
        />
        <p v-if="rechercheImpossible" class="text-caption text-negative q-mt-xs">
          Le registre des étudiants n’est pas encore en ligne — module en construction.
        </p>

        <span class="section-titre">Critères sociaux / mérite</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-input
              v-model.number="form.critereScore"
              type="number"
              min="0"
              max="100"
              outlined
              dense
              label="Score (0-100)"
            />
          </div>
          <div class="col-12 col-sm-8">
            <q-input
              v-model="form.justificatif"
              outlined
              dense
              type="textarea"
              label="Justificatif"
              :autogrow="true"
              hint="Pièce sociale ou de mérite (bourse, orphelinat, classement…)"
              rows="2"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { LIBELLE_STATUT_CHAMBRE } from '../utils/libelles';
import type { AnneeAcademique, Chambre, Etudiant } from '../types';

/**
 * Recherche d'étudiants — contrat du module 1 (registre universitaire) :
 *   GET /api/etudiants?search=&all=1
 *   → { data: [{ id, matricule, nom, prenom, telephone }] }
 * L'endpoint n'est pas encore déployé ; le dialogue le consommera tel quel.
 */
const props = defineProps<{
  modelValue: boolean;
  chambres: Chambre[];
  annees: AnneeAcademique[];
  anneeDefautId?: string | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const optionsEtudiants = ref<{ label: string; value: string }[]>([]);
const rechercheImpossible = ref(false);

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

const optionsAnnees = computed(() =>
  props.annees.map((a) => ({ label: a.libelle, value: a.id })),
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = {
      chambreId: null,
      etudiantId: null,
      anneeId: props.anneeDefautId ?? null,
      critereScore: null,
      justificatif: '',
    };
    optionsEtudiants.value = [];
    rechercheImpossible.value = false;
  },
);

function chambreChoisie(id: string | null) {
  const c = props.chambres.find((x) => x.id === id);
  if (c) {
    $q.notify({ type: 'info', message: `Loyer mensuel : ${c.loyer} ${c.devise}`, icon: 'payments' });
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
    const payload = {
      chambreId: form.value.chambreId!,
      etudiantId: form.value.etudiantId!,
      anneeId: form.value.anneeId || undefined,
      critereScore: form.value.critereScore ?? undefined,
      justificatif: form.value.justificatif || undefined,
    };
    await api.post('/attributions-logement', payload);
    $q.notify({ type: 'positive', message: 'Demande enregistrée — chambre réservée' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>