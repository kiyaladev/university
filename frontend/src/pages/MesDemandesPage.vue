<template>
  <q-page class="q-pa-md">
    <section-navigation section="procedures" />
    <page-header :title="$t('mesDemandes.title')" :subtitle="$t('mesDemandes.subtitle')">
      <template #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('mesDemandes.actions.new')"
          @click="creationOuverte = true"
        />
      </template>
    </page-header>

    <q-banner v-if="rolePasBon" class="note--info q-mb-md">
      {{ $t('mesDemandes.banner.wrongRole', { role: auth.utilisateur?.role, registry: $t('mesDemandes.banner.goToRegistry') }) }}
      <template #action>
        <q-btn
          flat
          no-caps
          icon="description"
          :label="$t('mesDemandes.banner.goToRegistry')"
          :to="{ name: 'demandes-docs' }"
        />
      </template>
    </q-banner>

    <div v-if="!rolePasBon" class="resume-liste" role="status">
      <span v-for="s in plaques" :key="s.cle">{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span>
    </div>

    <filter-bar
      v-if="!rolePasBon"
      v-model="filtres"
      :placeholder="$t('mesDemandes.filters.searchPlaceholder')"
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
          :label="$t('common.fields.status')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      v-if="!rolePasBon"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <q-table
      v-if="!rolePasBon && modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
      @row-click="(_, row) => ouvrirSuivi(row)"
    >
      <template #no-data>
        <etat-vide icone="description" :titre="$t('mesDemandes.emptyState.description')" />
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
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
            size="14px"
            class="q-ml-xs"
          >
            <q-tooltip>{{ $t('mesDemandes.table.paymentConfirmed') }}</q-tooltip>
          </q-icon>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'EN_ATTENTE_PAIEMENT' && p.row.frais > 0"
            unelevated
            color="primary"
            dense
            no-caps
            icon="payments"
            :label="$t('mesDemandes.actions.pay')"
            @click.stop="ouvrirPaiement(p.row)"
          />
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('mesDemandes.table.trackAria')"
            @click.stop="ouvrirSuivi(p.row)"
          >
            <q-tooltip>{{ $t('mesDemandes.table.trackTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else-if="!rolePasBon" class="row q-col-gutter-md">
      <div v-for="d in liste.lignes" :key="d.id" class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-start">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ d.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ libelleType(d.type) }}</div>
              <div class="text-caption text-grey-7">
                {{ $t('mesDemandes.cards.createdOn', { date: dateHeureLisible(d.creeLe) }) }}
              </div>
            </div>
            <PastilleStatut domaine="demande" :statut="d.statut" />
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
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
              </span>
            </div>
            <div class="row items-center text-grey-8">
              <q-icon name="timeline" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ EXPLICATION_STATUT[d.statut] }}</span>
            </div>
            <div v-if="d.notification" class="row items-center text-positive">
              <q-icon name="sms" size="16px" class="q-mr-sm" />
              <span class="text-caption" style="white-space: pre-wrap">{{ d.notification }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="visibility" :label="$t('mesDemandes.actions.track')" @click="ouvrirSuivi(d)" />
            <q-btn
              v-if="d.statut === 'EN_ATTENTE_PAIEMENT' && d.frais > 0"
              unelevated
              color="primary"
              no-caps
              icon="payments"
              :label="$t('mesDemandes.actions.payNow')"
              @click="ouvrirPaiement(d)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!liste.chargement && !liste.lignes.length"
        class="col-12"
        icone="description"
        :titre="$t('mesDemandes.emptyState.description')"
      >
        <template #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('mesDemandes.actions.new')"
            @click="creationOuverte = true"
          />
        </template>
      </etat-vide>
    </div>

    <demande-document-dialog v-model="creationOuverte" @enregistre="liste.recharger()" />

    <!-- Suivi d'une demande : mêmes étapes que côté scolarité -->
    <q-dialog v-model="suiviOuvert">
      <q-card style="width: 620px; max-width: 96vw">
        <q-card-section v-if="demandeSuivie" class="row items-center no-wrap">
          <div class="col">
            <div class="text-h6">{{ demandeSuivie.numero }}</div>
            <div class="text-caption text-grey-7">{{ libelleType(demandeSuivie.type) }}</div>
          </div>
          <PastilleStatut domaine="demande" :statut="demandeSuivie.statut" />
        </q-card-section>
        <q-card-section v-if="demandeSuivie" class="q-pt-none">
          <workflow-stepper
            :etapes="ETAPES_DEMANDE"
            :actuel="demandeSuivie.statut"
            :readonly="true"
          />
          <q-banner class="note--info q-mt-md">
            {{ EXPLICATION_STATUT[demandeSuivie.statut] }}
          </q-banner>

          <div class="demande-meta q-mt-md">
            <div>
              <span class="pochoir">{{ $t('mesDemandes.dialog.fees') }}</span>
              <span class="chiffres">
                {{ montantLisible(demandeSuivie.frais) }} {{ demandeSuivie.devise }}
              </span>
            </div>
            <div>
              <span class="pochoir">{{ $t('common.fields.payment') }}</span>
              <span v-if="demandeSuivie.paiement">
                {{ demandeSuivie.paiement.reference }} ·
                {{ LIBELLE_STATUT_PAIEMENT[demandeSuivie.paiement.statut] ?? demandeSuivie.paiement.statut }}
              </span>
              <span v-else class="text-grey-7">{{ $t('mesDemandes.dialog.notInitiated') }}</span>
            </div>
            <div>
              <span class="pochoir">{{ $t('common.fields.createdOn') }}</span>
              <span>{{ dateHeureLisible(demandeSuivie.creeLe) }}</span>
            </div>
            <div v-if="demandeSuivie.remiseLe">
              <span class="pochoir">{{ $t('mesDemandes.dialog.deliveredAt') }}</span>
              <span>{{ dateHeureLisible(demandeSuivie.remiseLe) }}</span>
            </div>
          </div>

          <div v-if="demandeSuivie.motif" class="q-mt-md">
            <span class="section-titre">{{ $t('mesDemandes.dialog.requestReason') }}</span>
            <div class="demande-bloc" style="white-space: pre-wrap">{{ demandeSuivie.motif }}</div>
          </div>
          <div v-if="demandeSuivie.notification" class="q-mt-md">
            <span class="section-titre">{{ $t('mesDemandes.dialog.registrarMessage') }}</span>
            <div class="demande-bloc" style="white-space: pre-wrap">{{ demandeSuivie.notification }}</div>
          </div>
          <div v-if="demandeSuivie.statut === 'REJETEE' && demandeSuivie.notes" class="q-mt-md">
            <span class="section-titre">{{ $t('mesDemandes.dialog.rejectionReason') }}</span>
            <div class="demande-bloc" style="white-space: pre-wrap">{{ demandeSuivie.notes }}</div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.actions.close')" no-caps v-close-popup />
          <q-btn
            v-if="demandeSuivie && demandeSuivie.statut === 'EN_ATTENTE_PAIEMENT' && demandeSuivie.frais > 0"
            unelevated
            color="primary"
            no-caps
            icon="payments"
            :label="$t('mesDemandes.actions.payNow')"
            @click="ouvrirPaiement(demandeSuivie)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialogue de paiement -->
    <dialogue-formulaire
      v-model="paiementOuvert"
      :titre="$t('mesDemandes.paymentDialog.title')"
      taille="s"
      :envoi="enregistrementPaiement"
      :libelle-valider="$t('mesDemandes.actions.pay')"
      icone-valider="payments"
      @valider="payer"
    >
    <template v-if="demandeAPayer">
      <div class="row q-col-gutter-md items-center q-mb-md">
        <div class="col">
          <div class="text-uppercase text-caption text-grey-7">{{ demandeAPayer.numero }}</div>
          <div class="text-subtitle1 text-weight-medium">{{ libelleType(demandeAPayer.type) }}</div>
        </div>
        <div class="col-auto text-h5 chiffres">
          {{ montantLisible(demandeAPayer.frais) }} {{ demandeAPayer.devise }}
        </div>
      </div>
      <q-select
        v-model="formPaiement.mode"
        :options="OPTIONS_PAIEMENT"
        outlined
        dense
        emit-value
        map-options
        :label="$t('mesDemandes.paymentDialog.mode')"
        class="q-mb-md"
      />
      <template v-if="formPaiement.mode === 'MOBILE_MONEY'">
        <q-select
          v-model="formPaiement.operateur"
          :options="OPTIONS_OPERATEUR"
          outlined
          dense
          emit-value
          map-options
          :label="$t('common.fields.operator')"
          class="q-mb-sm"
        />
        <q-input
          v-model="formPaiement.telephone"
          outlined
          dense
          :label="$t('mesDemandes.paymentDialog.phoneLabel')"
          :hint="$t('mesDemandes.paymentDialog.phoneHint')"
        />
      </template>
      <q-banner class="note--info q-mt-md">
        <template v-if="formPaiement.mode === 'MOBILE_MONEY'">
          {{ $t('mesDemandes.paymentDialog.mobileMoneyNote') }}
        </template>
        <template v-else>
          {{ $t('mesDemandes.paymentDialog.pendingNote') }}
        </template>
      </q-banner>
    </template>
    <q-banner v-if="erreurPaiement" dense class="note--erreur q-mt-md">
      <template #avatar><q-icon name="warning" /></template>
      {{ erreurPaiement }}
    </q-banner>
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import SectionNavigation from '../components/SectionNavigation.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import DemandeDocumentDialog from '../components/DemandeDocumentDialog.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import WorkflowStepper from '../components/WorkflowStepper.vue';
import {
  LIBELLE_STATUT_DEMANDE,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_DEMANDE,
  dateHeureLisible,
  montantLisible,
  optionsDepuis,
} from '../utils/libelles';
import type { DemandeDocument, ModePaiement, StatutDemande, TypeDemandeDocument } from '../types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();

const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ETUDIANT');

/** Le même statut, dit sans jargon administratif. */
const EXPLICATION_STATUT = computed<Record<StatutDemande, string>>(() => ({
  EN_ATTENTE_PAIEMENT: t('mesDemandes.statusExplanations.EN_ATTENTE_PAIEMENT'),
  PAYEE: t('mesDemandes.statusExplanations.PAYEE'),
  EN_TRAITEMENT: t('mesDemandes.statusExplanations.EN_TRAITEMENT'),
  PRETE: t('mesDemandes.statusExplanations.PRETE'),
  REMISE: t('mesDemandes.statusExplanations.REMISE'),
  REJETEE: t('mesDemandes.statusExplanations.REJETEE'),
}));

const ETAPES_DEMANDE = computed(() => [
  { identifiant: 'EN_ATTENTE_PAIEMENT', libelle: t('common.fields.payment'), icone: 'payments' },
  { identifiant: 'PAYEE', libelle: t('mesDemandes.steps.paid'), icone: 'verified' },
  { identifiant: 'EN_TRAITEMENT', libelle: t('mesDemandes.steps.processing'), icone: 'build' },
  { identifiant: 'PRETE', libelle: t('mesDemandes.steps.ready'), icone: 'check_circle' },
  { identifiant: 'REMISE', libelle: t('mesDemandes.steps.delivered'), icone: 'task_alt' },
]);

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_DEMANDE);
const OPTIONS_PAIEMENT = computed(() => [
  { label: t('mesDemandes.paymentOptions.mobileMoney'), value: 'MOBILE_MONEY' as const },
  { label: t('mesDemandes.paymentOptions.cash'), value: 'ESPECES' as const },
  { label: t('mesDemandes.paymentOptions.transfer'), value: 'VIREMENT' as const },
]);
const OPTIONS_OPERATEUR = computed(() => [
  { label: t('mesDemandes.operatorOptions.orangeMoney'), value: 'ORANGE_MONEY' },
  { label: t('mesDemandes.operatorOptions.mtnMomo'), value: 'MTN_MOMO' },
  { label: t('mesDemandes.operatorOptions.telecel'), value: 'TELECEL' },
]);

const filtres = ref<Record<string, any>>({ recherche: '', statut: null });
const liste = reactive(
  useListePaginee<DemandeDocument>({
    filtres,
    actif: () => auth.utilisateur?.role === 'ETUDIANT',
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/documents-demande/mes', {
          params: { ...pageApi(p), statut: f.statut || undefined, search: texteApi(f.recherche) },
        })
        .then((r) => r.data),
  }),
);
const modeVue = usePresentationListe();

