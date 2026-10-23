<template>
  <!--
    Carte d'une formation de la vitrine publique. La carte ne fait que
    présenter : elle prévient la page quand le visiteur veut s'inscrire.
  -->
  <article class="plaque carte-formation">
    <div class="carte-formation__tete">
      <span v-if="formation.categorie" class="pochoir carte-formation__categorie">{{ formation.categorie }}</span>
      <span v-else class="pochoir carte-formation__categorie">{{
        $t('formationsPubliques.catalogue.card.categorieDefaut')
      }}</span>
      <!-- `placesRestantes` vaut null/undefined quand la capacité est libre. -->
      <span
        v-if="formation.placesRestantes != null"
        class="pochoir carte-formation__places"
        :class="{ 'carte-formation__places--dernieres': formation.placesRestantes <= 5 }"
      >
        {{
          formation.placesRestantes === 0
            ? $t('formationsPubliques.catalogue.card.complet')
            : $t('formationsPubliques.catalogue.card.placesRestantes', { n: formation.placesRestantes })
        }}
      </span>
    </div>

    <h3 class="lettrage carte-formation__titre">{{ formation.titre }}</h3>
    <p v-if="formation.description" class="carte-formation__description">{{ formation.description }}</p>

    <dl class="carte-formation__details">
      <div v-if="formation.dureeHeures">
        <dt class="pochoir">{{ $t('common.fields.duration') }}</dt>
        <dd class="chiffres">
          {{ $t('formationsPubliques.catalogue.card.dureeValeur', { n: formation.dureeHeures }) }}
        </dd>
      </div>
      <div v-if="formation.dateDebut || formation.dateFin">
        <dt class="pochoir">{{ $t('formationsPubliques.catalogue.card.dates') }}</dt>
        <dd class="chiffres">{{ periodeLisible }}</dd>
      </div>
      <div v-if="formation.lieu">
        <dt class="pochoir">{{ $t('formationsPubliques.catalogue.card.lieu') }}</dt>
        <dd>{{ formation.lieu }}</dd>
      </div>
    </dl>

    <div class="carte-formation__prix">
      <span class="pochoir carte-formation__prix-libelle">{{
        $t('formationsPubliques.catalogue.card.investissement')
      }}</span>
      <span class="lettrage chiffres carte-formation__montant">
        {{ montantLisible(formation.prix) }}
        <small class="carte-formation__devise">{{ formation.devise }}</small>
      </span>
    </div>

    <q-btn
      class="full-width carte-formation__cta"
      color="primary"
      size="lg"
      unelevated
      no-caps
      :label="
        formation.prix > 0
          ? $t('formationsPubliques.catalogue.card.inscrirePayant')
          : $t('formationsPubliques.catalogue.card.inscrireGratuit')
      "
      :disable="formation.placesRestantes === 0"
      @click="emit('inscrire')"
    />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { dateLisible, montantLisible } from '@/shared/utils/libelles';
import type { FormationVitrine } from '@/shared/services/formations';

const props = defineProps<{ formation: FormationVitrine }>();

const emit = defineEmits<{ inscrire: [] }>();

/** Période de la formation : une date, ou les deux bornes. */
const periodeLisible = computed(() => {
  const f = props.formation;
  if (!f.dateDebut) return f.dateFin ? dateLisible(f.dateFin) : '';
  if (!f.dateFin) return dateLisible(f.dateDebut);
  return `${dateLisible(f.dateDebut)} → ${dateLisible(f.dateFin)}`;
});
</script>

<style scoped lang="scss">
@use '@/css/quasar.variables' as *;

.carte-formation {
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-3);
}

.carte-formation__tete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-2);
}

.carte-formation__categorie {
  color: var(--up-encre-douce);
  margin: 0;
}

.carte-formation__places {
  border: 0;
  background: $vert-fond;
  color: #{$vert};
  border-radius: var(--up-pilule);
  padding: 2px 10px;
  white-space: nowrap;
}

.carte-formation__places--dernieres {
  background: $jaune-fond;
  color: $jaune-texte;
}

.carte-formation__titre {
  font-size: 1.35rem;
  margin: 0;
  line-height: 1.12;
}

.carte-formation__description {
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--up-encre-douce);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.carte-formation__details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--up-2) var(--up-3);
  margin: 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-3);

  dt {
    color: var(--up-encre-douce);
  }
  dd {
    margin: 2px 0 0;
    font-size: 0.95rem;
  }
}

.carte-formation__prix {
  border-top: var(--up-filet);
  padding-top: var(--up-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.carte-formation__prix-libelle {
  color: var(--up-encre-douce);
}

.carte-formation__montant {
  font-size: clamp(1.6rem, 1.1rem + 1.6vw, 2.3rem);
  color: $vert;
}

.carte-formation__devise {
  font-size: 0.7em;
  letter-spacing: -0.01em;
}

.carte-formation__cta {
  min-height: 52px;
  margin-top: auto;
}
</style>
