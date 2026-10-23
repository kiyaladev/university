<template>
  <q-page class="q-pa-md">
    <section-navigation section="documents" />
    <page-header :title="$t('demandeDocuments.title')" :subtitle="$t('demandeDocuments.subtitle')" />

    <q-banner v-if="filtres.etudiantId" class="note--info q-mb-md">
      {{ $t('demandeDocuments.studentBanner.message') }}
      <template #action>
        <q-btn flat no-caps :label="$t('demandeDocuments.studentBanner.seeAll')" @click="retirerFiltreEtudiant" />
      </template>
    </q-banner>

    <div class="resume-liste" role="status">
      <span v-for="s in plaques" :key="s.cle">{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span>
    </div>

    <filter-bar
      v-model="filtres"
      :placeholder="$t('demandeDocuments.filters.searchPlaceholder')"
      :recherche="true"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #principaux>
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUTS"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('demandeDocuments.filters.status')"
        />
      </template>
      <template #avances>

        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('demandeDocuments.filters.type')"
        />
        <autocomplete-async
          v-model="filtres.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
          :label="$t('demandeDocuments.filters.student')"
        />
      </template>
    </filter-bar>

    <pagination-bar v-model:page="liste.page" v-model:page-size="liste.pageSize" :total="liste.total" :show-all="false" />

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
      @row-click="(_, row) => selectionner(row)"
    >
      <template #no-data>
        <etat-vide icone="description" :titre="$t('demandeDocuments.emptyState.message')" />
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
      </template>
      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <template v-if="p.row.etudiant">
            <div>{{ p.row.etudiant.prenom }} {{ p.row.etudiant.nom }}</div>
            <div class="text-caption text-grey-7">{{ p.row.etudiant.matricule }}</div>
          </template>
          <span v-else class="text-grey-7">{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="demande" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-frais="p">
        <q-td :props="p" class="text-right chiffres">
          {{ montantLisible(p.row.frais) }} {{ p.row.devise }}
          <q-icon
            v-if="p.row.paiement?.statut === 'REUSSI'"
            name="check_circle"
            color="positive"
            size="16px"
            class="q-ml-xs"
          >
            <q-tooltip>{{ $t('demandeDocuments.table.paymentConfirmed') }}</q-tooltip>
          </q-icon>
          <q-icon
            v-else-if="p.row.paiement?.statut === 'EN_ATTENTE'"
            name="hourglass_top"
            color="warning"
            size="16px"
            class="q-ml-xs"
          >
            <q-tooltip>{{ $t('demandeDocuments.table.paymentPending') }}</q-tooltip>
          </q-icon>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            v-if="['PAYEE', 'EN_TRAITEMENT'].includes(p.row.statut)"
            flat
            dense no-caps
            icon="play_arrow"
            :aria-label="$t('demandeDocuments.actionsColumn.startProcessing')" :label="$t('demandeDocuments.actionsColumn.startProcessing')"
            :loading="enCours === 'traitement'"
            @click.stop="lancerTraitement(p.row)"
          >
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.startProcessing') }}</q-tooltip>
          </q-btn>
<q-btn
            v-if="['PAYEE', 'EN_TRAITEMENT'].includes(p.row.statut)"
            flat
            dense no-caps
            icon="check_circle"
            color="positive"
            :aria-label="$t('demandeDocuments.actionsColumn.markReady')" :label="$t('demandeDocuments.actionsColumn.markReady')"
            :loading="enCours === 'prete'"
            @click.stop="marquerPrete(p.row)"
          >
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.markReady') }}</q-tooltip>
          </q-btn>
<q-btn
            v-if="p.row.statut === 'PRETE'"
            flat
            dense no-caps
            icon="assignment_turned_in"
            color="positive"
            :aria-label="$t('demandeDocuments.actionsColumn.handOver')" :label="$t('demandeDocuments.actionsColumn.handOver')"
            :loading="enCours === 'remettre'"
            @click.stop="remettre(p.row)"
          >
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.handOver') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            v-if="p.row.statut === 'EN_ATTENTE_PAIEMENT'"
            flat
            dense no-caps
            icon="verified"
            color="positive"
            :aria-label="$t('demandeDocuments.actionsColumn.confirmPayment')" :label="$t('demandeDocuments.actionsColumn.confirmPayment')"
            :loading="enCours === 'confirmer'"
            @click.stop="confirmerPaiement(p.row)"
          >
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.confirmPayment') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="p.row.statut !== 'REMISE' && p.row.statut !== 'REJETEE'"
            flat
            dense no-caps
            icon="block"
            color="negative"
            :aria-label="$t('demandeDocuments.actionsColumn.reject')" :label="$t('demandeDocuments.actionsColumn.reject')"
            :loading="enCours === 'rejeter'"
            @click.stop="rejeter(p.row)"
          >
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.reject') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup flat dense no-caps icon="visibility" :aria-label="$t('demandeDocuments.actionsColumn.detail')" :label="$t('demandeDocuments.actionsColumn.detail')" @click.stop="selectionner(p.row)">
            <q-tooltip>{{ $t('demandeDocuments.actionsColumn.detail') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="d in liste.lignes" :key="d.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-start q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ d.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ libelleType(d.type) }}</div>
              <div v-if="d.etudiant" class="text-caption text-grey-7">
                {{ d.etudiant.prenom }} {{ d.etudiant.nom }} · {{ d.etudiant.matricule }}
              </div>
            </div>
            <PastilleStatut domaine="demande" :statut="d.statut" />
          </q-card-section>
          <q-card-section class="q-pt-sm q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(d.creeLe) }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="payments" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption chiffres">
                {{ montantLisible(d.frais) }} {{ d.devise }}
                <q-icon
                  v-if="d.paiement?.statut === 'REUSSI'"
                  name="check_circle"
                  color="positive"
                  size="14px"
                  class="q-ml-xs"
                />
                <q-icon
                  v-else-if="d.paiement?.statut === 'EN_ATTENTE'"
                  name="hourglass_top"
                  color="warning"
                  size="14px"
                  class="q-ml-xs"
                />
              </span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-gutter-xs">
<q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(d.statut)"
              flat
              dense
              no-caps
              icon="play_arrow"
              :label="$t('demandeDocuments.cardActions.process')"
              :loading="enCours === 'traitement'"
              @click.stop="lancerTraitement(d)"
            />
<q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(d.statut)"
              flat
              dense
              no-caps
              icon="check_circle"
              color="positive"
              :label="$t('demandeDocuments.cardActions.ready')"
              :loading="enCours === 'prete'"
              @click.stop="marquerPrete(d)"
            />
<q-btn
              v-if="d.statut === 'PRETE'"
              flat
              dense
              no-caps
              icon="assignment_turned_in"
              color="positive"
              :label="$t('demandeDocuments.actionsColumn.handOver')"
              :loading="enCours === 'remettre'"
              @click.stop="remettre(d)"
            />
<actions-secondaires>
<q-btn v-close-popup
              v-if="d.statut === 'EN_ATTENTE_PAIEMENT'"
              flat
              dense
              no-caps
              icon="verified"
              color="positive"
              :label="$t('demandeDocuments.cardActions.confirm')"
              :loading="enCours === 'confirmer'"
              @click.stop="confirmerPaiement(d)"
            />
<q-btn v-close-popup
              v-if="d.statut !== 'REMISE' && d.statut !== 'REJETEE'"
              flat
              dense
              no-caps
              icon="block"
              color="negative"
              :label="$t('demandeDocuments.actionsColumn.reject')"
              :loading="enCours === 'rejeter'"
              @click.stop="rejeter(d)"
            />
<q-btn v-close-popup flat dense no-caps icon="visibility" :label="$t('demandeDocuments.actionsColumn.detail')" @click.stop="selectionner(d)" />
</actions-secondaires>
</q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!liste.chargement && !liste.lignes.length"
        class="col-12"
        icone="description"
        :titre="$t('demandeDocuments.emptyState.message')"
      />
    </div>

    <!-- Dialog de détail -->
    <q-dialog v-model="detailOuvert">
      <q-card style="width: 640px; max-width: 96vw">
        <q-card-section v-if="demandeSelectionnee" class="row items-center no-wrap">
          <div class="col">
            <div class="text-h6">{{ demandeSelectionnee.numero }}</div>
            <div class="text-caption text-grey-7">{{ libelleType(demandeSelectionnee.type) }}</div>
          </div>
          <PastilleStatut domaine="demande" :statut="demandeSelectionnee.statut" />
        </q-card-section>
        <q-card-section v-if="demandeSelectionnee" class="q-pt-none">
          <workflow-stepper
            :etapes="ETAPES_DEMANDE"
            :actuel="demandeSelectionnee.statut"
            :readonly="true"
          />
          <div class="demande-meta q-mt-md">
            <div>
              <span class="pochoir">{{ $t('demandeDocuments.detail.student') }}</span>
              <span v-if="demandeSelectionnee.etudiant">
                {{ demandeSelectionnee.etudiant.prenom }} {{ demandeSelectionnee.etudiant.nom }} ({{ demandeSelectionnee.etudiant.matricule }})
                <q-btn
                  flat
                  dense
                  no-caps
                  size="sm"
                  icon="badge"
                  :label="$t('demandeDocuments.detail.theirCard')"
                  @click="ouvrirCarteEtudiante(demandeSelectionnee)"
                />
              </span>
              <span v-else>{{ $t('rectoratPage.subtitleFallback') }}</span>
            </div>
            <div>
              <span class="pochoir">{{ $t('demandeDocuments.detail.enrollment') }}</span>
              <span>{{ demandeSelectionnee.inscription?.numero ?? '—' }}</span>
            </div>
            <div>
              <span class="pochoir">{{ $t('demandeDocuments.detail.fees') }}</span>
              <span class="chiffres">
                {{ montantLisible(demandeSelectionnee.frais) }} {{ demandeSelectionnee.devise }}
              </span>
            </div>
            <div>
              <span class="pochoir">{{ $t('demandeDocuments.detail.payment') }}</span>
              <span v-if="demandeSelectionnee.paiement">
                {{ demandeSelectionnee.paiement.reference }} · {{ libellePaiement(demandeSelectionnee.paiement.statut) }}
              </span>
              <span v-else class="text-grey-7">{{ $t('demandeDocuments.detail.paymentNotStarted') }}</span>
            </div>
            <div>
              <span class="pochoir">{{ $t('demandeDocuments.detail.processedBy') }}</span>
              <span v-if="demandeSelectionnee.traitePar">
                {{ demandeSelectionnee.traitePar.prenom }} {{ demandeSelectionnee.traitePar.nom }}
              </span>
              <span v-else>{{ $t('rectoratPage.subtitleFallback') }}</span>
            </div>
            <div>
              <span class="pochoir">{{ $t('demandeDocuments.detail.createdOn') }}</span>
              <span>{{ dateHeureLisible(demandeSelectionnee.creeLe) }}</span>
            </div>
            <div v-if="demandeSelectionnee.remiseLe">
              <span class="pochoir">{{ $t('demandeDocuments.detail.handedOverOn') }}</span>
              <span>{{ dateHeureLisible(demandeSelectionnee.remiseLe) }}</span>
            </div>
          </div>
          <div v-if="demandeSelectionnee.motif" class="q-mt-md">
            <span class="section-titre">{{ $t('demandeDocuments.detail.motif') }}</span>
            <div class="demande-motif" style="white-space: pre-wrap">{{ demandeSelectionnee.motif }}</div>
          </div>
          <div v-if="demandeSelectionnee.notes" class="q-mt-md">
            <span class="section-titre">{{ $t('demandeDocuments.detail.notes') }}</span>
            <div class="demande-notes" style="white-space: pre-wrap">{{ demandeSelectionnee.notes }}</div>
          </div>
          <div v-if="demandeSelectionnee.notification" class="q-mt-md">
            <span class="section-titre">{{ $t('demandeDocuments.detail.smsNotification') }}</span>
            <div class="demande-notification" style="white-space: pre-wrap">{{ demandeSelectionnee.notification }}</div>
          </div>
          <div class="row q-mt-md q-gutter-sm">
            <q-btn
              v-if="demandeSelectionnee.statut === 'EN_ATTENTE_PAIEMENT'"
              unelevated
              color="positive"
              no-caps
              icon="verified"
              :label="$t('demandeDocuments.actionsColumn.confirmPayment')"
              :loading="enCours === 'confirmer'"
              @click="confirmerPaiement(demandeSelectionnee)"
            />
            <q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(demandeSelectionnee.statut)"
              unelevated
              color="primary"
              no-caps
              icon="play_arrow"
              :label="$t('demandeDocuments.actionsColumn.startProcessing')"
              :loading="enCours === 'traitement'"
              @click="lancerTraitement(demandeSelectionnee)"
            />
            <q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(demandeSelectionnee.statut)"
              unelevated
              color="positive"
              no-caps
              icon="check_circle"
              :label="$t('demandeDocuments.actionsColumn.markReady')"
              :loading="enCours === 'prete'"
              @click="marquerPrete(demandeSelectionnee)"
            />
            <q-btn
              v-if="demandeSelectionnee.statut === 'PRETE'"
              unelevated
              color="positive"
              no-caps
              icon="assignment_turned_in"
              :label="$t('demandeDocuments.actionsColumn.handOver')"
              :loading="enCours === 'remettre'"
              @click="remettre(demandeSelectionnee)"
            />
            <q-btn
              v-if="demandeSelectionnee.statut !== 'REMISE' && demandeSelectionnee.statut !== 'REJETEE'"
              outline
              color="negative"
              no-caps
              icon="block"
              :label="$t('demandeDocuments.actionsColumn.reject')"
              :loading="enCours === 'rejeter'"
              @click="rejeter(demandeSelectionnee)"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('demandeDocuments.detail.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import SectionNavigation from '../components/SectionNavigation.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EtatVide from '../components/EtatVide.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import WorkflowStepper from '../components/WorkflowStepper.vue';
import {
  LIBELLE_STATUT_DEMANDE,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_DEMANDE,
  dateHeureLisible,
  montantLisible,
  optionsDepuis,
} from '../utils/libelles';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import type { DemandeDocument, StatutPaiement, TypeDemandeDocument } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { confirmerAvecSaisie } = useConfirmation();

const ETAPES_DEMANDE = computed(() => [
  { identifiant: 'EN_ATTENTE_PAIEMENT', libelle: t('demandeDocuments.steps.payment'), icone: 'payments' },
  { identifiant: 'PAYEE', libelle: t('demandeDocuments.steps.paid'), icone: 'verified' },
  { identifiant: 'EN_TRAITEMENT', libelle: t('demandeDocuments.steps.processing'), icone: 'build' },
  { identifiant: 'PRETE', libelle: t('demandeDocuments.steps.ready'), icone: 'check_circle' },
  { identifiant: 'REMISE', libelle: t('demandeDocuments.steps.handedOver'), icone: 'task_alt' },
]);

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_DEMANDE);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_DEMANDE);

const stats = ref<Record<string, number> | null>(null);
/**
 * Liaison depuis les autres écrans du dossier (réclamations, carte) :
 * `/demandes-docs?etudiantId=…` ouvre le registre filtré sur cet étudiant
 * (les filtres sont relus de l'URL par `syncUrl`).
 */
const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null,
  type: null,
  etudiantId: undefined,
});
/** Même périmètre que l'écran /demandes-docs et que le traitement côté API. */
const peutVoir = () => auth.peut('demandesDocuments.traiter');
const liste = reactive(
  useListePaginee<DemandeDocument>({
    filtres,
    syncUrl: true,
    actif: peutVoir,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/documents-demande', {
          params: {
            ...pageApi(p),
            statut: f.statut || undefined,
            type: f.type || undefined,
            etudiantId: f.etudiantId || undefined,
            search: texteApi(f.recherche),
          },
        })
        .then((r) => r.data),
  }),
);
const modeVue = usePresentationListe();
const detailOuvert = ref(false);
const demandeSelectionnee = ref<DemandeDocument | null>(null);
const enCours = ref('');

