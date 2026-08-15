<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 95vw">
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
          <q-select
            v-model="form.inscriptionId"
            :options="optionsInscriptions"
            outlined
            dense
            emit-value
            map-options
            label="Dossier *"
            :loading="chargementInscriptions"
            @update:model-value="remplirDossier"
          />
          <div v-if="dossierChoisi" class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input
                :model-value="dossierChoisi.etudiant ? `${dossierChoisi.etudiant.nom} ${dossierChoisi.etudiant.prenom}` : ''"
                outlined
                dense
                readonly
                label="Étudiant"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                :model-value="`${montantLisible(dossierChoisi.montantFrais)} GNF`"
                outlined
                dense
                readonly
                label="Frais du dossier"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <span class="section-titre">Bénéficiaire</span>
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
              outlined
              dense
              label="Montant (GNF) *"
              :disable="montantVerrouille"
              :hint="montantVerrouille ? 'Montant du dossier' : undefined"
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
          color="primary"
          unelevated
          no-caps
          label="Enregistrer le paiement"
          :loading="enregistrement"
          :disable="!form.montant || !form.mode || !telephoneOuNom"
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
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_INSCRIPTION,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Inscription } from '../types';

const props = defineProps<{
  modelValue: boolean;
  inscriptionId?: string;
  etudiantId?: string;
  montantInitial?: number;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; paye: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const typePaiement = ref<'inscription' | 'libre'>('inscription');
const inscriptions = ref<Inscription[]>([]);
const etudiants = ref<Etudiant[]>([]);
const chargementInscriptions = ref(false);
const rechercheEtudiants = ref(false);

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
const optionsInscriptions = computed(() =>
  inscriptions.value.map((i) => ({
    label: `${i.numero} — ${i.etudiant?.nom} ${i.etudiant?.prenom} (${LIBELLE_STATUT_INSCRIPTION[i.statut] ?? i.statut})`,
    value: i.id,
  })),
);
const optionsEtudiants = computed(() =>
  etudiants.value.map((e) => ({
    label: `${e.matricule} — ${e.nom} ${e.prenom}`,
    value: e.id,
  })),
);

const dossierChoisi = computed(() =>
  inscriptions.value.find((i) => i.id === form.value.inscriptionId) ?? null,
);
const montantVerrouille = computed(
  () => typePaiement.value === 'inscription' && form.value.inscriptionId !== '',
);
const telephoneOuNom = computed(() =>
  form.value.mode === 'MOBILE_MONEY' ? !!form.value.telephone : !!form.value.nomComplet,
);


async function charger() {
  chargementInscriptions.value = true;
  try {
    const { data } = await api.get('/inscriptions', { params: { all: '1' } });
    inscriptions.value = data.data;
  } finally {
    chargementInscriptions.value = false;
  }
  if (form.value.inscriptionId) remplirDossier();
}

function remplirDossier() {
  const dossier = dossierChoisi.value;
  if (!dossier) return;
  form.value.etudiantId = dossier.etudiantId;
  form.value.montant = dossier.montantFrais;
  if (!form.value.motif) form.value.motif = `Frais d’inscription ${dossier.numero}`;
}

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
    etudiants.value = [];
    void charger();
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    await api.post('/paiements', {
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
    $q.notify({ type: 'positive', message: 'Paiement enregistré' });
    emit('paye');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>