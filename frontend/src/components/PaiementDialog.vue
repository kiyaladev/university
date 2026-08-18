<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 680px; max-width: 95vw">
      <q-card-section class="text-h6">Nouveau paiement</q-card-section>

      <q-card-section>
        <q-option-group
          v-model="typePaiement"
          :options="[
            { label: 'À partir d’un dossier d’inscription', value: 'inscription' },
            { label: 'Paiement libre', value: 'libre' },
          ]"
          color="primary"
          dense
        />

        <template v-if="typePaiement === 'inscription'">
          <span class="section-titre">Dossier d’inscription</span>
          <autocomplete-async
            v-model="form.inscriptionId"
            endpoint="/inscriptions"
            :label-fn="(i) => `${i.numero} — ${i.etudiant?.nom ?? ''} ${i.etudiant?.prenom ?? ''} (${LIBELLE_STATUT_INSCRIPTION[i.statut] ?? i.statut})`"
            label="Dossier *"
            placeholder="Tapez n° de dossier ou nom d'étudiant…"
            @update:model-value="remplirDossier"
          />
          <div v-if="dossierChoisi" class="row q-col-gutter-md">
            <div class="col-12 col-sm-4">
              <q-input
                :model-value="dossierChoisi.etudiant ? `${dossierChoisi.etudiant.nom} ${dossierChoisi.etudiant.prenom}` : ''"
                outlined
                dense
                readonly
                label="Étudiant"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                :model-value="`${montantLisible(dossierChoisi.montantFrais)} GNF`"
                outlined
                dense
                readonly
                label="Frais d’inscription"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                :model-value="`${montantLisible(resteAPayer)} GNF`"
                outlined
                dense
                readonly
                label="Reste à payer"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <span class="section-titre">Bénéficiaire</span>
          <autocomplete-async
            v-model="form.etudiantId"
            endpoint="/etudiants"
            :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
            label="Étudiant *"
            placeholder="Tapez nom, prénom ou matricule…"
          />
        </template>

        <span class="section-titre">Règlement</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.mode"
              :options="optionsModes"
              outlined
              dense
              emit-value
              map-options
              label="Mode de paiement *"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.montant"
              type="number"
              min="1"
              outlined
              dense
              label="Montant (GNF) *"
              :error="montantExcessif"
              :error-message="`Le reste à payer n’est que de ${montantLisible(resteAPayer)} GNF`"
              :hint="
                resteAPayer !== null
                  ? 'Reste dû proposé — modifiable pour un versement partiel'
                  : undefined
              "
            />
          </div>
        </div>

        <template v-if="form.mode === 'MOBILE_MONEY'">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.operateur"
                :options="optionsOperateurs"
                outlined
                dense
                emit-value
                map-options
                label="Opérateur *"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.telephone"
                outlined
                dense
                label="Numéro Mobile Money *"
                placeholder="622 00 00 00"
              />
            </div>
          </div>
        </template>
        <template v-else>
          <q-input
            v-model="form.nomComplet"
            outlined
            dense
            label="Nom complet du donneur d’ordre"
            hint="Affiché au guichet ou sur le relevé bancaire"
          />
        </template>

        <q-input
          v-model="form.motif"
          outlined
          dense
          label="Motif"
          placeholder="Frais d’inscription L1…"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          v-if="peutSimulerReussi"
          color="positive"
          outline
          no-caps
          icon="check"
          label="Simuler comme REUSSI"
          :loading="enregistrementSimu"
          :disable="!montantValide || !form.mode || !telephoneOuNom"
          @click="enregistrerEnSimulantReussi"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          label="Enregistrer le paiement"
          :loading="enregistrement"
          :disable="!montantValide || !form.mode || !telephoneOuNom"
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
import AutocompleteAsync from './AutocompleteAsync.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_INSCRIPTION,
  montantLisible,
} from '../utils/libelles';
import { useAuthStore } from '../stores/auth';
import type { Inscription } from '../types';

const props = defineProps<{
  modelValue: boolean;
  inscriptionId?: string;
  etudiantId?: string;
  montantInitial?: number;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; paye: [] }>();

const $q = useQuasar();
const auth = useAuthStore();
const enregistrement = ref(false);
const enregistrementSimu = ref(false);

const typePaiement = ref<'inscription' | 'libre'>('inscription');
const inscriptions = ref<Inscription[]>([]);

