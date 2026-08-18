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
        <!--
          Le matricule (INE « 2026-0004 ») est attribué par le registre à la
          création et ne se modifie pas : on l'affiche, on ne le saisit pas.
        -->
        <q-input
          :model-value="etudiant?.matricule ?? 'Attribué à l’enregistrement'"
          outlined
          dense
          readonly
          label="Matricule (INE)"
          :hint="
            etudiant
              ? 'Attribué par le registre, non modifiable'
              : 'Numéro séquentiel généré automatiquement à l’enregistrement'
          "
        >
          <template #prepend><q-icon name="badge" /></template>
        </q-input>

        <span class="section-titre">Promotion</span>
        <!--
          La promotion se porte par un dossier d'inscription, jamais par la
          fiche : on renvoie vers l'écran qui en a la charge.
        -->
        <div class="plaque etudiant-dialog__renvoi">
          <div class="text-caption">
            <template v-if="promotionActuelle">
              Promotion actuelle : <strong>{{ promotionActuelle }}</strong>.
            </template>
            <template v-else>Aucune inscription : l’étudiant n’est rattaché à aucune promotion.</template>
            La promotion se change en ouvrant un dossier d’inscription.
          </div>
          <q-btn
            flat
            dense
            no-caps
            icon="how_to_reg"
            :label="etudiant ? 'Voir ses inscriptions' : 'Ouvrir les inscriptions'"
            @click="allerAuxInscriptions"
          />
        </div>

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
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';
import type { Etudiant, Promotion } from '../types';

interface EtudiantAvecInscriptions extends Etudiant {
  inscriptions?: { promotionId?: string; promotion?: Promotion | null }[];
}

const props = defineProps<{
  modelValue: boolean;
  etudiant?: Etudiant | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const router = useRouter();
const enregistrement = ref(false);

/** Promotion portée par le dernier dossier — lecture seule, pour information. */
const promotionActuelle = computed(() => {
  const e = props.etudiant as EtudiantAvecInscriptions | null;
  return e?.inscriptions?.[0]?.promotion?.nom ?? null;
});

function allerAuxInscriptions() {
  emit('update:modelValue', false);
  void router.push({
    path: '/inscriptions',
    ...(props.etudiant ? { query: { etudiant: props.etudiant.id } } : {}),
  });
}

const form = ref({
  nom: '',
  prenom: '',
  sexe: null as string | null,
  dateNaissance: '',
  lieuNaissance: '',
  telephone: '',
  email: '',
  adresse: '',
  actif: true,
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
    form.value = {
      nom: e?.nom ?? '',
      prenom: e?.prenom ?? '',
      sexe: e?.sexe ?? null,
      dateNaissance: e?.dateNaissance ? String(e.dateNaissance).slice(0, 10) : '',
      lieuNaissance: e?.lieuNaissance ?? '',
      telephone: e?.telephone ?? '',
      email: e?.email ?? '',
      adresse: e?.adresse ?? '',
      actif: e?.actif ?? true,
      creerCompte: false,
      emailCompte: '',
      motDePasse: '',
    };
  },
);

async function enregistrer() {
  if (!formulaireValide.value) return;
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
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

<style scoped lang="scss">
// Renvoi vers l'écran qui porte réellement la donnée.
.etudiant-dialog__renvoi {
  padding: var(--up-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}
</style>
