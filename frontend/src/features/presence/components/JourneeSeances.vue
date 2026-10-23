<template>
  <!-- Une journée, un bloc : le registre se lit par jour, pas ligne à ligne -->
  <section v-for="jour in journees" :key="jour.date" class="journee">
    <header class="journee__tete">
      <h2 class="lettrage journee__date">{{ jour.libelle }}</h2>
      <span class="pochoir pochoir--brut journee__compte chiffres">
        {{
          $t('seances.day.count', {
            count: jour.seances.length,
            pluralSessions: jour.seances.length > 1 ? 's' : '',
            checked: jour.controlees,
            pluralChecked: jour.controlees > 1 ? 's' : '',
          })
        }}
      </span>
    </header>

    <ol class="journee__liste">
      <li v-for="s in jour.seances" :key="s.id">
        <article class="plaque ligne" :class="{ 'ligne--annulee': s.statut === 'ANNULE' }">
          <div class="champ ligne__heure">
            <span class="lettrage chiffres">{{ s.heureDebut }}</span>
            <span class="pochoir chiffres">{{ s.heureFin }}</span>
          </div>

          <div class="ligne__corps">
            <h3 class="lettrage ligne__enseignant">
              {{ s.affectation?.enseignant?.nom }} {{ s.affectation?.enseignant?.prenom }}
            </h3>
            <p class="ligne__matiere">
              {{ s.affectation?.matiere?.intitule }}
              <span class="pochoir ligne__type" :title="LIBELLE_TYPE_COURS[s.type]">{{ s.type }}</span>
            </p>
            <p class="pochoir ligne__lieu">
              {{ s.affectation?.promotion?.nom }}
              <span v-if="s.salle" class="plaque-salle">{{ s.salle.code }}</span>
            </p>
            <p v-if="s.controle" class="pochoir pochoir--brut ligne__constat chiffres">
              {{ s.controle.heureArrivee ?? '—' }} → {{ s.controle.heureFinReelle ?? '—' }} ·
              {{ dureeLisible(s.controle.dureeMinutes) }}
              <span v-if="s.controle.effectifPresent">
                · {{ s.controle.effectifPresent }} {{ $t('seances.card.studentsSuffix') }}</span
              >
              · {{ s.controle.controleur?.prenom }} {{ s.controle.controleur?.nom }}
            </p>
          </div>

          <div class="ligne__etat">
            <champ-statut :statut="s.controle?.statut ?? 'NON_CONTROLE'" />
            <q-badge v-if="s.statut === 'ANNULE'" color="grey-7" class="q-mt-xs">{{
              $t('seances.card.cancelledBadge')
            }}</q-badge>

            <div class="ligne__boutons">
              <q-btn
                flat
                dense
                round
                icon="visibility"
                :aria-label="$t('seances.table.actions.viewDetail')"
                @click="emit('detail', s)"
              >
                <q-tooltip>{{ $t('seances.table.actions.detail') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutPointer && s.statut !== 'ANNULE'"
                dense
                unelevated
                no-caps
                color="primary"
                :icon="s.controle ? 'edit' : 'how_to_reg'"
                :label="s.controle ? $t('seances.table.actions.correct') : $t('seances.table.actions.check')"
                @click="emit('pointer', s)"
              />
              <q-btn
                v-if="peutPlanifier && !s.controle && s.statut !== 'ANNULE'"
                flat
                dense
                round
                color="negative"
                icon="event_busy"
                :aria-label="$t('seances.card.cancelSession')"
                @click="emit('annuler', s)"
              >
                <q-tooltip>{{ $t('seances.card.cancelSession') }}</q-tooltip>
              </q-btn>
            </div>
          </div>
        </article>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ChampStatut from './ChampStatut.vue';
import { LIBELLE_TYPE_COURS, dureeLisible } from '@/shared/utils/libelles';
import { getAppLocale } from '@/boot/i18n';
import type { Seance } from '@/types';

/**
 * Vue par journée du registre : une en-tête, puis ses séances à l'heure.
 *
 * Le regroupement par jour se fait ici : la page ne manipule que la liste
 * filtrée, ce bloc la range.
 */
const props = defineProps<{ seances: Seance[]; peutPointer: boolean; peutPlanifier: boolean }>();
const emit = defineEmits<{ detail: [Seance]; pointer: [Seance]; annuler: [Seance] }>();

const journees = computed(() => {
  const groupes = new Map<string, Seance[]>();
  for (const s of props.seances) {
    const jour = s.date.slice(0, 10);
    if (!groupes.has(jour)) groupes.set(jour, []);
    groupes.get(jour)!.push(s);
  }

  return [...groupes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, liste]) => ({
      date,
      libelle: new Date(`${date}T12:00:00`).toLocaleDateString(getAppLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      controlees: liste.filter((s) => s.controle).length,
      seances: [...liste].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
    }));
});
</script>

<style scoped lang="scss">
// ----------------------------------------------------------------- journée
.journee + .journee {
  margin-top: var(--up-5);
}

.journee__tete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding-bottom: var(--up-2);
  margin-bottom: var(--up-2);
  border-bottom: var(--up-filet);
  flex-wrap: wrap;
}

.journee__date {
  font-size: 1.15rem;
  margin: 0;
  &::first-letter {
    text-transform: uppercase;
  }
}

.journee__compte {
  color: var(--up-encre-douce);
}

.journee__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.ligne {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  align-items: stretch;
  overflow: hidden;
}

.ligne--annulee {
  opacity: 0.6;
}

.ligne__heure {
  flex-direction: column;
  background: var(--up-chaux);
  color: var(--up-encre);
  gap: 2px;
  padding: var(--up-2);
}

.ligne__corps {
  padding: var(--up-3);
  min-width: 0;
}

.ligne__enseignant {
  font-size: 1.02rem;
  margin: 0;
}

.ligne__matiere {
  margin: 3px 0 0;
  font-size: 0.92rem;
}

.ligne__type {
  border: 1px solid var(--up-encre);
  padding: 1px 4px;
  margin-left: 4px;
}

.ligne__lieu,
.ligne__constat {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ligne__etat {
  padding: var(--up-3);
  border-left: var(--up-filet-fin);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-2);
}

.ligne__boutons {
  display: flex;
  align-items: center;
  gap: var(--up-1);
}

@media (max-width: 599px) {
  .ligne {
    grid-template-columns: 74px minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .ligne__heure {
    grid-row: 1 / span 2;
  }

  .ligne__etat {
    grid-column: 2;
    border-left: 0;
    border-top: var(--up-filet);
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: var(--up-2) var(--up-3);
  }
}
</style>
