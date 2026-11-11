<template>
  <div class="kb" role="group" :aria-label="$t('stages.kanban.label')">
    <p class="sr-only" aria-live="polite">{{ annonce }}</p>
    <section
      v-for="col in colonnes"
      :key="col.statut"
      class="kb-col"
      :class="{
        'kb-col--cible': glisse && peutDeposer(col.statut),
        'kb-col--survol': survol === col.statut && peutDeposer(col.statut),
        'kb-col--refus': glisse && !peutDeposer(col.statut) && glisse.statut !== col.statut,
      }"
      :aria-labelledby="`kb-t-${col.statut}`"
      @dragover="(e) => survolColonne(e, col.statut)"
      @dragleave="survol === col.statut && (survol = null)"
      @drop.prevent="deposer(col.statut)"
    >
      <header class="kb-col__tete">
        <span class="kb-point" :class="`kb-point--${col.statut}`" aria-hidden="true" />
        <h3 :id="`kb-t-${col.statut}`" class="kb-col__titre">{{ col.label }}</h3>
        <span class="kb-col__nb">{{ col.travaux.length }}</span>
      </header>

      <ul class="kb-col__liste">
        <li
          v-for="tr in col.travaux"
          :key="tr.id"
          class="kb-carte"
          :class="{ 'kb-carte--glisse': glisse?.id === tr.id }"
          :draggable="cibles(tr).length > 0"
          tabindex="0"
          :aria-label="`${tr.intitule}, ${col.label}`"
          @dragstart="(e) => debutGlisse(e, tr)"
          @dragend="finGlisse"
          @click="emit('detail', tr)"
          @keydown.enter.self.prevent="emit('detail', tr)"
          @keydown.space.self.prevent="emit('detail', tr)"
        >
          <div class="kb-carte__type">
            {{ LIBELLE_TYPE_ENCADREMENT[tr.type] ?? tr.type }}
            <span v-if="tr.entreprise"> · {{ tr.entreprise }}</span>
          </div>
          <div class="kb-carte__titre">{{ tr.intitule }}</div>
          <div class="kb-carte__meta">
            {{ [tr.etudiant?.nom, tr.etudiant?.prenom].filter(Boolean).join(' ') || $t('common.format.emptyValue') }}
          </div>
          <div class="kb-carte__meta">
            <q-icon name="person" size="14px" aria-hidden="true" />
            <span v-if="tr.encadrant">{{ tr.encadrant.nom }} {{ tr.encadrant.prenom }}</span>
            <span v-else class="kb-carte__alerte">{{ $t('stages.toDesignate') }}</span>
          </div>
          <div class="kb-carte__pied">
            <span v-if="tr.soutenance" class="kb-puce" :title="$t('stages.table.columns.defense')">
              <q-icon name="event" size="13px" aria-hidden="true" />{{ dateHeureLisible(tr.soutenance.date) }}
            </span>
            <span v-else-if="tr.rapportRendu" class="kb-puce kb-puce--ok">
              <q-icon name="task_alt" size="13px" aria-hidden="true" />{{ $t('stages.table.report.done') }}
            </span>
            <span v-else-if="['EN_COURS', 'VALIDE'].includes(tr.statut)" class="kb-puce">
              {{ $t('stages.table.report.pending') }}
            </span>
            <span class="kb-carte__actions">
              <q-btn
                v-for="b in cibles(tr)"
                :key="b.statut"
                flat
                dense
                round
                size="sm"
                :color="b.couleur"
                :icon="b.icone"
                :aria-label="b.libelle"
                @click.stop="emit('transition', tr, b.statut)"
              >
                <q-tooltip>{{ b.libelle }}</q-tooltip>
              </q-btn>
            </span>
          </div>
        </li>
        <li v-if="!col.travaux.length" class="kb-vide">
          <span v-if="glisse && peutDeposer(col.statut)">{{ $t('stages.kanban.drop') }}</span>
          <span v-else>{{ $t(`stages.kanban.empty.${col.statut}`) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Vue Kanban des travaux encadrés : une colonne par statut, glisser-déposer
 * d'une carte = demande de transition (la page confirme puis appelle l'API).
 * Une colonne n'accepte que les transitions permises à l'utilisateur ; au
 * clavier, la carte s'ouvre avec Entrée et ses boutons déclenchent la transition.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { LIBELLE_STATUT_ENCADREMENT, LIBELLE_TYPE_ENCADREMENT } from '@/shared/utils/libelles';
import { dateHeureLisible } from '@/shared/utils/format';
import type { StatutEncadrement, TravailEncadre } from '@/types';
import type { BoutonTransition } from '../types';

type Bouton = BoutonTransition & { statut: StatutEncadrement };

const props = defineProps<{
  lignes: TravailEncadre[];
  cibles: (tr: TravailEncadre) => Bouton[];
}>();

const emit = defineEmits<{
  transition: [travail: TravailEncadre, cible: StatutEncadrement];
  detail: [travail: TravailEncadre];
}>();

const { t } = useI18n();
const STATUTS: StatutEncadrement[] = ['PROPOSE', 'VALIDE', 'EN_COURS', 'SOUTENU', 'ABANDONNE'];

const glisse = ref<TravailEncadre | null>(null);
const survol = ref<StatutEncadrement | null>(null);
const annonce = ref('');

const colonnes = computed(() =>
  STATUTS.map((statut) => ({
    statut,
    label: LIBELLE_STATUT_ENCADREMENT[statut] ?? statut,
    travaux: props.lignes.filter((x) => x.statut === statut),
  })),
);

function peutDeposer(statut: StatutEncadrement) {
  return !!glisse.value && props.cibles(glisse.value).some((b) => b.statut === statut);
}

function debutGlisse(e: DragEvent, tr: TravailEncadre) {
  if (!props.cibles(tr).length) {
    e.preventDefault();
    return;
  }
  glisse.value = tr;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tr.id));
  }
}

