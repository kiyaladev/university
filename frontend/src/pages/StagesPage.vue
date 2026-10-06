<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('stages.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('stages.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('stages.actions.new')"
          @click="ouvrirCreation"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="travaux" icon="view_kanban" :label="$t('stages.tabs.works')" no-caps />
      <q-tab name="soutenances" icon="event" :label="$t('stages.tabs.defenses')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- TRAVAUX : Kanban + tableau + statistiques                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'travaux'" name="travaux" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresTravaux"
        :chips="chipsTravaux"
        :placeholder="$t('stages.filters.searchPlaceholderWorks')"
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
            :label="$t('stages.filters.type')"
          />
          <autocomplete-async
            v-model="filtresTravaux.encadrantId"
            endpoint="/enseignants"
            :label-fn="(e) => `${e.nom} ${e.prenom} (${e.matricule})`"
            :label="$t('stages.filters.supervisor')"
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
            <div class="q-mt-sm">{{ $t('stages.table.emptyState.title') }}</div>
            <div class="text-caption q-mt-xs">
              {{ $t('stages.table.emptyState.description') }}
            </div>
            <q-btn
              v-if="peutCreer"
              flat
              no-caps
              color="primary"
              icon="add"
              :label="$t('stages.actions.new')"
              class="q-mt-sm"
              @click="ouvrirCreation"
            />
          </div>
        </template>

        <template #body-cell-intitule="p">
          <q-td :props="p">
            <div class="text-weight-medium">
              {{ LIBELLE_TYPE_ENCADREMENT[p.row.type] }} {{ $t('rectoratPage.subtitleFallback') }} {{ p.row.intitule }}
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
            <span v-else class="text-grey-6">{{ $t('stages.toDesignate') }}</span>
          </q-td>
        </template>
        <template #body-cell-periode="p">
          <q-td :props="p">
            <span v-if="p.row.dateDebut || p.row.dateFin">
              {{ dateLisible(p.row.dateDebut) }} → {{ dateLisible(p.row.dateFin) }}
            </span>
            <span v-else class="text-grey-6">{{ $t('rectoratPage.subtitleFallback') }}</span>
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
              {{ p.row.rapportRendu ? $t('stages.table.report.done') : $t('stages.table.report.pending') }}
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
                <span v-else>{{ $t('stages.table.defense.awaitingReport') }}</span>
              </div>
            </template>
            <span v-else class="text-grey-6">{{ $t('rectoratPage.subtitleFallback') }}</span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense round icon="visibility" :aria-label="$t('stages.table.actions.viewSheet')" @click="detail = p.row">
              <q-tooltip>{{ $t('stages.table.actions.viewSheetTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
              flat dense round icon="edit" :aria-label="$t('stages.table.actions.edit')" @click="ouvrirEdition(p.row)"
            >
              <q-tooltip>{{ $t('stages.table.actions.editTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="print" :aria-label="$t('stages.table.actions.print')" @click="imprimer(p.row)">
              <q-tooltip>{{ $t('stages.table.actions.print') }}</q-tooltip>
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
              :aria-label="$t('stages.table.actions.planDefense')"
              @click="ouvrirSoutenance(p.row)"
            >
              <q-tooltip>{{ $t('stages.table.actions.planDefense') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutConstatJury(p.row)"
              flat dense round color="deep-purple" icon="fact_check"
              :aria-label="$t('stages.table.actions.juryReport')"
              @click="ouvrirJury(p.row)"
            >
              <q-tooltip>{{ $t('stages.table.actions.juryReportTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
              flat dense round color="negative" icon="delete"
              :aria-label="$t('stages.table.actions.delete')"
              @click="supprimer(p.row)"
            >
              <q-tooltip>{{ $t('stages.table.actions.deleteTooltip') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>

      <!-- Statistiques par type -->
      <div class="row q-col-gutter-md q-mt-md">
        <q-card flat bordered class="col-12 col-md-6 carte">
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ $t('stages.stats.byType') }}</div>
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
            <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ $t('stages.stats.byStatus') }}</div>
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
              <div class="pochoir text-grey-7">{{ $t('stages.stats.upcoming7Days') }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="stat-chiffre chiffres">{{ travauxFiltresSoutenance.length }}</div>
              <div class="pochoir text-grey-7">{{ $t('stages.stats.inDefensePhase') }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="stat-chiffre chiffres">{{ travauxSoutenus.length }}</div>
              <div class="pochoir text-grey-7">{{ $t('stages.stats.defended') }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <filter-bar
        v-model="filtresSoutenances"
        :chips="chipsSoutenances"
        :placeholder="$t('stages.filters.searchPlaceholderDefenses')"
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
            :label="$t('stages.filters.workStatus')"
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
          {{ $t('stages.stats.upcoming7Days') }}
        </q-item-label>
        <q-item v-for="s in soutenancesFiltrees" :key="s.id" clickable @click="detail = s.travailEncadre ?? null">
          <q-item-section>
            <q-item-label>
              {{ dateHeureLisible(s.date) }}
              <span class="text-grey-7">· {{ s.salle ? `${s.salle.nom} (${s.salle.code})` : $t('stages.list.roomToBeSet') }}</span>
            </q-item-label>
            <q-item-label caption>
              {{ s.travailEncadre?.intitule }} {{ $t('rectoratPage.subtitleFallback') }} {{ s.travailEncadre?.etudiant?.nom }}
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
            <div>{{ $t('stages.list.emptyTitle') }}</div>
            <div class="text-caption q-mt-xs">
              {{ $t('stages.list.emptyDescription') }}
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
        <q-card-section class="text-h6">{{ $t('stages.detail.title') }}</q-card-section>
        <q-card-section v-if="detail">
          <q-list dense>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.type') }}</q-item-section>
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
              <q-item-section>{{ $t('stages.detail.fields.student') }}</q-item-section>
              <q-item-section side>
                {{ detail.etudiant?.nom }} {{ detail.etudiant?.prenom }}
                ({{ detail.etudiant?.matricule }})
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.supervisor') }}</q-item-section>
              <q-item-section side>
                {{ detail.encadrant ? `${detail.encadrant.nom} ${detail.encadrant.prenom}` : $t('stages.toDesignate') }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.company') }}</q-item-section>
              <q-item-section side>{{ detail.entreprise ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.companyTutor') }}</q-item-section>
              <q-item-section side>{{ detail.tuteurEntreprise ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.place') }}</q-item-section>
              <q-item-section side>{{ detail.lieu ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.period') }}</q-item-section>
              <q-item-section side>
                {{ dateLisible(detail.dateDebut) }} → {{ dateLisible(detail.dateFin) }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.reportSubmitted') }}</q-item-section>
              <q-item-section side>{{ detail.rapportRendu ? $t('stages.detail.yes') : $t('stages.detail.no') }}</q-item-section>
            </q-item>
            <q-item v-if="detail.soutenance">
              <q-item-section>{{ $t('stages.detail.fields.defense') }}</q-item-section>
              <q-item-section side>
                {{ dateHeureLisible(detail.soutenance.date) }}
                <template v-if="detail.soutenance.note !== null">
                  · {{ detail.soutenance.note }}/20
                  <template v-if="detail.soutenance.mention"> · {{ detail.soutenance.mention }}</template>
                </template>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('stages.detail.fields.status') }}</q-item-section>
              <q-item-section side>
                <q-chip :color="couleurStatut(detail.statut)" text-color="white" dense square>
                  {{ LIBELLE_STATUT_ENCADREMENT[detail.statut] }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('stages.actions.close')" v-close-popup />
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
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import { ouvrirImpression } from '../services/impression';
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
const { t } = useI18n();

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

const optionsTypes = computed(() => [
  { label: t('stages.types.memoire'), value: 'MEMOIRE' },
  { label: t('stages.types.stage'), value: 'STAGE' },
  { label: t('stages.types.rapport'), value: 'RAPPORT' },
]);

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

const BOUTONS_PAR_STATUT = computed<Record<StatutEncadrement, BoutonTransition[]>>(() => ({
  PROPOSE: [
    { statut: 'VALIDE', libelle: t('stages.transitions.validate'), icone: 'check', couleur: 'positive' },
    { statut: 'ABANDONNE', libelle: t('stages.transitions.abandon'), icone: 'flag', couleur: 'negative' },
  ],
  VALIDE: [
    { statut: 'EN_COURS', libelle: t('stages.transitions.startSupervision'), icone: 'play_arrow', couleur: 'primary' },
    { statut: 'ABANDONNE', libelle: t('stages.transitions.abandon'), icone: 'flag', couleur: 'negative' },
  ],
  EN_COURS: [
    { statut: 'SOUTENU', libelle: t('stages.transitions.moveToDefended'), icone: 'workspace_premium', couleur: 'positive' },
    { statut: 'ABANDONNE', libelle: t('stages.transitions.abandon'), icone: 'flag', couleur: 'negative' },
  ],
  SOUTENU: [],
  ABANDONNE: [
    { statut: 'PROPOSE', libelle: t('stages.transitions.reactivate'), icone: 'restart_alt', couleur: 'primary', role: ['ADMIN'] },
  ],
}));

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'intitule', label: t('stages.table.columns.work'), field: 'intitule', align: 'left', sortable: true },
  { name: 'etudiant', label: t('stages.table.columns.student'), field: 'etudiantId', align: 'left' },
  { name: 'encadrant', label: t('stages.table.columns.supervisor'), field: 'encadrantId', align: 'left' },
  { name: 'periode', label: t('stages.table.columns.period'), field: 'dateDebut', align: 'left' },
  { name: 'statut', label: t('stages.table.columns.status'), field: 'statut', align: 'left' },
  { name: 'rapport', label: t('stages.table.columns.report'), field: 'rapportRendu', align: 'center' },
  { name: 'soutenance', label: t('stages.table.columns.defense'), field: 'soutenance', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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

const COLONNES_KANBAN = computed<Array<{
  statut: StatutEncadrement;
  titre: string;
  couleur: string;
}>>(() => [
  { statut: 'PROPOSE', titre: t('stages.kanban.columns.proposed'), couleur: '#86868b' },
  { statut: 'VALIDE', titre: t('stages.kanban.columns.validated'), couleur: '#007A4D' },
  { statut: 'EN_COURS', titre: t('stages.kanban.columns.inProgress'), couleur: '#1D1D1F' },
  { statut: 'SOUTENU', titre: t('stages.kanban.columns.defended'), couleur: '#007A4D' },
  { statut: 'ABANDONNE', titre: t('stages.kanban.columns.abandoned'), couleur: '#CE1126' },
]);

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
  if (f.encadrantId) cs.push({ label: t('stages.filters.supervisorFiltered'), value: f.encadrantId, icone: 'person', cle: 'encadrantId'});
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
    ? COLONNES_KANBAN.value.filter((c) => c.statut === f.statut)
    : COLONNES_KANBAN.value;
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
      .map((tr) => ({
        id: tr.id,
        titre: tr.intitule,
        sousTitre: tr.etudiant ? `${tr.etudiant.nom} ${tr.etudiant.prenom} — ${tr.etudiant.matricule ?? ''}` : t('stages.kanban.studentToDesignate'),
        meta: `${tr.encadrant ? `${tr.encadrant.nom} ${tr.encadrant.prenom}` : t('stages.toDesignate')}${tr.entreprise ? ` · ${tr.entreprise}` : ''}`,
        badge: LIBELLE_TYPE_ENCADREMENT[tr.type] ?? tr.type,
        couleur: col.couleur,
        onClick: () => { detail.value = tr; },
        actions: [
          ...(peutCreer.value && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(tr.statut)
            ? [{
                label: t('stages.kanban.actions.edit'),
                icone: 'edit',
                couleur: 'primary',
                onClick: () => ouvrirEdition(tr),
              }]
            : []),
          ...(boutonsTransition(tr).slice(0, 1).map((b) => ({
            label: b.libelle,
            icone: b.icone,
            couleur: b.couleur,
            onClick: () => transition(tr, b.statut),
          }))),
          ...(peutPlanifierSoutenance(tr) ? [{
            label: t('stages.kanban.actions.defense'),
            icone: 'groups',
            couleur: 'primary',
            onClick: () => ouvrirSoutenance(tr),
          }] : []),
          ...(peutConstatJury(tr) ? [{
            label: t('stages.kanban.actions.report'),
            icone: 'fact_check',
            couleur: 'deep-purple',
            onClick: () => ouvrirJury(tr),
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
  return (BOUTONS_PAR_STATUT.value[t.statut] ?? []).filter(
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

function transition(travail: TravailEncadre, cible: StatutEncadrement) {
  const libelle = LIBELLE_STATUT_ENCADREMENT[cible] ?? cible;
  $q.dialog({
    title: t('stages.dialogs.transition.title', { label: libelle }),
    message:
      cible === 'ABANDONNE'
        ? t('stages.dialogs.transition.abandonMessage')
        : cible === 'SOUTENU'
          ? t('stages.dialogs.transition.defendedMessage')
          : t('stages.dialogs.transition.defaultMessage'),
    cancel: true,
  }).onOk(async () => {
    await api.post(`/travaux-encadres/${travail.id}/transition`, { statut: cible });
    $q.notify({ type: 'positive', message: t('stages.notifications.transitionSuccess', { label: libelle }) });
    await charger();
  });
}

async function basculerRapport(travail: TravailEncadre, rendu: boolean) {
  await api.put(`/travaux-encadres/${travail.id}`, { rapportRendu: rendu });
  $q.notify({
    type: 'positive',
    message: rendu ? t('stages.notifications.reportMarkedDone') : t('stages.notifications.reportMarkedPending'),
  });
  await charger();
}

function imprimer(t: TravailEncadre) {
  void ouvrirImpression(`/travaux-encadres/${t.id}/fiche`);
}

function supprimer(travail: TravailEncadre) {
  $q.dialog({
    title: t('stages.dialogs.delete.title'),
    message: t('stages.dialogs.delete.message', { title: travail.intitule }),
    cancel: true,
    ok: { color: 'negative', label: t('stages.dialogs.delete.confirm') },
  }).onOk(async () => {
    await api.delete(`/travaux-encadres/${travail.id}`);
    $q.notify({ type: 'positive', message: t('stages.notifications.deleted') });
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
    titre: `${s.travailEncadre?.intitule ?? t('stages.list.defenseFallback')} — ${s.travailEncadre?.etudiant?.nom ?? ''}`,
    sousTitre: s.salle ? `${s.salle.nom} (${s.salle.code})` : t('stages.list.roomToBeSet'),
    couleur: '#007A4D',
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
  border-color: #0066cc;
}
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}
</style>
