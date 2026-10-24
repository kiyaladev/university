<template>
  <!--
    Étape 2 du dossier public : le choix de la promotion. Le tarif dépend de
    l'année et de la promotion : la page le charge et le transmet.
  -->
  <q-form class="acces__form" @submit.prevent="emit('deposer')">
    <span class="section-titre">{{ $t('inscriptionPublique.form.step2.sectionTitle') }}</span>
    <q-banner v-if="chargementAnnees" class="note--info">
      <template #avatar><q-spinner size="20px" /></template>
      {{ $t('inscriptionPublique.form.step2.loadingFilieres') }}
    </q-banner>

    <template v-else>
      <champ-recherche
        v-model="form.anneeId"
        :endpoint="CHEMIN_ANNEES"
        :endpoint-detail="false"
        :libelle-initial="libelleAnneeCourante"
        :label-fn="(a: AnneeAcademique) => a.libelle"
        :label="$t('common.fields.academicYearRequired')"
        :disable="annees.length <= 1"
        @update:model-value="emit('annee-change')"
      />
      <champ-recherche
        v-model="form.promotionId"
        :endpoint="endpointPromotions"
        :label-fn="labelPromotion"
        :disable="!form.anneeId"
        :preload="false"
        :label="$t('inscriptionPublique.form.step2.promotionLabel')"
        :placeholder="$t('inscriptionPublique.form.step2.promotionPlaceholder')"
        @update:model-value="emit('promotion-change')"
      />

      <div v-if="tarifCourant" class="plaque acces__tarif">
        <div class="text-caption acces__tarif-libelle">{{ $t('inscriptionPublique.form.step2.tarifLabel') }}</div>
        <div class="lettrage chiffres acces__tarif-montant">
          {{ montantLisible(tarifCourant.montant) }} {{ tarifCourant.devise }}
        </div>
      </div>
      <div v-else-if="form.promotionId && chargementTarif" class="text-caption text-grey-7">
        <q-spinner size="16px" class="q-mr-xs" />
        {{ $t('inscriptionPublique.form.step2.checkingTarif') }}
      </div>
    </template>

    <q-banner v-if="messageDepotErreur" class="note--erreur" role="alert" aria-live="assertive">
      <template #avatar><q-icon name="error" /></template>
      {{ messageDepotErreur }}
    </q-banner>

    <p v-if="!chargementAnnees && !form.promotionId" class="pochoir acces__aide">
      {{ $t('inscriptionPublique.form.step2.chooseHelp') }}
    </p>

    <div class="row q-col-gutter-sm">
      <div class="col-6">
        <q-btn
          outline
          class="full-width acces__bouton"
          size="lg"
          no-caps
          icon="chevron_left"
          :label="$t('inscriptionPublique.form.step2.back')"
          @click="emit('retour')"
        />
      </div>
      <div class="col-6">
        <q-btn
          type="submit"
          color="primary"
          class="full-width acces__bouton"
          size="lg"
          unelevated
          no-caps
          :label="$t('inscriptionPublique.form.step2.submit')"
          :loading="depotEnCours"
          :disable="!form.promotionId"
        />
      </div>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import { montantLisible } from '@/shared/utils/libelles';
import type { AnneeAcademique } from '@/types';
import {
  CHEMIN_ANNEES,
  cheminPromotions,
  type FormulaireInscription,
  type PromotionOuverte,
} from '@/features/public/services/inscription-publique';

const form = defineModel<FormulaireInscription>('form', { required: true });

const props = defineProps<{
  annees: AnneeAcademique[];
  chargementAnnees: boolean;
  tarifCourant: { montant: number; devise: string } | null;
  chargementTarif: boolean;
  messageDepotErreur: string;
  depotEnCours: boolean;
}>();

const emit = defineEmits<{
  'annee-change': [];
  'promotion-change': [];
  deposer: [];
  retour: [];
}>();

const { t } = useI18n();

/** Les promotions de l'année retenue. */
const endpointPromotions = computed(() => cheminPromotions(form.value.anneeId));

/**
 * Libellé de l'année retenue. La route publique des années n'a pas de variante
 * par identifiant : c'est la page qui connaît l'année, elle en donne le
 * libellé au sélecteur.
 */
const libelleAnneeCourante = computed(() => props.annees.find((a) => a.id === form.value.anneeId)?.libelle ?? '');

const labelPromotion = (p: PromotionOuverte) =>
  `${p.filiere ? p.filiere.nom + ' — ' : ''}${p.nom}${
    p.frais
      ? ` (${t('inscriptionPublique.form.step2.fraisLabel', { montant: montantLisible(p.frais.montant), devise: p.frais.devise })})`
      : ''
  }`;
</script>

<style scoped lang="scss">
@use '@/css/quasar.variables' as *;

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

.acces__tarif {
  padding: var(--up-3) var(--up-4);
  display: grid;
  gap: var(--up-1);
}

.acces__tarif-libelle {
  color: var(--up-encre-douce);
  letter-spacing: -0.01em;
}

.acces__tarif-montant {
  font-size: 1.4rem;
  color: $vert;
}
</style>