// Compteurs calculés sur les demandes affichées (l'API étudiante ne
// fournit pas de tableau de bord dédié).
const stats = computed(() => {
  const counts: Record<string, number> = { EN_ATTENTE_PAIEMENT: 0, EN_TRAITEMENT: 0, PRETE: 0, REMISE: 0 };
  for (const d of liste.lignes) {
    if (counts[d.statut] != null) counts[d.statut]++;
  }
  return counts;
});

const creationOuverte = ref(false);
const suiviOuvert = ref(false);
const demandeSuivie = ref<DemandeDocument | null>(null);
const paiementOuvert = ref(false);
const demandeAPayer = ref<DemandeDocument | null>(null);
const enregistrementPaiement = ref(false);
const erreurPaiement = ref('');
const formPaiement = ref({
  mode: 'MOBILE_MONEY' as ModePaiement,
  operateur: 'ORANGE_MONEY',
  telephone: '',
});

const plaques = computed(() => [
  { cle: 'EN_ATTENTE_PAIEMENT', libelle: t('mesDemandes.stats.labels.toPay'), alerte: true },
  { cle: 'EN_TRAITEMENT', libelle: t('mesDemandes.stats.labels.inProgress'), alerte: false },
  { cle: 'PRETE', libelle: t('mesDemandes.stats.labels.ready'), alerte: false },
  { cle: 'REMISE', libelle: t('mesDemandes.stats.labels.delivered'), alerte: false },
]);

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'frais', label: t('mesDemandes.table.columns.fees'), field: 'frais', align: 'right' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'creeLe',
    label: t('common.fields.createdOn'),
    field: 'creeLe',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ouvrirSuivi(d: DemandeDocument) {
  demandeSuivie.value = d;
  suiviOuvert.value = true;
}

