<template>
  <q-page class="registre">
    <en-tete-page :title="$t('common.fields.sessions')" :subtitle="$t('seances.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutAffecterControleur"
          outline
          no-caps
          icon="route"
          :label="$t('seances.actions.assignRound')"
          @click="ouvrirAffectationGroupee"
        />
        <q-btn
          v-if="auth.peutPointer || auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add_box"
          :label="auth.peutPointer ? $t('seances.actions.newUnscheduled') : $t('seances.actions.newAdHoc')"
          @click="ouvrirSeance(null)"
        />
        <q-btn outline no-caps icon="print" :label="$t('common.actions.print')" @click="imprimer" />
      </template>
    </en-tete-page>

    <!-- Période : les trois lectures courantes en un geste -->
    <div class="registre__periode">
      <div class="registre__raccourcis">
        <button
          v-for="r in raccourcis"
          :key="r.id"
          type="button"
          class="pochoir raccourci"
          :class="{ 'raccourci--actif': raccourciActif === r.id }"
          @click="appliquer(r)"
        >
          {{ r.label }}
        </button>
      </div>

      <champ-date v-model="filtres.dateDebut" :label="$t('common.actions.from')" style="width: 148px" />
      <champ-date v-model="filtres.dateFin" :label="$t('common.actions.to')" style="width: 148px" />

      <q-btn
        flat
        dense
        no-caps
        :icon="filtresOuverts ? 'expand_less' : 'tune'"
        :label="etiquetteFiltres"
        @click="filtresOuverts = !filtresOuverts"
      />
      <q-btn
        round
        color="primary"
        icon="refresh"
        :aria-label="$t('seances.actions.reloadAria')"
        :loading="chargement"
        @click="charger"
      >
        <q-tooltip>{{ $t('common.actions.reload') }}</q-tooltip>
      </q-btn>
    </div>

    <div v-if="filtresOuverts" class="registre__filtres">
      <q-input v-model="recherche" outlined dense clearable :label="$t('seances.filters.search')">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-select
        v-model="filtres.enseignantId"
        :options="optionsEnseignants"
        outlined
        dense
        clearable
        emit-value
        map-options
        use-input
        :label="$t('common.fields.teacher')"
        @filter="filtrerEnseignants"
      />
      <q-select
        v-model="filtres.salleId"
        :options="optionsSalles"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('common.fields.room')"
      />
      <q-select
        v-model="filtres.statut"
        :options="optionsStatuts"
        outlined
        dense
        clearable
        emit-value
        map-options
        :label="$t('seances.filters.status')"
      />
      <q-toggle v-model="seulementAPointer" :label="$t('seances.filters.onlyUnchecked')" />
    </div>

    <!-- Relevé de la période affichée -->
    <section class="plaque registre__releve">
      <div class="registre__releve-cellule">
        <p class="pochoir">{{ $t('common.fields.sessions') }}</p>
        <p class="lettrage chiffres registre__releve-valeur">{{ seancesFiltrees.length }}</p>
      </div>
      <div class="registre__releve-cellule">
        <p class="pochoir">{{ $t('seances.summary.checked') }}</p>
        <p class="lettrage chiffres registre__releve-valeur">{{ compte.controlees }}</p>
      </div>
      <div class="registre__releve-cellule">
        <p class="pochoir">{{ $t('common.fields.absences') }}</p>
        <p class="lettrage chiffres registre__releve-valeur">{{ compte.absences }}</p>
      </div>
      <div class="registre__releve-cellule">
        <p class="pochoir">{{ $t('seances.summary.unchecked') }}</p>
        <p class="lettrage chiffres registre__releve-valeur">{{ compte.sansControle }}</p>
      </div>
    </section>

    <q-inner-loading :showing="chargement" />

    <div v-if="!chargement && !seancesFiltrees.length" class="registre__vide">
      <q-icon name="event_busy" size="42px" />
      <span class="lettrage registre__vide-titre">{{ $t('seances.emptyState.title') }}</span>
      <span class="pochoir">
        {{ filtresActifs ? $t('seances.emptyState.filtered') : $t('seances.emptyState.default') }}
      </span>
      <div class="registre__vide-actions">
        <q-btn
          v-if="filtresActifs"
          outline
          no-caps
          icon="filter_alt_off"
          :label="$t('seances.emptyState.removeFilters')"
          @click="reinitialiserFiltres"
        />
        <q-btn
          v-else
          outline
          no-caps
          icon="date_range"
          :label="$t('seances.emptyState.expand30')"
          @click="elargirA30Jours"
        />
        <q-btn v-if="auth.peutPlanifier" outline no-caps icon="calendar_month"
          :label="$t('nav.emploi-du-temps')" to="/emploi-du-temps" />
      </div>
    </div>

    <!-- Vue tableau : pour comparer et trier, quand la lecture par jour ne
         suffit plus (recherche d'une salle, d'un enseignant, tri par état). -->
    <q-table
      v-if="vue === 'tableau' && seancesFiltrees.length"
      flat
      bordered
      class="carte registre__tableau"
      :rows="seancesFiltrees"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 50 }"
      :visible-columns="colonnesVisibles"
      :dense="$q.screen.lt.md"
      @row-click="(_, ligne) => $q.screen.lt.md && (detail = ligne)"
    >
      <template #body-cell-etat="p">
        <q-td :props="p">
          <champ-statut :statut="p.row.controle?.statut ?? 'NON_CONTROLE'" />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('seances.table.actions.viewDetail')"
            @click="detail = p.row"
          >
            <q-tooltip>{{ $t('seances.table.actions.detail') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.peutPointer && p.row.statut !== 'ANNULEE'"
            dense
            unelevated
            no-caps
            color="primary"
            :icon="p.row.controle ? 'edit' : 'how_to_reg'"
            :label="p.row.controle ? $t('seances.table.actions.correct') : $t('seances.table.actions.check')"
            @click="ouvrirPointage(p.row)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- Une journée, un bloc : le registre se lit par jour, pas ligne à ligne -->
    <section v-for="jour in (vue === 'cartes' ? journees : [])" :key="jour.date" class="journee">
      <header class="journee__tete">
        <h2 class="lettrage journee__date">{{ jour.libelle }}</h2>
        <span class="pochoir pochoir--brut journee__compte chiffres">
          {{
            $t('seances.day.count', {
              count: jour.seances.length,
              pluralSessions: jour.seances.length > 1 ? 's' : '',
              checked: jour.controlees,
              pluralChecked: jour.controlees > 1 ? 's' : '',
            })
          }}
        </span>
      </header>

      <ol class="journee__liste">
        <li v-for="s in jour.seances" :key="s.id">
          <article class="plaque ligne" :class="{ 'ligne--annulee': s.statut === 'ANNULEE' }">
            <div class="champ ligne__heure">
              <span class="lettrage chiffres">{{ s.heureDebut }}</span>
              <span class="pochoir chiffres">{{ s.heureFin }}</span>
            </div>

            <div class="ligne__corps">
              <h3 class="lettrage ligne__enseignant">
                {{ s.affectation?.enseignant?.nom }} {{ s.affectation?.enseignant?.prenom }}
              </h3>
              <p class="ligne__matiere">
                {{ s.affectation?.matiere?.intitule }}
                <span class="pochoir ligne__type" :title="LIBELLE_TYPE_COURS[s.type]">{{ s.type }}</span>
              </p>
              <p class="pochoir ligne__lieu">
                {{ s.affectation?.promotion?.nom }}
                <span v-if="s.salle" class="plaque-salle">{{ s.salle.code }}</span>
              </p>
              <p v-if="s.controle" class="pochoir pochoir--brut ligne__constat chiffres">
                {{ s.controle.heureArrivee ?? '—' }} → {{ s.controle.heureFinReelle ?? '—' }}
                · {{ dureeLisible(s.controle.dureeMinutes) }}
                <span v-if="s.controle.effectifPresent"> · {{ s.controle.effectifPresent }} {{ $t('seances.card.studentsSuffix') }}</span>
                · {{ s.controle.controleur?.prenom }} {{ s.controle.controleur?.nom }}
              </p>
            </div>

            <div class="ligne__etat">
              <champ-statut :statut="s.controle?.statut ?? 'NON_CONTROLE'" />
              <q-badge v-if="s.statut === 'ANNULEE'" color="grey-7" class="q-mt-xs">{{ $t('seances.card.cancelledBadge') }}</q-badge>

              <div class="ligne__boutons">
                <q-btn
                  flat
                  dense
                  round
                  icon="visibility"
                  :aria-label="$t('seances.table.actions.viewDetail')"
                  @click="detail = s"
                >
                  <q-tooltip>{{ $t('seances.table.actions.detail') }}</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="auth.peutPointer && s.statut !== 'ANNULEE'"
                  dense
                  unelevated
                  no-caps
                  color="primary"
                  :icon="s.controle ? 'edit' : 'how_to_reg'"
                  :label="s.controle ? $t('seances.table.actions.correct') : $t('seances.table.actions.check')"
                  @click="ouvrirPointage(s)"
                />
                <q-btn
                  v-if="auth.peutPlanifier && !s.controle && s.statut !== 'ANNULEE'"
                  flat
                  dense
                  round
                  color="negative"
                  icon="event_busy"
                  :aria-label="$t('seances.card.cancelSession')"
                  @click="annuler(s)"
                >
                  <q-tooltip>{{ $t('seances.card.cancelSession') }}</q-tooltip>
                </q-btn>
              </div>
            </div>
          </article>
        </li>
      </ol>
    </section>

    <dialogue-seance
      v-model="dialogSeance"
      :seance="seanceEditee"
      :salles="salles"
      @enregistre="apresCreation"
    />
    <dialogue-pointage v-model="dialogPointage" :seance="seanceSelectionnee" @enregistre="charger" />

    <!-- Détail du contrôle consigné -->
    <q-dialog :model-value="!!detail" @update:model-value="detail = null">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">{{ $t('seances.detail.title') }}</q-card-section>
        <q-card-section v-if="detail">
          <!-- Fiche à deux colonnes : le libellé tient sa colonne, la valeur la
               sienne. En dessous de 600 px les deux se superposent proprement
               au lieu de se marcher dessus. -->
          <dl class="fiche-detail">
            <dt class="pochoir">{{ $t('common.fields.teacher') }}</dt>
            <dd>
              {{ detail.affectation?.enseignant?.nom }} {{ detail.affectation?.enseignant?.prenom }}
            </dd>

            <dt class="pochoir">{{ $t('seances.detail.subjectPromotion') }}</dt>
            <dd>
              {{ detail.affectation?.matiere?.intitule }} {{ $t('common.format.emptyValue') }} {{ detail.affectation?.promotion?.nom }}
            </dd>

            <dt class="pochoir">{{ $t('seances.detail.courseType') }}</dt>
            <dd>{{ LIBELLE_TYPE_COURS[detail.type] ?? detail.type }}</dd>

            <dt class="pochoir">{{ $t('seances.detail.plannedSchedule') }}</dt>
            <dd class="chiffres">{{ detail.heureDebut }} – {{ detail.heureFin }}</dd>

            <dt class="pochoir">{{ $t('common.fields.room') }}</dt>
            <dd>
              <span v-if="detail.salle" class="plaque-salle">{{ detail.salle.code }}</span>
              <span v-else>{{ $t('common.format.emptyValue') }}</span>
            </dd>

            <dt class="pochoir">{{ $t('seances.detail.assignedController') }}</dt>
            <dd class="row items-center q-gutter-sm">
              <span>{{ detail.controleurAssigne ? `${detail.controleurAssigne.prenom} ${detail.controleurAssigne.nom}` : $t('seances.detail.noAssignedController') }}</span>
              <q-btn
                v-if="peutAffecterControleur"
                flat dense no-caps icon="assignment_ind"
                :label="$t('seances.detail.assignController')"
                @click="ouvrirAffectationControleur(detail)"
              />
            </dd>

            <template v-if="detail.justificatif">
              <dt class="pochoir">{{ $t('seances.detail.absenceJustification') }}</dt>
              <dd>
                {{ LIBELLE_STATUT_JUSTIFICATIF[detail.justificatif.statut] ?? detail.justificatif.statut }}
                <q-btn
                  flat
                  dense
                  no-caps
                  size="sm"
                  icon="open_in_new"
                  :label="$t('seances.detail.openFile')"
                  :to="{ name: 'justificatifs', query: { statut: detail.justificatif.statut } }"
                />
              </dd>
            </template>

            <template v-if="detail.controle">
              <dt class="pochoir fiche-detail__coupure">{{ $t('seances.detail.actualCourse') }}</dt>
              <dd class="fiche-detail__coupure">
                <champ-statut :statut="detail.controle.statut" dense />
              </dd>

              <dt class="pochoir">{{ $t('seances.detail.actualSchedule') }}</dt>
              <dd class="chiffres">
                {{ detail.controle.heureArrivee ?? '—' }} → {{ detail.controle.heureFinReelle ?? '—' }}
                ({{ dureeLisible(detail.controle.dureeMinutes) }})
              </dd>

              <dt class="pochoir">{{ $t('seances.detail.studentsPresent') }}</dt>
              <dd class="chiffres">{{ detail.controle.effectifPresent ?? '—' }}</dd>

              <dt class="pochoir">{{ $t('seances.detail.topicCovered') }}</dt>
              <dd>{{ detail.controle.thematiqueTraitee ?? '—' }}</dd>

              <dt class="pochoir">{{ $t('seances.detail.observation') }}</dt>
              <dd>{{ detail.controle.observation ?? '—' }}</dd>

              <dt class="pochoir">{{ $t('seances.detail.checkedBy') }}</dt>
              <dd>
                {{ detail.controle.controleur?.prenom }} {{ detail.controle.controleur?.nom }}
                · <span class="chiffres">{{ dateHeureLisible(detail.controle.horodatage) }}</span>
              </dd>

              <dt class="pochoir">{{ $t('seances.detail.attestation') }}</dt>
              <dd>
                {{ LIBELLE_ATTESTATION[detail.controle.attestation ?? 'AUCUNE'] }}
                <span v-if="detail.controle.empreinteScore" class="chiffres">
                  {{ $t('common.units.outOf100', { n: detail.controle.empreinteScore }) }}
                </span>
              </dd>

              <template v-if="detail.controle.signatureBase64">
                <dt class="pochoir">{{ $t('seances.detail.signature') }}</dt>
                <dd><img :src="detail.controle.signatureBase64" class="signature-detail" /></dd>
              </template>
            </template>
          </dl>
        </q-card-section>
        <!-- Depuis une séance, on rejoint les deux lectures voisines : tout ce
             que cet enseignant a fait, et tout ce qui s'est tenu dans cette salle. -->
        <q-card-actions align="left" class="fiche-detail__liens">
          <q-btn
            v-if="detail?.affectation?.enseignantId"
            flat
            dense
            no-caps
            icon="person_pin"
            :label="$t('seances.detail.otherSessions')"
            @click="filtrerDepuisDetail('enseignantId', detail.affectation.enseignantId)"
          />
          <q-btn
            v-if="detail?.salle"
            flat
            dense
            no-caps
            icon="meeting_room"
            :label="$t('seances.detail.sessionsInRoom', { code: detail.salle.code })"
            @click="filtrerDepuisDetail('salleId', detail.salle.id)"
          />
        </q-card-actions>

        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
          <q-btn
            v-if="auth.peutPointer && detail && detail.statut !== 'ANNULEE'"
            unelevated
            color="primary"
            no-caps
            :label="detail?.controle ? $t('seances.detail.correctCheck') : $t('seances.detail.checkThisSession')"
            @click="depuisDetail()"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogAffectationControleur" persistent>
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ $t('seances.detail.assignControllerTitle') }}</div>
          <div class="text-caption text-grey-7">{{ $t('seances.detail.assignControllerHelp') }}</div>
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="controleurChoisi"
            :options="optionsControleurs"
            outlined dense clearable emit-value map-options
            :label="$t('seances.detail.assignedController')"
            :loading="chargementControleurs"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('common.actions.cancel')" :disable="sauvegardeAffectation" @click="dialogAffectationControleur = false" />
          <q-btn color="primary" unelevated no-caps :label="$t('common.actions.save')" :loading="sauvegardeAffectation" @click="enregistrerAffectationControleur" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogTournee" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ $t('seances.tournee.title') }}</div>
          <div class="text-caption text-grey-7">{{ $t('seances.tournee.help') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6"><champ-date v-model="tournee.dateDebut" :label="$t('common.actions.from')" @update:model-value="tourneeApercu = null" /></div>
            <div class="col-6"><champ-date v-model="tournee.dateFin" :label="$t('common.actions.to')" @update:model-value="tourneeApercu = null" /></div>
          </div>
          <q-select
            v-model="tournee.departementId" :options="optionsDepartements"
            outlined dense clearable emit-value map-options
            :label="$t('seances.tournee.departmentOptional')"
            @update:model-value="tourneeApercu = null"
          />
          <q-select
            v-model="tournee.controleurId" :options="optionsControleurs"
            outlined dense emit-value map-options
            :label="$t('seances.detail.assignedController')"
            @update:model-value="tourneeApercu = null"
            class="q-mt-md"
          />
          <q-banner v-if="tourneeApercu" rounded class="bg-blue-1 text-blue-10 q-mt-md">
            {{ $t('seances.tournee.preview', {
              affectables: tourneeApercu.seancesAffectables,
              closed: tourneeApercu.ignoreesAnneeCloturee,
            }) }}
          </q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('common.actions.cancel')" :disable="chargementTournee || sauvegardeTournee" @click="dialogTournee = false" />
          <q-btn
            v-if="!tourneeApercu"
            outline color="primary" no-caps icon="manage_search"
            :loading="chargementTournee"
            :label="$t('common.actions.preview')"
            @click="previsualiserTournee"
          />
          <q-btn
            v-else
            color="primary" unelevated no-caps icon="assignment_ind"
            :loading="sauvegardeTournee"
            :disable="tourneeApercu.seancesAffectables === 0"
            :label="$t('seances.tournee.assignAction', { count: tourneeApercu.seancesAffectables })"
            @click="affecterTournee"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '@/boot/axios';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueSeance from '../components/DialogueSeance.vue';
import DialoguePointage from '../components/DialoguePointage.vue';
import ChampStatut from '../components/ChampStatut.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import {
  LIBELLE_ATTESTATION,
  LIBELLE_STATUT_JUSTIFICATIF,
  LIBELLE_STATUT_SEANCE,
  LIBELLE_TYPE_COURS,
  aujourdhui,
  dateHeureLisible,
  dateLisible,
  decalerJours,
  dureeLisible,
} from '@/shared/utils/libelles';
import type { Enseignant, Salle, Seance } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { getAppLocale } from '@/boot/i18n';

const $q = useQuasar();
const route = useRoute();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const peutAffecterControleur = computed(() => auth.peut('seances.affecterControleur'));
const vue = usePresentationListe();
const { t } = useI18n();

/** Les mêmes séances, mises en colonnes : c'est la vue qui compare et qui trie. */
const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'date',
    label: t('common.fields.date'),
    field: (r: Seance) => r.date,
    format: (v: string) => dateLisible(v),
    align: 'left',
    sortable: true,
  },
  {
    name: 'heure',
    label: t('seances.table.columns.schedule'),
    field: (r: Seance) => `${r.heureDebut}–${r.heureFin}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'enseignant',
    label: t('common.fields.teacher'),
    field: (r: Seance) =>
      `${r.affectation?.enseignant?.nom ?? ''} ${r.affectation?.enseignant?.prenom ?? ''}`.trim(),
    align: 'left',
    sortable: true,
  },
  {
    name: 'matiere',
    label: t('common.fields.subject'),
    field: (r: Seance) => r.affectation?.matiere?.intitule ?? '—',
    align: 'left',
    sortable: true,
  },
  {
    name: 'promotion',
    label: t('seances.table.columns.promotion'),
    field: (r: Seance) => r.affectation?.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'salle', label: t('common.fields.room'), field: (r: Seance) => r.salle?.code ?? '—', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  {
    name: 'duree',
    label: t('seances.table.columns.durationObserved'),
    field: (r: Seance) => (r.controle ? dureeLisible(r.controle.dureeMinutes) : '—'),
    align: 'right',
  },
  { name: 'etat', label: t('seances.table.columns.status'), field: (r: Seance) => r.controle?.statut ?? '', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

// Sur téléphone le tableau reste consultable : trois colonnes tiennent dans
// 390 px sans déborder, et la ligne entière ouvre le détail — d'où l'on peut
// pointer. Garder la colonne d'actions poussait l'état hors de l'écran.
const colonnesVisibles = computed(() =>
  $q.screen.lt.md
    ? ['heure', 'enseignant', 'etat']
    : colonnes.value.map((c) => String(c.name)),
);

const seances = ref<Seance[]>([]);
const salles = ref<Salle[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtresOuverts = ref(false);
const seulementAPointer = ref(false);
const detail = ref<Seance | null>(null);
const dialogSeance = ref(false);
const dialogPointage = ref(false);
const seanceEditee = ref<Seance | null>(null);
const seanceSelectionnee = ref<Seance | null>(null);
const seanceAffectee = ref<Seance | null>(null);
const dialogAffectationControleur = ref(false);
const chargementControleurs = ref(false);
const sauvegardeAffectation = ref(false);
const controleurChoisi = ref<string | null>(null);
const optionsControleurs = ref<{ label: string; value: string }[]>([]);
const dialogTournee = ref(false);
const chargementTournee = ref(false);
const sauvegardeTournee = ref(false);
const optionsDepartements = ref<{ label: string; value: string }[]>([]);
const tourneeApercu = ref<{ seancesAffectables: number; ignoreesAnneeCloturee: number } | null>(null);
const tournee = ref({
  dateDebut: decalerJours(aujourdhui(), -6),
  dateFin: aujourdhui(),
  departementId: null as string | null,
  controleurId: '',
});
const raccourciActif = ref('sevenDays');

const filtres = ref({
  dateDebut: decalerJours(aujourdhui(), -6),
  dateFin: aujourdhui(),
  enseignantId: null as string | null,
  statut: null as string | null,
  salleId: null as string | null,
});

const raccourcis = computed(() => [
  { id: 'today', label: t('seances.period.shortcuts.today'), debut: 0, fin: 0 },
  { id: 'sevenDays', label: t('seances.period.shortcuts.sevenDays'), debut: -6, fin: 0 },
  { id: 'thirtyDays', label: t('seances.period.shortcuts.thirtyDays'), debut: -29, fin: 0 },
  { id: 'upcoming', label: t('seances.period.shortcuts.upcoming'), debut: 1, fin: 14 },
]);

/** Les états de séance viennent du référentiel partagé, jamais d'une liste locale. */
const optionsStatuts = Object.entries(LIBELLE_STATUT_SEANCE).map(([value, label]) => ({
  label,
  value,
}));

const optionsSalles = computed(() =>
  salles.value.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const etiquetteFiltres = computed(() => {
  const actifs = [
    filtres.value.enseignantId && t('seances.filters.activeTeacher'),
    filtres.value.salleId && t('seances.filters.activeRoom'),
    filtres.value.statut && t('seances.filters.activeStatus'),
    recherche.value && t('seances.filters.activeSearch'),
    seulementAPointer.value && t('seances.filters.activeUnchecked'),
  ].filter(Boolean);
  return actifs.length
    ? t('seances.filters.labelActive', { list: actifs.join(', ') })
    : t('seances.filters.label');
});

const filtresActifs = computed(
  () =>
    !!filtres.value.enseignantId ||
    !!filtres.value.salleId ||
    !!filtres.value.statut ||
    !!recherche.value ||
    seulementAPointer.value,
);

/** Le vide le plus courant vient d'une fenêtre trop courte : on l'élargit. */
function elargirA30Jours() {
  const trente = raccourcis.value.find((r) => r.id === 'thirtyDays');
  if (trente) appliquer(trente);
}

function reinitialiserFiltres() {
  recherche.value = '';
  seulementAPointer.value = false;
  filtres.value = { ...filtres.value, enseignantId: null, salleId: null, statut: null };
}

const seancesFiltrees = computed(() => {
  const q = (recherche.value ?? '').toLowerCase();
  return seances.value.filter((s) => {
    if (seulementAPointer.value && s.controle) return false;
    if (!q) return true;
    return [
      s.affectation?.enseignant?.nom,
      s.affectation?.enseignant?.prenom,
      s.affectation?.matiere?.intitule,
      s.affectation?.promotion?.nom,
      s.salle?.code,
      s.thematique,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
});

const compte = computed(() => {
  const tenues = seancesFiltrees.value.filter((s) => s.statut !== 'ANNULEE');
  return {
    controlees: tenues.filter((s) => s.controle).length,
    absences: tenues.filter((s) => s.controle?.statut === 'ABSENT').length,
    sansControle: tenues.filter((s) => !s.controle).length,
  };
});

/** Le registre se lit par journée : une en-tête, puis ses séances à l'heure. */
const journees = computed(() => {
  const groupes = new Map<string, Seance[]>();
  for (const s of seancesFiltrees.value) {
    const jour = s.date.slice(0, 10);
    if (!groupes.has(jour)) groupes.set(jour, []);
    groupes.get(jour)!.push(s);
  }

  return [...groupes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, liste]) => ({
      date,
      libelle: new Date(`${date}T12:00:00`).toLocaleDateString(getAppLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      controlees: liste.filter((s) => s.controle).length,
      seances: [...liste].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
    }));
});

function appliquer(r: (typeof raccourcis.value)[number]) {
  raccourciActif.value = r.id;
  filtres.value = {
    ...filtres.value,
    dateDebut: decalerJours(aujourdhui(), r.debut),
    dateFin: decalerJours(aujourdhui(), r.fin),
  };
}

function ouvrirSeance(s: Seance | null) {
  seanceEditee.value = s;
  dialogSeance.value = true;
}

function ouvrirPointage(s: Seance) {
  seanceSelectionnee.value = s;
  dialogPointage.value = true;
}

async function ouvrirAffectationControleur(seance: Seance) {
  seanceAffectee.value = seance;
  controleurChoisi.value = seance.controleurAssigneId ?? null;
  dialogAffectationControleur.value = true;
  chargementControleurs.value = true;
  try {
    const { data } = await api.get('/seances/controleurs');
    optionsControleurs.value = data.map((u: { id: string; nom: string; prenom: string }) => ({
      value: u.id,
      label: `${u.prenom} ${u.nom}`,
    }));
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargementControleurs.value = false;
  }
}

async function ouvrirAffectationGroupee() {
  tournee.value = {
    dateDebut: filtres.value.dateDebut,
    dateFin: filtres.value.dateFin,
    departementId: null,
    controleurId: '',
  };
  tourneeApercu.value = null;
  dialogTournee.value = true;
  chargementTournee.value = true;
  try {
    const [controleurs, departements] = await Promise.all([
      api.get('/seances/controleurs'),
      referentiels.departements(),
    ]);
    optionsControleurs.value = controleurs.data.map((u: { id: string; nom: string; prenom: string }) => ({
      value: u.id, label: `${u.prenom} ${u.nom}`,
    }));
    optionsDepartements.value = departements.map((d) => ({ value: d.id, label: d.nom }));
    if (!tournee.value.controleurId) tournee.value.controleurId = optionsControleurs.value[0]?.value ?? '';
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargementTournee.value = false;
  }
}

async function previsualiserTournee() {
  if (!tournee.value.controleurId) {
    $q.notify({ type: 'warning', message: t('seances.tournee.controllerRequired') });
    return;
  }
  chargementTournee.value = true;
  try {
    const { data } = await api.get('/seances/tournee-apercu', { params: {
      dateDebut: tournee.value.dateDebut,
      dateFin: tournee.value.dateFin,
      controleurId: tournee.value.controleurId,
      departementId: tournee.value.departementId || undefined,
    } });
    tourneeApercu.value = data;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargementTournee.value = false;
  }
}

async function affecterTournee() {
  if (!tourneeApercu.value || !tournee.value.controleurId) return;
  sauvegardeTournee.value = true;
  try {
    const { data } = await api.post('/seances/tournee', {
      dateDebut: tournee.value.dateDebut,
      dateFin: tournee.value.dateFin,
      controleurId: tournee.value.controleurId,
      departementId: tournee.value.departementId || undefined,
    });
    dialogTournee.value = false;
    await charger();
    $q.notify({ type: 'positive', message: t('seances.tournee.assigned', { count: data.seancesAffectees }) });
  } catch {
    tourneeApercu.value = null;
  } finally {
    sauvegardeTournee.value = false;
  }
}

async function enregistrerAffectationControleur() {
  if (!seanceAffectee.value) return;
  sauvegardeAffectation.value = true;
  try {
    await api.put(`/seances/${seanceAffectee.value.id}/controleur`, { controleurId: controleurChoisi.value });
    dialogAffectationControleur.value = false;
    detail.value = null;
    await charger();
    $q.notify({ type: 'positive', message: t('seances.detail.controllerAssigned') });
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    sauvegardeAffectation.value = false;
  }
}

/** Rebondir depuis une séance vers la même lecture, élargie à un enseignant
 *  ou à une salle : la fiche se ferme, le registre se recadre. */
function filtrerDepuisDetail(cle: 'enseignantId' | 'salleId', valeur: string) {
  detail.value = null;
  filtresOuverts.value = true;
  filtres.value = { ...filtres.value, [cle]: valeur };
}

function depuisDetail() {
  const s = detail.value;
  detail.value = null;
  if (s) ouvrirPointage(s);
}

/** Une séance ouverte à la main enchaîne sur son pointage. */
async function apresCreation(creee: Seance) {
  await charger();
  const complete = seances.value.find((s) => s.id === creee?.id);
  if (complete) ouvrirPointage(complete);
}

function annuler(s: Seance) {
  $q.dialog({
    title: t('seances.dialogs.cancelTitle'),
    message:
      t('seances.dialogs.cancelMessagePrefix', { date: dateLisible(s.date), heure: s.heureDebut }) +
      t('seances.dialogs.cancelMessageSuffix'),
    prompt: { model: '', type: 'text' },
    ok: { label: t('seances.dialogs.cancelConfirm'), color: 'negative', unelevated: true, noCaps: true },
    cancel: { label: t('seances.dialogs.cancelDismiss'), flat: true, noCaps: true },
  }).onOk(async (motif: string) => {
    await api.post(`/seances/${s.id}/annuler`, { motif });
    $q.notify({ type: 'positive', message: t('seances.messages.cancelled') });
    await charger();
  });
}

function imprimer() {
  void ouvrirImpression('/impression/registre', {
    dateDebut: filtres.value.dateDebut,
    dateFin: filtres.value.dateFin,
  });
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom}`, value: e.id }));
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/seances', {
      params: {
        dateDebut: filtres.value.dateDebut,
        dateFin: filtres.value.dateFin,
        enseignantId: filtres.value.enseignantId || undefined,
        statut: filtres.value.statut || undefined,
        salleId: filtres.value.salleId || undefined,
        pageSize: 500,
        sort: 'date',
        order: 'desc',
      },
    });
    seances.value = data.data;
  } finally {
    chargement.value = false;
  }
}

