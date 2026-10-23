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
    <!-- TRAVAUX : liste et suivi                          -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'travaux'" name="travaux" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresTravaux"
        :chips="chipsTravaux"
        :placeholder="$t('stages.filters.searchPlaceholderWorks')"
        @reinitialiser="trav.reinitialiser()"
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

      <!-- Vue tableau -->
      <q-table :grid="$q.screen.lt.md"
        flat
        bordered
        class="carte"
        :rows="lignesVisibles"
        :columns="colonnes"
        row-key="id"
        :loading="trav.chargement"
        :pagination="{ rowsPerPage: 20 }"
      >

        <template #item="p">
    <div class="col-12 q-pb-sm"><q-card flat bordered class="carte">
      <q-card-section>
        <div v-for="c in p.cols.filter(c => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
          <div class="text-caption text-grey-7">{{ c.label }}</div>
          <template v-if="c.name === 'intitule'">{{ p.row.intitule }}</template>
  <template v-else-if="c.name === 'etudiant'">{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</template>
  <template v-else-if="c.name === 'encadrant'">{{ p.row.encadrant?.nom }} {{ p.row.encadrant?.prenom }}</template>
  <template v-else-if="c.name === 'statut'">{{ LIBELLE_STATUT_ENCADREMENT[p.row.statut] ?? p.row.statut }}</template>
  <template v-else-if="c.name === 'periode'">{{ dateLisible(p.row.dateDebut) }} — {{ dateLisible(p.row.dateFin) }}</template>
  <template v-else-if="c.name === 'rapport'">
    <q-toggle :model-value="p.row.rapportRendu" :disable="['SOUTENU', 'ABANDONNE'].includes(p.row.statut) || !peutModifierRapport(p.row)"
      :label="p.row.rapportRendu ? $t('stages.table.report.done') : $t('stages.table.report.pending')"
      @update:model-value="(v: boolean) => basculerRapport(p.row, v)" />
  </template>
  <template v-else-if="c.name === 'soutenance'">{{ p.row.soutenance ? dateHeureLisible(p.row.soutenance.date) : '—' }}</template>
  <span v-else>{{ c.value }}</span>
        </div>
      </q-card-section>
      <q-card-actions align="right">
            <q-btn flat dense no-caps icon="visibility" :label="$t('stages.table.actions.viewSheetTooltip')" @click="detail = p.row" />
            <q-btn
              v-for="b in boutonsTransition(p.row).slice(0, 1)" :key="b.statut"
              flat dense no-caps :color="b.couleur" :icon="b.icone" :label="b.libelle"
              @click="transition(p.row, b.statut)"
            />
            <actions-secondaires>
              <q-btn v-close-popup
                v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
                flat dense no-caps icon="edit" :label="$t('stages.table.actions.editTooltip')" @click="ouvrirEdition(p.row)"
              />
              <q-btn v-close-popup flat dense no-caps icon="print" :label="$t('stages.table.actions.print')" @click="imprimer(p.row)" />
              <q-btn v-close-popup
                v-for="b in boutonsTransition(p.row).slice(1)" :key="b.statut"
                flat dense no-caps :color="b.couleur" :icon="b.icone" :label="b.libelle"
                @click="transition(p.row, b.statut)"
              />
              <q-btn v-close-popup v-if="peutPlanifierSoutenance(p.row)" flat dense no-caps color="primary" icon="groups"
                :label="$t('stages.table.actions.planDefense')" @click="ouvrirSoutenance(p.row)" />
              <q-btn v-close-popup v-if="peutConstatJury(p.row)" flat dense no-caps color="deep-purple" icon="fact_check"
                :label="$t('stages.table.actions.juryReport')" @click="ouvrirJury(p.row)" />
              <q-btn v-close-popup v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
                flat dense no-caps color="negative" icon="delete" :label="$t('stages.table.actions.deleteTooltip')" @click="supprimer(p.row)" />
            </actions-secondaires>
          </q-card-actions>
    </q-card></div>
  </template>
        <template #no-data>
          <etat-vide icone="work_off" :titre="$t('stages.table.emptyState.title')" :aide="$t('stages.table.emptyState.description')">
            <template v-if="peutCreer" #action>
              <q-btn flat no-caps color="primary" icon="add" :label="$t('stages.actions.new')" @click="ouvrirCreation" />
            </template>
          </etat-vide>
        </template>

        <template #body-cell-intitule="p">
          <q-td :props="p">
            <div class="text-weight-medium">
              {{ LIBELLE_TYPE_ENCADREMENT[p.row.type] }} {{ $t('rectorat.subtitleFallback') }} {{ p.row.intitule }}
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
            <span v-else class="text-grey-6">{{ $t('rectorat.subtitleFallback') }}</span>
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
            <span v-else class="text-grey-6">{{ $t('rectorat.subtitleFallback') }}</span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense no-caps icon="visibility" :label="$t('stages.table.actions.viewSheetTooltip')" @click="detail = p.row" />
            <q-btn
              v-for="b in boutonsTransition(p.row).slice(0, 1)" :key="b.statut"
              flat dense no-caps :color="b.couleur" :icon="b.icone" :label="b.libelle"
              @click="transition(p.row, b.statut)"
            />
            <actions-secondaires>
              <q-btn v-close-popup
                v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
                flat dense no-caps icon="edit" :label="$t('stages.table.actions.editTooltip')" @click="ouvrirEdition(p.row)"
              />
              <q-btn v-close-popup flat dense no-caps icon="print" :label="$t('stages.table.actions.print')" @click="imprimer(p.row)" />
              <q-btn v-close-popup
                v-for="b in boutonsTransition(p.row).slice(1)" :key="b.statut"
                flat dense no-caps :color="b.couleur" :icon="b.icone" :label="b.libelle"
                @click="transition(p.row, b.statut)"
              />
              <q-btn v-close-popup v-if="peutPlanifierSoutenance(p.row)" flat dense no-caps color="primary" icon="groups"
                :label="$t('stages.table.actions.planDefense')" @click="ouvrirSoutenance(p.row)" />
              <q-btn v-close-popup v-if="peutConstatJury(p.row)" flat dense no-caps color="deep-purple" icon="fact_check"
                :label="$t('stages.table.actions.juryReport')" @click="ouvrirJury(p.row)" />
              <q-btn v-close-popup v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
                flat dense no-caps color="negative" icon="delete" :label="$t('stages.table.actions.deleteTooltip')" @click="supprimer(p.row)" />
            </actions-secondaires>
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
              {{ s.travailEncadre?.intitule }} {{ $t('rectorat.subtitleFallback') }} {{ s.travailEncadre?.etudiant?.nom }}
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
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import FilterBar from '../components/FilterBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import CalendarGrid from '../components/CalendarGrid.vue';
import EtatVide from '../components/EtatVide.vue';
import { texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { computed, onMounted, reactive, ref } from 'vue';
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
const { confirmer, supprimerAvecConfirmation } = useConfirmation();

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

const soutenancesAVenir = ref<SoutenanceCalendrier[]>([]);
const detail = ref<TravailEncadre | null>(null);

const filtresTravaux = ref<Record<string, any>>({
  recherche: '',
  type: null,
  statut: null,
  encadrantId: null,
});

/**
 * Travaux : l'API ne pagine pas, le q-table le fait. Le statut reste un filtre
 * d'affichage (`clesLocales`) : envoyé au serveur, il viderait les compteurs
 * des autres états.
 */
const trav = reactive(
  useListePaginee<TravailEncadre>({
    filtres: filtresTravaux,
    pageSize: 0,
    syncUrl: true,
    clesLocales: ['statut'],
    charger: ({ filtres: f }) =>
      api
        .get('/travaux-encadres', {
          params: {
            all: '1',
            search: texteApi(f.recherche),
            type: f.type || undefined,
            encadrantId: f.encadrantId || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

// Les filtres de soutenance sont purement locaux : aucun rechargement.
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

const BOUTONS_PAR_STATUT = computed<Record<StatutEncadrement, BoutonTransition[]>>(() => {
  const abandon = { statut: 'ABANDONNE' as const, libelle: t('stages.transitions.abandon'), icone: 'flag', couleur: 'negative' };
  return {
    PROPOSE: [{ statut: 'VALIDE', libelle: t('stages.transitions.validate'), icone: 'check', couleur: 'positive' }, abandon],
    VALIDE: [{ statut: 'EN_COURS', libelle: t('stages.transitions.startSupervision'), icone: 'play_arrow', couleur: 'primary' }, abandon],
    EN_COURS: [{ statut: 'SOUTENU', libelle: t('stages.transitions.moveToDefended'), icone: 'workspace_premium', couleur: 'positive' }, abandon],
    SOUTENU: [],
    ABANDONNE: [
      { statut: 'PROPOSE', libelle: t('stages.transitions.reactivate'), icone: 'restart_alt', couleur: 'primary', role: ['ADMIN'] },
    ],
  };
});

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
  ({ SOUTENU: 'positive', ABANDONNE: 'negative', EN_COURS: 'primary', VALIDE: 'secondary' })[s] ?? 'grey-7';

const compteurs = computed(() => {
  const statuts: StatutEncadrement[] = ['PROPOSE', 'VALIDE', 'EN_COURS', 'SOUTENU', 'ABANDONNE'];
  return statuts.map((statut) => ({
    statut,
    label: LIBELLE_STATUT_ENCADREMENT[statut] ?? statut,
    nb: trav.lignes.filter((x) => x.statut === statut).length,
  }));
});

const lignesVisibles = computed(() =>
  filtresTravaux.value.statut ? trav.lignes.filter((x) => x.statut === filtresTravaux.value.statut) : trav.lignes,
);

function chipsCommuns(f: Record<string, any>): ChipFiltre[] {
  const cs: ChipFiltre[] = [];
  if (f.recherche) cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  if (f.type) cs.push({ label: LIBELLE_TYPE_ENCADREMENT[f.type] ?? f.type, value: f.type, icone: 'work', cle: 'type' });
  if (f.statut) cs.push({ label: LIBELLE_STATUT_ENCADREMENT[f.statut] ?? f.statut, value: f.statut, icone: 'flag', cle: 'statut' });
  return cs;
}

/** Chips des filtres actifs : sans elles, FilterBar masque « Réinitialiser ». */
const chipsTravaux = computed(() => {
  const f = filtresTravaux.value;
  const cs = chipsCommuns(f);
  if (f.encadrantId) cs.push({ label: t('stages.filters.supervisorFiltered'), value: f.encadrantId, icone: 'person', cle: 'encadrantId' });
  return cs;
});

const chipsSoutenances = computed(() => chipsCommuns(filtresSoutenances.value));

const statsParType = computed(() => {
  const types: TypeEncadrement[] = ['STAGE', 'MEMOIRE', 'RAPPORT'];
  return types.map((type) => ({
    type,
    label: LIBELLE_TYPE_ENCADREMENT[type],
    nb: trav.lignes.filter((x) => x.type === type).length,
  }));
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));

const peutTransitionner = computed(() =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT']),
);

function basculerStatut(statut: StatutEncadrement) {
  filtresTravaux.value.statut = filtresTravaux.value.statut === statut ? null : statut;
}

const estEncadrant = (tr: TravailEncadre) =>
  auth.role === 'ENSEIGNANT' && tr.encadrantId === auth.utilisateur?.enseignantId;

function boutonsTransition(tr: TravailEncadre) {
  if (!peutTransitionner.value) return [];
  if (auth.role === 'ENSEIGNANT' && !estEncadrant(tr)) return [];
  return (BOUTONS_PAR_STATUT.value[tr.statut] ?? []).filter(
    (b) => !b.role || auth.aRole(b.role as never),
  );
}

function peutModifierRapport(tr: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) || estEncadrant(tr);
}

function peutPlanifierSoutenance(tr: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) && tr.statut === 'EN_COURS' && !tr.soutenance;
}

function peutConstatJury(tr: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION']) && !!tr.soutenance;
}

function ouvrirCreation() {
  travailEdite.value = null;
  dialogTravail.value = true;
}

function ouvrirEdition(tr: TravailEncadre) {
  if (!peutCreer.value) return;
  travailEdite.value = tr;
  dialogTravail.value = true;
}

function ouvrirSoutenance(tr: TravailEncadre) {
  travailSoutenance.value = tr;
  modeSoutenance.value = 'planifier';
  dialogSoutenance.value = true;
}

function ouvrirJury(tr: TravailEncadre) {
  travailSoutenance.value = tr;
  modeSoutenance.value = 'jury';
  dialogSoutenance.value = true;
}

async function transition(travail: TravailEncadre, cible: StatutEncadrement) {
  const libelle = LIBELLE_STATUT_ENCADREMENT[cible] ?? cible;
  const ok = await confirmer({
    titre: t('stages.dialogs.transition.title', { label: libelle }),
    message:
      cible === 'ABANDONNE'
        ? t('stages.dialogs.transition.abandonMessage')
        : cible === 'SOUTENU'
          ? t('stages.dialogs.transition.defendedMessage')
          : t('stages.dialogs.transition.defaultMessage'),
    danger: cible === 'ABANDONNE',
  });
  if (!ok) return;
  try {
    await api.post(`/travaux-encadres/${travail.id}/transition`, { statut: cible });
    $q.notify({ type: 'positive', message: t('stages.notifications.transitionSuccess', { label: libelle }) });
    await charger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

async function basculerRapport(travail: TravailEncadre, rendu: boolean) {
  try {
    await api.put(`/travaux-encadres/${travail.id}`, { rapportRendu: rendu });
    $q.notify({
      type: 'positive',
      message: rendu ? t('stages.notifications.reportMarkedDone') : t('stages.notifications.reportMarkedPending'),
    });
    await charger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

function imprimer(tr: TravailEncadre) {
  void ouvrirImpression(`/travaux-encadres/${tr.id}/fiche`);
}

function supprimer(travail: TravailEncadre) {
  void supprimerAvecConfirmation(`/travaux-encadres/${travail.id}`, travail.intitule, charger, {
    titre: t('stages.dialogs.delete.title'),
    message: t('stages.dialogs.delete.message', { title: travail.intitule }),
    ok: t('stages.dialogs.delete.confirm'),
    succes: t('stages.notifications.deleted'),
  });
}

const travauxFiltresSoutenance = computed(() =>
  trav.lignes.filter((x) => x.statut === 'EN_COURS' || x.statut === 'SOUTENU' || x.soutenance),
);

/** Dossiers arrivés au bout du parcours — calculés sur la liste complète. */
const travauxSoutenus = computed(() => trav.lignes.filter((x) => x.statut === 'SOUTENU'));

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

/** Calendrier des soutenances : réservé à la scolarité, fenêtre à venir. */
async function chargerSoutenances() {
  if (!peutCreer.value) return;
  try {
    const { data } = await api.get<SoutenanceCalendrier[]>('/soutenances');
    const dateMin = aujourdhui();
    soutenancesAVenir.value = (data ?? []).filter((s) => s.date.slice(0, 10) >= dateMin);
  } catch {
    soutenancesAVenir.value = [];
  }
}

/** Après une action : la liste des travaux et le calendrier bougent ensemble. */
function charger() {
  return Promise.all([trav.recharger(), chargerSoutenances()]);
}

onMounted(() => {
  void chargerSoutenances();
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
