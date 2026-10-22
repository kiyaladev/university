<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('resto.rechargeDialog.title')"
    :libelle-valider="$t('common.actions.reload')"
    :envoi="enregistrement"
    :desactive="!valide"
    @valider="recharger"
  >
    <span class="section-titre">{{ $t('common.fields.student') }}</span>
    <q-select
      v-model="etudiantId"
      :options="optionsEtudiants"
      option-value="id"
      option-label="libelle"
      emit-value
      map-options
      :label="$t('resto.rechargeDialog.student')"
      outlined
      dense
      use-input
      input-debounce="300"
      clearable
      :disable="!!etudiant"
      :loading="chargementEtudiants"
      @filter="filtrerEtudiants"
    >
      <template #no-option>
        <q-item><q-item-section class="text-grey-7">{{ $t('resto.rechargeDialog.noWallet') }}</q-item-section></q-item>
      </template>
    </q-select>

    <span class="section-titre q-mt-md">{{ $t('resto.rechargeDialog.sectionTitle') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-6">
        <q-input
          v-model.number="form.montant"
          type="number"
          min="500"
          step="500"
          outlined
          dense
          :label="$t('resto.rechargeDialog.amount')"
          suffix="GNF"
          :rules="[(v: number) => v >= 500 || $t('common.messages.errors.range')]"
        />
      </div>
      <div class="col-6">
        <q-select
          v-model="form.mode"
          :options="optionsModes"
          emit-value
          map-options
          :label="$t('resto.rechargeDialog.mode')"
          outlined
          dense
        />
      </div>
    </div>

    <template v-if="form.mode === 'MOBILE_MONEY'">
      <q-select
        v-model="form.operateur"
        :options="optionsOperateurs"
        emit-value
        map-options
        :label="$t('examens.scansTable.columns.operator')"
        outlined
        dense
        class="q-mt-md"
      />
      <q-toggle v-model="form.simuler" :label="$t('resto.rechargeDialog.confirmImmediately')" class="q-mt-sm" />
      <p class="note-rechargement">
        <q-icon name="info" size="15px" />
        <span>{{ $t('resto.rechargeDialog.mobileMoneyNote') }}</span>
      </p>
    </template>
    <p v-else class="note-rechargement note-rechargement--positif">
      <q-icon name="payments" size="15px" />
      <span>{{ $t('resto.rechargeDialog.cashNote') }}</span>
    </p>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { LIBELLE_MODE_PAIEMENT } from '../utils/libelles';

interface EtudiantOption {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  solde: number;
  libelle: string;
}

/**
 * Recharge d'un portefeuille. Les selects rendent la valeur (`emit-value`) :
 * sans cela l'objet option entier partait dans l'URL et dans `mode`.
 */
const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  /** Étudiant pré-sélectionné (bouton « Recharger » d'une ligne du tableau). */
  etudiant?: string | null;
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const chargementEtudiants = ref(false);
const etudiantId = ref<string | null>(null);
const tousEtudiants = ref<EtudiantOption[]>([]);
const optionsEtudiants = ref<EtudiantOption[]>([]);

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

const valide = computed(() => !!(etudiantId.value ?? props.etudiant) && form.value.montant >= 500);

function filtrerEtudiants(terme: string, miseAJour: (fn: () => void) => void) {
  miseAJour(() => {
    const q = terme.toLowerCase();
    optionsEtudiants.value = !q
      ? tousEtudiants.value
      : tousEtudiants.value.filter(
          (e) =>
            e.matricule.toLowerCase().includes(q) ||
            e.nom.toLowerCase().includes(q) ||
            e.prenom.toLowerCase().includes(q),
        );
  });
}

async function recharger() {
  const id = etudiantId.value ?? props.etudiant;
  if (!id) return;
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
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
        ? t('resto.rechargeDialog.messages.credited', { balance: data.solde.toLocaleString('fr-FR') })
        : t('resto.rechargeDialog.messages.pending', { reference: data.paiement.reference }),
    });
    emit('enregistre');
    ouvert.value = false;
    void charger(true);
  } catch {
    /* l'intercepteur axios affiche le motif */
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
    etudiantId.value = v ?? null;
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
    optionsEtudiants.value = tousEtudiants.value;
  } catch {
    /* l'intercepteur axios affiche le motif */
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
  color: var(--up-vert, #027a0b);
}
</style>
