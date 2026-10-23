<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import SectionNavigation from '../components/SectionNavigation.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, nextTick, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import CarteDialog from '../components/CarteDialog.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { dateLisible } from '../utils/libelles';
import type { CarteEtudiante } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

/**
 * Liaison depuis les autres écrans du dossier (demandes de documents,
 * réclamations) : `/cartes-etudiantes?etudiantId=…` ouvre directement la ou
 * les cartes de l'étudiant concerné (relu de l'URL par `syncUrl`).
 */
const filtres = ref<Record<string, any>>({ recherche: '', etudiantId: '' });
const liste = reactive(
  useListePaginee<CarteEtudiante>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/cartes-etudiantes', {
          params: { ...pageApi(p), search: texteApi(f.recherche), etudiantId: f.etudiantId || undefined },
        })
        .then((r) => r.data),
  }),
);

const modeVue = usePresentationListe();

const peutEmettre = computed(() => auth.peut('cartes.emettre'));
const peutModifier = computed(() => auth.peut('cartes.modifier'));
const peutRevoquer = computed(() => auth.peut('cartes.revoquer'));

const dialogEmission = ref(false);
const dialogRevocation = ref(false);
const dialogDetail = ref(false);
const carteEnEdition = ref<CarteEtudiante | null>(null);
const carteRevocation = ref<CarteEtudiante | null>(null);
const carteDetail = ref<CarteEtudiante | null>(null);
const motifRevocation = ref('');
const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'etudiant', label: t('carteEtudiante.table.columns.student'), field: 'etudiant', align: 'left' },
  { name: 'matricule', label: t('carteEtudiante.table.columns.matricule'), field: 'etudiant', align: 'left' },
  { name: 'emission', label: t('carteEtudiante.table.columns.issuedOn'), field: 'dateEmission', align: 'left' },
  { name: 'validite', label: t('carteEtudiante.table.columns.validity'), field: 'dateValidite', align: 'left' },
  { name: 'statut', label: t('carteEtudiante.table.columns.status'), field: 'statut', align: 'center' },
  { name: 'actions', label: t('carteEtudiante.table.columns.actions'), field: 'id', align: 'right' },
]);

