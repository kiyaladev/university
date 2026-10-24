<template>
  <!--
    Étape 1 du dossier public : l'identité du candidat. Le formulaire est
    validé par les règles portées par les champs ; la page n'a plus qu'à
    passer à l'étape suivante.
  -->
  <q-form class="acces__form" @submit.prevent="emit('continue')">
    <span class="section-titre">{{ $t('inscriptionPublique.form.step1.sectionTitle') }}</span>
    <p class="pochoir acces__aide">
      {{ $t('inscriptionPublique.form.step1.help') }}
    </p>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.nom"
          outlined
          dense
          autocomplete="family-name"
          :label="$t('inscriptionPublique.form.step1.nom.label')"
          :rules="[(v) => !!v?.trim() || $t('inscriptionPublique.form.step1.nom.required')]"
          lazy-rules
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.prenom"
          outlined
          dense
          autocomplete="given-name"
          :label="$t('inscriptionPublique.form.step1.prenom.label')"
          :rules="[(v) => !!v?.trim() || $t('inscriptionPublique.form.step1.prenom.required')]"
          lazy-rules
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-4">
        <q-select
          v-model="form.sexe"
          :options="optionsSexe"
          emit-value
          map-options
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

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.lieuNaissance"
          outlined
          dense
          :label="$t('inscriptionPublique.form.step1.lieuNaissance.label')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.telephone"
          outlined
          dense
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          :label="$t('inscriptionPublique.form.step1.telephone.label')"
          :placeholder="$t('inscriptionPublique.form.step1.telephone.placeholder')"
          :hint="$t('inscriptionPublique.form.step1.telephone.hint')"
          :rules="[
            (v) => !!v?.trim() || $t('inscriptionPublique.form.step1.telephone.required'),
            (v) => !v || v.replace(/\D/g, '').length >= 8 || $t('inscriptionPublique.form.step1.telephone.minLength'),
          ]"
          lazy-rules
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.email"
          outlined
          dense
          type="email"
          autocomplete="email"
          :label="$t('inscriptionPublique.form.step1.email.label')"
          :rules="[
            (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || $t('inscriptionPublique.form.step1.email.invalid'),
          ]"
          lazy-rules
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.adresse"
          outlined
          dense
          autocomplete="street-address"
          :label="$t('inscriptionPublique.form.step1.adresse.label')"
        />
      </div>
    </div>

    <q-btn
      type="submit"
      color="primary"
      class="full-width acces__bouton"
      size="lg"
      unelevated
      no-caps
      :label="$t('inscriptionPublique.form.step1.continue')"
    />
  </q-form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ChampDate from '@/shared/components/ChampDate.vue';
import type { FormulaireInscription } from '@/features/public/services/inscription-publique';

/** Identité du candidat : le formulaire est porté par la page, pas dupliqué ici. */
const form = defineModel<FormulaireInscription>('form', { required: true });

const emit = defineEmits<{ continue: [] }>();

const { t } = useI18n();

const optionsSexe = computed(() => [
  { value: 'M', label: t('inscriptionPublique.form.step1.sexe.masculin') },
  { value: 'F', label: t('inscriptionPublique.form.step1.sexe.feminin') },
]);
</script>

<style scoped lang="scss">
.acces__form {
  display: grid;
  gap: var(--up-3);
}

.acces__aide {
  color: var(--up-encre-douce);
  margin: -4px 0 0;
}

.acces__bouton {
  min-height: 56px;
}
</style>
