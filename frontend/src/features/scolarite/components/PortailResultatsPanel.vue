<template>
  <section class="plaque carte-portail carte-portail--resultat">
    <h2 class="pochoir section-titre">{{ $t('common.fields.result') }}</h2>
    <template v-if="finale">
      <div class="carte-portail__resultat-panneau">
        <span class="lettrage carte-portail__resultat-moyenne chiffres" :class="tonResultat(finale.decision)">
          {{ finale.moyenne.toLocaleString(getAppLocale(), { maximumFractionDigits: 2 }) }}
          <span class="carte-portail__resultat-surligne">{{ $t('common.units.outOf20') }}</span>
        </span>
        <q-chip
          :color="finale.decision === 'ADMIS' ? 'positive' : 'negative'"
          text-color="white"
          square
          class="carte-portail__resultat-decision"
        >
          {{ LIBELLE_DECISION_JURY[finale.decision] }}
          <q-tooltip v-if="finale.rang">{{ $t('portail.sections.resultat.rankTooltip') }}</q-tooltip>
        </q-chip>
      </div>
      <p class="carte-portail__resultat-details">
        {{ LIBELLE_SESSION_DELIBERATION[finale.session] }} ·
        {{ finale.promotion }}
        <span v-if="finale.mention"> · {{ finale.mention }}</span>
        <span v-if="finale.rang" class="chiffres">
          · {{ $t('portail.sections.resultat.rank', { rang: finale.rang }) }}</span
        >
      </p>
    </template>
    <p v-else class="carte-portail__aucune">
      {{ $t('portail.sections.resultat.empty') }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * Résultat de délibération de l'étudiant : moyenne, décision et rang.
 *
 * Le composant ne fait aucune requête : la page détient les résultats et
 * passe la ligne finale (absente tant qu'aucune délibération n'est publiée).
 */
import { computed } from 'vue';
import { getAppLocale } from '@/boot/i18n';
import { LIBELLE_DECISION_JURY, LIBELLE_SESSION_DELIBERATION } from '@/shared/utils/libelles';
import type { ResultatsPortail } from '../services/portail';

const props = defineProps<{
  resultats: ResultatsPortail | null;
}>();

/** La délibération retenue : celle qui fait foi. */
const finale = computed(() => props.resultats?.finale ?? null);

function tonResultat(decision: string) {
  return decision === 'ADMIS' ? 'carte-portail__admis' : 'carte-portail__ajourne';
}
</script>

<style scoped lang="scss">
.carte-portail {
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-2);

  .section-titre {
    margin: 0 0 var(--up-2);
  }
}

.carte-portail__aucune {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
}

// ------------------------------------------------------------ résultat
.carte-portail--resultat {
  gap: var(--up-3);
}

.carte-portail__resultat-panneau {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.carte-portail__resultat-moyenne {
  font-size: clamp(2.6rem, 1.8rem + 3.2vw, 4.2rem);
  line-height: 1;
}

.carte-portail__resultat-surligne {
  font-size: 0.45em;
  color: var(--up-encre-douce);
}

.carte-portail__admis {
  color: $vert;
}
.carte-portail__ajourne {
  color: $rouge;
}

.carte-portail__resultat-details {
  margin: 0;
  color: var(--up-encre-douce);
  font-size: 0.92rem;
}
</style>
