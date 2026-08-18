<template>
  <q-dialog v-model="dialogOuvert" persistent>
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">Émettre une attestation</div>
        <div class="text-caption text-grey-7">
          Document officiel vérifiable par QR code — la même année, le même
          type et le même étudiant ne donnent qu'une attestation active.
        </div>
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Étudiant</span>
        <q-select
          v-model="form.etudiantId"
          :options="optionsEtudiants"
          use-input
          input-debounce="300"
          outlined
          dense
          clearable
          autofocus
          emit-value
          map-options
          label="Étudiant *"
          option-label="label"
          option-value="value"
          hint="Tapez au moins 2 lettres : nom, prénom ou matricule"
          :loading="rechercheEtudiants"
          @filter="filtrerEtudiants"
        >
          <template #no-option>
            <q-item><q-item-section class="text-grey-7">Aucun étudiant trouvé</q-item-section></q-item>
          </template>
        </q-select>

        <span class="section-titre q-mt-md">Document</span>
        <q-select
          v-model="form.type"
          :options="optionsTypes"
          outlined
          dense
          emit-value
          map-options
          label="Type d'attestation *"
        />
        <q-input
          v-model="form.motif"
          outlined
          dense
          type="textarea"
          rows="2"
          label="Motif (bourse, banque, passeport…)"
        />

        <span class="section-titre q-mt-md">Rattachement</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.anneeId"
              :options="optionsAnnees"
              outlined
              dense
              emit-value
              map-options
              clearable
              label="Année académique"
              @update:model-value="chargerInscriptions"
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
              clearable
              label="Promotion"
            />
          </div>
        </div>
        <q-select
          v-if="optionsInscriptions.length"
          v-model="form.inscriptionId"
          :options="optionsInscriptions"
          outlined
          dense
          emit-value
          map-options
          clearable
          label="Inscription liée (facultatif)"
          hint="Précise le parcours exact de l'étudiant"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="qr_code_2"
          label="Émettre"
          :disable="!formulaireValide"
          :loading="enregistrement"
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
import { LIBELLE_TYPE_ATTESTATION } from '../utils/libelles';
import type { AnneeAcademique, Etudiant, Inscription, Promotion } from '../types';

const $q = useQuasar();
const emit = defineEmits<{ enregistre: [] }>();

/**
 * `prefill` permet à un autre écran (un bulletin ADMIS, par exemple) d'ouvrir
 * l'émission déjà renseignée : l'opérateur n'a plus qu'à vérifier et valider.
 */
const props = defineProps<{
  prefill?: Record<string, string> | null;
}>();

const dialogOuvert = defineModel<boolean>({ default: false });

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const inscriptions = ref<Inscription[]>([]);
const etudiants = ref<Etudiant[]>([]);
const optionsEtudiants = ref<Array<{ label: string; value: string }>>([]);
const rechercheEtudiants = ref(false);

const form = ref({
  etudiantId: null as string | null,
  type: null as string | null,
  motif: '',
  anneeId: null as string | null,
  promotionId: null as string | null,
  inscriptionId: null as string | null,
});

const optionsTypes = computed(() =>
  Object.entries(LIBELLE_TYPE_ATTESTATION).map(([value, label]) => ({ value, label })),
);
const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: `${a.libelle}${a.active ? ' (en cours)' : ''}`, value: a.id })),
);
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !form.value.anneeId || p.anneeId === form.value.anneeId)
    .map((p) => ({ label: `${p.nom}${p.filiere ? ` — ${p.filiere.nom}` : ''}`, value: p.id })),
);
const optionsInscriptions = computed(() =>
  inscriptions.value.map((i) => ({
    label: `${i.numero} — ${i.annee?.libelle ?? ''} ${i.promotion?.nom ?? ''}`,
    value: i.id,
  })),
);

const formulaireValide = computed(
  () => !!form.value.etudiantId && !!form.value.type,
);

const enregistrement = ref(false);

function reinitialiser() {
  form.value = {
    etudiantId: null,
    type: null,
    motif: '',
    anneeId: null,
    promotionId: null,
    inscriptionId: null,
  };
}

/** Saisie de l'étudiant : recherche serveur, même mécanique que les filtres. */
async function filtrerEtudiants(texte: string, maj: (cb: () => void) => void) {
  rechercheEtudiants.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: { search: texte ?? '', all: '1' },
    });
    etudiants.value = Array.isArray(data.data) ? data.data : [];
    optionsEtudiants.value = etudiants.value.map((e) => ({
      label: `${e.nom} ${e.prenom} — ${e.matricule}`,
      value: e.id,
    }));
    maj(() => {});
  } catch {
    optionsEtudiants.value = [];
    maj(() => {});
  } finally {
    rechercheEtudiants.value = false;
  }
}

/** L'inscription éventuelle de l'étudiant pour l'année choisie, sans bloquer l'émission. */
async function chargerInscriptions() {
  form.value.inscriptionId = null;
  inscriptions.value = [];
  if (!form.value.etudiantId || !form.value.anneeId) return;
  try {
    const { data } = await api.get('/inscriptions', {
      params: { etudiantId: form.value.etudiantId, anneeId: form.value.anneeId, all: '1' },
    });
    inscriptions.value = Array.isArray(data.data) ? data.data : [];
  } catch {
    inscriptions.value = [];
  }
}

watch(
  () => form.value.etudiantId,
  () => chargerInscriptions(),
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      type: form.value.type,
      etudiantId: form.value.etudiantId,
      motif: form.value.motif || undefined,
      anneeId: form.value.anneeId || undefined,
      promotionId: form.value.promotionId || undefined,
      inscriptionId: form.value.inscriptionId || undefined,
    };
    await api.post('/attestations', payload);
    $q.notify({ type: 'positive', message: "Attestation émise — pensez à l'imprimer avec son QR" });
    dialogOuvert.value = false;
    emit('enregistre');
  } finally {
    enregistrement.value = false;
  }
}

watch(dialogOuvert, (ouvert) => {
  if (ouvert) {
    reinitialiser();
    void chargerReferentiels().then(appliquerPrefill);
  }
});

/**
 * Le sélecteur d'étudiant travaille sur une recherche serveur : pour un
 * préremplissage par identifiant, on charge la fiche afin d'afficher un nom
 * plutôt qu'un identifiant technique.
 */
async function appliquerPrefill() {
  const p = props.prefill;
  if (!p) return;
  if (p.type) form.value.type = p.type;
  if (p.anneeId) form.value.anneeId = p.anneeId;
  if (p.promotionId) form.value.promotionId = p.promotionId;
  if (p.etudiantId) {
    form.value.etudiantId = p.etudiantId;
    try {
      const { data } = await api.get(`/etudiants/${p.etudiantId}`);
      optionsEtudiants.value = [
        { label: `${data.nom} ${data.prenom} — ${data.matricule}`, value: data.id },
      ];
    } catch {
      optionsEtudiants.value = [];
    }
    await chargerInscriptions();
  }
}

async function chargerReferentiels() {
  const [rAnnees, rPromotions] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = rAnnees.data.data;
  promotions.value = rPromotions.data.data;
  const active = (await api.get('/annees/active').catch(() => null))?.data as
    | AnneeAcademique
    | null
    | undefined;
  if (active?.id) {
    form.value.anneeId = active.id;
    if (!optionsPromotions.value.length && promotions.value.some((p) => p.anneeId === active.id)) {
      form.value.promotionId = null;
    }
  }
}
</script>