const plaques = computed(() => [
  { cle: 'EN_ATTENTE_PAIEMENT', libelle: t('demandeDocuments.plaques.awaitingPayment'), alerte: false },
  { cle: 'EN_TRAITEMENT', libelle: t('demandeDocuments.plaques.processing'), alerte: false },
  { cle: 'PRETE', libelle: t('demandeDocuments.plaques.ready'), alerte: false },
  { cle: 'pretesNonRemises', libelle: t('demandeDocuments.plaques.readyOverdue'), alerte: true },
]);

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}
function libellePaiement(s: StatutPaiement | string) {
  return LIBELLE_STATUT_PAIEMENT[s] ?? s;
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('demandeDocuments.table.columns.numero'), field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: t('demandeDocuments.table.columns.type'), field: 'type', align: 'left' },
  { name: 'etudiant', label: t('demandeDocuments.table.columns.student'), field: 'etudiant', align: 'left' },
  { name: 'frais', label: t('demandeDocuments.table.columns.frais'), field: 'frais', align: 'right' },
  { name: 'statut', label: t('demandeDocuments.table.columns.status'), field: 'statut', align: 'left' },
  {
    name: 'creeLe',
    label: t('demandeDocuments.table.columns.createdOn'),
    field: 'creeLe',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: t('demandeDocuments.table.columns.actions'), field: 'id', align: 'right' },
]);