function ouvrirPaiement(d: DemandeDocument) {
  suiviOuvert.value = false;
  demandeAPayer.value = d;
  paiementOuvert.value = true;
  erreurPaiement.value = '';
  formPaiement.value = {
    mode: 'MOBILE_MONEY',
    operateur: 'ORANGE_MONEY',
    telephone: '',
  };
}

async function payer() {
  if (!demandeAPayer.value) return;
  enregistrementPaiement.value = true;
  erreurPaiement.value = '';
  try {
    const mobileMoney = formPaiement.value.mode === 'MOBILE_MONEY';
    if (mobileMoney && !/^\+?[\d\s().-]{6,20}$/.test(formPaiement.value.telephone.trim())) {
      erreurPaiement.value = t('mesDemandes.messages.phoneRequired');
      return;
    }
    const body: Record<string, unknown> = {
      mode: formPaiement.value.mode,
    };
    if (mobileMoney) {
      body.operateur = formPaiement.value.operateur;
      body.telephone = formPaiement.value.telephone.trim();
    }
    await api.post(`/documents-demande/${demandeAPayer.value.id}/payer`, body, {
      silencieux: true,
    });
    $q.notify({
      type: 'positive',
      message: mobileMoney
        ? t('mesDemandes.messages.mobileMoneyPending')
        : t('mesDemandes.messages.paymentInitiatedPending'),
    });
    paiementOuvert.value = false;
    void liste.recharger();
  } catch (e: any) {
    erreurPaiement.value = e.response?.data?.message ?? t('mesDemandes.messages.paymentFailed');
  } finally {
    enregistrementPaiement.value = false;
  }
}

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

/* Mêmes blocs de détail que le registre de la scolarité. */
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

.demande-bloc {
  background: var(--up-craie);
  border: var(--up-filet-fin);
  padding: var(--up-2);
  border-radius: var(--up-rayon-sm);
  font-size: 0.95rem;
}

</style>
