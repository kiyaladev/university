<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Stages &amp; mémoires</div>
        <div class="page-sous-titre">
          Sujet proposé → validé → encadré → rapport rendu → soutenu. Suivi tenu par la
          scolarité et la direction ; l'enseignant pilote ses encadrements, l'étudiant
          ses travaux (via le portail).
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouveau travail"
          @click="ouvrirCreation"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="travaux" icon="view_kanban" label="Travaux" no-caps />
      <q-tab name="soutenances" icon="event" label="Soutenances" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- TRAVAUX : Kanban + tableau + statistiques                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'travaux'" name="travaux" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresTravaux"
        :chips="chipsTravaux"
        placeholder="Rechercher (intitulé, entreprise, lieu…)"
        @reinitialiser="reinitialiserTravaux"
      >
        <template #avances>
          <q-select
            v-model="filtresTravaux.type"
            :options="optionsTypes"
            emit-value
            map-options
            dense
            outlined
            clearable
            label="Type"
          />
          <autocomplete-async
            v-model="filtresTravaux.encadrantId"
            endpoint="/enseignants"
            :label-fn="(e) => `${e.nom} ${e.prenom} (${e.matricule})`"
            label="Encadrant"
          />
        </template>
        <template #actions>
          <view-toggle
            cle="stages.travaux"
            :modes="['kanban', 'tableau']"
            defaut="kanban"
            @update:mode="(v: string) => (modeTravail = v as 'kanban' | 'tableau')"
          />
        </template>
      </filter-bar>

      <!-- Compteurs par statut -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div
          v-for="c in compteurs"
          :key="c.statut"
          class="col-6 col-sm-4 col-lg-2"
        >
          <q-card
            flat
            bordered
            class="carte carte-compteur"
            :class="{ 'carte-compteur--actif': filtresTravaux.statut === c.statut }"
            @click="basculerStatut(c.statut)"
          >
            <q-card-section class="text-center q-py-sm">
              <div class="text-h5 q-mb-none">{{ c.nb }}</div>
              <div class="text-caption text-grey-7">{{ c.label }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Vue Kanban -->
      <kanban-board
        v-if="modeTravail === 'kanban'"
        :colonnes="colonnesKanban"
      />

      <!-- Vue tableau -->
      <q-table
        v-else
        flat
        bordered
        class="carte"
        :rows="lignesVisibles"
        :columns="colonnes"
        row-key="id"
        :loading="chargement"
        :pagination="{ rowsPerPage: 20 }"
      >
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="work_off" size="38px" color="grey-5" />
            <div class="q-mt-sm">Aucun travail encadré pour ces critères.</div>
            <div class="text-caption q-mt-xs">
              Le parcours commence par un sujet proposé, puis validé par la
              scolarité.
            </div>
            <q-btn
              v-if="peutCreer"
              flat
              no-caps
              color="primary"
              icon="add"
              label="Nouveau travail"
              class="q-mt-sm"
              @click="ouvrirCreation"
            />
          </div>
        </template>

        <template #body-cell-intitule="p">
          <q-td :props="p">
            <div class="text-weight-medium">
              {{ LIBELLE_TYPE_ENCADREMENT[p.row.type] }} — {{ p.row.intitule }}
            </div>
            <div v-if="p.row.entreprise" class="text-caption text-grey-7">
              {{ p.row.entreprise }}
            </div>
          </q-td>
        </template>
        <template #body-cell-etudiant="p">
          <q-td :props="p">
            <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
            <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule ?? '' }}</div>
          </q-td>
        </template>
        <template #body-cell-encadrant="p">
          <q-td :props="p">
            <span v-if="p.row.encadrant">{{ p.row.encadrant.nom }} {{ p.row.encadrant.prenom }}</span>
            <span v-else class="text-grey-6">À désigner</span>
          </q-td>
        </template>
        <template #body-cell-periode="p">
          <q-td :props="p">
            <span v-if="p.row.dateDebut || p.row.dateFin">
              {{ dateLisible(p.row.dateDebut) }} → {{ dateLisible(p.row.dateFin) }}
            </span>
            <span v-else class="text-grey-6">—</span>
          </q-td>
        </template>
        <template #body-cell-statut="p">
          <q-td :props="p">
            <q-chip :color="couleurStatut(p.row.statut)" text-color="white" dense square>
              {{ LIBELLE_STATUT_ENCADREMENT[p.row.statut] ?? p.row.statut }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-rapport="p">
          <q-td :props="p" class="text-center">
            <q-toggle
              :model-value="p.row.rapportRendu"
              color="positive"
              :disable="
                ['SOUTENU', 'ABANDONNE'].includes(p.row.statut) || !peutModifierRapport(p.row)
              "
              @update:model-value="(v: boolean) => basculerRapport(p.row, v)"
            />
            <div class="text-caption text-grey-7">
              {{ p.row.rapportRendu ? 'Rendu' : 'En attente' }}
            </div>
          </q-td>
        </template>
        <template #body-cell-soutenance="p">
          <q-td :props="p">
            <template v-if="p.row.soutenance">
              <div>{{ dateHeureLisible(p.row.soutenance.date) }}</div>
              <div class="text-caption text-grey-7">
                <template v-if="p.row.soutenance.note !== null">
                  {{ p.row.soutenance.note }}/20<template v-if="p.row.soutenance.mention"> · {{ p.row.soutenance.mention }}</template>
                </template>
                <span v-else>Constat en attente</span>
              </div>
            </template>
            <span v-else class="text-grey-6">—</span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense round icon="visibility" aria-label="Voir la fiche du travail" @click="detail = p.row">
              <q-tooltip>Voir la fiche</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
              flat dense round icon="edit" aria-label="Modifier le travail" @click="ouvrirEdition(p.row)"
            >
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="print" aria-label="Imprimer la fiche" @click="imprimer(p.row)">
              <q-tooltip>Imprimer la fiche</q-tooltip>
            </q-btn>
            <template v-if="boutonsTransition(p.row).length">
              <q-btn
                v-for="b in boutonsTransition(p.row).slice(0, 1)"
                :key="b.statut"
                flat dense round
                :color="b.couleur"
                :icon="b.icone"
                :aria-label="b.libelle"
                @click="transition(p.row, b.statut)"
              >
                <q-tooltip>{{ b.libelle }}</q-tooltip>
              </q-btn>
            </template>
            <q-btn
              v-if="peutPlanifierSoutenance(p.row)"
              flat dense round color="primary" icon="groups"
              aria-label="Planifier la soutenance"
              @click="ouvrirSoutenance(p.row)"
            >
              <q-tooltip>Planifier la soutenance</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutConstatJury(p.row)"
              flat dense round color="deep-purple" icon="fact_check"
              aria-label="Saisir le constat du jury"
              @click="ouvrirJury(p.row)"
            >
              <q-tooltip>Constat du jury</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
              flat dense round color="negative" icon="delete"
              aria-label="Supprimer le travail"
              @click="supprimer(p.row)"
            >
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>

      <!-- Statistiques par type -->
      <div class="row q-col-gutter-md q-mt-md">
        <q-card flat bordered class="col-12 col-md-6 carte">
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium q-mb-sm">Répartition par type</div>
            <q-list dense>
              <q-item v-for="s in statsParType" :key="s.type">
                <q-item-section>
                  <q-item-label>{{ s.label }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge color="primary" :label="s.nb" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="col-12 col-md-6 carte">
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium q-mb-sm">Répartition par statut</div>
            <q-list dense>
              <q-item v-for="c in compteurs" :key="`stat-${c.statut}`">
                <q-item-section>
                  <q-item-label>{{ c.label }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge :color="couleurStatut(c.statut)" :label="c.nb" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- SOUTENANCES : calendrier des soutenances à venir                   -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'soutenances'" name="soutenances" class="q-pa-none q-mt-md">
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="stat-chiffre chiffres">{{ soutenancesAVenir.length }}</div>
              <div class="pochoir text-grey-7">Soutenances des 7 prochains jours</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="stat-chiffre chiffres">{{ travauxFiltresSoutenance.length }}</div>
              <div class="pochoir text-grey-7">Travaux en phase de soutenance</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="stat-chiffre chiffres">{{ travauxSoutenus.length }}</div>
              <div class="pochoir text-grey-7">Travaux soutenus</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <filter-bar
        v-model="filtresSoutenances"
        :chips="chipsSoutenances"
        placeholder="Rechercher (intitulé, étudiant, salle…)"
        @reinitialiser="filtresSoutenances = { recherche: '', statut: null }"
      >
        <template #avances>
          <q-select
            v-model="filtresSoutenances.statut"
            :options="optionsStatutsTravail"
            emit-value
            map-options
            dense
            outlined
            clearable
            label="Statut travail"
          />
        </template>
      </filter-bar>

      <calendar-grid
        :evenements="evenementsSoutenances"
        :compact="false"
      />

      <!-- Le serveur ne renvoie que la fenêtre des 7 jours : on le dit. -->
      <q-list separator bordered class="q-mt-md carte">
        <q-item-label header class="text-subtitle1">
          Soutenances des 7 prochains jours
        </q-item-label>
        <q-item v-for="s in soutenancesFiltrees" :key="s.id" clickable @click="detail = s.travailEncadre ?? null">
          <q-item-section>
            <q-item-label>
              {{ dateHeureLisible(s.date) }}
              <span class="text-grey-7">· {{ s.salle ? `${s.salle.nom} (${s.salle.code})` : 'salle à fixer' }}</span>
            </q-item-label>
            <q-item-label caption>
              {{ s.travailEncadre?.intitule }} — {{ s.travailEncadre?.etudiant?.nom }}
              {{ s.travailEncadre?.etudiant?.prenom }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-chip v-if="s.president" size="sm" color="secondary" text-color="white" square>
              {{ s.president.nom }} {{ s.president.prenom }}
            </q-chip>
          </q-item-section>
        </q-item>
        <q-item v-if="!soutenancesFiltrees.length">
          <q-item-section class="text-grey-7 text-center q-py-md">
            <div>Aucune soutenance programmée dans les 7 prochains jours.</div>
            <div class="text-caption q-mt-xs">
              Une soutenance se planifie depuis l'onglet « Travaux », sur un
              dossier en cours dont le rapport est rendu.
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-tab-panel>

    <!-- Dialog création / édition -->
    <travail-dialog v-model="dialogTravail" :travail="travailEdite" @enregistre="charger" />

    <!-- Dialog soutenance (planification ou constat du jury) -->
    <soutenance-dialog
      v-if="travailSoutenance"
      v-model="dialogSoutenance"
      :travail="travailSoutenance"
      :mode="modeSoutenance"
      @enregistre="charger"
    />

    <!-- Détail -->
    <q-dialog :model-value="!!detail" @update:model-value="detail = null">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">Travail encadré</q-card-section>
        <q-card-section v-if="detail">
          <q-list dense>
            <q-item>
              <q-item-section>Type</q-item-section>
              <q-item-section side>{{ LIBELLE_TYPE_ENCADREMENT[detail.type] }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <span class="text-weight-medium">{{ detail.intitule }}</span>
                <span v-if="detail.description" class="text-caption text-grey-7">
                  {{ detail.description }}
                </span>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Étudiant</q-item-section>
              <q-item-section side>
                {{ detail.etudiant?.nom }} {{ detail.etudiant?.prenom }}
                ({{ detail.etudiant?.matricule }})
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Encadrant</q-item-section>
              <q-item-section side>
                {{ detail.encadrant ? `${detail.encadrant.nom} ${detail.encadrant.prenom}` : 'À désigner' }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Entreprise</q-item-section>
              <q-item-section side>{{ detail.entreprise ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Tuteur entreprise</q-item-section>
              <q-item-section side>{{ detail.tuteurEntreprise ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Lieu</q-item-section>
              <q-item-section side>{{ detail.lieu ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Période</q-item-section>
              <q-item-section side>
                {{ dateLisible(detail.dateDebut) }} → {{ dateLisible(detail.dateFin) }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Rapport rendu</q-item-section>
              <q-item-section side>{{ detail.rapportRendu ? 'Oui' : 'Non' }}</q-item-section>
            </q-item>
            <q-item v-if="detail.soutenance">
              <q-item-section>Soutenance</q-item-section>
              <q-item-section side>
                {{ dateHeureLisible(detail.soutenance.date) }}
                <template v-if="detail.soutenance.note !== null">
                  · {{ detail.soutenance.note }}/20
                  <template v-if="detail.soutenance.mention"> · {{ detail.soutenance.mention }}</template>
                </template>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Statut</q-item-section>
              <q-item-section side>
                <q-chip :color="couleurStatut(detail.statut)" text-color="white" dense square>
                  {{ LIBELLE_STATUT_ENCADREMENT[detail.statut] }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import SoutenanceDialog from '../components/SoutenanceDialog.vue';
import TravailDialog from '../components/TravailDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import KanbanBoard from '../components/KanbanBoard.vue';
import CalendarGrid from '../components/CalendarGrid.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { API_URL, api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import {
  LIBELLE_STATUT_ENCADREMENT,
  LIBELLE_TYPE_ENCADREMENT,
  dateHeureLisible,
  dateLisible,
  aujourdhui,
} from '../utils/libelles';
import type {
  StatutEncadrement,
  TravailEncadre,
  TypeEncadrement, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

type SoutenanceCalendrier = {
  id: string;
  date: string;
  salleId?: string | null;
  presidentId?: string | null;
  note?: number | null;
  mention?: string | null;
  salle?: { id: string; code: string; nom: string } | null;
  president?: { id: string; nom: string; prenom: string } | null;
  travailEncadre?: TravailEncadre | null;
};

const onglet = ref<'travaux' | 'soutenances'>('travaux');
const modeTravail = ref<'kanban' | 'tableau'>('kanban');

const travaux = ref<TravailEncadre[]>([]);
const soutenancesAVenir = ref<SoutenanceCalendrier[]>([]);
const chargement = ref(false);
const detail = ref<TravailEncadre | null>(null);

const filtresTravaux = ref<Record<string, any>>({
  recherche: '',
  type: null,
  statut: null,
  encadrantId: null,
});

const filtresSoutenances = ref<Record<string, any>>({
  recherche: '',
  statut: null,
});

const dialogTravail = ref(false);
const travailEdite = ref<TravailEncadre | null>(null);
const dialogSoutenance = ref(false);
const travailSoutenance = ref<TravailEncadre | null>(null);
const modeSoutenance = ref<'planifier' | 'jury'>('planifier');

const optionsTypes = [
  { label: 'Mémoire', value: 'MEMOIRE' },
  { label: 'Stage', value: 'STAGE' },
  { label: 'Rapport', value: 'RAPPORT' },
];

const optionsStatutsTravail = (Object.keys(LIBELLE_STATUT_ENCADREMENT) as StatutEncadrement[]).map((v) => ({
  label: LIBELLE_STATUT_ENCADREMENT[v],
  value: v,
}));

interface BoutonTransition {
  statut: StatutEncadrement;
  libelle: string;
  icone: string;
  couleur: string;
  role?: string[];
}

const BOUTONS_PAR_STATUT: Record<StatutEncadrement, BoutonTransition[]> = {
  PROPOSE: [
    { statut: 'VALIDE', libelle: 'Valider', icone: 'check', couleur: 'positive' },
    { statut: 'ABANDONNE', libelle: 'Abandonner', icone: 'flag', couleur: 'negative' },
  ],
  VALIDE: [
    { statut: 'EN_COURS', libelle: "Démarrer l'encadrement", icone: 'play_arrow', couleur: 'primary' },
    { statut: 'ABANDONNE', libelle: 'Abandonner', icone: 'flag', couleur: 'negative' },
  ],
  EN_COURS: [
    { statut: 'SOUTENU', libelle: 'Passer en SOUTENU', icone: 'workspace_premium', couleur: 'positive' },
    { statut: 'ABANDONNE', libelle: 'Abandonner', icone: 'flag', couleur: 'negative' },
  ],
  SOUTENU: [],
  ABANDONNE: [
    { statut: 'PROPOSE', libelle: 'Réactiver', icone: 'restart_alt', couleur: 'primary', role: ['ADMIN'] },
  ],
};

const colonnes: QTableColumn[] = [
  { name: 'intitule', label: 'Travail', field: 'intitule', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiantId', align: 'left' },
  { name: 'encadrant', label: 'Encadrant', field: 'encadrantId', align: 'left' },
  { name: 'periode', label: 'Période', field: 'dateDebut', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'rapport', label: 'Rapport', field: 'rapportRendu', align: 'center' },
  { name: 'soutenance', label: 'Soutenance', field: 'soutenance', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const couleurStatut = (s: string) =>
  s === 'SOUTENU'
    ? 'positive'
    : s === 'ABANDONNE'
      ? 'negative'
      : s === 'EN_COURS'
        ? 'primary'
        : s === 'VALIDE'
          ? 'secondary'
          : 'grey-7';

const COLONNES_KANBAN: Array<{
  statut: StatutEncadrement;
  titre: string;
  couleur: string;
}> = [
  { statut: 'PROPOSE', titre: 'Proposé', couleur: '#6b7280' },
  { statut: 'VALIDE', titre: 'Validé', couleur: '#0F7A45' },
  { statut: 'EN_COURS', titre: 'En cours', couleur: '#10251E' },
  { statut: 'SOUTENU', titre: 'Soutenu', couleur: '#0F7A45' },
  { statut: 'ABANDONNE', titre: 'Abandonné', couleur: '#C4122E' },
];

const compteurs = computed(() => {
  const statuts: StatutEncadrement[] = ['PROPOSE', 'VALIDE', 'EN_COURS', 'SOUTENU', 'ABANDONNE'];
  return statuts.map((statut) => ({
    statut,
    label: LIBELLE_STATUT_ENCADREMENT[statut] ?? statut,
    nb: travaux.value.filter((t) => t.statut === statut).length,
  }));
});

const lignesVisibles = computed(() => {
  let liste = travaux.value;
  if (filtresTravaux.value.statut) {
    liste = liste.filter((t) => t.statut === filtresTravaux.value.statut);
  }
  return liste;
});

/** Chips des filtres actifs : sans elles, FilterBar masque « Réinitialiser ». */
const chipsTravaux = computed(() => {
  const f = filtresTravaux.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.type) {
    cs.push({ label: LIBELLE_TYPE_ENCADREMENT[f.type] ?? f.type, value: f.type, icone: 'work', cle: 'type'});
  }
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_ENCADREMENT[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'flag', cle: 'statut'});
  }
  if (f.encadrantId) cs.push({ label: 'Encadrant filtré', value: f.encadrantId, icone: 'person', cle: 'encadrantId'});
  return cs;
});

const chipsSoutenances = computed(() => {
  const f = filtresSoutenances.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_ENCADREMENT[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'flag', cle: 'statut'});
  }
  return cs;
});

const statsParType = computed(() => {
  const types: TypeEncadrement[] = ['STAGE', 'MEMOIRE', 'RAPPORT'];
  return types.map((type) => ({
    type,
    label: LIBELLE_TYPE_ENCADREMENT[type],
    nb: travaux.value.filter((t) => t.type === type).length,
  }));
});

const colonnesKanban = computed(() => {
  const f = filtresTravaux.value;
  const recherche = (f.recherche ?? '').toString().trim().toLowerCase();
  // Un compteur sélectionné ne garde que sa colonne : le tableau et le kanban
  // montrent alors exactement le même sous-ensemble.
  const colonnesRetenues = f.statut
    ? COLONNES_KANBAN.filter((c) => c.statut === f.statut)
    : COLONNES_KANBAN;
  return colonnesRetenues.map((col) => {
    const cartes = travaux.value
      .filter((t) => t.statut === col.statut)
      .filter((t) => {
        if (f.type && t.type !== f.type) return false;
        if (f.encadrantId && t.encadrantId !== f.encadrantId) return false;
        if (recherche) {
          const blob = `${t.intitule} ${t.entreprise ?? ''} ${t.lieu ?? ''}`.toLowerCase();
          if (!blob.includes(recherche)) return false;
        }
        return true;
      })
      .map((t) => ({
        id: t.id,
        titre: t.intitule,
        sousTitre: t.etudiant ? `${t.etudiant.nom} ${t.etudiant.prenom} — ${t.etudiant.matricule ?? ''}` : 'Étudiant à désigner',
        meta: `${t.encadrant ? `${t.encadrant.nom} ${t.encadrant.prenom}` : 'À désigner'}${t.entreprise ? ` · ${t.entreprise}` : ''}`,
        badge: LIBELLE_TYPE_ENCADREMENT[t.type] ?? t.type,
        couleur: col.couleur,
        onClick: () => { detail.value = t; },
        actions: [
          ...(peutCreer.value && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(t.statut)
            ? [{
                label: 'Modifier',
                icone: 'edit',
                couleur: 'primary',
                onClick: () => ouvrirEdition(t),
              }]
            : []),
          ...(boutonsTransition(t).slice(0, 1).map((b) => ({
            label: b.libelle,
            icone: b.icone,
            couleur: b.couleur,
            onClick: () => transition(t, b.statut),
          }))),
          ...(peutPlanifierSoutenance(t) ? [{
            label: 'Soutenance',
            icone: 'groups',
            couleur: 'primary',
            onClick: () => ouvrirSoutenance(t),
          }] : []),
          ...(peutConstatJury(t) ? [{
            label: 'Constat',
            icone: 'fact_check',
            couleur: 'deep-purple',
            onClick: () => ouvrirJury(t),
          }] : []),
        ],
      }));
    return {
      identifiant: col.statut,
      titre: col.titre,
      couleur: col.couleur,
      cartes,
    };
  });
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));

const peutTransitionner = computed(() =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT']),
);

function basculerStatut(statut: StatutEncadrement) {
  filtresTravaux.value.statut = filtresTravaux.value.statut === statut ? null : statut;
}

function boutonsTransition(t: TravailEncadre) {
  if (!peutTransitionner.value) return [];
  if (auth.role === 'ENSEIGNANT' && t.encadrantId !== auth.utilisateur?.enseignantId) return [];
  return (BOUTONS_PAR_STATUT[t.statut] ?? []).filter(
    (b) => !b.role || auth.aRole(b.role as never),
  );
}

function peutModifierRapport(t: TravailEncadre) {
  return (
    auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) ||
    (auth.role === 'ENSEIGNANT' && t.encadrantId === auth.utilisateur?.enseignantId)
  );
}

function peutPlanifierSoutenance(t: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) && t.statut === 'EN_COURS' && !t.soutenance;
}

function peutConstatJury(t: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION']) && !!t.soutenance;
}

function ouvrirCreation() {
  travailEdite.value = null;
  dialogTravail.value = true;
}

function ouvrirEdition(t: TravailEncadre) {
  if (!peutCreer.value) return;
  travailEdite.value = t;
  dialogTravail.value = true;
}

function ouvrirSoutenance(t: TravailEncadre) {
  travailSoutenance.value = t;
  modeSoutenance.value = 'planifier';
  dialogSoutenance.value = true;
}

function ouvrirJury(t: TravailEncadre) {
  travailSoutenance.value = t;
  modeSoutenance.value = 'jury';
  dialogSoutenance.value = true;
}

function transition(t: TravailEncadre, cible: StatutEncadrement) {
  const libelle = LIBELLE_STATUT_ENCADREMENT[cible] ?? cible;
  $q.dialog({
    title: `Passer en « ${libelle} »`,
    message:
      cible === 'ABANDONNE'
        ? 'Le dossier reste consultable mais sort du parcours. Confirmer l\'abandon ?'
        : cible === 'SOUTENU'
          ? 'Rapport rendu et soutenance enregistrée sont requis avant le passage en SOUTENU.'
          : 'Confirmer cette transition ?',
    cancel: true,
  }).onOk(async () => {
    await api.post(`/travaux-encadres/${t.id}/transition`, { statut: cible });
    $q.notify({ type: 'positive', message: `Travail passé en « ${libelle} »` });
    await charger();
  });
}

async function basculerRapport(t: TravailEncadre, rendu: boolean) {
  await api.put(`/travaux-encadres/${t.id}`, { rapportRendu: rendu });
  $q.notify({
    type: 'positive',
    message: rendu ? 'Rapport marqué rendu' : 'Rapport marqué non rendu',
  });
  await charger();
}

function imprimer(t: TravailEncadre) {
  // Le jeton voyage en paramètre : l'onglet ouvert ne porte pas l'en-tête.
  if (!auth.token) return;
  window.open(
    `${API_URL}/travaux-encadres/${t.id}/fiche?token=${encodeURIComponent(auth.token)}`,
    '_blank',
  );
}

function supprimer(t: TravailEncadre) {
  $q.dialog({
    title: 'Supprimer ce travail ?',
    message: `${t.intitule} — casse du dossier réservée à l'administration, états PROPOSE / VALIDE uniquement.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/travaux-encadres/${t.id}`);
    $q.notify({ type: 'positive', message: 'Travail supprimé' });
    await charger();
  });
}

function reinitialiserTravaux() {
  filtresTravaux.value = {
    recherche: filtresTravaux.value.recherche ?? '',
    type: null,
    statut: null,
    encadrantId: null,
  };
}

const travauxFiltresSoutenance = computed(() => {
  return travaux.value.filter((t) => t.statut === 'EN_COURS' || t.statut === 'SOUTENU' || t.soutenance);
});

/** Dossiers arrivés au bout du parcours — calculés sur la liste complète. */
const travauxSoutenus = computed(() => travaux.value.filter((t) => t.statut === 'SOUTENU'));

const soutenancesFiltrees = computed(() => {
  const f = filtresSoutenances.value;
  const q = (f.recherche ?? '').toString().trim().toLowerCase();
  return soutenancesAVenir.value
    .filter((s) => {
      if (f.statut && s.travailEncadre?.statut !== f.statut) return false;
      if (q) {
        const blob = `${s.travailEncadre?.intitule ?? ''} ${s.travailEncadre?.etudiant?.nom ?? ''} ${s.travailEncadre?.etudiant?.prenom ?? ''} ${s.salle?.nom ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
});

const evenementsSoutenances = computed(() =>
  soutenancesFiltrees.value.map((s) => ({
    id: s.id,
    date: s.date,
    titre: `${s.travailEncadre?.intitule ?? 'Soutenance'} — ${s.travailEncadre?.etudiant?.nom ?? ''}`,
    sousTitre: s.salle ? `${s.salle.nom} (${s.salle.code})` : 'salle à fixer',
    couleur: '#0F7A45',
    icone: 'groups',
    onClick: () => {
      if (s.travailEncadre) detail.value = s.travailEncadre;
    },
  })),
);

async function charger() {
  chargement.value = true;
  try {
    const f = filtresTravaux.value;
    // Le statut reste un filtre d'affichage : envoyé au serveur, il viderait
    // les compteurs des autres états et les colonnes du kanban.
    const [travauxRes, calendrierRes] = await Promise.all([
      api.get('/travaux-encadres', {
        params: {
          all: '1',
          search: f.recherche || undefined,
          type: f.type || undefined,
          encadrantId: f.encadrantId || undefined,
        },
      }),
      peutCreer.value
        ? api.get('/soutenances').catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ]);
    travaux.value = travauxRes.data.data;
    const listeS = (calendrierRes.data ?? []) as Array<{
      id: string;
      date: string;
      travailEncadre?: any;
      travailEncadreId?: string;
    }>;
    const dateMin = aujourdhui();
    soutenancesAVenir.value = (listeS as SoutenanceCalendrier[]).filter(
      (s) => s.date.slice(0, 10) >= dateMin,
    );
  } finally {
    chargement.value = false;
  }
}

// Les filtres de soutenance sont purement locaux : aucun rechargement.
watch(filtresTravaux, () => charger(), { deep: true });

onMounted(() => {
  void charger();
});
</script>

<style scoped lang="scss">
.carte-compteur {
  cursor: pointer;
  transition: background 0.15s ease;
}
.carte-compteur--actif {
  background: #e3f2fd;
  border-color: #1565c0;
}
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}
</style>