function selectionner(d: DemandeDocument | null) {
  if (!d) return;
  demandeSelectionnee.value = d;
  detailOuvert.value = true;
}

/** Retire le filtre « un seul étudiant » posé par un lien entrant. */
function retirerFiltreEtudiant() {
  filtres.value = { ...filtres.value, etudiantId: undefined };
}

/** Rebond vers la carte étudiante du demandeur. */
function ouvrirCarteEtudiante(d: DemandeDocument | null) {
  if (!d?.etudiantId) return;
  detailOuvert.value = false;
  void router.push({ name: 'cartes-etudiantes', query: { etudiantId: d.etudiantId } });
}

async function chargerStats() {
  if (!peutVoir()) return;
  try {
    const { data } = await api.get('/documents-demande/dashboard');
    stats.value = data;
  } catch {
    /* silencieux */
  }
}

/** Après une action : liste, compteurs et fiche ouverte à jour. */
async function rafraichir(d: DemandeDocument) {
  void liste.recharger();
  void chargerStats();
  if (demandeSelectionnee.value?.id === d.id) {
    const { data } = await api.get(`/documents-demande/${d.id}`);
    demandeSelectionnee.value = data as DemandeDocument;
  }
}

/** Action de workflow : POST, notification, rafraîchissement. */
async function agir(
  d: DemandeDocument,
  cle: string,
  action: string,
  corps: object,
  message: string,
  type: 'positive' | 'warning' = 'positive',
) {
  enCours.value = cle;
  try {
    await api.post(`/documents-demande/${d.id}/${action}`, corps);
    $q.notify({ type, message });
    await rafraichir(d);
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enCours.value = '';
  }
}

