<template>
  <ol class="panneau">
    <li v-for="s in seances" :key="s.id">
      <article
        class="plaque seance"
        :class="{ 'seance--en-cours': estEnCours(s), 'seance--annulee': s.statut === 'ANNULE' }"
      >
        <div class="champ seance__heure" :class="{ 'seance__heure--en-cours': estEnCours(s) }">
          <span class="lettrage chiffres seance__debut">{{ s.heureDebut }}</span>
          <span class="pochoir chiffres seance__fin">{{ s.heureFin }}</span>
          <span v-if="estEnCours(s)" class="pochoir seance__marque">{{ $t('controle.seance.inProgress') }}</span>
        </div>

        <div class="seance__corps">
          <h2 class="lettrage seance__enseignant">
            {{ s.affectation?.enseignant?.nom }} {{ s.affectation?.enseignant?.prenom }}
          </h2>
          <p class="seance__matiere">
            {{ s.affectation?.matiere?.intitule }}
            <span class="pochoir seance__type" :title="LIBELLE_TYPE_COURS[s.type]">{{ s.type }}</span>
          </p>
          <p class="pochoir seance__lieu">
            {{ s.affectation?.promotion?.nom }}
            <span v-if="s.salle" class="plaque-salle">{{ s.salle.code }}</span>
          </p>

          <p v-if="s.controle" class="pochoir pochoir--brut seance__constat chiffres">
            {{ s.controle.heureArrivee ?? '—' }} → {{ s.controle.heureFinReelle ?? '—' }} ·
            {{ dureeLisible(s.controle.dureeMinutes) }}
            <span v-if="s.controle.effectifPresent">{{
              $t('controle.seance.studentCount', { n: s.controle.effectifPresent })
            }}</span>
          </p>
          <p v-if="s.controle" class="pochoir seance__preuves">
            <q-icon
              v-if="s.controle.attestation && s.controle.attestation !== 'AUCUNE'"
              :name="ICONE_ATTESTATION[s.controle.attestation]"
              size="15px"
            />
            {{ LIBELLE_ATTESTATION[s.controle.attestation ?? 'AUCUNE'] }}
            <q-icon v-if="s.controle.qrSalleValide" name="qr_code_2" size="15px" />
            <q-icon v-if="s.controle.latitude" name="my_location" size="15px" />
            <q-icon v-if="s.controle.horsLigne" name="cloud_off" size="15px" />
            · {{ s.controle.controleur?.prenom }} {{ s.controle.controleur?.nom }}
          </p>
        </div>

        <button
          v-if="s.statut !== 'ANNULE'"
          type="button"
          class="champ seance__action se-peint"
          :class="s.controle ? `champ--${classeStatut(s.controle.statut)}` : 'seance__action--vierge'"
          @click="emit('pointer', s)"
        >
          <span v-if="s.controle" class="lettrage seance__verdict">
            {{ LIBELLE_STATUT_PRESENCE[s.controle.statut] }}
          </span>
          <span v-else class="lettrage seance__appel">{{ $t('controle.seance.pointer') }}</span>
          <span class="pochoir seance__sous-action">
            {{
              s.controle ? $t('controle.seance.correct') : $t('controle.seance.room', { code: s.salle?.code ?? '—' })
            }}
          </span>
        </button>

        <div v-else class="champ seance__action seance__action--annulee">
          <span class="lettrage seance__verdict">{{ $t('controle.seance.cancelled') }}</span>
        </div>
      </article>
    </li>
  </ol>
</template>

<script setup lang="ts">
import {
  ICONE_ATTESTATION,
  LIBELLE_ATTESTATION,
  LIBELLE_STATUT_PRESENCE,
  LIBELLE_TYPE_COURS,
  aujourdhui,
  dureeLisible,
  maintenantHHmm,
} from '@/shared/utils/libelles';
import { CLASSE_CHAMP_PRESENCE } from '@/shared/utils/statuts';
import type { Seance, StatutPresence } from '@/types';

