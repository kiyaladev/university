<script setup lang="ts">
/**
 * Carte d'une suspicion de plagiat : affiche le score en gros, deux vignettes
 * (document A | document B) et expose les actions d'acquittement/confirmation.
 *
 * Composant passif : toute mutation passe par le parent (bouton + dialog de
 * confirmation) — seul `@click` est exposé.
 */
import { computed } from 'vue';
import { LIBELLE_STATUT_SUSPICION, LIBELLE_TYPE_DOCUMENT } from '../utils/libelles';
import type { DocumentDepot, SuspicionPlagiat } from '../types';

const props = withDefaults(defineProps<{
  suspicion: SuspicionPlagiat;
  /** Affiche les boutons « Acquitter / Confirmer ». */
  showActions?: boolean;
  /** Lien cliqué (utile pour ouvrir la page détail). */
  clickable?: boolean;
}>(), {
  showActions: false,
  clickable: true,
});

const emit = defineEmits<{
  'voir': [SuspicionPlagiat];
  'acquitter': [SuspicionPlagiat];
  'confirmer': [SuspicionPlagiat];
}>();

const score = computed(() => Math.round(props.suspicion.score ?? 0));

const couleurScore = computed(() => {
  if (score.value < 50) return 'positive';
  if (score.value <= 80) return 'warning';
  return 'negative';
});

const libelleScore = computed(() => {
  if (score.value < 50) return 'Faible';
  if (score.value <= 80) return 'Suspect';
  return 'Risque élevé';
});

const couleurStatut: Record<SuspicionPlagiat['statut'], string> = {
  EN_ATTENTE: 'orange',
  ACQUITTE: 'positive',
  CONFIRME: 'negative',
};

function miniature(doc?: DocumentDepot | null) {
  if (!doc) return { titre: '—', auteurs: '', departement: null as string | null };
  return {
    titre: doc.titre ?? '—',
    auteurs: doc.auteurs ?? '—',
    departement: doc.departement?.nom ?? null,
    type: doc.type,
  };
}
</script>

<template>
  <q-card flat bordered class="carte plagiat-carte" :class="{ 'plagiat-carte--clic': clickable }">
    <q-card-section class="row items-center q-pb-none">
      <div class="col">
        <div class="text-caption text-grey-7 text-uppercase">
          Suspicion {{ LIBELLE_STATUT_SUSPICION[suspicion.statut] }}
        </div>
        <div class="plagiat-carte__score" :class="`plagiat-carte__score--${couleurScore}`">
          {{ score }}<span class="plagiat-carte__score-unite">%</span>
        </div>
        <div class="text-caption" :class="`text-${couleurScore}`">
          {{ libelleScore }}
        </div>
      </div>
      <div class="col-auto">
        <q-badge :color="couleurStatut[suspicion.statut]" text-color="white">
          {{ LIBELLE_STATUT_SUSPICION[suspicion.statut] }}
        </q-badge>
      </div>
    </q-card-section>

    <q-card-section class="q-pt-sm">
      <div class="row q-col-gutter-md items-stretch">
        <div class="col-12 col-sm-6">
          <div class="plagiat-carte__vignette">
            <div class="text-caption text-grey-7 text-uppercase">Document A</div>
            <div class="plagiat-carte__vignette-titre text-weight-medium">
              {{ miniature(suspicion.documentA).titre }}
            </div>
            <div class="text-caption text-grey-7">
              {{ miniature(suspicion.documentA).auteurs }}
            </div>
            <div class="row items-center q-mt-xs text-caption text-grey-7">
              <q-icon name="apartment" size="14px" class="q-mr-xs" />
              <span>{{ miniature(suspicion.documentA).departement ?? '—' }}</span>
            </div>
            <div class="row items-center q-mt-xs text-caption text-grey-7">
              <q-icon name="category" size="14px" class="q-mr-xs" />
              <span>{{ LIBELLE_TYPE_DOCUMENT[miniature(suspicion.documentA).type ?? 'AUTRE'] ?? 'Autre' }}</span>
            </div>
          </div>
        </div>
        <div class="col-12 col-sm-6">
          <div class="plagiat-carte__vignette plagiat-carte__vignette--b">
            <div class="text-caption text-grey-7 text-uppercase">Document B</div>
            <div class="plagiat-carte__vignette-titre text-weight-medium">
              {{ miniature(suspicion.documentB).titre }}
            </div>
            <div class="text-caption text-grey-7">
              {{ miniature(suspicion.documentB).auteurs }}
            </div>
            <div class="row items-center q-mt-xs text-caption text-grey-7">
              <q-icon name="apartment" size="14px" class="q-mr-xs" />
              <span>{{ miniature(suspicion.documentB).departement ?? '—' }}</span>
            </div>
            <div class="row items-center q-mt-xs text-caption text-grey-7">
              <q-icon name="category" size="14px" class="q-mr-xs" />
              <span>{{ LIBELLE_TYPE_DOCUMENT[miniature(suspicion.documentB).type ?? 'AUTRE'] ?? 'Autre' }}</span>
            </div>
          </div>
        </div>
      </div>
    </q-card-section>

    <q-separator />
    <q-card-actions class="q-px-md">
      <div class="text-caption text-grey-7">
        <q-icon name="event" size="14px" class="q-mr-xs" />
        Détecté le {{ new Date(suspicion.detecteLe).toLocaleDateString('fr-FR') }}
      </div>
      <q-space />
      <q-btn v-if="clickable" flat dense no-caps icon="open_in_new" label="Détail" @click.stop="emit('voir', suspicion)" />
      <template v-if="showActions && suspicion.statut === 'EN_ATTENTE'">
        <q-btn flat dense no-caps color="positive" icon="thumb_down" label="Acquitter" @click.stop="emit('acquitter', suspicion)" />
        <q-btn flat dense no-caps color="negative" icon="gavel" label="Confirmer" @click.stop="emit('confirmer', suspicion)" />
      </template>
    </q-card-actions>
  </q-card>
</template>

<style scoped>
.plagiat-carte {
  display: flex;
  flex-direction: column;
}
.plagiat-carte--clic {
  cursor: pointer;
}
.plagiat-carte__score {
  font-size: 2.8rem;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--up-encre);
}
.plagiat-carte__score-unite {
  font-size: 1rem;
  font-weight: 600;
  margin-left: 2px;
}
.plagiat-carte__score--positive { color: var(--q-positive); }
.plagiat-carte__score--warning { color: var(--q-warning); }
.plagiat-carte__score--negative { color: var(--q-negative); }

.plagiat-carte__vignette {
  background: var(--up-chaux);
  border: var(--up-filet-fin);
  padding: 8px 10px;
  height: 100%;
}
.plagiat-carte__vignette--b {
  background: rgba(0, 0, 0, 0.02);
}
.plagiat-carte__vignette-titre {
  font-size: 0.95rem;
  line-height: 1.25;
}
</style>