/**
 * Le registre est la destination des liens du tableau de bord et des relevés :
 * il accepte donc la même période et les mêmes clés de filtre en paramètres.
 */
function appliquerParametresUrl() {
  const q = route.query;
  const lire = (cle: string) => (q[cle] ? String(q[cle]) : null);
  const debut = lire('dateDebut');
  const fin = lire('dateFin');
  const enseignantId = lire('enseignantId');
  const salleId = lire('salleId');
  const statut = lire('statut');

  if (!debut && !fin && !enseignantId && !salleId && !statut) return;

  raccourciActif.value = '';
  filtres.value = {
    dateDebut: debut ?? filtres.value.dateDebut,
    dateFin: fin ?? filtres.value.dateFin,
    enseignantId,
    salleId,
    statut,
  };
  // Les filtres arrivés par l'URL doivent se voir : sinon on lit un registre
  // restreint sans savoir pourquoi.
  filtresOuverts.value = !!(enseignantId || salleId || statut);
}

// Appliqué avant l'observateur : l'arrivée par lien ne déclenche qu'un chargement.
appliquerParametresUrl();
watch(filtres, charger, { deep: true });

onMounted(async () => {
  await charger();
  // Les référentiels n'alimentent que des listes déroulantes : ils ne doivent
  // pas retarder l'affichage du registre.
  [salles.value, enseignants.value] = await Promise.all([
    referentiels.salles(),
    referentiels.enseignants(),
  ]);
});
</script>