function ouvrirDetail(c: CarteEtudiante) {
  carteDetail.value = c;
  urlVerification.value = `${window.location.origin}/#/verification-carte?carte=${encodeURIComponent(c.id)}&k=${encodeURIComponent(c.qrToken)}`;
  dialogDetail.value = true;
  void nextTick(() => {
    if (canvasQr.value) {
      void QRCode.toCanvas(canvasQr.value, urlVerification.value, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
  });
}

/** Ouvre la page publique de vérification, exactement comme le ferait un scan. */
function ouvrirVerification() {
  if (urlVerification.value) window.open(urlVerification.value, '_blank');
}

async function copierUrlVerification() {
  try {
    await navigator.clipboard.writeText(urlVerification.value);
    $q.notify({ type: 'positive', message: t('carteEtudiante.messages.linkCopied') });
  } catch {
    $q.notify({ type: 'warning', message: t('carteEtudiante.messages.copyError') });
  }
}

function imprimer(c: CarteEtudiante) {
  void ouvrirImpression(`/cartes-etudiantes/${c.id}/imprimer`);
}

function ouvrirRevocation(c: CarteEtudiante) {
  carteRevocation.value = c;
  motifRevocation.value = '';
  dialogRevocation.value = true;
}

async function confirmerRevocation() {
  if (!carteRevocation.value || motifRevocation.value.trim().length < 3) return;
  try {
    await api.post(`/cartes-etudiantes/${carteRevocation.value.id}/revoquer`, {
      motif: motifRevocation.value.trim(),
    });
    $q.notify({ type: 'warning', message: t('carteEtudiante.messages.revoked') });
    dialogRevocation.value = false;
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

/** Retire le filtre « un seul étudiant » posé par un lien entrant. */
function retirerFiltreEtudiant() {
  filtres.value = { ...filtres.value, etudiantId: '' };
}

function ouvrirModification(c: CarteEtudiante) {
  carteEnEdition.value = c;
  dialogEmission.value = true;
}

function ouvrirEmission() {
  carteEnEdition.value = null;
  dialogEmission.value = true;
}
</script>

<template>
  <q-page class="q-pa-md">
    <section-navigation section="documents" />
    <page-header :title="$t('carteEtudiante.title')" :subtitle="$t('carteEtudiante.subtitle')">
      <template v-if="peutEmettre" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('carteEtudiante.actions.issue')"
          @click="ouvrirEmission"
        />
      </template>
    </page-header>

    <q-banner v-if="filtres.etudiantId" class="note--info q-mb-md">
      {{ $t('carteEtudiante.studentBanner.message') }}
      <template #action>
        <q-btn flat no-caps :label="$t('carteEtudiante.studentBanner.seeAll')" @click="retirerFiltreEtudiant" />
      </template>
    </q-banner>

    <filter-bar v-model="filtres" :placeholder="$t('carteEtudiante.filters.searchPlaceholder')" />

    <pagination-bar v-model:page="liste.page" v-model:page-size="liste.pageSize" :total="liste.total" :show-all="false" />

    <!-- Vue tableau -->
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
    >
      <template #no-data>
        <etat-vide icone="badge" :titre="$t('carteEtudiante.emptyState.message')" />
      </template>
      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <strong>{{ p.row.etudiant?.prenom }} {{ p.row.etudiant?.nom }}</strong>
        </q-td>
      </template>
      <template #body-cell-matricule="p">
        <q-td :props="p"><code>{{ p.row.etudiant?.matricule ?? '—' }}</code></q-td>
      </template>
      <template #body-cell-emission="p">
        <q-td :props="p">{{ dateLisible(p.row.dateEmission) }}</q-td>
      </template>
      <template #body-cell-validite="p">
        <q-td :props="p">{{ dateLisible(p.row.dateValidite) }}</q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="carte" :statut="p.row.statut" />
          <div v-if="p.row.motifRevocation" class="text-caption text-grey-7">
            {{ p.row.motifRevocation }}
          </div>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            flat no-caps
            dense
            icon="qr_code_2"
            :aria-label="$t('carteEtudiante.actionsColumn.qrAria')" :label="$t('carteEtudiante.actionsColumn.qrAria')"
            @click="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('carteEtudiante.actionsColumn.qrTooltip') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup flat no-caps dense icon="print" :aria-label="$t('carteEtudiante.actionsColumn.printAria')" :label="$t('carteEtudiante.actionsColumn.printAria')" @click="imprimer(p.row)">
            <q-tooltip>{{ $t('carteEtudiante.actionsColumn.printTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutModifier && p.row.statut === 'EMISE'"
            flat no-caps
            dense
            icon="edit"
            :aria-label="$t('carteEtudiante.actionsColumn.editAria')" :label="$t('carteEtudiante.actionsColumn.editAria')"
            @click="ouvrirModification(p.row)"
          >
            <q-tooltip>{{ $t('carteEtudiante.actionsColumn.editTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="p.row.statut === 'EMISE' && peutRevoquer"
            flat no-caps
            dense
            icon="block"
            color="negative"
            :aria-label="$t('carteEtudiante.actionsColumn.revokeAria')" :label="$t('carteEtudiante.actionsColumn.revokeAria')"
            @click="ouvrirRevocation(p.row)"
          >
            <q-tooltip>{{ $t('carteEtudiante.actionsColumn.revokeTooltip') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div v-for="c in liste.lignes" :key="c.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="carte-carte">
          <q-card-section class="row items-center q-gutter-sm">
            <q-avatar size="56px" color="grey-3" text-color="primary">
              <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.etudiant?.prenom}`" />
              <q-icon v-else name="person" size="32px" />
            </q-avatar>
            <div class="col">
              <div class="text-weight-bold">{{ c.etudiant?.prenom }} {{ c.etudiant?.nom }}</div>
              <div class="text-caption text-grey-7">
                {{ $t('carteEtudiante.table.columns.matricule') }} <code>{{ c.etudiant?.matricule }}</code>
              </div>
            </div>
            <PastilleStatut domaine="carte" :statut="c.statut" />
          </q-card-section>
          <q-separator />
          <q-card-section class="text-caption">
            {{ $t('carteEtudiante.card.issuedOn', { date: dateLisible(c.dateEmission) }) }}<br>
            {{ $t('carteEtudiante.card.validUntil', { date: dateLisible(c.dateValidite) }) }}
            <div v-if="c.motifRevocation" class="text-grey-7 q-mt-xs">
              {{ $t('carteEtudiante.card.revocationReason', { motif: c.motifRevocation }) }}
            </div>
          </q-card-section>
          <q-card-actions align="right">
<q-btn flat dense icon="qr_code_2" :label="$t('carteEtudiante.cardActions.qr')" no-caps @click="ouvrirDetail(c)" />
<actions-secondaires>
<q-btn v-close-popup flat dense icon="print" :label="$t('carteEtudiante.cardActions.print')" no-caps @click="imprimer(c)" />
<q-btn v-close-popup
              v-if="peutModifier && c.statut === 'EMISE'"
              flat
              dense
              icon="edit"
              :label="$t('carteEtudiante.cardActions.edit')"
              no-caps
              @click="ouvrirModification(c)"
            />
<q-btn v-close-popup
              v-if="c.statut === 'EMISE' && peutRevoquer"
              flat
              dense
              icon="block"
              color="negative"
              :label="$t('carteEtudiante.cardActions.revoke')"
              no-caps
              @click="ouvrirRevocation(c)"
            />
</actions-secondaires>
</q-card-actions>
        </q-card>
      </div>
      <etat-vide v-if="!liste.chargement && !liste.lignes.length" class="col-12" icone="badge" :titre="$t('carteEtudiante.emptyState.message')" />
    </div>

    <!-- Dialog émission / édition -->
    <carte-dialog v-model="dialogEmission" :carte="carteEnEdition" @enregistre="liste.recharger()" />

    <!-- Dialog révocation -->
    <dialogue-formulaire
      v-model="dialogRevocation"
      :titre="$t('carteEtudiante.revokeDialog.title')"
      :sous-titre="carteRevocation?.etudiant ? `${carteRevocation.etudiant.prenom} ${carteRevocation.etudiant.nom} · ${carteRevocation.etudiant.matricule}` : undefined"
      taille="s"
      :libelle-valider="$t('carteEtudiante.revokeDialog.confirm')"
      couleur-valider="negative"
      :desactive="motifRevocation.trim().length < 3"
      @valider="confirmerRevocation"
    >
      <q-banner class="note--alerte q-mb-md">
        {{ $t('carteEtudiante.revokeDialog.warning') }}
      </q-banner>
      <q-input
        v-model="motifRevocation"
        :label="$t('carteEtudiante.revokeDialog.motifLabel')"
        :hint="$t('carteEtudiante.revokeDialog.motifHint')"
        outlined
        dense
        type="textarea"
        autogrow
      />
    </dialogue-formulaire>

    <!-- Dialog détail + QR -->
    <q-dialog v-model="dialogDetail">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ $t('carteEtudiante.detailDialog.title') }}</div>
            <div v-if="carteDetail?.etudiant" class="text-caption text-grey-7">
              {{ carteDetail.etudiant.prenom }} {{ carteDetail.etudiant.nom }} ·
              {{ carteDetail.etudiant.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('carteEtudiante.detailDialog.close')" @click="dialogDetail = false" />
        </q-card-section>
        <q-card-section class="text-center">
          <canvas ref="canvasQr" />
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ $t('carteEtudiante.detailDialog.scanHint') }}
          </div>
          <div class="text-caption text-grey-7 q-mt-xs url-verification">
            <code>{{ urlVerification }}</code>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps icon="content_copy" :label="$t('carteEtudiante.detailDialog.copyLink')" @click="copierUrlVerification" />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="verified_user"
            :label="$t('carteEtudiante.detailDialog.openVerification')"
            @click="ouvrirVerification"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
/* Pas d'arrondi : la carte est une plaque, comme partout ailleurs. */
.carte-carte {
  border: var(--up-filet-fin);
  height: 100%;
  background: var(--up-plaque);
}

.url-verification code {
  word-break: break-all;
}
</style>
