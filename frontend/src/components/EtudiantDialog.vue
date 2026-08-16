<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ etudiant ? 'Modifier l’étudiant' : 'Nouvel étudiant' }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Identité</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.nom" outlined dense label="Nom *" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.prenom" outlined dense label="Prénom *" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="form.sexe"
              :options="['M', 'F']"
              outlined
              dense
              clearable
              label="Sexe"
            />
          </div>
          <div class="col-12 col-sm-8">
            <champ-date v-model="form.dateNaissance" label="Date de naissance" />
          </div>
        </div>

        <q-input
          v-model="form.lieuNaissance"
          outlined
          dense
          label="Lieu de naissance"
          class="champ-bloc"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.telephone"
              outlined
              dense
              label="Téléphone"
              placeholder="622 00 00 00"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.email" outlined dense type="email" label="Adresse e-mail" />
          </div>
        </div>

        <q-input
          v-model="form.adresse"
          outlined
          dense
          label="Adresse"
          class="champ-bloc"
        />

        <span class="section-titre">Matricule</span>
        <div class="row q-col-gutter-md items-center">
          <div class="col-12 col-sm-8">
            <q-input
              v-model="form.matricule"
              outlined
              dense
              label="Matricule"
              :hint="etudiant ? 'Vide = conserver le matricule existant' : 'Laissez vide pour générer automatiquement'"
            >
              <template #prepend><q-icon name="badge" /></template>
            </q-input>
          </div>
          <div class="col-12 col-sm-4">
            <q-btn
              outline
              color="primary"
              no-caps
              icon="auto_fix_high"
              label="Générer"
              class="full-width"
              :loading="generationMatricule"
              :disable="!!etudiant"
              @click="genererMatricule"
            />
          </div>
        </div>

        <span class="section-titre">Promotion actuelle</span>
        <autocomplete-async
          v-model="form.promotionActuelleId"
          endpoint="/promotions"
          :label-fn="(p) => p.nom"
          label="Promotion actuelle (optionnel)"
          placeholder="Filière / niveau de l'étudiant"
          clearable
        />

        <span class="section-titre">Compte portail</span>
        <q-toggle
          v-model="form.creerCompte"
          label="Créer aussi le compte de connexion (portail étudiant)"
        />
        <div v-if="form.creerCompte" class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.emailCompte"
              outlined
              dense
              type="email"
              label="E-mail du compte *"
              hint="À défaut, l’e-mail de la fiche est utilisé"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.motDePasse"
              outlined
              dense
              type="password"
              label="Mot de passe *"
              hint="8 caractères au minimum"
              :rules="[
                (v) => !form.creerCompte || (v && v.length >= 8) || '8 caractères minimum',
              ]"
              lazy-rules
            />
          </div>
        </div>

        <q-toggle v-model="form.actif" label="Étudiant actif" class="champ-bloc--toggle" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          label="Enregistrer"
          :loading="enregistrement"
          :disable="!formulaireValide"
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
import ChampDate from './ChampDate.vue';
import AutocompleteAsync from './AutocompleteAsync.vue';
import type { Etudiant } from '../types';

interface EtudiantAvecInscriptions extends Etudiant {
  inscriptions?: { promotionId?: string }[];
}

const props = defineProps<{
  modelValue: boolean;
  etudiant?: Etudiant | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const generationMatricule = ref(false);

const PREFIXE_MATRICULE = `${new Date().getFullYear()}-`;

const form = ref({
  matricule: '',
  nom: '',
  prenom: '',
  sexe: null as string | null,
  dateNaissance: '',
  lieuNaissance: '',
  telephone: '',
  email: '',
  adresse: '',
  actif: true,
  promotionActuelleId: null as string | null,
  creerCompte: false,
  emailCompte: '',
  motDePasse: '',
});

const formulaireValide = computed(
  () => !!form.value.nom.trim() && !!form.value.prenom.trim() && (!form.value.creerCompte || form.value.motDePasse.length >= 8),
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const e = props.etudiant as EtudiantAvecInscriptions | null;
    const derniere = e?.inscriptions?.[0] ?? null;
    form.value = {
      matricule: e?.matricule ?? '',
      nom: e?.nom ?? '',
      prenom: e?.prenom ?? '',
      sexe: e?.sexe ?? null,
      dateNaissance: e?.dateNaissance ? String(e.dateNaissance).slice(0, 10) : '',
      lieuNaissance: e?.lieuNaissance ?? '',
      telephone: e?.telephone ?? '',
      email: e?.email ?? '',
      adresse: e?.adresse ?? '',
      actif: e?.actif ?? true,
      promotionActuelleId: derniere?.promotionId ?? null,
      creerCompte: false,
      emailCompte: '',
      motDePasse: '',
    };
  },
);

/**
 * Génère un matricule. Tente d'abord l'endpoint `/etudiants/prochain-matricule`
 * (utile si l'université l'active); sinon, retombe sur une lecture locale des
 * matricules déjà chargés.
 */
async function genererMatricule() {
  generationMatricule.value = true;
  try {
    try {
      const { data } = await api.get('/etudiants/prochain-matricule');
      const m = typeof data === 'string' ? data : data?.matricule;
      if (m) {
        form.value.matricule = String(m);
        return;
      }
    } catch {
      /* endpoint absent : on retombe sur le calcul local */
    }
    form.value.matricule = await prochainMatriculeLocal();
  } finally {
    generationMatricule.value = false;
  }
}

/** Calcule un matricule « AAAA-NNNN » à partir des étudiants déjà connus. */
async function prochainMatriculeLocal(): Promise<string> {
  try {
    const { data } = await api.get('/etudiants', { params: { all: '1', pageSize: 1000 } });
    const liste: Etudiant[] = Array.isArray(data) ? data : data?.data ?? [];
    const existants = liste
      .map((e) => e.matricule)
      .filter((m) => m?.startsWith(PREFIXE_MATRICULE))
      .map((m) => Number(m.slice(PREFIXE_MATRICULE.length)))
      .filter((n) => Number.isFinite(n));
    const next = (existants.length ? Math.max(...existants) : 0) + 1;
    return `${PREFIXE_MATRICULE}${String(next).padStart(4, '0')}`;
  } catch {
    return `${PREFIXE_MATRICULE}0001`;
  }
}

async function enregistrer() {
  if (!formulaireValide.value) return;
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      matricule: form.value.matricule || undefined,
      nom: form.value.nom,
      prenom: form.value.prenom,
      sexe: form.value.sexe ?? undefined,
      dateNaissance: form.value.dateNaissance || undefined,
      lieuNaissance: form.value.lieuNaissance || undefined,
      telephone: form.value.telephone || undefined,
      email: form.value.email || undefined,
      adresse: form.value.adresse || undefined,
      actif: form.value.actif,
    };
    if (form.value.creerCompte) {
      payload.creerCompte = true;
      payload.motDePasse = form.value.motDePasse || undefined;
      if (form.value.emailCompte) payload.email = form.value.emailCompte;
    }
    if (props.etudiant) await api.put(`/etudiants/${props.etudiant.id}`, payload);
    else await api.post('/etudiants', payload);
    $q.notify({ type: 'positive', message: 'Étudiant enregistré' });
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
