<template>
  <!-- Sur téléphone : la journée choisie, dans l'ordre des heures -->
  <ol class="edt__liste">
    <li v-for="c in creneaux" :key="c.id">
      <button
        type="button"
        class="plaque creneau-ligne"
        :class="{ 'creneau--inactif': !c.actif }"
        :disabled="!peutTenir"
        @click="emit('ouvrir', c)"
      >
        <span class="champ creneau-ligne__heure">
          <span class="lettrage chiffres">{{ c.heureDebut }}</span>→
          <span class="pochoir chiffres">{{ c.heureFin }}</span>
        </span>
        <span class="creneau-ligne__corps">
          <span class="lettrage creneau-ligne__matiere">
            {{ c.affectation?.matiere?.intitule }}
          </span>
          <span class="creneau-ligne__enseignant">
            {{ c.affectation?.enseignant?.nom }} {{ c.affectation?.enseignant?.prenom }}
          </span>
          <span class="pochoir creneau-ligne__meta">
            {{ c.affectation?.promotion?.nom }}
            <span class="pochoir creneau__type" :title="LIBELLE_TYPE_COURS[c.type]">{{ c.type }}</span>
            <span v-if="c.salle" class="plaque-salle">{{ c.salle.code }}</span>
          </span>
          <span v-if="libellePeriode(c)" class="pochoir chiffres creneau__periode">
            {{ libellePeriode(c) }}
          </span>
        </span>
      </button>
    </li>
    <li v-if="!creneaux.length" class="edt__vide pochoir">
      {{ $t('emploiDuTemps.list.empty') }}
    </li>
  </ol>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LIBELLE_TYPE_COURS } from '@/shared/utils/libelles';
import { libellePeriodeCreneau } from '../utils/creneaux';
import type { Creneau } from '@/types';

/**
 * Vue mobile de l'emploi du temps : la journée choisie, dans l'ordre des
 * heures. Sur un écran étroit, une grille de six jours serait illisible.
 */
defineProps<{ creneaux: Creneau[]; peutTenir: boolean }>();
const emit = defineEmits<{ ouvrir: [Creneau] }>();

const { t } = useI18n();

const libellePeriode = (c: Creneau) => libellePeriodeCreneau(c, t);
</script>

<style scoped lang="scss">
.edt__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.creneau-ligne {
  appearance: none;
  width: 100%;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  min-height: 92px;
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  font: inherit;
  color: var(--up-encre);

  &:focus-visible {
    outline: 2px solid #{$vert-action};
    outline-offset: -4px;
  }
  &:disabled {
    cursor: default;
  }
}

.creneau-ligne__heure {
  flex-direction: column;
  background: var(--up-chaux);
  color: var(--up-encre);
  gap: 2px;
}

.creneau-ligne__corps {
  display: block;
  padding: var(--up-3);
  min-width: 0;
}

.creneau-ligne__matiere {
  display: block;
  font-size: 1rem;
}

.creneau-ligne__enseignant {
  display: block;
  margin-top: 3px;
  font-size: 0.9rem;
}

.creneau-ligne__meta {
  margin-top: 6px;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.edt__vide {
  padding: var(--up-6) var(--up-3);
  text-align: center;
  color: var(--up-encre-douce);
}

.creneau--inactif {
  opacity: 0.55;
  background-image: repeating-linear-gradient(-45deg, rgba(16, 37, 30, 0.1) 0 6px, transparent 6px 12px);
}

.creneau__type {
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon-sm);
  color: var(--up-encre-douce);
  padding: 1px 6px;
}

.creneau__periode {
  color: var(--up-jaune-fonce);
  letter-spacing: -0.01em;
}
</style>
