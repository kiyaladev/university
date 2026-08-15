<template>
  <q-page class="stats">
    <header class="stats__entete">
      <div>
        <h1 class="page-titre">Statistiques</h1>
        <p class="page-sous-titre">
          Ce que la tournée a produit — salle par salle, enseignant par enseignant
        </p>
      </div>

      <div class="stats__periode">
        <champ-date v-model="filtres.dateDebut" label="Du" />
        <champ-date v-model="filtres.dateFin" label="Au" />
        <q-btn round color="primary" icon="refresh" :loading="chargement" @click="charger" />
      </div>
    </header>

    <div class="stats__raccourcis">
      <button
        v-for="r in raccourcis"
        :key="r.label"
        type="button"
        class="pochoir raccourci"
        @click="appliquer(r.jours)"
      >
        {{ r.label }}
      </button>
    </div>

    <div class="stats__barre">
      <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
        <q-tab name="salles" icon="meeting_room" label="Par salle" no-caps />
        <q-tab name="enseignants" icon="school" label="Par enseignant" no-caps />
      </q-tabs>
      <bascule-vue v-model="vue" />
    </div>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------- par salle -->
      <q-tab-panel name="salles" class="q-pa-none">
        <section v-if="salles?.total" class="plaque releve">
          <div class="releve__ligne">
            <p class="pochoir">Salles visitées</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ sallesVisitees }}/{{ salles.lignes.length }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">Séances contrôlées</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ salles.total.controlees }}/{{ salles.total.planifiees }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">Absences constatées</p>
            <p class="lettrage avec-unite chiffres releve__valeur text-negative">
              {{ salles.total.absent }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">Heures assurées</p>
            <p class="lettrage avec-unite chiffres releve__valeur text-positive">
              {{ heuresLisibles(salles.total.heuresRealisees) }}
            </p>
          </div>
        </section>

        <ul v-if="vue === 'cartes'" class="cartes q-mt-md">
          <li v-for="l in salles?.lignes ?? []" :key="l.code">
            <article class="plaque fiche">
              <header class="fiche__tete">
                <span class="plaque-salle">{{ l.code }}</span>
                <span class="fiche__titre">
                  <span class="lettrage fiche__nom">{{ l.nom }}</span>
                  <span v-if="l.batiment" class="pochoir fiche__sous">{{ l.batiment }}</span>
                </span>
              </header>

              <div class="fiche__chiffres">
                <div class="fiche__chiffre">
                  <span class="pochoir">Séances</span>
                  <span class="lettrage chiffres">{{ l.planifiees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">Contrôlées</span>
                  <span class="lettrage chiffres text-positive">{{ l.controlees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">Absences</span>
                  <span class="lettrage chiffres" :class="l.absent ? 'text-negative' : ''">
                    {{ l.absent }}
                  </span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">Étudiants</span>
                  <span class="lettrage chiffres">{{ l.effectifMoyen || '—' }}</span>
                </div>
              </div>

              <div class="fiche__taux">
                <span class="pochoir">Occupation</span>
                <barre-taux :valeur="l.tauxOccupation" />
              </div>
              <div class="fiche__taux">
                <span class="pochoir">Présence</span>
                <barre-taux :valeur="l.tauxPresence" />
              </div>

              <footer class="pochoir fiche__pied">
                <template v-if="l.derniereVisite">
                  Vue le <span class="chiffres">{{ dateLisible(l.derniereVisite) }}</span>
                </template>
                <span v-else class="text-negative">jamais visitée</span>
              </footer>
            </article>
          </li>
          <li v-if="!(salles?.lignes ?? []).length" class="stats__vide pochoir">
            Aucune salle sur la période.
          </li>
        </ul>

        <q-table
          v-else
          flat
          bordered
          class="carte q-mt-md"
          :rows="salles?.lignes ?? []"
          :columns="colonnesSalles"
          row-key="code"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25, sortBy: 'code' }"
          :visible-columns="colonnesSallesVisibles"
        >
          <template #body-cell-salle="p">
            <q-td :props="p">
              <div class="stats__salle">
                <span class="plaque-salle">{{ p.row.code }}</span>
                <span>
                  <span class="stats__nom-salle">{{ p.row.nom }}</span>
                  <span v-if="p.row.batiment" class="pochoir stats__batiment">
                    {{ p.row.batiment }}
                  </span>
                </span>
              </div>
            </q-td>
          </template>

          <template #body-cell-occupation="p">
            <q-td :props="p"><barre-taux :valeur="p.row.tauxOccupation" /></q-td>
          </template>

          <template #body-cell-presence="p">
            <q-td :props="p"><barre-taux :valeur="p.row.tauxPresence" /></q-td>
          </template>

          <template #body-cell-visite="p">
            <q-td :props="p">
              <span v-if="p.row.derniereVisite" class="chiffres">
                {{ dateLisible(p.row.derniereVisite) }}
              </span>
              <span v-else class="pochoir text-negative">jamais visitée</span>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- -------------------------------------------------- par enseignant -->
      <q-tab-panel name="enseignants" class="q-pa-none">
        <section v-if="enseignants?.total" class="plaque releve q-mb-md">
          <div class="releve__ligne">
            <p class="pochoir">Séances</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ enseignants.total.planifiees }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">Présence</p>
            <p class="lettrage avec-unite chiffres releve__valeur text-positive">
              {{ pourcentLisible(enseignants.total.tauxPresence) }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">Absences</p>
            <p class="lettrage avec-unite chiffres releve__valeur text-negative">
              {{ enseignants.total.absent }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">Heures assurées</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ heuresLisibles(enseignants.total.heuresRealisees) }}
            </p>
          </div>
        </section>

        <ul v-if="vue === 'cartes'" class="cartes">
          <li v-for="l in enseignants?.lignes ?? []" :key="l.enseignantId">
            <article class="plaque fiche">
              <header class="fiche__tete">
                <span class="fiche__titre">
                  <span class="lettrage fiche__nom">{{ l.nom }}</span>
                  <span class="pochoir fiche__sous">
                    {{ l.matricule }}<template v-if="l.departement"> · {{ l.departement }}</template>
                  </span>
                </span>
                <q-btn flat dense round icon="print" @click="imprimerFiche(l.enseignantId)">
                  <q-tooltip>Fiche d’assiduité</q-tooltip>
                </q-btn>
              </header>

              <div class="fiche__chiffres">
                <div class="fiche__chiffre">
                  <span class="pochoir">Séances</span>
                  <span class="lettrage chiffres">{{ l.planifiees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">Assurées</span>
                  <span class="lettrage chiffres text-positive">{{ l.assurees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">Retards</span>
                  <span class="lettrage chiffres">{{ l.retard }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">Absences</span>
                  <span class="lettrage chiffres" :class="l.absent ? 'text-negative' : ''">
                    {{ l.absent }}
                  </span>
                </div>
              </div>

              <div class="fiche__taux">
                <span class="pochoir">Présence</span>
                <barre-taux :valeur="l.tauxPresence" />
              </div>

              <footer class="pochoir pochoir--brut fiche__pied">
                {{ heuresLisibles(l.heuresRealisees) }} assurées
              </footer>
            </article>
          </li>
          <li v-if="!(enseignants?.lignes ?? []).length" class="stats__vide pochoir">
            Aucun enseignant sur la période.
          </li>
        </ul>

        <q-table
          v-else
          flat
          bordered
          class="carte"
          :rows="enseignants?.lignes ?? []"
          :columns="colonnesEnseignants"
          row-key="enseignantId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
          :visible-columns="colonnesEnseignantsVisibles"
        >
          <template #top-right>
            <div class="text-caption">
              {{ enseignants?.total?.planifiees ?? 0 }} séances ·
              présence {{ pourcentLisible(enseignants?.total?.tauxPresence) }} ·
              {{ heuresLisibles(enseignants?.total?.heuresRealisees) }} assurées
            </div>
          </template>

          <template #body-cell-presence="p">
            <q-td :props="p"><barre-taux :valeur="p.row.tauxPresence" /></q-td>
          </template>

          <template #body-cell-fiche="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="print" @click="imprimerFiche(p.row.enseignantId)">
                <q-tooltip>Fiche d’assiduité</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChampDate from '../components/ChampDate.vue';
import BarreTaux from '../components/BarreTaux.vue';
import BasculeVue from '../components/BasculeVue.vue';
import { useVuePreferee } from '../composables/vuePreferee';
import {
  aujourdhui,
  dateLisible,
  decalerJours,
  heuresLisibles,
  pourcentLisible,
} from '../utils/libelles';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<'salles' | 'enseignants'>('salles');
const vue = useVuePreferee('statistiques');
const chargement = ref(false);
const salles = ref<any>(null);
const enseignants = ref<any>(null);

const filtres = ref({
  dateDebut: decalerJours(aujourdhui(), -29),
  dateFin: aujourdhui(),
});

const raccourcis = [
  { label: '7 jours', jours: 7 },
  { label: '30 jours', jours: 30 },
  { label: '90 jours', jours: 90 },
];

const appliquer = (jours: number) => {
  filtres.value = { dateDebut: decalerJours(aujourdhui(), -(jours - 1)), dateFin: aujourdhui() };
};

const sallesVisitees = computed(
  () => (salles.value?.lignes ?? []).filter((l: any) => l.controlees > 0).length,
);

const colonnesSalles: QTableColumn[] = [
  { name: 'salle', label: 'Salle', field: 'code', align: 'left', sortable: true },
  { name: 'planifiees', label: 'Séances', field: 'planifiees', align: 'right', sortable: true },
  { name: 'controlees', label: 'Contr.', field: 'controlees', align: 'right', sortable: true },
  { name: 'absent', label: 'Absences', field: 'absent', align: 'right', sortable: true },
  { name: 'effectif', label: 'Étud.', field: 'effectifMoyen', align: 'right', sortable: true },
  { name: 'occupation', label: 'Occupation', field: 'tauxOccupation', align: 'left', sortable: true },
  { name: 'presence', label: 'Présence', field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'visite', label: 'Vue le', field: 'derniereVisite', align: 'left', sortable: true },
];

// Sur téléphone, on garde ce que le contrôleur cherche : où il est passé, ce
// qu'il y a constaté.
const colonnesSallesVisibles = computed(() =>
  $q.screen.lt.md
    ? ['salle', 'controlees', 'absent', 'presence']
    : colonnesSalles.map((c) => String(c.name)),
);

const colonnesEnseignantsVisibles = computed(() =>
  $q.screen.lt.md
    ? ['nom', 'absent', 'presence']
    : colonnesEnseignants.map((c) => String(c.name)),
);

const colonnesEnseignants: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left' },
  { name: 'nom', label: 'Enseignant', field: 'nom', align: 'left', sortable: true },
  { name: 'departement', label: 'Département', field: 'departement', align: 'left' },
  { name: 'planifiees', label: 'Séances', field: 'planifiees', align: 'right', sortable: true },
  { name: 'assurees', label: 'Assurées', field: 'assurees', align: 'right' },
  { name: 'retard', label: 'Retards', field: 'retard', align: 'right', sortable: true },
  { name: 'absent', label: 'Absences', field: 'absent', align: 'right', sortable: true },
  {
    name: 'heures',
    label: 'Heures',
    field: (r: any) => heuresLisibles(r.heuresRealisees),
    align: 'right',
  },
  { name: 'presence', label: 'Présence', field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'fiche', label: '', field: 'enseignantId', align: 'right' },
];

function imprimerFiche(id: string) {
  window.open(
    `${API_URL}/impression/fiche-enseignant/${id}` +
      `?dateDebut=${filtres.value.dateDebut}&dateFin=${filtres.value.dateFin}&token=${auth.token}`,
    '_blank',
  );
}

async function charger() {
  chargement.value = true;
  try {
    const [s, e] = await Promise.all([
      api.get('/rapports/salles', { params: filtres.value }),
      api.get('/rapports/presence-enseignants', { params: filtres.value }),
    ]);
    salles.value = s.data;
    enseignants.value = e.data;
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });
onMounted(charger);

</script>

<style scoped lang="scss">
.stats {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.stats__entete {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
  margin-bottom: var(--up-3);
}

.stats__periode {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

.stats__raccourcis {
  display: flex;
  gap: 0;
  margin-bottom: var(--up-3);
}

.raccourci {
  appearance: none;
  background: var(--up-plaque);
  color: var(--up-encre);
  border: 2px solid var(--up-encre);
  padding: 8px 12px;
  min-height: 40px;
  cursor: pointer;

  & + & { border-left-width: 0; }
  &:hover { background: var(--up-craie); }
}

.stats__salle {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

.stats__nom-salle { display: block; }

.stats__batiment { color: var(--up-encre-douce); }

.releve {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.releve__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding: var(--up-3);

  &:nth-child(2n) { border-left: var(--up-filet); }
  &:nth-child(n + 3) { border-top: var(--up-filet); }
}

.releve__valeur {
  font-size: clamp(1.4rem, 1rem + 1.6vw, 2rem);
  margin: 0;
  white-space: nowrap;
}

// --------------------------------------------------------------- vue cartes

.stats__barre {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.cartes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: var(--up-3);
}

.fiche {
  display: flex;
  flex-direction: column;
  gap: var(--up-2);
  padding: var(--up-3);
  height: 100%;
}

.fiche__tete {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--up-2);
  padding-bottom: var(--up-2);
  border-bottom: var(--up-filet);
}

.fiche__titre {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fiche__nom {
  font-size: 1.02rem;
  overflow-wrap: anywhere;
}

.fiche__sous {
  color: var(--up-encre-douce);
  // Le matricule et le département tiennent sur une ligne : deux lignes ici
  // décalent les chiffres d'une carte à l'autre et cassent la comparaison.
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Quatre chiffres alignés : c'est la comparaison que le tableau donnait,
// tenue dans la largeur d'une carte.
.fiche__chiffres {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--up-2);
}

.fiche__chiffre {
  display: flex;
  flex-direction: column;
  gap: 1px;

  // Quatre étiquettes côte à côte : sans desserrer le pochoir, « SÉANCES »
  // et « ASSURÉES » se touchent et le mot devient illisible.
  .pochoir {
    color: var(--up-encre-douce);
    font-size: 10px;
    letter-spacing: 0.02em;
  }

  .lettrage { font-size: 1.25rem; }
}

.fiche__taux {
  display: flex;
  align-items: center;
  gap: var(--up-2);

  .pochoir { color: var(--up-encre-douce); min-width: 76px; }
  > :last-child { flex: 1; }
}

.fiche__pied {
  color: var(--up-encre-douce);
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
  margin-top: auto;
}

.stats__vide {
  grid-column: 1 / -1;
  padding: var(--up-5);
  text-align: center;
  color: var(--up-encre-douce);
}

@media (max-width: 599px) {
  .cartes { grid-template-columns: 1fr; }
  .stats__barre { align-items: stretch; }
  .stats__periode { width: 100%; }
  .releve { grid-template-columns: 1fr; }
  .releve__ligne:nth-child(2n) { border-left: 0; }
  .releve__ligne + .releve__ligne { border-top: var(--up-filet); }
}
</style>
