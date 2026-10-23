<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 680px; max-width: 95vw">
      <q-card-section class="text-h6">{{ $t('paiements.actions.new') }}</q-card-section>

      <q-card-section>
        <q-option-group
          v-model="typePaiement"
          :options="[
            { label: $t('paiements.dialog.type.enrollment'), value: 'inscription' },
            { label: $t('paiements.dialog.type.free'), value: 'libre' },
          ]"
          color="primary"
          dense
        />

        <template v-if="typePaiement === 'inscription'">
          <span class="section-titre">{{ $t('paiements.filters.enrollment') }}</span>
          <autocomplete-async
            v-model="form.inscriptionId"
            endpoint="/inscriptions"
            :label-fn="(i) => `${i.numero} — ${i.etudiant?.nom ?? ''} ${i.etudiant?.prenom ?? ''} (${LIBELLE_STATUT_INSCRIPTION[i.statut] ?? i.statut})`"
            :label="$t('paiements.dialog.fields.enrollment')"
            :placeholder="$t('paiements.dialog.fields.enrollmentPlaceholder')"
            @update:model-value="remplirDossier"
          />
          <div v-if="dossierChoisi" class="row q-col-gutter-md">
            <div class="col-12 col-sm-4">
              <q-input
                :model-value="dossierChoisi.etudiant ? `${dossierChoisi.etudiant.nom} ${dossierChoisi.etudiant.prenom}` : ''"
                outlined
                dense
                readonly
                :label="$t('common.fields.student')"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                :model-value="`${montantLisible(dossierChoisi.montantFrais)} GNF`"
                outlined
                dense
                readonly
                :label="$t('etudiants.dialogInscriptions.columns.amount')"
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-input
                :model-value="`${montantLisible(resteAPayer)} GNF`"
                outlined
                dense
                readonly
                :label="$t('inscriptions.cards.balance')"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <span class="section-titre">{{ $t('paiements.dialog.fields.beneficiary') }}</span>
          <autocomplete-async
            v-model="form.etudiantId"
            endpoint="/etudiants"
            :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
            :label="$t('common.fields.studentRequired')"
            :placeholder="$t('paiements.dialog.fields.studentPlaceholder')"
          />
        </template>

        <span class="section-titre">{{ $t('paiements.dialog.fields.payment') }}</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.mode"
              :options="optionsModes"
              outlined
              dense
              emit-value
              map-options
              :label="$t('paiements.dialog.fields.mode')"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.montant"
              type="number"
              min="1"
              outlined
              dense
              :label="$t('paiements.dialog.fields.amount')"
              :error="montantExcessif"
              :error-message="$t('paiements.dialog.fields.excessiveAmount', { amount: montantLisible(resteAPayer) })"
              :hint="
                resteAPayer !== null
                  ? $t('paiements.dialog.fields.balanceHint')
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
                :label="$t('paiements.dialog.fields.operator')"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.telephone"
                outlined
                dense
                :label="$t('paiements.dialog.fields.mobileMoneyPhone')"
                :placeholder="$t('common.fields.phonePlaceholder')"
              />
            </div>
          </div>
        </template>
        <template v-else>
          <q-input
            v-model="form.nomComplet"
            outlined
            dense
            :label="$t('paiements.dialog.fields.payerName')"
            :hint="$t('paiements.dialog.fields.payerNameHint')"
          />
        </template>

        <q-input
          v-model="form.motif"
          outlined
          dense
          :label="$t('common.fields.motif')"
          :placeholder="$t('paiements.dialog.fields.reasonPlaceholder')"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          v-if="peutSimulerReussi"
          color="positive"
          outline
          no-caps
          icon="check"
          :label="$t('paiements.dialog.simulateSuccess')"
          :loading="enregistrementSimu"
          :disable="!montantValide || !form.mode || !telephoneOuNom"
          @click="enregistrerEnSimulantReussi"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          :label="$t('paiements.dialog.save')"
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
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();
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
/** Même droit que `POST /paiements/:id/simuler` : la scolarité y recevait un 403. */
const peutSimulerReussi = computed(() => auth.peut('paiements.simuler'));

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
    $q.notify({ type: 'positive', message: t('paiements.messages.recorded') });
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
    $q.notify({ type: 'positive', message: t('paiements.messages.recordedAndSucceeded') });
    emit('paye');
    emit('update:modelValue', false);
  } finally {
    enregistrementSimu.value = false;
  }
}
</script>
