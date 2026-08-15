<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Mes séances</div>
        <div class="page-sous-titre">
          Suivi de mes cours et des contrôles de présence me concernant
        </div>
      </div>
      <div class="col-auto row q-gutter-sm items-center">
        <champ-date v-model="dateDebut" label="Du" style="width: 152px" />
        <champ-date v-model="dateFin" label="Au" style="width: 152px" />
        <q-btn outline color="primary" icon="print" no-caps label="Ma fiche" @click="imprimer" />
      </div>
    </div>

    <section class="plaque releve-chiffres">
      <div v-for="k in kpis" :key="k.libelle" class="releve-chiffres__cellule">
        <p class="pochoir">{{ k.libelle }}</p>
        <p class="lettrage avec-unite chiffres releve-chiffres__valeur" :class="`text-${k.couleur}`">
          {{ k.valeur }}
        </p>
      </div>
    </section>

    <!-- Sur téléphone, le relevé se lit en plaques : un registre de huit
         colonnes n'entre pas dans 390 px sans rogner ce qui compte. -->
    <ol v-if="$q.screen.lt.md" class="releve-plaques">
      <li v-for="s in fiche?.seances ?? []" :key="s.id">
        <article class="plaque seance-relevee">
          <div class="seance-relevee__corps">
            <p class="pochoir pochoir--brut chiffres seance-relevee__quand">
              {{ dateLisible(s.date) }} · {{ s.horaire }}
            </p>
            <h2 class="lettrage seance-relevee__matiere">{{ s.matiere }}</h2>
            <p class="pochoir seance-relevee__lieu">
              {{ s.promotion }}
              <span v-if="s.salle && s.salle !== '—'" class="plaque-salle">{{ s.salle }}</span>
            </p>
            <p v-if="s.thematiqueTraitee" class="seance-relevee__theme">{{ s.thematiqueTraitee }}</p>
          </div>
          <div class="seance-relevee__constat">
            <champ-statut :statut="s.statut" />
            <span class="pochoir pochoir--brut seance-relevee__duree">
              {{ dureeLisible(s.dureeMinutes) }}
            </span>
          </div>
        </article>
      </li>
      <li v-if="!fiche?.seances?.length" class="seance-relevee__vide pochoir">
        Aucune séance sur cette période.
      </li>
    </ol>

    <q-table
      v-else
      flat
      bordered
      class="carte"
      :rows="fiche?.seances ?? []"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25 }"
    >
      <template #body-cell-statut="p">
        <q-td :props="p">
          <champ-statut :statut="p.row.statut" dense />
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChampStatut from '../components/ChampStatut.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  aujourdhui,
  dateLisible,
  decalerJours,
  dureeLisible,
  heuresLisibles,
} from '../utils/libelles';

const $q = useQuasar();
const auth = useAuthStore();

const dateDebut = ref(decalerJours(aujourdhui(), -60));
const dateFin = ref(aujourdhui());
const fiche = ref<any>(null);
const chargement = ref(false);

const kpis = computed(() => {
  const s = fiche.value?.synthese;
  return [
    { libelle: 'Séances programmées', valeur: s?.planifiees ?? 0, couleur: 'primary' },
    { libelle: 'Séances assurées', valeur: s?.assurees ?? 0, couleur: 'positive' },
    { libelle: 'Absences', valeur: s?.absent ?? 0, couleur: 'negative' },
    { libelle: 'Heures réalisées', valeur: heuresLisibles(s?.heuresRealisees), couleur: 'secondary' },
  ];
});

const colonnes: QTableColumn[] = [
  { name: 'date', label: 'Date', field: (r: any) => dateLisible(r.date), align: 'left', sortable: true },
  { name: 'horaire', label: 'Horaire', field: 'horaire', align: 'left' },
  { name: 'matiere', label: 'Matière', field: 'matiere', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: 'promotion', align: 'left' },
  { name: 'salle', label: 'Salle', field: 'salle', align: 'left' },
  { name: 'statut', label: 'Constat', field: 'statut', align: 'left' },
  {
    name: 'duree',
    label: 'Durée',
    field: (r: any) => dureeLisible(r.dureeMinutes),
    align: 'left',
  },
  { name: 'theme', label: 'Thème déroulé', field: 'thematiqueTraitee', align: 'left' },
];

function imprimer() {
  window.open(
    `${API_URL}/impression/fiche-enseignant/${auth.utilisateur?.enseignantId}` +
      `?dateDebut=${dateDebut.value}&dateFin=${dateFin.value}&token=${auth.token}`,
    '_blank',
  );
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/rapports/ma-fiche', {
      params: { dateDebut: dateDebut.value, dateFin: dateFin.value },
    });
    fiche.value = data;
  } finally {
    chargement.value = false;
  }
}

watch([dateDebut, dateFin], charger);
onMounted(charger);
</script>

<style scoped lang="scss">
.releve-chiffres {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: var(--up-3);
}

.releve-chiffres__cellule {
  padding: var(--up-3);

  & + & { border-left: var(--up-filet); }
}

.releve-chiffres__valeur {
  font-size: clamp(1.5rem, 1.1rem + 2vw, 2.2rem);
  margin: var(--up-1) 0 0;
}

@media (max-width: 767px) {
  .releve-chiffres { grid-template-columns: repeat(2, 1fr); }
  .releve-chiffres__cellule:nth-child(2n + 1) { border-left: 0; }
  .releve-chiffres__cellule:nth-child(n + 3) { border-top: var(--up-filet); }
}

.releve-plaques {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.seance-relevee {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: var(--up-2);
  padding: var(--up-3);
}

.seance-relevee__quand { color: var(--up-encre-douce); margin: 0; }

.seance-relevee__matiere { font-size: 1.05rem; margin: 4px 0 0; }

.seance-relevee__lieu {
  margin: 5px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.seance-relevee__theme {
  margin: 6px 0 0;
  font-size: 0.86rem;
  color: var(--up-encre-douce);
}

.seance-relevee__constat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-2);
  flex: 0 0 auto;
}

.seance-relevee__duree { color: var(--up-encre-douce); }

.seance-relevee__vide {
  padding: var(--up-5) var(--up-3);
  text-align: center;
  color: var(--up-encre-douce);
}
</style>
