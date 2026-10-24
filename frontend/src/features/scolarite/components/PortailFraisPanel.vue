<template>
  <section class="plaque carte-portail">
    <h2 class="pochoir section-titre">{{ $t('portail.sections.frais.title') }}</h2>
    <template v-if="frais">
      <div class="carte-portail__recap">
        <span class="lettrage chiffres carte-portail__montant">
          {{ montantLisible(frais.montant) }}
          <span class="carte-portail__devise">{{ frais.devise }}</span>
        </span>
      </div>
      <div class="carte-portail__ligne">
        <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.frais.paye') }}</span>
        <span class="chiffres">{{ montantLisible(frais.paye) }} {{ frais.devise }}</span>
      </div>
      <div class="carte-portail__ligne">
        <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.frais.restant') }}</span>
        <span class="chiffres">{{ montantLisible(frais.solde) }} {{ frais.devise }}</span>
      </div>
      <barre-taux :valeur="frais.taux" :seuil-bas="60" :seuil-haut="90" class="carte-portail__jauge" />
    </template>
    <p v-else class="carte-portail__aucun">{{ $t('portail.sections.frais.empty') }}</p>
    <!-- Paiements récents -->
    <q-expansion-item :label="$t('portail.paymentHistory')" class="q-mt-md">
      <ul v-if="paiements.length" class="carte-portail__liste">
        <li v-for="p in paiements.slice(0, 5)" :key="p.id" class="carte-portail__ligne">
          <span class="carte-portail__item-texte">
            <span class="lettrage carte-portail__item-titre">
              {{ LIBELLE_STATUT_PAIEMENT[p.statut] ?? p.statut }}
            </span>
            <span class="pochoir pochoir--brut carte-portail__date chiffres">
              {{ p.reference }} · {{ LIBELLE_MODE_PAIEMENT[p.mode] ?? p.mode }} ·
              {{ dateLisible(p.horodatage) }}
            </span>
          </span>
          <span class="chiffres carte-portail__montant-petit"> {{ montantLisible(p.montant) }} {{ p.devise }} </span>
        </li>
      </ul>
      <p v-else class="carte-portail__aucune">{{ $t('portail.sections.paiements.empty') }}</p>
    </q-expansion-item>
  </section>
</template>

<script setup lang="ts">
/**
 * Frais d'inscription de l'année : montant, payé, restant et jauge, avec
 * l'historique des derniers paiements.
 *
 * Le composant ne fait aucune requête : la page détient le dossier.
 */
import BarreTaux from '@/shared/components/BarreTaux.vue';
import { dateLisible, montantLisible } from '@/shared/utils/format';
import { LIBELLE_MODE_PAIEMENT, LIBELLE_STATUT_PAIEMENT } from '@/shared/utils/libelles';
import type { PaiementPortail, PortailProfil } from '../types';

defineProps<{
  frais: PortailProfil['frais'];
  paiements: PaiementPortail[];
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

.carte-portail__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
  font-size: 0.95rem;
}

.carte-portail__libelle {
  color: var(--up-encre-douce);
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

.carte-portail__jauge {
  margin-top: var(--up-2);
}

.carte-portail__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.carte-portail__montant-petit {
  font-weight: 590;
}

.carte-portail__date {
  color: var(--up-encre-douce);
}

.carte-portail__aucune,
.carte-portail__aucun {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
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
</style>