/**
 * Panneau de la tournée : une plaque par séance, dans l'ordre des heures.
 *
 * La plaque porte la séance telle qu'elle est : l'état du contrôle, les
 * preuves, l'action à faire. La page ne fait que passer la liste.
 */
const props = defineProps<{ seances: Seance[]; date: string }>();
const emit = defineEmits<{ pointer: [Seance] }>();

const classeStatut = (statut: string) => CLASSE_CHAMP_PRESENCE[statut as StatutPresence] ?? 'attente';

/** Séance en cours à l'instant où le contrôleur regarde son panneau. */
function estEnCours(s: Seance) {
  if (props.date !== aujourdhui()) return false;
  const h = maintenantHHmm();
  return s.heureDebut <= h && h <= s.heureFin;
}
</script>

<style scoped lang="scss">
// -------------------------------------------------------------- panneau
.panneau {
  list-style: none;
  margin: 0;
  padding: var(--up-3);
  display: grid;
  gap: var(--up-2);
}

.seance {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 116px;
  min-height: 104px;
  overflow: hidden;
}

.seance--annulee {
  opacity: 0.55;
}

.seance__heure {
  flex-direction: column;
  gap: 2px;
  background: var(--up-chaux);
  color: var(--up-encre);
  padding: var(--up-2) var(--up-1);

  // La séance se déroule à l'instant : un liséré bleu, la couleur de ce qui est
  // actif — pas une couleur de statut qu'on lui volerait.
  &--en-cours {
    box-shadow: inset 0 0 0 2px #{$vert-action};
  }
}

.seance__debut {
  font-size: 1.5rem;
  color: var(--up-encre);
}

.seance__fin {
  color: var(--up-encre-douce);
  &::before {
    content: '→ ';
  }
}

.seance__marque {
  margin-top: 2px;
  color: $jaune;
  border-top: var(--up-filet);
  padding-top: 2px;
}

.seance__corps {
  padding: var(--up-3);
  min-width: 0;
}

.seance__enseignant {
  font-size: 1.12rem;
  margin: 0;
}

.seance__matiere {
  margin: 3px 0 0;
  font-size: 0.94rem;
  color: var(--up-encre);
}

.seance__type {
  border: 0;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon-sm);
  color: var(--up-encre-douce);
  padding: 1px 6px;
  margin-left: 6px;
}

.seance__lieu {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.seance__constat,
.seance__preuves {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.seance__action {
  appearance: none;
  border: 0;
  border-left: var(--up-filet);
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  padding: var(--up-2);
  font: inherit;
  transition: filter var(--up-transition);

  &:hover {
    filter: brightness(1.08);
  }
  &:focus-visible {
    outline: 2px solid #{$vert-action};
    outline-offset: -4px;
  }

  &--vierge {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
  }

  &--annulee {
    background: repeating-linear-gradient(-45deg, rgba(16, 37, 30, 0.13) 0 6px, transparent 6px 12px);
    color: var(--up-encre-douce);
    cursor: default;
  }
}

.seance__verdict,
.seance__appel {
  font-size: 1rem;
  line-height: 1.05;
}

.seance__sous-action {
  opacity: 1;
  font-size: 10px;
}

// Sur grand écran le panneau garde une largeur de lecture : deux colonnes de
// plaques, pas une bande étirée sur 1 800 px.
@media (min-width: 1024px) {
  .panneau {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-inline: var(--up-4);
    max-width: 1180px;
  }
}

// L'écran du contrôleur est un téléphone tenu à une main.
@media (max-width: 599px) {
  .seance {
    grid-template-columns: 76px minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .seance__heure {
    grid-row: 1 / span 2;
  }

  .seance__action {
    grid-column: 2;
    border-left: 0;
    border-top: var(--up-filet);
    flex-direction: row;
    gap: var(--up-2);
    min-height: 56px;
  }
}
</style>