function finGlisse() {
  glisse.value = null;
  survol.value = null;
}

function survolColonne(e: DragEvent, statut: StatutEncadrement) {
  if (!peutDeposer(statut)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  survol.value = statut;
}

function deposer(statut: StatutEncadrement) {
  const tr = glisse.value;
  const ok = peutDeposer(statut);
  finGlisse();
  if (!tr || !ok) return;
  annonce.value = t('stages.kanban.moved', {
    title: tr.intitule,
    status: LIBELLE_STATUT_ENCADREMENT[statut] ?? statut,
  });
  emit('transition', tr, statut);
}
</script>

<style scoped lang="scss">
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.kb {
  display: grid;
  grid-template-columns: repeat(5, minmax(220px, 1fr));
  gap: var(--up-3, 16px);
  align-items: start;
  overflow-x: auto;
  padding-bottom: var(--up-2, 8px);
  scroll-snap-type: x proximity;
}

.kb-col {
  background: var(--up-chaux);
  border-radius: 18px;
  padding: 12px;
  min-height: 160px;
  scroll-snap-align: start;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    opacity 0.15s ease;
}
.kb-col--cible {
  border-color: var(--up-gris-inerte);
  background: var(--up-vert-fond);
}
.kb-col--survol {
  border-color: var(--up-vert-action);
}
.kb-col--refus {
  opacity: 0.5;
}

.kb-col__tete {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px 10px;
}
.kb-col__titre {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--up-encre);
  flex: 1;
}
.kb-col__nb {
  font-size: 12px;
  font-weight: 500;
  font-feature-settings: 'tnum' 1;
  color: var(--up-encre-douce);
  background: var(--up-gris-inerte);
  border-radius: 980px;
  padding: 0 8px;
  min-width: 24px;
  text-align: center;
  line-height: 20px;
}

.kb-point {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--up-encre-tertiaire);
  &--VALIDE {
    background: var(--up-jaune);
  }
  &--EN_COURS {
    background: var(--up-vert);
    opacity: 0.55;
  }
  &--SOUTENU {
    background: var(--up-vert);
  }
  &--ABANDONNE {
    background: var(--up-rouge);
  }
}

.kb-col__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kb-carte {
  background: var(--up-plaque);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    opacity 0.15s ease;
  &[draggable='true'] {
    cursor: grab;
  }
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 122, 77, 0.25);
  }
  &--glisse {
    opacity: 0.4;
  }
}
.kb-carte__type {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--up-encre-tertiaire);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-carte__titre {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--up-encre);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.kb-carte__meta {
  font-size: 12px;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.kb-carte__alerte {
  color: var(--up-jaune-texte);
}
.kb-carte__pied {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 6px;
  min-height: 24px;
}
.kb-carte__actions {
  margin-left: auto;
  display: inline-flex;
}
.kb-puce {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--up-encre-douce);
  background: var(--up-gris-inerte);
  border-radius: 980px;
  padding: 0 8px;
  line-height: 20px;
  &--ok {
    color: var(--up-vert);
    background: var(--up-vert-fond);
  }
}

.kb-vide {
  font-size: 12px;
  color: var(--up-encre-tertiaire);
  text-align: center;
  padding: 18px 8px;
  border: 1px dashed var(--up-gris-inerte);
  border-radius: 12px;
}

@media (max-width: 599px) {
  .kb {
    grid-template-columns: repeat(5, 82vw);
  }
  .kb-carte__actions :deep(.q-btn) {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .kb-col,
  .kb-carte {
    transition: none;
  }
}
</style>
