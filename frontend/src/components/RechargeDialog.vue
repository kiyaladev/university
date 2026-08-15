<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">Recharger un portefeuille resto</q-card-section>

      <q-card-section>
        <span class="section-titre">Étudiant</span>
        <q-select
          v-model="etudiantId"
          :options="optionsEtudiants"
          option-value="id"
          option-label="libelle"
          label="Étudiant *"
          outlined
          dense
          use-input
          input-debounce="300"
          clearable
          filterable
          :disable="!!preSelectionnee"
          :loading="chargementEtudiants"
          @filter="filtrerEtudiants"
        >
          <template #no-option>
            <q-item><q-item-section class="text-grey-7">Aucun portefeuille trouvé</q-item-section></q-item>
          </template>
        </q-select>

        <span class="section-titre q-mt-md">Rechargement</span>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input
              v-model.number="form.montant"
              type="number"
              min="500"
              step="500"
              outlined
              dense
              label="Montant (GNF) *"
              suffix="GNF"
            />
          </div>
          <div class="col-6">
            <q-select
              v-model="form.mode"
              :options="optionsModes"
              label="Mode *"
              outlined
              dense
            />
          </div>
        </div>

        <template v-if="form.mode === 'MOBILE_MONEY'">
          <q-select
            v-model="form.operateur"
            :options="optionsOperateurs"
            label="Opérateur"
            outlined
            dense
            class="q-mt-md"
          />
          <q-toggle v-model="form.simuler" label="Confirmer immédiatement (simulation pilote)" class="q-mt-sm" />
          <p class="note-rechargement">
            <q-icon name="info" size="15px" />
            <span>
              En Mobile Money, la recharge naît « en attente » : elle sera
              confirmée via le module de paiement (simulation) avant d'être
              créditée sur le portefeuille.
            </span>
          </p>
        </template>
        <p v-else class="note-rechargement note-rechargement--positif">
          <q-icon name="payments" size="15px" />
          <span>Espèces au guichet : crédit immédiat du portefeuille.</span>
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          label="Recharger"
          :loading="enregistrement"
          :disable="!valide"
          @click="recharger"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { LIBELLE_MODE_PAIEMENT } from '../utils/libelles';

interface EtudiantOption {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  solde: number;
  libelle: string;
}

const props = defineProps<{
  modelValue: boolean;
  /** Étudiant pré-sélectionné (bouton « Recharger » d'une ligne du tableau). */
  etudiant?: string | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; rechargee: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const chargementEtudiants = ref(false);
const etudiantId = ref<string | null>(null);
const tousEtudiants = ref<EtudiantOption[]>([]);

const form = ref({
  montant: 10_000 as number,
  mode: 'ESPECES',
  operateur: 'ORANGE_MONEY',
  simuler: false,
});

const optionsModes = Object.entries(LIBELLE_MODE_PAIEMENT)
  .filter(([v]) => v === 'MOBILE_MONEY' || v === 'ESPECES')
  .map(([value, label]) => ({ value, label }));
const optionsOperateurs = [
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'MTN_MOMO', label: 'MTN MoMo' },
  { value: 'TELECEL', label: 'Telecel' },
];

const optionsEtudiants = computed(() => tousEtudiants.value);
const preSelectionnee = computed(() => props.etudiant ?? null);

const valide = computed(() => {
  const id = etudiantId.value ?? props.etudiant;
  return !!id && form.value.montant >= 500;
});

function filtrerEtudiants(terme: string, miseAJour: (v: () => EtudiantOption[]) => void) {
  if (!terme) {
    miseAJour(() => tousEtudiants.value);
    return;
  }
  const t = terme.toLowerCase();
  miseAJour(() =>
    tousEtudiants.value.filter(
      (e) =>
        e.matricule.toLowerCase().includes(t) ||
        e.nom.toLowerCase().includes(t) ||
        e.prenom.toLowerCase().includes(t),
    ),
  );
}

async function recharger() {
  const id = etudiantId.value ?? props.etudiant;
  if (!id) return;
  enregistrement.value = true;
  try {
    const payload: Record<string, any> = {
      montant: form.value.montant,
      mode: form.value.mode,
    };
    if (form.value.mode === 'MOBILE_MONEY') {
      payload.operateur = form.value.operateur;
      payload.simuler = form.value.simuler;
    }
    const { data } = await api.post(`/resto/portefeuilles/${id}/recharger`, payload);
    $q.notify({
      type: data.immediat ? 'positive' : 'info',
      message: data.immediat
        ? `Portefeuille crédité : ${data.solde.toLocaleString('fr-FR')} GNF`
        : `Recharge en attente de confirmation (${data.paiement.reference})`,
    });
    emit('rechargee');
    emit('update:modelValue', false);
    void charger(true);
  } finally {
    enregistrement.value = false;
  }
}

onMounted(() => {
  etudiantId.value = props.etudiant ?? null;
  void charger(false);
});

watch(
  () => props.etudiant,
  (v) => {
    if (v) etudiantId.value = v;
  },
);

async function charger(hard = false) {
  if (!hard && tousEtudiants.value.length) return;
  chargementEtudiants.value = true;
  try {
    const { data } = await api.get('/resto/portefeuilles', { params: { all: '1' } });
    tousEtudiants.value = data.data.map((p: any) => ({
      id: p.etudiant.id,
      matricule: p.etudiant.matricule,
      nom: p.etudiant.nom,
      prenom: p.etudiant.prenom,
      solde: p.solde,
      libelle: `${p.etudiant.matricule} — ${p.etudiant.nom} ${p.etudiant.prenom} (${p.solde.toLocaleString('fr-FR')} GNF)`,
    }));
  } finally {
    chargementEtudiants.value = false;
  }
}
</script>

<style scoped lang="scss">
.section-titre {
  display: block;
  margin-bottom: var(--up-1);
}

.note-rechargement {
  display: flex;
  align-items: flex-start;
  gap: var(--up-2);
  color: var(--up-encre-douce);
  font-size: 0.85rem;
  line-height: 1.4;
  margin: var(--up-2) 0 0;

  > .q-icon {
    margin-top: 2px;
  }
}

.note-rechargement--positif {
  color: var(--up-vert, #2e7d32);
}
</style>