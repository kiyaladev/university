<script setup lang="ts">
/**
 * Stepper de workflow horizontal : affiche l'état courant dans la suite
 * d'étapes, les transitions valides et un bouton d'action rapide.
 * Utilisé par : courrier, réclamations, tirage examens, recettes, élections.
 */
import { computed } from 'vue';

interface Etape {
  identifiant: string;
  libelle: string;
  icone?: string;
  description?: string;
}

export interface Transition {
  cible: string;
  label: string;
  icone?: string;
  couleur?: string;
  requireMotif?: boolean;
}

const props = defineProps<{
  /** Étapes ordonnées du workflow */
  etapes: Etape[];
  /** Identifiant de l'étape courante */
  actuel: string;
  /** Transitions possibles depuis l'étape courante */
  transitions?: Transition[];
  /** Lecture seule (visu pure) */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  transition: [cible: string];
}>();

const indexActuel = computed(() => props.etapes.findIndex((e) => e.identifiant === props.actuel));
</script>

<template>
  <div class="workflow">
    <div class="workflow__rail">
      <div
        v-for="(etape, i) in etapes"
        :key="etape.identifiant"
        class="workflow__etape"
        :class="{
          'workflow__etape--faite': i < indexActuel,
          'workflow__etape--actuelle': i === indexActuel,
          'workflow__etape--avenir': i > indexActuel,
        }"
      >
        <div class="workflow__puce">
          <q-icon v-if="i < indexActuel" name="check" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <div class="workflow__libelle">{{ etape.libelle }}</div>
        <div v-if="etape.description" class="workflow__description">{{ etape.description }}</div>
        <div v-if="i < etapes.length - 1" class="workflow__lien" />
      </div>
    </div>
    <div v-if="!readonly && transitions?.length" class="workflow__actions">
      <q-btn
        v-for="t in transitions"
        :key="t.cible"
        :label="t.label"
        :icon="t.icone"
        :color="t.couleur ?? 'primary'"
        outline
        no-caps
        @click="emit('transition', t.cible)"
      />
    </div>
  </div>
</template>

<style scoped>
.workflow {
  display: grid;
  gap: 10px;
}
.workflow__rail {
  display: flex;
  align-items: stretch;
  gap: 4px;
  overflow-x: auto;
}
.workflow__etape {
  flex: 1;
  min-width: 110px;
  position: relative;
  text-align: center;
  padding: 12px 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  background: white;
}
.workflow__etape--actuelle {
  border-color: var(--up-primary, #10251E);
  background: rgba(15, 122, 69, 0.06);
}
.workflow__etape--faite {
  background: rgba(0, 0, 0, 0.04);
  opacity: 0.8;
}
.workflow__puce {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  margin: 0 auto 6px;
  display: grid;
  place-items: center;
  font-weight: 700;
}
.workflow__etape--actuelle .workflow__puce {
  background: var(--up-primary, #10251E);
  color: white;
}
.workflow__etape--faite .workflow__puce {
  background: var(--up-secondary, #0F7A45);
  color: white;
}
.workflow__libelle {
  font-weight: 600;
  font-size: 13px;
}
.workflow__description {
  font-size: 11px;
  color: #555;
  margin-top: 2px;
}
.workflow__lien {
  position: absolute;
  right: -10px;
  top: 24px;
  width: 16px;
  height: 2px;
  background: rgba(0, 0, 0, 0.2);
}
.workflow__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}
</style>
