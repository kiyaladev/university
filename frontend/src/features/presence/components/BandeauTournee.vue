<template>
  <!-- Bandeau de tournée : l'état de la journée, lisible d'un coup d'œil -->
  <header class="bandeau">
    <div class="bandeau__titre">
      <div>
        <h1 class="lettrage bandeau__jour">{{ jourLisible }}</h1>
        <p class="pochoir bandeau__mention">{{ $t('controle.header.mention', { nom: nomControleur }) }}</p>
      </div>
      <div class="bandeau__nav">
        <q-btn
          flat
          dense
          round
          icon="chevron_left"
          :aria-label="$t('controle.header.navPrev')"
          @click="emit('update:date', decalerJours(date, -1))"
        />
        <q-btn
          flat
          dense
          no-caps
          icon="event"
          :label="date === aujourdhui() ? $t('controle.header.today') : $t('controle.header.otherDay')"
        >
          <q-popup-proxy transition-show="scale" transition-hide="scale">
            <q-date :model-value="date" mask="YYYY-MM-DD" minimal @update:model-value="changerDate" />
          </q-popup-proxy>
        </q-btn>
        <q-btn
          flat
          dense
          round
          icon="chevron_right"
          :aria-label="$t('controle.header.navNext')"
          @click="emit('update:date', decalerJours(date, 1))"
        />
      </div>
    </div>

    <!-- Le seul chiffre qui commande la tournée : ce qui reste à faire -->
    <p class="reste">
      <span v-if="restantes" class="lettrage chiffres reste__valeur">{{ restantes }}</span>
      <span v-else-if="total" class="champ champ--present reste__cachet se-peint">
        <q-icon name="check" size="26px" />
      </span>

      <span class="reste__mot">
        <span class="lettrage reste__unite">
          <template v-if="restantes">
            {{
              restantes > 1
                ? $t('controle.remaining.roomsToVisitPlural')
                : $t('controle.remaining.roomsToVisitSingular')
            }}
          </template>
          <template v-else-if="total">{{ $t('controle.remaining.complete') }}</template>
          <template v-else>{{ $t('controle.remaining.none') }}</template>
        </span>
        <span v-if="total" class="pochoir pochoir--brut reste__detail chiffres">
          {{ pointees }}
          {{ pointees > 1 ? $t('controle.remaining.pointeePlural') : $t('controle.remaining.pointeeSingular') }}
          {{ $t('controle.remaining.outOf') }} {{ total }}
          <template v-if="absences">
            · {{ absences }}
            {{
              absences > 1 ? $t('controle.remaining.absencePlural') : $t('controle.remaining.absenceSingular')
            }}</template
          >
        </span>
      </span>
    </p>
  </header>
</template>

<script setup lang="ts">
import { aujourdhui, decalerJours } from '@/shared/utils/libelles';

/**
 * Bandeau de la tournée : le jour, la navigation, et le chiffre qui commande
 * tout — ce qui reste à faire.
 */
const props = defineProps<{
  date: string;
  jourLisible: string;
  nomControleur: string;
  restantes: number;
  total: number;
  pointees: number;
  absences: number;
}>();
const emit = defineEmits<{ 'update:date': [string] }>();

/** Le calendrier peut se vider : on garde alors le jour affiché. */
function changerDate(v: string | null) {
  emit('update:date', v ?? props.date);
}
</script>

<style scoped lang="scss">
// ------------------------------------------------------------- bandeau
.bandeau {
  padding: var(--up-4) var(--up-3) 0;
}

.bandeau__titre {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.bandeau__jour {
  font-size: clamp(1.6rem, 1.2rem + 2vw, 2.4rem);
  color: var(--up-encre);
  &::first-letter {
    text-transform: uppercase;
  }
}

.bandeau__mention {
  color: var(--up-encre-douce);
  margin-top: 2px;
}

.bandeau__nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

// Le reste à faire : le chiffre que le contrôleur cherche en levant les yeux.
.reste {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  margin: var(--up-3) 0 0;
  padding: var(--up-3) 0 var(--up-4);
  border-top: var(--up-filet);
}

.reste__valeur {
  font-size: clamp(2.6rem, 2rem + 3.6vw, 4rem);
  color: var(--up-encre);
  line-height: 1;
}

// Tournée finie : un cachet, pas un zéro. Un « 0 » à côté de « complète » se
// contredit lui-même.
.reste__cachet {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  border: var(--up-filet);
}

.reste__mot {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.reste__unite {
  font-size: clamp(1.05rem, 0.9rem + 1vw, 1.4rem);
  color: var(--up-encre);
}

.reste__detail {
  color: var(--up-encre-douce);
}

// Sur grand écran, le bandeau se cale sur la largeur de lecture du panneau.
@media (min-width: 1024px) {
  .bandeau {
    padding-inline: var(--up-4);
  }
}
</style>