<style scoped lang="scss">
// --------------------------------------------------------- fiche de détail

.fiche-detail {
  display: grid;
  grid-template-columns: minmax(112px, 33%) 1fr;
  gap: var(--up-2) var(--up-3);
  margin: 0;
  align-items: baseline;

  dt {
    color: var(--up-encre-douce);
    padding-top: 2px;
  }

  dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .fiche-detail__coupure {
    border-top: var(--up-filet-fin);
    padding-top: var(--up-3);
  }
}

.fiche-detail__liens {
  border-top: var(--up-filet-fin);
  flex-wrap: wrap;
  gap: var(--up-2);
}

@media (max-width: 599px) {
  .fiche-detail {
    grid-template-columns: 1fr;
    gap: 2px;

    dd {
      text-align: left;
      margin-bottom: var(--up-2);
    }
  }
}

.registre {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.registre__periode {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  flex-wrap: wrap;
  padding-bottom: var(--up-3);
  border-bottom: var(--up-filet);
}

// La gouttière du segmented control ; le reste vient de la règle globale
// `.raccourci` d'app.scss, partagée avec l'écran des statistiques.
.registre__raccourcis {
  display: flex;
  background: var(--up-gris-inerte);
  border-radius: var(--up-rayon);
  padding: 3px;
  gap: 2px;
}

.registre__filtres {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--up-3);
  align-items: center;
  padding: var(--up-3) 0;
  border-bottom: var(--up-filet);
}

