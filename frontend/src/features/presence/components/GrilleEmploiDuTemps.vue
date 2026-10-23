<template>
  <!-- La grille : axe des heures à gauche, une colonne par jour -->
  <div class="grille">
    <div class="grille__axe">
      <div class="grille__coin" />
      <div v-for="h in heures" :key="h" class="grille__heure">
        <span class="pochoir chiffres">{{ $t('common.units.oClock', { h: String(h).padStart(2, '0') }) }}</span>
      </div>
    </div>

    <div v-for="j in semaine" :key="j.jour" class="grille__jour">
      <div class="grille__tete">
        <span class="lettrage grille__tete-nom">{{ j.libelle }}</span>
        <span class="pochoir pochoir--brut grille__tete-charge chiffres">
          {{ $t('emploiDuTemps.week.dayHeader', { count: j.creneaux.length, hours: heuresLisibles(heuresDuJour(j)) }) }}
        </span>
      </div>

      <div class="grille__colonne" :style="{ height: `${hauteurTotale}px` }">
        <div
          v-for="h in heures"
          :key="`l${h}`"
          class="grille__ligne"
          :style="{ top: `${(h - PREMIERE_HEURE) * HAUTEUR_HEURE}px` }"
        />

        <button
          v-for="c in disposer(j.creneaux)"
          :key="c.id"
          type="button"
          class="creneau"
          :class="{ 'creneau--inactif': !c.actif }"
          :style="c.style"
          @click="peutTenir && emit('ouvrir', c)"
        >
          <span class="pochoir chiffres creneau__heure">{{ c.heureDebut }}–{{ c.heureFin }}</span>
          <span class="lettrage creneau__matiere">{{ c.affectation?.matiere?.intitule }}</span>
          <span class="creneau__enseignant">
            {{ c.affectation?.enseignant?.nom }} {{ c.affectation?.enseignant?.prenom }}
          </span>
          <span class="pochoir creneau__promotion">{{ c.affectation?.promotion?.nom }}</span>
          <span class="creneau__pied">
            <span class="pochoir creneau__type" :title="LIBELLE_TYPE_COURS[c.type]">{{ c.type }}</span>
            <span v-if="c.salle" class="plaque-salle">{{ c.salle.code }}</span>
          </span>
          <span v-if="libellePeriode(c)" class="pochoir creneau__periode chiffres">
            {{ libellePeriode(c) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LIBELLE_TYPE_COURS, heuresLisibles } from '@/shared/utils/libelles';
import { dureeHeuresCreneau, libellePeriodeCreneau, minutes } from '../utils/creneaux';
import type { JourEmploiDuTemps } from '../services/creneaux';
import type { Creneau } from '@/types';

/** Amplitude d'une journée universitaire, et échelle de la grille. */
const PREMIERE_HEURE = 7;
const DERNIERE_HEURE = 20;
const HAUTEUR_HEURE = 64;

defineProps<{ semaine: JourEmploiDuTemps[]; peutTenir: boolean }>();
const emit = defineEmits<{ ouvrir: [Creneau] }>();

const { t } = useI18n();

const heures = Array.from({ length: DERNIERE_HEURE - PREMIERE_HEURE + 1 }, (_, i) => PREMIERE_HEURE + i);
const hauteurTotale = (DERNIERE_HEURE - PREMIERE_HEURE) * HAUTEUR_HEURE;

const heuresDuJour = (j: { creneaux: Creneau[] }) => j.creneaux.reduce((t, c) => t + dureeHeuresCreneau(c), 0);

const libellePeriode = (c: Creneau) => libellePeriodeCreneau(c, t);

/**
 * Place les créneaux dans la colonne du jour : position et hauteur selon
 * l'heure réelle, et répartition en couloirs quand deux cours se chevauchent —
 * c'est exactement ce qu'un panneau peint montre et qu'une pile de cartes cache.
 */
function disposer(creneaux: Creneau[]) {
  const tries = [...creneaux].sort((a, b) => minutes(a.heureDebut) - minutes(b.heureDebut));
  const couloirs: number[] = []; // fin du dernier créneau de chaque couloir

  const places = tries.map((c) => {
    const debut = minutes(c.heureDebut);
    const fin = minutes(c.heureFin);
    let couloir = couloirs.findIndex((f) => f <= debut);
    if (couloir === -1) {
      couloirs.push(fin);
      couloir = couloirs.length - 1;
    } else {
      couloirs[couloir] = fin;
    }
    return { c, debut, fin, couloir };
  });

  const nbCouloirs = Math.max(1, couloirs.length);

  return places.map(({ c, debut, fin, couloir }) => ({
    ...c,
    style: {
      top: `${((debut - PREMIERE_HEURE * 60) / 60) * HAUTEUR_HEURE}px`,
      height: `${Math.max(46, ((fin - debut) / 60) * HAUTEUR_HEURE - 4)}px`,
      left: `calc(${(couloir / nbCouloirs) * 100}% + 2px)`,
      width: `calc(${100 / nbCouloirs}% - 6px)`,
    },
  }));
}
</script>

<style scoped lang="scss">
// ------------------------------------------------------------------ grille
.grille {
  display: grid;
  grid-template-columns: 62px repeat(auto-fit, minmax(0, 1fr));
  border: var(--up-filet);
  background: var(--up-plaque);
  overflow-x: auto;
}

.grille__axe {
  border-right: var(--up-filet);
}

.grille__coin {
  height: 54px;
  border-bottom: var(--up-filet);
  background: var(--up-chaux);
}

.grille__heure {
  height: 64px;
  padding: 2px 6px 0 0;
  text-align: right;
  color: var(--up-encre-douce);
  border-bottom: var(--up-filet-fin);

  &:last-child {
    border-bottom: 0;
  }
}

.grille__jour {
  min-width: 152px;
  border-right: var(--up-filet-fin);

  &:last-child {
    border-right: 0;
  }
}

// L'en-tête de colonne était un bandeau d'encre : sept aplats sombres en haut
// d'une grille, c'est le contraire d'une semaine qu'on lit d'un coup d'œil.
// Il devient un intitulé gris posé sur la surface, comme `.entete-jour`.
.grille__tete {
  height: 54px;
  padding: var(--up-2);
  background: var(--up-chaux);
  color: var(--up-encre);
  border-bottom: var(--up-filet);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.grille__tete-nom {
  font-size: 1rem;
}

.grille__tete-charge {
  color: var(--up-encre-douce);
}

.grille__colonne {
  position: relative;
}

.grille__ligne {
  position: absolute;
  left: 0;
  right: 0;
  border-top: var(--up-filet-fin);
}

// Une plaque de cours, posée à son heure.
.creneau {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 7px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--up-encre);
  background: var(--up-craie);
  border: var(--up-filet);
  transition: filter var(--up-transition);

  &:hover {
    filter: brightness(0.96);
  }
  &:focus-visible {
    outline: 2px solid #{$vert-action};
    outline-offset: -4px;
  }
}

.creneau--inactif {
  opacity: 0.55;
  background-image: repeating-linear-gradient(-45deg, rgba(16, 37, 30, 0.1) 0 6px, transparent 6px 12px);
}

.creneau__heure {
  color: var(--up-encre-douce);
}

.creneau__matiere {
  font-size: 0.82rem;
  line-height: 1.12;
}

.creneau__enseignant {
  font-size: 0.76rem;
  margin: 0;
}

.creneau__promotion {
  color: var(--up-encre-douce);
  font-size: 9.5px;
  letter-spacing: -0.01em;
}

.creneau__pied {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.creneau__periode {
  color: var(--up-jaune-fonce);
  letter-spacing: -0.01em;
}

.creneau__type {
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon-sm);
  color: var(--up-encre-douce);
  padding: 1px 6px;
}
</style>
