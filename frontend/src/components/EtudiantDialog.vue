<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ $t(etudiant ? 'etudiants.dialogForm.editTitle' : 'etudiants.dialogForm.newTitle') }}
      </q-card-section>

      <q-card-section>
        <span class="section-titre">{{ $t('badges.table.columns.identity') }}</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.nom" outlined dense :label="$t('inscriptionPublique.form.step1.nom.label')" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.prenom" outlined dense :label="$t('inscriptionPublique.form.step1.prenom.label')" />
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
              :label="$t('inscriptionPublique.form.step1.sexe.label')"
            />
          </div>
          <div class="col-12 col-sm-8">
            <champ-date v-model="form.dateNaissance" :label="$t('inscriptionPublique.form.step1.dateNaissance.label')" />
          </div>
        </div>

        <q-input
          v-model="form.lieuNaissance"
          outlined
          dense
          :label="$t('inscriptionPublique.form.step1.lieuNaissance.label')"
          class="champ-bloc"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.telephone"
              outlined
              dense
              :label="$t('common.fields.phone')"
              :placeholder="$t('inscriptionPublique.form.step1.telephone.placeholder')"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.email" outlined dense type="email" :label="$t('common.fields.email')" />
          </div>
        </div>

        <q-input
          v-model="form.adresse"
          outlined
          dense
          :label="$t('common.fields.address')"
          class="champ-bloc"
        />

        <span class="section-titre">{{ $t('common.fields.matricule') }}</span>
        <!--
          Le matricule (INE « 2026-0004 ») est attribué par le registre à la
          création et ne se modifie pas : on l'affiche, on ne le saisit pas.
        -->
        <p class="q-mt-sm q-mb-md">
          {{ etudiant?.matricule ?? $t('etudiants.dialogForm.assignedOnSave') }}
        </p>

        <span class="section-titre">{{ $t('affectations.filters.promotion') }}</span>
        <!--
          La promotion se porte par un dossier d'inscription, jamais par la
          fiche : on renvoie vers l'écran qui en a la charge.
        -->
        <div class="plaque etudiant-dialog__renvoi">
          <div class="text-caption">
            <template v-if="promotionActuelle">
              {{ $t('etudiants.dialogForm.currentCohort') }} <strong>{{ promotionActuelle }}</strong>.
            </template>
            <template v-else>{{ $t('etudiants.dialogForm.noCohort') }}</template>
            {{ $t('etudiants.dialogForm.cohortChangeHint') }}
          </div>
          <q-btn
            flat
            dense
            no-caps
            icon="how_to_reg"
            :label="$t(etudiant ? 'etudiants.dialogForm.viewEnrollments' : 'etudiants.dialogForm.openEnrollments')"
            @click="allerAuxInscriptions"
          />
        </div>

        <span class="section-titre">{{ $t('inscriptions.studentDialog.portalAccount') }}</span>
        <q-toggle
          v-model="form.creerCompte"
          :label="$t('etudiants.dialogForm.createPortalAccount')"
        />
        <div v-if="form.creerCompte" class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.emailCompte"
              outlined
              dense
              type="email"
              :label="$t('etudiants.dialogForm.accountEmail')"
              :hint="$t('etudiants.dialogForm.accountEmailHint')"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.motDePasse"
              outlined
              dense
              type="password"
              :label="$t('utilisateurs.dialog.passwordNewAccount')"
              :hint="$t('etudiants.dialogForm.passwordHint')"
              :rules="[
                (v) => !form.creerCompte || (v && v.length >= 8) || $t('etudiants.dialogForm.passwordMinLength'),
              ]"
              lazy-rules
            />
          </div>
        </div>

        <q-toggle v-model="form.actif" :label="$t('etudiants.dialogForm.active')" class="champ-bloc--toggle" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          :label="$t('common.actions.register')"
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
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();
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
    $q.notify({ type: 'positive', message: t('etudiants.dialogForm.saved') });
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
