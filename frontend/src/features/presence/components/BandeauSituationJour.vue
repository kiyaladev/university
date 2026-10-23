<template>
  <!-- Situation du jour : ce que la tournée a déjà couvert -->
  <section class="bandeau jour">
    <div class="jour__etat">
      <p class="pochoir jour__mention">{{ $t('dashboard.today.mention', { date: dateLisible(jour?.date) }) }}</p>
      <p class="lettrage jour__compte chiffres">
        {{ jour?.controlees ?? 0 }}<span class="jour__sur">/{{ jour?.planifiees ?? 0 }}</span>
      </p>
      <p class="pochoir jour__legende">{{ $t('dashboard.today.legend') }}</p>
    </div>

    <div
      class="jour__jauge"
      role="img"
      :aria-label="$t('dashboard.gauge.coverageAria', { percent: pourcentLisible(jour?.tauxControle) })"
    >
      <div class="jour__jauge-remplie se-peint" :style="{ width: `${jour?.tauxControle ?? 0}%` }" />
      <span class="pochoir jour__taux chiffres">{{
        $t('dashboard.gauge.coverageLabel', { percent: pourcentLisible(jour?.tauxControle) })
      }}</span>
    </div>

    <q-btn
      v-if="peutPointer"
      unelevated
      no-caps
      color="primary"
      icon="fact_check"
      :label="$t('dashboard.actions.goToRounds')"
      to="/controle"
    />
    <q-btn
      v-if="peutPointer"
      outline
      no-caps
      icon="offline_pin"
      :label="$t('dashboard.actions.prepareRound')"
      :loading="preparationEnCours"
      @click="emit('preparerTournee')"
    />
    <q-chip v-if="tourneePrepareeLe" dense icon="cloud_done" role="status">
      {{ $t('dashboard.actions.preparedAt', { time: heurePreparation }) }}
    </q-chip>
    <q-btn
      v-else
      unelevated
      no-caps
      color="primary"
      icon="event_note"
      :label="$t('dashboard.actions.viewSessionsRegistry')"
      :to="lienSeancesJour"
    />
  </section>
</template>

<script setup lang="ts">
import { dateLisible, pourcentLisible } from '@/shared/utils/libelles';
import type { JourneeRapport } from '../services/rapports';

/**
 * Situation du jour : ce que la tournée a déjà couvert, et ce qu'il reste à
 * couvrir. Le bandeau prépare aussi la tournée pour le hors-ligne.
 */
defineProps<{
  jour: JourneeRapport | null;
  peutPointer: boolean;
  preparationEnCours: boolean;
  tourneePrepareeLe: string | null;
  heurePreparation: string;
  lienSeancesJour: { name: string; query: Record<string, string> };
}>();
const emit = defineEmits<{ preparerTournee: [] }>();
</script>

<style scoped lang="scss">
.jour {
  display: flex;
  align-items: center;
  gap: var(--up-4);
  padding: var(--up-4);
  margin-bottom: var(--up-3);
  flex-wrap: wrap;
}

.jour__mention {
  color: var(--up-encre-douce);
}

.jour__compte {
  font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem);
  color: var(--up-encre);
  margin: 2px 0 0;
}

.jour__sur {
  font-size: 0.5em;
  color: var(--up-encre-douce);
}

.jour__legende {
  color: var(--up-encre-douce);
}

.jour__jauge {
  flex: 1 1 240px;
  position: relative;
  height: 34px;
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-pilule);
  overflow: hidden;
  display: flex;
  align-items: center;
}

.jour__jauge-remplie {
  position: absolute;
  inset: 0 auto 0 0;
  background: #{$vert-action};
  border-radius: var(--up-pilule);
}

.jour__taux {
  position: relative;
  padding-left: var(--up-2);
  color: var(--up-encre);
}
</style>
