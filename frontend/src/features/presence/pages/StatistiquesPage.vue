<template>
  <q-page class="stats">
    <section-navigation section="presence" />
    <page-header :title="$t('statistiques.title')" :subtitle="$t('statistiques.subtitle')">
      <template #actions>
        <div class="stats__periode">
          <champ-date v-model="filtres.dateDebut" :label="$t('common.actions.from')" @update:model-value="raccourciActif = ''" />
          <champ-date v-model="filtres.dateFin" :label="$t('common.actions.to')" @update:model-value="raccourciActif = ''" />
          <q-btn
            round
            color="primary"
            icon="refresh"
            :aria-label="$t('statistiques.filters.recalculateAria')"
            :loading="chargement"
            @click="charger"
          >
            <q-tooltip>{{ $t('common.actions.recalculate') }}</q-tooltip>
          </q-btn>
        </div>
      </template>
    </page-header>

    <div class="stats__raccourcis">
      <button
        v-for="r in raccourcis"
        :key="r.jours"
        type="button"
        class="pochoir raccourci"
        :class="{ 'raccourci--actif': raccourciActif === r.jours }"
        :aria-pressed="raccourciActif === r.jours"
        @click="appliquer(r)"
      >
        {{ r.label }}
      </button>
    </div>

    <div class="stats__barre">
      <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
        <q-tab name="salles" icon="meeting_room" :label="$t('statistiques.tabs.salles')" no-caps />
        <q-tab name="enseignants" icon="school" :label="$t('statistiques.tabs.enseignants')" no-caps />
      </q-tabs>
    </div>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------- par salle -->
      <q-tab-panel name="salles" class="q-pa-none">
        <section v-if="salles?.total" class="plaque releve">
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('statistiques.salles.summary.visited') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ sallesVisitees }}/{{ salles.lignes.length }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('statistiques.salles.summary.controlled') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ salles.total.controlees }}/{{ salles.total.planifiees }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('statistiques.salles.summary.absences') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ salles.total.absent }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('statistiques.salles.summary.hours') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
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
                  <span class="pochoir">{{ $t('common.fields.sessions') }}</span>
                  <span class="lettrage chiffres">{{ l.planifiees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('statistiques.salles.card.controlled') }}</span>
                  <span class="lettrage chiffres">{{ l.controlees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('common.fields.absences') }}</span>
                  <span class="lettrage chiffres" :class="l.absent ? 'text-negative' : ''">
                    {{ l.absent }}
                  </span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('common.fields.students') }}</span>
                  <span class="lettrage chiffres">{{ l.effectifMoyen || '—' }}</span>
                </div>
              </div>

              <div class="fiche__taux">
                <span class="pochoir">{{ $t('statistiques.salles.card.occupation') }}</span>
                <barre-taux :valeur="l.tauxOccupation" />
              </div>
              <div class="fiche__taux">
                <span class="pochoir">{{ $t('common.fields.attendance') }}</span>
                <barre-taux :valeur="l.tauxPresence" />
              </div>

              <footer class="fiche__pied">
                <span class="pochoir">
                  <template v-if="l.derniereVisite">
                    {{ $t('statistiques.salles.card.visitedOn') }}
                    <span class="chiffres">{{ dateLisible(l.derniereVisite) }}</span>
                  </template>
                  <span v-else class="text-negative">{{ $t('statistiques.salles.card.neverVisited') }}</span>
                </span>
                <q-btn
                  v-if="l.salleId"
                  flat
                  dense
                  no-caps
                  size="sm"
                  icon="event_note"
                  :label="$t('statistiques.salles.card.sessionsLink')"
                  :to="lienSeancesSalle(l.salleId)"
                />
              </footer>
            </article>
          </li>
          <li v-if="!(salles?.lignes ?? []).length" class="stats__vide pochoir">
            {{ $t('statistiques.salles.empty.cards') }}
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
          :loading-label="$t('statistiques.salles.table.loading')"
          :no-data-label="$t('statistiques.salles.empty.table')"
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
              <span v-else class="pochoir text-negative">{{ $t('statistiques.salles.card.neverVisited') }}</span>
            </q-td>
          </template>

          <template #body-cell-registre="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="p.row.salleId"
                flat
                dense
                round
                icon="event_note"
                :aria-label="$t('statistiques.salles.actions.sessionsAria')"
                :to="lienSeancesSalle(p.row.salleId)"
              >
                <q-tooltip>{{ $t('statistiques.salles.actions.sessionsTooltip') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- -------------------------------------------------- par enseignant -->
      <q-tab-panel name="enseignants" class="q-pa-none">
        <section v-if="enseignants?.total" class="plaque releve q-mb-md">
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('common.fields.sessions') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ enseignants.total.planifiees }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('common.fields.attendance') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ pourcentLisible(enseignants.total.tauxPresence) }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('common.fields.absences') }}</p>
            <p class="lettrage avec-unite chiffres releve__valeur">
              {{ enseignants.total.absent }}
            </p>
          </div>
          <div class="releve__ligne">
            <p class="pochoir">{{ $t('statistiques.enseignants.summary.hours') }}</p>
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
                <span class="fiche__actions">
                  <q-btn
                    flat
                    dense
                    round
                    icon="event_note"
                    :aria-label="$t('statistiques.enseignants.actions.sessionsAria')"
                    :to="lienSeancesEnseignant(l.enseignantId)"
                  >
                    <q-tooltip>{{ $t('statistiques.enseignants.actions.sessionsTooltip') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    round
                    icon="print"
                    :aria-label="$t('statistiques.enseignants.actions.printAria')"
                    @click="imprimerFiche(l.enseignantId)"
                  >
                    <q-tooltip>{{ $t('statistiques.enseignants.actions.printTooltip') }}</q-tooltip>
                  </q-btn>
                </span>
              </header>

              <div class="fiche__chiffres">
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('common.fields.sessions') }}</span>
                  <span class="lettrage chiffres">{{ l.planifiees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('statistiques.enseignants.card.done') }}</span>
                  <span class="lettrage chiffres">{{ l.assurees }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('statistiques.enseignants.card.late') }}</span>
                  <span class="lettrage chiffres">{{ l.retard }}</span>
                </div>
                <div class="fiche__chiffre">
                  <span class="pochoir">{{ $t('common.fields.absences') }}</span>
                  <span class="lettrage chiffres" :class="l.absent ? 'text-negative' : ''">
                    {{ l.absent }}
                  </span>
                </div>
              </div>

              <div class="fiche__taux">
                <span class="pochoir">{{ $t('common.fields.attendance') }}</span>
                <barre-taux :valeur="l.tauxPresence" />
              </div>

              <footer class="pochoir pochoir--brut fiche__pied">
                {{ $t('statistiques.enseignants.card.hoursDone', { hours: heuresLisibles(l.heuresRealisees) }) }}
              </footer>
            </article>
          </li>
          <li v-if="!(enseignants?.lignes ?? []).length" class="stats__vide pochoir">
            {{ $t('statistiques.enseignants.empty.cards') }}
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
          :loading-label="$t('statistiques.enseignants.table.loading')"
          :no-data-label="$t('statistiques.enseignants.empty.table')"
        >
          <template #body-cell-presence="p">
            <q-td :props="p"><barre-taux :valeur="p.row.tauxPresence" /></q-td>
          </template>

          <template #body-cell-fiche="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="event_note"
                :aria-label="$t('statistiques.enseignants.actions.sessionsAria')"
                :to="lienSeancesEnseignant(p.row.enseignantId)"
              >
                <q-tooltip>{{ $t('statistiques.enseignants.actions.sessionsTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="print"
                :aria-label="$t('statistiques.enseignants.actions.printAria')"
                @click="imprimerFiche(p.row.enseignantId)"
              >
                <q-tooltip>{{ $t('statistiques.enseignants.actions.printTooltip') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import PageHeader from '@/shared/components/PageHeader.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import ChampDate from '@/shared/components/ChampDate.vue';
import BarreTaux from '@/shared/components/BarreTaux.vue';
import { usePresentationListe } from '@/shared/composables/presentationListe';
import { useImpressionFicheEnseignant } from '@/shared/composables/useImpressionFicheEnseignant';
import {
  aujourdhui,
  dateLisible,
  decalerJours,
  heuresLisibles,
  pourcentLisible,
} from '@/shared/utils/libelles';

const $q = useQuasar();
const route = useRoute();
const { t } = useI18n();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

const onglet = ref<'salles' | 'enseignants'>(
  route.query.onglet === 'enseignants' ? 'enseignants' : 'salles',
);
const vue = usePresentationListe();
const chargement = ref(false);
const salles = ref<any>(null);
const enseignants = ref<any>(null);

const filtres = ref({
  dateDebut: route.query.dateDebut
    ? String(route.query.dateDebut)
    : decalerJours(aujourdhui(), -29),
  dateFin: route.query.dateFin ? String(route.query.dateFin) : aujourdhui(),
});

const raccourcis = computed(() => [
  { label: t('statistiques.shortcuts.d7'), jours: 7 },
  { label: t('statistiques.shortcuts.d30'), jours: 30 },
  { label: t('statistiques.shortcuts.d90'), jours: 90 },
]);

// La période choisie doit se voir : sans état actif, les trois raccourcis
// ressemblent à trois boutons inertes.
const raccourciActif = ref<number | ''>(route.query.dateDebut ? '' : 30);

const appliquer = (r: (typeof raccourcis.value)[number]) => {
  raccourciActif.value = r.jours;
  filtres.value = {
    dateDebut: decalerJours(aujourdhui(), -(r.jours - 1)),
    dateFin: aujourdhui(),
  };
};

/** Un relevé se termine toujours par « et concrètement, quelles séances ? ». */
const lienSeancesSalle = (salleId: string) => ({
  name: 'seances',
  query: { salleId, dateDebut: filtres.value.dateDebut, dateFin: filtres.value.dateFin },
});

const lienSeancesEnseignant = (enseignantId: string) => ({
  name: 'seances',
  query: { enseignantId, dateDebut: filtres.value.dateDebut, dateFin: filtres.value.dateFin },
});

const sallesVisitees = computed(
  () => (salles.value?.lignes ?? []).filter((l: any) => l.controlees > 0).length,
);

const colonnesSalles = computed<QTableColumn[]>(() => [
  { name: 'salle', label: t('common.fields.room'), field: 'code', align: 'left', sortable: true },
  { name: 'planifiees', label: t('common.fields.sessions'), field: 'planifiees', align: 'right', sortable: true },
  { name: 'controlees', label: t('statistiques.salles.table.columns.controlees'), field: 'controlees', align: 'right', sortable: true },
  { name: 'absent', label: t('common.fields.absences'), field: 'absent', align: 'right', sortable: true },
  { name: 'effectif', label: t('statistiques.salles.table.columns.effectif'), field: 'effectifMoyen', align: 'right', sortable: true },
  { name: 'occupation', label: t('statistiques.salles.table.columns.occupation'), field: 'tauxOccupation', align: 'left', sortable: true },
  { name: 'presence', label: t('common.fields.attendance'), field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'visite', label: t('statistiques.salles.table.columns.visite'), field: 'derniereVisite', align: 'left', sortable: true },
  { name: 'registre', label: '', field: 'salleId', align: 'right' },
]);

// Sur téléphone, on garde ce que le contrôleur cherche : où il est passé, ce
// qu'il y a constaté.
const colonnesSallesVisibles = computed(() =>
  $q.screen.lt.md
    ? ['salle', 'controlees', 'absent', 'presence']
    : colonnesSalles.value.map((c) => String(c.name)),
);

const colonnesEnseignantsVisibles = computed(() =>
  $q.screen.lt.md
    ? ['nom', 'absent', 'presence']
    : colonnesEnseignants.value.map((c) => String(c.name)),
);

const colonnesEnseignants = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('statistiques.enseignants.table.columns.matricule'), field: 'matricule', align: 'left' },
  { name: 'nom', label: t('common.fields.teacher'), field: 'nom', align: 'left', sortable: true },
  { name: 'departement', label: t('common.fields.department'), field: 'departement', align: 'left' },
  { name: 'planifiees', label: t('common.fields.sessions'), field: 'planifiees', align: 'right', sortable: true },
  { name: 'assurees', label: t('statistiques.enseignants.table.columns.assurees'), field: 'assurees', align: 'right' },
  { name: 'retard', label: t('statistiques.enseignants.table.columns.retard'), field: 'retard', align: 'right', sortable: true },
  { name: 'absent', label: t('common.fields.absences'), field: 'absent', align: 'right', sortable: true },
  {
    name: 'heures',
    label: t('common.fields.hours'),
    field: (r: any) => heuresLisibles(r.heuresRealisees),
    align: 'right',
  },
  { name: 'presence', label: t('common.fields.attendance'), field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'fiche', label: '', field: 'enseignantId', align: 'right' },
]);

function imprimerFiche(id: string) {
  ouvrirFicheEnseignant(id, filtres.value.dateDebut, filtres.value.dateFin);
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

.stats__periode {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

// Même gouttière que le registre des séances ; le reste vient de la règle
// globale `.raccourci` d'app.scss.
.stats__raccourcis {
  display: inline-flex;
  align-self: flex-start;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon);
  padding: 3px;
  gap: 2px;
  margin-bottom: var(--up-3);
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
    letter-spacing: -0.01em;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
}

.fiche__actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
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