const form = ref({
  inscriptionId: '',
  etudiantId: '',
  montant: null as number | null,
  devise: 'GNF',
  mode: 'MOBILE_MONEY',
  operateur: 'ORANGE_MONEY',
  telephone: '',
  nomComplet: '',
  motif: '',
});

const optionsModes = computed(() =>
  Object.entries(LIBELLE_MODE_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsOperateurs = computed(() =>
  Object.entries(LIBELLE_OPERATEUR_MM).map(([value, label]) => ({ value, label })),
);
const peutSimulerReussi = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));

const dossierChoisi = computed(() =>
  inscriptions.value.find((i) => i.id === form.value.inscriptionId) ?? null,
);

/** Déjà encaissé sur le dossier : seuls les paiements réussis comptent. */
function montantPaye(dossier: Inscription): number {
  return (dossier.paiements ?? [])
    .filter((p) => p.statut === 'REUSSI')
    .reduce((t, p) => t + p.montant, 0);
}

/** Reste dû : le montant proposé par défaut, jamais le total des frais. */
const resteAPayer = computed(() =>
  dossierChoisi.value
    ? Math.max(0, dossierChoisi.value.montantFrais - montantPaye(dossierChoisi.value))
    : null,
);

const telephoneOuNom = computed(() =>
  form.value.mode === 'MOBILE_MONEY' ? !!form.value.telephone : !!form.value.nomComplet,
);

/** Un règlement partiel est permis, mais jamais au-delà du reste dû. */
const montantExcessif = computed(
  () => resteAPayer.value !== null && (form.value.montant ?? 0) > resteAPayer.value,
);

const montantValide = computed(
  () => !!form.value.montant && form.value.montant > 0 && !montantExcessif.value,
);

async function charger() {
  try {
    const { data } = await api.get('/inscriptions', { params: { all: '1' } });
    inscriptions.value = Array.isArray(data) ? data : data.data ?? [];
  } catch {
    inscriptions.value = [];
  }
  if (form.value.inscriptionId) remplirDossier();
}

/**
 * Choix d'un dossier : on propose le reste dû (et non le total des frais,
 * qui ferait payer deux fois un dossier déjà réglé en partie). Le montant
 * reste modifiable pour accepter un versement partiel.
 */
function remplirDossier() {
  const dossier = dossierChoisi.value;
  if (!dossier) return;
  form.value.etudiantId = dossier.etudiantId;
  form.value.montant = resteAPayer.value ?? dossier.montantFrais;
  if (!form.value.motif) form.value.motif = `Frais d’inscription ${dossier.numero}`;
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const retenuIns = props.inscriptionId ?? '';
    form.value = {
      inscriptionId: retenuIns,
      etudiantId: props.etudiantId ?? '',
      montant: props.montantInitial ?? null,
      devise: 'GNF',
      mode: 'MOBILE_MONEY',
      operateur: 'ORANGE_MONEY',
      telephone: '',
      nomComplet: '',
      motif: '',
    };
    typePaiement.value = retenuIns ? 'inscription' : 'libre';
    void charger();
  },
);

async function poster(): Promise<string> {
  const { data } = await api.post('/paiements', {
    montant: form.value.montant,
    devise: form.value.devise,
    mode: form.value.mode,
    operateur: form.value.mode === 'MOBILE_MONEY' ? form.value.operateur : undefined,
    telephone: form.value.mode === 'MOBILE_MONEY' ? form.value.telephone : undefined,
    nomComplet: form.value.mode === 'MOBILE_MONEY' ? undefined : form.value.nomComplet,
    motif: form.value.motif || undefined,
    inscriptionId: form.value.inscriptionId || undefined,
    etudiantId: form.value.etudiantId || undefined,
  });
  return data.id as string;
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    await poster();
    $q.notify({ type: 'positive', message: 'Paiement enregistré' });
    emit('paye');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}

async function enregistrerEnSimulantReussi() {
  if (!peutSimulerReussi.value) return;
  enregistrementSimu.value = true;
  try {
    const id = await poster();
    // Confirmation opérateur : la transaction est validée immédiatement.
    await api.post(`/paiements/${id}/simuler`, { statut: 'REUSSI' });
    $q.notify({ type: 'positive', message: 'Paiement enregistré et marqué réussi' });
    emit('paye');
    emit('update:modelValue', false);
  } finally {
    enregistrementSimu.value = false;
  }
}
</script>