async function confirmerPaiement(d: DemandeDocument | null) {
  if (!d) return;
  await agir(d, 'confirmer', 'confirmer-paiement', {}, t('demandeDocuments.messages.paymentConfirmed'));
}

async function lancerTraitement(d: DemandeDocument | null) {
  if (!d) return;
  await agir(d, 'traitement', 'lancer-traitement', {}, t('demandeDocuments.messages.processingStarted'));
}

async function marquerPrete(d: DemandeDocument | null) {
  if (!d) return;
  const message = await confirmerAvecSaisie({
    titre: t('demandeDocuments.markReadyDialog.title'),
    message: t('demandeDocuments.markReadyDialog.message'),
    libelleSaisie: t('demandeDocuments.detail.smsNotification'),
    ok: t('demandeDocuments.markReadyDialog.confirm'),
    couleur: 'positive',
  });
  if (message === null) return;
  await agir(d, 'prete', 'prete', { message: message.trim() || undefined }, t('demandeDocuments.messages.markedReady'));
}

async function remettre(d: DemandeDocument | null) {
  if (!d) return;
  const noteRemise = await confirmerAvecSaisie({
    titre: t('demandeDocuments.handOverDialog.title'),
    message: t('demandeDocuments.handOverDialog.message'),
    libelleSaisie: t('demandeDocuments.detail.notes'),
    ok: t('demandeDocuments.handOverDialog.confirm'),
    couleur: 'positive',
  });
  if (noteRemise === null) return;
  await agir(d, 'remettre', 'remettre', { noteRemise: noteRemise.trim() || undefined }, t('demandeDocuments.messages.handedOver'));
}

