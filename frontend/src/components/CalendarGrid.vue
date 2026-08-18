<script setup lang="ts">
/**
 * Calendrier mensuel simple. Affiche les événements passés en prop, regroupés
 * par jour. Les clics ouvrent les détails via les actions fournies.
 */
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';

interface Evenement {
  id: string | number;
  date: string; // ISO YYYY-MM-DD ou ISO datetime
  titre: string;
  sousTitre?: string;
  couleur?: string;
  icone?: string;
  onClick?: () => void | Promise<void>;
}

const props = withDefaults(defineProps<{
  evenements?: Evenement[];
  /** Date initiale au format YYYY-MM (par défaut : mois courant) */
  moisInitial?: string;
  /** Masque les jours du mois précédent/suivant */
  compact?: boolean;
}>(), {
  evenements: () => [],
  compact: true,
});

const $q = useQuasar();
const mois = ref(props.moisInitial ?? new Date().toISOString().slice(0, 7));

const moisPrecedent = computed(() => {
  const [y, m] = mois.value.split('-').map(Number);
  const date = new Date(y, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});
const moisSuivant = computed(() => {
  const [y, m] = mois.value.split('-').map(Number);
  const date = new Date(y, m, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

const LIBELLE_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const grille = computed(() => {
  const [annee, moisN] = mois.value.split('-').map(Number);
  const premierJour = new Date(annee, moisN - 1, 1);
  const dernierJour = new Date(annee, moisN, 0);
  // Lundi = 0
  const decalage = (premierJour.getDay() + 6) % 7;
  const cellules: { date: Date; horsMois: boolean; iso: string }[] = [];
  for (let i = 0; i < decalage; i++) {
    const d = new Date(annee, moisN - 1, -decalage + i + 1);
    cellules.push({ date: d, horsMois: true, iso: d.toISOString().slice(0, 10) });
  }
  for (let d = 1; d <= dernierJour.getDate(); d++) {
    const date = new Date(annee, moisN - 1, d);
    cellules.push({ date, horsMois: false, iso: date.toISOString().slice(0, 10) });
  }
  while (cellules.length % 7 !== 0) {
    const last = cellules[cellules.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cellules.push({ date: next, horsMois: true, iso: next.toISOString().slice(0, 10) });
  }
  return cellules;
});

const evenementsParJour = computed(() => {
  const map: Record<string, Evenement[]> = {};
  for (const ev of props.evenements) {
    const j = ev.date.slice(0, 10);
    (map[j] ||= []).push(ev);
  }
  return map;
});

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}
</script>

<template>
  <div class="cal">
    <div class="cal__entete">
      <q-btn flat round dense icon="chevron_left" @click="mois = moisPrecedent" />
      <div class="cal__titre">
        {{ LIBELLE_MOIS[Number(mois.split('-')[1]) - 1] }} {{ mois.split('-')[0] }}
      </div>
      <q-btn flat round dense icon="chevron_right" @click="mois = moisSuivant" />
      <q-space />
      <q-btn flat dense icon="today" label="Aujourd'hui" no-caps @click="mois = aujourdhui().slice(0, 7)" />
    </div>
    <div class="cal__grille">
      <div v-for="j in JOURS" :key="j" class="cal__jh">{{ j }}</div>
      <div
        v-for="(cellule, idx) in grille"
        :key="idx"
        class="cal__cellule"
        :class="{
          'cal__cellule--hors': cellule.horsMois,
          'cal__cellule--auj': cellule.iso === aujourdhui(),
          'cal__cellule--event': (evenementsParJour[cellule.iso] ?? []).length > 0,
        }"
      >
        <div class="cal__numero">{{ cellule.date.getDate() }}</div>
        <div v-if="!props.compact" class="cal__liste">
          <div
            v-for="ev in (evenementsParJour[cellule.iso] ?? [])"
            :key="ev.id"
            class="cal__event"
            :style="{ borderColor: ev.couleur ?? 'var(--up-encre)' }"
            @click="ev.onClick?.()"
          >
            <q-icon v-if="ev.icone" :name="ev.icone" size="14px" />
            <span>{{ ev.titre }}</span>
          </div>
        </div>
        <div v-else-if="(evenementsParJour[cellule.iso] ?? []).length" class="cal__compacte">
          <span
            v-for="(ev, i) in (evenementsParJour[cellule.iso] ?? []).slice(0, 3)"
            :key="ev.id"
            class="cal__pastille"
            :style="{ background: ev.couleur ?? 'var(--up-primary)' }"
          >
            {{ i + 1 }}
          </span>
          <span v-if="(evenementsParJour[cellule.iso] ?? []).length > 3" class="cal__pastille cal__pastille--plus">+{{ (evenementsParJour[cellule.iso] ?? []).length - 3 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 12px;
}
.cal__entete {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.cal__titre {
  font-weight: 700;
  font-size: 16px;
  text-transform: capitalize;
  min-width: 180px;
  text-align: center;
}
.cal__grille {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: rgba(0, 0, 0, 0.08);
}
.cal__jh {
  background: var(--up-plaque, #f2f3ee);
  padding: 6px;
  font-weight: 600;
  font-size: 12px;
  text-align: center;
}
.cal__cellule {
  background: white;
  min-height: 90px;
  padding: 4px;
  display: grid;
  gap: 4px;
}
.cal__cellule--hors {
  background: #fafafa;
  color: #bbb;
}
.cal__cellule--auj {
  background: rgba(15, 122, 69, 0.06);
  border: 1px solid var(--up-secondary, #0F7A45);
}
.cal__numero {
  font-size: 12px;
  font-weight: 600;
}
.cal__liste {
  display: grid;
  gap: 2px;
}
/* La couleur du type d'événement cerne la pastille entière : un filet tracé,
   pas un onglet collé sur le flanc. */
.cal__event {
  background: var(--up-craie);
  border: 2px solid;
  padding: 2px 4px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.cal__compacte {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.cal__pastille {
  background: var(--up-primary);
  color: white;
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 10px;
}
.cal__pastille--plus {
  background: #555;
}
</style>
