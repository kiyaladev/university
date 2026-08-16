<script setup lang="ts">
/**
 * Tableau Kanban : un ensemble de colonnes, chaque colonne une liste de cartes.
 * Pas de drag-drop (les transitions de statut passent par les routes backend
 * via le menu de la carte). C'est volontairement simple mais lisible.
 */
import { computed } from 'vue';

interface Card {
  id: string | number;
  titre: string;
  sousTitre?: string;
  meta?: string;
  badge?: string;
  couleur?: string;
  actions?: Array<{ label: string; icone?: string; couleur?: string; onClick: () => void | Promise<void> }>;
  onClick?: () => void | Promise<void>;
}

interface Colonne {
  identifiant: string;
  titre: string;
  couleur?: string;
  cartes: Card[];
}

const props = withDefaults(defineProps<{
  colonnes: Colonne[];
  /** Permet l'action rapide sur la carte (clic sur le titre) */
  selectionnable?: boolean;
}>(), {
  selectionnable: true,
});

const totalCartes = computed(() => props.colonnes.reduce((acc, c) => acc + c.cartes.length, 0));
</script>

<template>
  <div class="kanban">
    <div class="kanban__rail">
      <div v-for="col in colonnes" :key="col.identifiant" class="kanban__colonne" :style="{ borderTopColor: col.couleur ?? 'var(--up-encre)' }">
        <div class="kanban__entete">
          <span class="kanban__titre">{{ col.titre }}</span>
          <q-badge outline color="primary" :label="col.cartes.length" />
        </div>
        <div class="kanban__cartes">
          <q-card
            v-for="carte in col.cartes"
            :key="String(carte.id)"
            flat
            bordered
            class="kanban__carte"
            @click="carte.onClick?.()"
          >
            <q-card-section class="kanban__carte-corps">
              <div v-if="carte.badge" class="kanban__carte-badge">
                <q-badge :color="carte.couleur ?? 'primary'" :label="carte.badge" />
              </div>
              <div class="kanban__carte-titre" :class="{ 'kanban__carte-titre--cliquable': selectionnable }">{{ carte.titre }}</div>
              <div v-if="carte.sousTitre" class="kanban__carte-sous-titre">{{ carte.sousTitre }}</div>
              <div v-if="carte.meta" class="kanban__carte-meta">{{ carte.meta }}</div>
              <div v-if="carte.actions?.length" class="kanban__carte-actions">
                <q-btn
                  v-for="(act, i) in carte.actions"
                  :key="i"
                  :label="act.label"
                  :icon="act.icone"
                  :color="act.couleur"
                  size="sm"
                  flat
                  dense
                  no-caps
                  @click.stop="act.onClick"
                />
              </div>
            </q-card-section>
          </q-card>
          <div v-if="!col.cartes.length" class="kanban__vide">
            <q-icon name="inbox" size="32px" color="grey-5" />
            <div>Aucune carte</div>
          </div>
        </div>
      </div>
    </div>
    <div class="kanban__pied">{{ totalCartes }} élément(s)</div>
  </div>
</template>

<style scoped>
.kanban {
  display: grid;
  gap: 8px;
}
.kanban__rail {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.kanban__colonne {
  flex: 0 0 280px;
  background: var(--up-plaque, #fafaf7);
  border-top: 3px solid;
  border-radius: 4px;
  padding: 8px;
  display: grid;
  gap: 8px;
}
.kanban__entete {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
}
.kanban__cartes {
  display: grid;
  gap: 8px;
}
.kanban__carte {
  background: white;
  cursor: pointer;
  border-left: 4px solid var(--up-encre);
}
.kanban__carte-corps {
  padding: 8px 10px;
  display: grid;
  gap: 4px;
}
.kanban__carte-titre {
  font-weight: 600;
}
.kanban__carte-titre--cliquable {
  cursor: pointer;
}
.kanban__carte-sous-titre {
  font-size: 12px;
  color: #555;
}
.kanban__carte-meta {
  font-size: 11px;
  color: #888;
}
.kanban__carte-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.kanban__vide {
  padding: 24px;
  text-align: center;
  color: #aaa;
  font-size: 13px;
}
.kanban__pied {
  font-size: 12px;
  color: #666;
  text-align: right;
}
</style>