async function rejeter(d: DemandeDocument | null) {
  if (!d) return;
  const motif = await confirmerAvecSaisie({
    titre: t('demandeDocuments.rejectDialog.title'),
    message: t('demandeDocuments.rejectDialog.message'),
    libelleSaisie: t('demandeDocuments.detail.motif'),
    ok: t('demandeDocuments.rejectDialog.confirm'),
    danger: true,
  });
  if (motif === null) return;
  // Le motif est obligatoire (3 caractères au moins), comme côté API.
  if (motif.trim().length < 3) {
    $q.notify({ type: 'warning', message: t('common.messages.errors.tooShort') });
    return;
  }
  await agir(d, 'rejeter', 'rejeter', { motif: motif.trim() }, t('demandeDocuments.messages.rejected'), 'warning');
}

onMounted(() => {
  void chargerStats();
});
</script>

<style scoped lang="scss">
$encre: #1D1D1F;
$vert: #007A4D;
$jaune-fonce: #8A6300;
$rouge: #CE1126;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}


.demande-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--up-2);
  background: rgba(16, 37, 30, 0.04);
  padding: var(--up-2);
  border-left: var(--up-filet);

  .pochoir {
    display: block;
    color: var(--up-encre-douce);
    margin-bottom: 2px;
  }
}

.demande-motif,
.demande-notes,
.demande-notification {
  background: var(--up-craie);
  border: var(--up-filet-fin);
  padding: var(--up-2);
  border-radius: var(--up-rayon-sm);
  font-size: 0.95rem;
}
</style>
