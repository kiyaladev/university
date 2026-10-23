<template>
  <!--
    Étape 3 du dossier public : le récépissé. Le numéro court de paiement et
    le montant sont repris tels que l'API les a rendus.
  -->
  <div class="acces__resultat">
    <div class="acces__resultat-tampon" aria-hidden="true">
      <span class="pochoir">{{ $t('inscriptionPublique.form.step3.stampFolder') }}</span>
      <span class="lettrage">{{ $t('inscriptionPublique.form.step3.stampDone') }}</span>
    </div>

    <p class="pochoir acces__resultat-ref">{{ $t('inscriptionPublique.form.step3.numeroLabel') }}</p>
    <p class="lettrage chiffres acces__resultat-numero">{{ resultat?.numero }}</p>
    <p class="pochoir acces__aide">
      {{ $t('inscriptionPublique.form.step3.numeroHelp') }}
    </p>

    <div class="plaque acces__resultat-montant">
      <div class="text-caption acces__resultat-libelle">{{ $t('inscriptionPublique.form.step3.fraisLabel') }}</div>
      <div class="lettrage chiffres acces__resultat-somme">
        {{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}
      </div>
    </div>

    <p class="acces__resultat-message">
      <i18n-t keypath="inscriptionPublique.form.step3.message" tag="span">
        <template #montant
          ><strong class="chiffres"
            >{{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}</strong
          ></template
        >
        <template #numero
          ><strong class="chiffres">{{ numeroCourtMm }}</strong></template
        >
        <template #ref
          ><strong>{{ resultat?.numero }}</strong></template
        >
      </i18n-t>
    </p>

    <q-banner v-if="resultat?.avertissement" class="note--alerte">
      <template #avatar><q-icon name="warning" /></template>
      {{ resultat.avertissement }}
    </q-banner>

    <div class="acces__resultat-actions">
      <q-btn
        color="primary"
        class="acces__bouton"
        size="lg"
        unelevated
        no-caps
        icon="print"
        :label="$t('inscriptionPublique.form.step3.print')"
        @click="emit('imprimer')"
      />
      <q-btn
        outline
        class="acces__bouton"
        size="lg"
        no-caps
        icon="person_add"
        :label="$t('inscriptionPublique.form.step3.another')"
        @click="emit('recommencer')"
      />
    </div>

    <p class="pochoir acces__resultat-lien">
      {{ $t('inscriptionPublique.form.step3.validatedIntro') }}
      <router-link to="/portail-connexion" class="acces__lien-lien">
        {{ $t('inscriptionPublique.form.step3.enterSpace') }}
      </router-link>
    </p>
  </div>
</template>

<script setup lang="ts">
import { montantLisible } from '@/shared/utils/libelles';
import type { ResultatDepot } from '@/features/public/services/inscription-publique';

defineProps<{
  resultat: ResultatDepot | null;
  /** Numéro court institutionnel qui encaisse le paiement des frais. */
  numeroCourtMm: string;
}>();

const emit = defineEmits<{ imprimer: []; recommencer: [] }>();
</script>

<style scoped lang="scss">
@use '@/css/quasar.variables' as *;

.acces__resultat {
  display: grid;
  gap: var(--up-4);
}

.acces__resultat-tampon {
  display: inline-flex;
  align-items: center;
  gap: var(--up-2);
  align-self: start;
  background: $vert-fond;
  color: #{$vert};
  border-radius: var(--up-pilule);
  padding: var(--up-2) var(--up-3);
}

.acces__resultat-ref {
  color: var(--up-encre-douce);
  margin: 0;
}

.acces__resultat-numero {
  font-size: clamp(1.8rem, 1.2rem + 2.2vw, 2.6rem);
  margin: 0;
}

.acces__resultat-montant {
  padding: var(--up-4);
  display: grid;
  gap: var(--up-2);
}

.acces__resultat-libelle {
  color: var(--up-encre-douce);
  letter-spacing: -0.01em;
}

.acces__resultat-somme {
  font-size: clamp(1.6rem, 1rem + 2vw, 2.4rem);
  color: $vert;
}

.acces__resultat-message {
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0;
  max-width: 46ch;
}

.acces__resultat-actions {
  display: grid;
  gap: var(--up-2);
}

.acces__resultat-lien {
  margin: 0;
}

.acces__aide {
  color: var(--up-encre-douce);
  margin: -4px 0 0;
}

.acces__bouton {
  min-height: 56px;
}

.acces__lien-lien {
  color: var(--up-encre-douce);
  text-decoration: none;

  &:hover,
  &:focus-visible {
    color: var(--up-encre);
    text-decoration: underline;
  }
}

// Le récépissé imprimé ne porte pas les boutons d'action.
@media print {
  .acces__resultat-actions {
    display: none;
  }
}
</style>
