<template>
  <q-expansion-item class="plaque carte-portail carte-portail--large" :label="$t('portail.sections.resto.title')">
    <div class="carte-portail__recap">
      <span class="lettrage chiffres carte-portail__montant">
        {{ montantLisible(resto.solde) }}
        <span class="carte-portail__devise">{{ $t('common.units.gnf') }}</span>
      </span>
    </div>
    <p class="carte-portail__vide">
      {{ $t('portail.sections.resto.description') }}
    </p>

    <ul v-if="resto.lignes.length" class="carte-portail__liste">
      <li v-for="l in resto.lignes" :key="l.cle" class="carte-portail__ligne">
        <span class="carte-portail__item-texte">
          <span class="lettrage carte-portail__item-titre">{{ l.libelle }}</span>
          <span class="pochoir pochoir--brut chiffres carte-portail__date">
            {{ dateHeureLisible(l.date) }} · {{ l.statut }}
          </span>
        </span>
        <span class="chiffres carte-portail__montant-petit" :class="l.montant < 0 ? 'text-negative' : 'text-positive'">
          {{ l.montant < 0 ? '−' : '+' }}{{ montantLisible(Math.abs(l.montant)) }}
        </span>
      </li>
    </ul>
    <p v-else class="carte-portail__aucune">{{ $t('portail.sections.resto.empty') }}</p>

    <q-btn
      unelevated
      color="primary"
      no-caps
      icon="add_card"
      :label="$t('portail.actions.recharge')"
      @click="emit('recharger')"
    />
    <p v-if="resto.instructions" class="pochoir carte-portail__avertissement">
      {{ resto.instructions }}
    </p>
  </q-expansion-item>
</template>

<script setup lang="ts">
/**
 * Portefeuille restauration de l'étudiant : solde, dernières opérations et
 * demande de recharge.
 *
 * Le composant ne fait aucune requête : la page détient le portefeuille et
 * porte la demande de recharge (dialogue et appel).
 */
import { dateHeureLisible, montantLisible } from '@/shared/utils/format';
import type { PortefeuilleRestoPortail } from '../types';

defineProps<{
  resto: PortefeuilleRestoPortail;
}>();

const emit = defineEmits<{
  /** Demande d'ouverture du dialogue de recharge. */
  recharger: [];
}>();
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

.carte-portail--large {
  grid-column: 1 / -1;
}

.carte-portail__recap {
  display: flex;
  align-items: baseline;
  gap: var(--up-2);
}

.carte-portail__montant {
  font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.2rem);
}

.carte-portail__devise {
  font-size: 0.72em;
  color: var(--up-encre-douce);
}

.carte-portail__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.carte-portail__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
  font-size: 0.95rem;
}

.carte-portail__item-texte {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.carte-portail__item-titre {
  font-size: 0.92rem;
}

.carte-portail__date {
  color: var(--up-encre-douce);
}

.carte-portail__montant-petit {
  font-weight: 590;
}

.carte-portail__aucune,
.carte-portail__vide {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
}

.carte-portail__avertissement {
  color: $jaune-fonce;
  margin: var(--up-2) 0 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
}
</style>