.registre__releve {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: var(--up-3) 0;
}

.registre__releve-cellule {
  padding: var(--up-3);

  & + & { border-left: var(--up-filet); }
}

.registre__releve-valeur {
  font-size: clamp(1.4rem, 1rem + 1.6vw, 2rem);
  margin: var(--up-1) 0 0;
}

// ----------------------------------------------------------------- journée
.journee + .journee { margin-top: var(--up-5); }

.journee__tete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding-bottom: var(--up-2);
  margin-bottom: var(--up-2);
  border-bottom: var(--up-filet);
  flex-wrap: wrap;
}

.journee__date {
  font-size: 1.15rem;
  margin: 0;
  &::first-letter { text-transform: uppercase; }
}

.journee__compte { color: var(--up-encre-douce); }

.journee__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.ligne {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  align-items: stretch;
  overflow: hidden;
}

.ligne--annulee { opacity: 0.6; }

.ligne__heure {
  flex-direction: column;
  background: var(--up-chaux);
  color: var(--up-encre);
  gap: 2px;
  padding: var(--up-2);
}

.ligne__corps {
  padding: var(--up-3);
  min-width: 0;
}

.ligne__enseignant { font-size: 1.02rem; margin: 0; }

.ligne__matiere { margin: 3px 0 0; font-size: 0.92rem; }

.ligne__type {
  border: 1px solid var(--up-encre);
  padding: 1px 4px;
  margin-left: 4px;
}

.ligne__lieu,
.ligne__constat {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ligne__etat {
  padding: var(--up-3);
  border-left: var(--up-filet-fin);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-2);
}

.ligne__boutons {
  display: flex;
  align-items: center;
  gap: var(--up-1);
}

.signature-detail { max-height: 90px; }

.registre__vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-6) var(--up-3);
  color: var(--up-encre-douce);
  text-align: center;
}

.registre__vide-titre { font-size: 1.3rem; color: var(--up-encre); }

.registre__vide-actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-3);
}

@media (max-width: 767px) {
  .registre__releve { grid-template-columns: repeat(2, 1fr); }
  .registre__releve-cellule:nth-child(2n + 1) { border-left: 0; }
  .registre__releve-cellule:nth-child(n + 3) { border-top: var(--up-filet); }
}

@media (max-width: 599px) {
  .ligne {
    grid-template-columns: 74px minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .ligne__heure { grid-row: 1 / span 2; }

  .ligne__etat {
    grid-column: 2;
    border-left: 0;
    border-top: var(--up-filet);
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: var(--up-2) var(--up-3);
  }
}
</style>
