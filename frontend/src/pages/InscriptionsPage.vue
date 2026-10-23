<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('inscriptions.title')" :subtitle="$t('inscriptions.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('inscriptions.actions.new')"
          @click="dialogInscription = true"
        />
      </template>
    </page-header>

    <!-- Arrivée depuis la fiche d'un étudiant : le ciblage est annoncé et se lève. -->
    <q-banner v-if="etudiantCible && filtres.etudiant" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="person_search" /></template>
      {{ $t('inscriptions.banner.dossiersOf') }} <strong>{{ etudiantCible.prenom }} {{ etudiantCible.nom }}</strong>
      {{ $t('inscriptions.banner.allYears', { matricule: etudiantCible.matricule }) }}
      <template #action>
        <q-btn flat dense no-caps :label="$t('inscriptions.banner.viewAll')" @click="retirerEtudiantCible" />
      </template>
    </q-banner>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('inscriptions.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #principaux>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('inscriptions.filters.status')"
        />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('inscriptions.filters.academicYear')"
          @update:model-value="filtres.promotionId = null"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('inscriptions.filters.promotion')"
        />

        <champ-date v-model="filtres.dateDebut" :label="$t('inscriptions.filters.enrolledFrom')" />
        <champ-date v-model="filtres.dateFin" :label="$t('inscriptions.filters.enrolledUntil')" />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #loading><q-linear-progress indeterminate color="primary" :aria-label="$t('common.messages.loading')" /></template>
      <template #no-data>
        <etat-vide icone="how_to_reg" :titre="messageVide">
          <template #action>
            <div class="q-gutter-sm">
              <q-btn
                v-if="filtresActifs"
                outline
                no-caps
                icon="refresh"
                :label="$t('inscriptions.actions.resetFilters')"
                @click="reinitialiser"
              />
              <q-btn
                v-if="peutGerer"
                unelevated
                color="primary"
                no-caps
                icon="add"
                :label="$t('inscriptions.actions.new')"
                @click="dialogInscription = true"
              />
            </div>
          </template>
        </etat-vide>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip dense outline color="primary">{{ p.row.promotion?.nom }}</q-chip>
          <div class="text-caption text-grey-7">{{ p.row.annee?.libelle }}</div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_INSCRIPTION[p.row.statut] ?? p.row.statut }}
          </span>
        </q-td>
      </template>

      <template #body-cell-montantFrais="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montantFrais) }}
        </q-td>
      </template>

      <template #body-cell-paye="p">
        <q-td :props="p" class="text-right chiffres">
          <span :class="{ 'text-positive text-weight-medium': resteAPayer(p.row) === 0 }">
            {{ montantLisible(montantPaye(p.row)) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-solde="p">
        <q-td :props="p" class="text-right text-weight-medium chiffres">
          <span :class="{ 'text-negative': resteAPayer(p.row) > 0 }">
            {{ montantLisible(resteAPayer(p.row)) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-dateInscription="p">
        <q-td :props="p">
          {{ dateLisible(p.row.dateInscription ?? p.row.createdAt) }}
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            v-if="peutEncaisserDossier(p.row)"
            flat
            dense no-caps
            color="primary"
            icon="payments"
            :aria-label="$t('inscriptions.table.actions.collectAria')" :label="$t('inscriptions.table.actions.collectAria')"
            @click="encaisser(p.row)"
          >
            <q-tooltip>
              {{ $t('inscriptions.table.actions.collectTooltip', { amount: montantLisible(resteAPayer(p.row)) }) }}
            </q-tooltip>
          </q-btn>
<q-btn
            v-if="peutValider(p.row)"
            flat
            dense no-caps
            color="positive"
            icon="verified"
            :aria-label="$t('inscriptions.table.actions.validateAria')" :label="$t('inscriptions.table.actions.validateAria')"
            @click="valider(p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.validateTooltip') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="receipt_long"
            :aria-label="$t('inscriptions.table.actions.viewPaymentsAria')" :label="$t('inscriptions.table.actions.viewPaymentsAria')"
            @click="voirPaiements(p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.viewPaymentsTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutAnnuler(p.row)"
            flat
            dense no-caps
            color="negative"
            icon="cancel"
            :aria-label="$t('inscriptions.table.actions.cancelAria')" :label="$t('inscriptions.table.actions.cancelAria')"
            @click="annuler(p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.cancelTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="print"
            :aria-label="$t('inscriptions.table.actions.printAria')" :label="$t('inscriptions.table.actions.printAria')"
            @click="imprimer(p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.printTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            flat
            dense no-caps
            color="primary"
            icon="person"
            :aria-label="$t('inscriptions.table.actions.viewStudentAria')" :label="$t('inscriptions.table.actions.viewStudentAria')"
            @click="voirEtudiant(p.row)"
          >
            <q-tooltip>{{ $t('inscriptions.table.actions.viewStudentTooltip') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <q-linear-progress :aria-label="$t('common.messages.loading')"
      v-if="modeVue === 'cartes' && liste.chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="inscriptions-cartes">
      <q-card
        v-for="d in liste.lignes"
        :key="d.id"
        flat
        bordered
        class="carte inscriptions-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <span class="champ badge-statut" :class="classeStatut(d.statut)">
              {{ LIBELLE_STATUT_INSCRIPTION[d.statut] ?? d.statut }}
            </span>
            <q-space />
            <div class="text-caption text-grey-7">{{ d.numero }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ d.etudiant?.nom }} {{ d.etudiant?.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            {{ d.etudiant?.matricule }} · {{ d.promotion?.nom }} · {{ d.annee?.libelle }}
          </div>
          <div class="row q-mt-sm q-col-gutter-sm">
            <div class="col-4">
              <div class="text-caption text-grey-7">{{ $t('inscriptions.cards.fees') }}</div>
              <div class="text-weight-medium chiffres">{{ montantLisible(d.montantFrais) }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">{{ $t('inscriptions.cards.paid') }}</div>
              <div class="text-weight-medium chiffres text-positive">
                {{ montantLisible(montantPaye(d)) }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">{{ $t('inscriptions.cards.balance') }}</div>
              <div
                class="text-weight-medium chiffres"
                :class="{ 'text-negative': resteAPayer(d) > 0 }"
              >
                {{ montantLisible(resteAPayer(d)) }}
              </div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ dateLisible(d.dateInscription ?? d.createdAt) }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
<q-btn
            v-if="peutEncaisserDossier(d)"
            flat
            dense
            color="primary"
            icon="payments"
            no-caps
            :label="$t('inscriptions.cards.actions.collect')"
            @click="encaisser(d)"
          />
<q-btn
            v-if="peutValider(d)"
            flat
            dense
            color="positive"
            icon="verified"
            no-caps
            :label="$t('inscriptions.cards.actions.validate')"
            @click="valider(d)"
          />
<actions-secondaires>
<q-btn v-close-popup
            flat
            dense
            icon="receipt_long"
            no-caps
            :label="$t('inscriptions.cards.actions.payments')"
            @click="voirPaiements(d)"
          />
<q-btn v-close-popup
            v-if="peutAnnuler(d)"
            flat
            dense
            color="negative"
            icon="cancel"
            no-caps
            :label="$t('inscriptions.cards.actions.cancel')"
            @click="annuler(d)"
          />
<q-btn v-close-popup
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            :label="$t('inscriptions.cards.actions.certificate')"
            @click="imprimer(d)"
          />
<q-btn v-close-popup
            flat
            dense
            icon="person"
            no-caps
            :label="$t('inscriptions.cards.actions.student')"
            @click="voirEtudiant(d)"
          />
</actions-secondaires>
</q-card-actions>
      </q-card>
      <etat-vide v-if="!liste.lignes.length" icone="how_to_reg" :titre="messageVide">
        <template #action>
          <div class="q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('inscriptions.actions.resetFilters')"
              @click="reinitialiser"
            />
            <q-btn
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('inscriptions.actions.new')"
              @click="dialogInscription = true"
            />
          </div>
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="toutAfficher"
    />

    <inscription-dialog v-model="dialogInscription" @enregistre="liste.recharger()" />
    <paiement-dialog
      v-model="dialogPaiement"
      :inscription-id="paiementInscriptionId"
      :montant-initial="paiementMontantInitial"
      @paye="liste.recharger()"
    />
    <etudiant-dialog
      v-model="dialogFicheEtudiant"
      :etudiant="etudiantEdite"
      @enregistre="liste.recharger()"
    />

    <!-- Dialog : aperçu de l'étudiant -->
    <q-dialog v-model="dialogEtudiant">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              {{ etudiantApercu?.nom }} {{ etudiantApercu?.prenom }}
            </div>
            <div class="text-caption text-grey-7">
              {{ etudiantApercu?.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress :aria-label="$t('common.messages.loading')" v-if="chargementEtudiant" indeterminate color="primary" />
          <div v-else-if="!etudiantApercu" class="text-center q-pa-md text-grey-7">
            {{ $t('inscriptions.studentDialog.unavailable') }}
          </div>
          <q-list v-else separator dense>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('inscriptions.studentDialog.sex') }}</q-item-label>
                <q-item-label>{{ etudiantApercu?.sexe ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('inscriptions.studentDialog.birthDate') }}</q-item-label>
                <q-item-label>{{ dateLisible(etudiantApercu?.dateNaissance) }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('inscriptions.studentDialog.phone') }}</q-item-label>
                <q-item-label>{{ etudiantApercu?.telephone ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('inscriptions.studentDialog.email') }}</q-item-label>
                <q-item-label>{{ etudiantApercu?.email ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('inscriptions.studentDialog.address') }}</q-item-label>
                <q-item-label>{{ etudiantApercu?.adresse ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('inscriptions.studentDialog.portalAccount') }}</q-item-label>
                <q-item-label>
                  {{ etudiantApercu?.user ? etudiantApercu.user.email : $t('inscriptions.studentDialog.none') }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('inscriptions.studentDialog.close')" v-close-popup />
          <q-btn
            v-if="etudiantApercu"
            flat
            no-caps
            icon="groups"
            :label="$t('inscriptions.studentDialog.registry')"
            @click="ouvrirRegistreEtudiant"
          />
          <q-btn
            v-if="etudiantApercu && peutGerer"
            flat
            no-caps
            icon="payments"
            :label="$t('inscriptions.studentDialog.hisPayments')"
            @click="voirPaiementsEtudiant"
          />
          <q-btn
            v-if="peutGerer && etudiantApercu"
            color="primary"
            unelevated
            no-caps
            icon="edit"
            :label="$t('inscriptions.studentDialog.editRecord')"
            @click="ouvrirModificationEtudiant"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import InscriptionDialog from '../components/InscriptionDialog.vue';
import PaiementDialog from '../components/PaiementDialog.vue';
import EtudiantDialog from '../components/EtudiantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ChampDate from '../components/ChampDate.vue';
import EtatVide from '../components/EtatVide.vue';
import { texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { ouvrirImpression } from '../services/impression';
import {
  LIBELLE_STATUT_INSCRIPTION,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type {
  AnneeAcademique,
  Etudiant,
  Inscription,
  Paiement,
  Promotion,
  StatutInscription, ChipFiltre } from '../types';

const $q = useQuasar();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { confirmer } = useConfirmation();

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const modeVue = usePresentationListe();

/**
 * Filtres transmis à `GET /inscriptions` : tous sont appliqués par le serveur,
 * donc à l'ensemble des dossiers et au total paginé. Les dates portent sur la
 * date d'inscription, à défaut la date de création du dossier. `etudiant`
 * (`/inscriptions?etudiant=<id>`) restreint aux dossiers d'un étudiant.
 */
const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null,
  anneeId: null,
  promotionId: null,
  dateDebut: null,
  dateFin: null,
  etudiant: null,
});
const liste = reactive(
  useListePaginee<Inscription>({
    filtres,
    syncUrl: true,
    // Premier chargement une fois les filtres d'ouverture posés (onMounted).
    immediat: false,
    charger: ({ page, pageSize, filtres: f }) =>
      api
        .get('/inscriptions', {
          params: {
            page,
            pageSize,
            search: texteApi(f.recherche),
            anneeId: f.anneeId || undefined,
            promotionId: f.promotionId || undefined,
            statut: f.statut || undefined,
            dateDebut: f.dateDebut || undefined,
            dateFin: f.dateFin || undefined,
            etudiantId: f.etudiant || undefined,
          },
        })
        .then((r) => r.data),
  }),
);
/** Fiche de l'étudiant ciblé, pour annoncer son nom. */
const etudiantCible = ref<Etudiant | null>(null);

const dialogInscription = ref(false);
const dialogPaiement = ref(false);
const paiementInscriptionId = ref<string | undefined>(undefined);
const paiementMontantInitial = ref<number | undefined>(undefined);

const dialogEtudiant = ref(false);
const etudiantApercu = ref<Etudiant | null>(null);
const chargementEtudiant = ref(false);
const etudiantEdite = ref<Etudiant | null>(null);
const dialogFicheEtudiant = ref(false);

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
/** Encaisser, c'est créer un paiement : mêmes rôles que `POST /paiements`. */
const peutEncaisser = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_INSCRIPTION).map(([value, label]) => ({ value, label })),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('inscriptions.table.columns.number'), field: 'numero', align: 'left', sortable: true },
  { name: 'etudiant', label: t('inscriptions.table.columns.student'), field: 'etudiant', align: 'left' },
  { name: 'promotion', label: t('inscriptions.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'statut', label: t('inscriptions.table.columns.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'montantFrais', label: t('inscriptions.table.columns.fees'), field: 'montantFrais', align: 'right', sortable: true },
  { name: 'paye', label: t('inscriptions.table.columns.paid'), field: 'paye', align: 'right' },
  { name: 'solde', label: t('inscriptions.table.columns.balance'), field: 'solde', align: 'right' },
  { name: 'dateInscription', label: t('inscriptions.table.columns.enrolledOn'), field: 'dateInscription', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const classeStatut = (s: string) =>
  ({
    BROUILLON: 'champ--brouillon',
    EN_ATTENTE_PAIEMENT: 'champ--attente-paiement',
    PAYEE: 'champ--payee',
    VALIDEE: 'champ--validee',
    ANNULEE: 'champ--annulee',
  })[s] ?? 'champ--brouillon';

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() => {
  if (etudiantCible.value && filtres.value.etudiant) {
    return t('inscriptions.emptyState.noRecordsForStudent', {
      name: `${etudiantCible.value.prenom} ${etudiantCible.value.nom}`,
    });
  }
  return filtresActifs.value
    ? t('inscriptions.emptyState.noMatch')
    : t('inscriptions.emptyState.none');
});

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('inscriptions.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: t('inscriptions.chips.year', { value: a?.libelle ?? '?' }), value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: t('inscriptions.chips.promotion', { value: p?.nom ?? '?' }), value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('inscriptions.chips.status', {
        value: LIBELLE_STATUT_INSCRIPTION[filtres.value.statut as StatutInscription] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: t('inscriptions.chips.since', { value: dateLisible(filtres.value.dateDebut) }),
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: t('inscriptions.chips.until', { value: dateLisible(filtres.value.dateFin) }),
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

/** Somme réellement encaissée sur le dossier (seuls les paiements réussis comptent). */
function montantPaye(dossier: Inscription): number {
  return (dossier.paiements ?? [])
    .filter((p: Paiement) => p.statut === 'REUSSI')
    .reduce((t, p) => t + p.montant, 0);
}

/** Reste dû sur les frais d'inscription. */
function resteAPayer(dossier: Inscription): number {
  return Math.max(0, dossier.montantFrais - montantPaye(dossier));
}

const peutValider = (d: Inscription) =>
  auth.aRole(['SCOLARITE', 'ADMIN']) && d.statut === 'PAYEE';
const peutAnnuler = (d: Inscription) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && !['VALIDEE', 'ANNULEE'].includes(d.statut);
/** Un dossier annulé ne s'encaisse plus, un dossier soldé non plus. */
const peutEncaisserDossier = (d: Inscription) =>
  peutEncaisser.value && d.statut !== 'ANNULEE' && resteAPayer(d) > 0;

/** Encaissement : le dialogue s'ouvre sur le dossier, au montant restant dû. */
function encaisser(row: Inscription) {
  paiementInscriptionId.value = row.id;
  paiementMontantInitial.value = resteAPayer(row);
  dialogPaiement.value = true;
}

/** Écran Paiements préfiltré sur le dossier. */
function voirPaiements(dossier: Inscription) {
  void router.push({ path: '/paiements', query: { inscription: dossier.id } });
}

async function valider(dossier: Inscription) {
  const ok = await confirmer({
    titre: t('inscriptions.dialogs.validate.title'),
    message: t('inscriptions.dialogs.validate.message', {
      numero: dossier.numero,
      prenom: dossier.etudiant?.prenom,
      nom: dossier.etudiant?.nom,
    }),
    ok: t('inscriptions.dialogs.validate.confirm'),
  });
  if (!ok) return;
  try {
    await api.put(`/inscriptions/${dossier.id}/valider`);
  } catch {
    return;
  }
  $q.notify({ type: 'positive', message: t('inscriptions.messages.validated') });
  await liste.recharger();
}

async function annuler(dossier: Inscription) {
  const ok = await confirmer({
    titre: t('inscriptions.dialogs.cancel.title'),
    message: t('inscriptions.dialogs.cancel.message', { numero: dossier.numero }),
    ok: t('inscriptions.dialogs.cancel.confirm'),
    danger: true,
  });
  if (!ok) return;
  try {
    await api.put(`/inscriptions/${dossier.id}/annuler`);
  } catch {
    return;
  }
  $q.notify({ type: 'warning', message: t('inscriptions.messages.cancelled') });
  await liste.recharger();
}

function imprimer(dossier: Inscription) {
  void ouvrirImpression(`/inscriptions/${dossier.id}/attestation-inscription`);
}

async function voirEtudiant(dossier: Inscription) {
  dialogEtudiant.value = true;
  chargementEtudiant.value = true;
  etudiantApercu.value = null;
  try {
    const { data } = await api.get(`/etudiants/${dossier.etudiantId}`);
    etudiantApercu.value = data;
  } catch {
    etudiantApercu.value = null;
  } finally {
    chargementEtudiant.value = false;
  }
}

/** Registre des étudiants, recherche posée sur le matricule du dossier. */
function ouvrirRegistreEtudiant() {
  const e = etudiantApercu.value;
  if (!e) return;
  dialogEtudiant.value = false;
  void router.push({ path: '/etudiants', query: { recherche: e.matricule } });
}

/** Paiements de l'étudiant, tous dossiers confondus. */
function voirPaiementsEtudiant() {
  const e = etudiantApercu.value;
  if (!e) return;
  dialogEtudiant.value = false;
  void router.push({ path: '/paiements', query: { etudiant: e.id } });
}

function ouvrirModificationEtudiant() {
  if (!etudiantApercu.value) return;
  etudiantEdite.value = etudiantApercu.value;
  dialogEtudiant.value = false;
  dialogFicheEtudiant.value = true;
}

/** « Tout afficher » : une seule page, bornée à 1 000 lignes par l'API. */
function toutAfficher() {
  liste.pageSize = Math.min(Math.max(liste.total, 1), 1000);
}

/** Tout tombe, recherche comprise ; un ciblage levé ramène à l'année en cours. */
function reinitialiser() {
  const ciblait = !!filtres.value.etudiant;
  liste.reinitialiser([]);
  etudiantCible.value = null;
  if (ciblait) filtres.value.anneeId = referentiels.anneeCourante?.id ?? null;
}

/** Lève le ciblage venu de l'URL : retour aux dossiers de l'année en cours. */
function retirerEtudiantCible() {
  etudiantCible.value = null;
  filtres.value = {
    ...filtres.value,
    etudiant: null,
    recherche: '',
    anneeId: referentiels.anneeCourante?.id ?? null,
  };
}

/**
 * `/inscriptions?etudiant=<id>` : on lit la fiche pour afficher son nom et
 * poser la recherche sur son matricule ; le filtre exact passe par
 * `etudiantId`.
 */
async function appliquerEtudiantCible(id: string) {
  try {
    const { data } = await api.get(`/etudiants/${id}`);
    etudiantCible.value = data;
    filtres.value.recherche = data.matricule;
    // Le dossier cherché peut relever d'une autre année que l'année active.
    filtres.value.anneeId = null;
  } catch {
    etudiantCible.value = null;
    filtres.value.etudiant = null;
    $q.notify({ type: 'warning', message: t('inscriptions.messages.studentNotFound') });
  }
}

onMounted(async () => {
  try {
    [annees.value, promotions.value] = await Promise.all([
      referentiels.annees(),
      referentiels.promotions(),
    ]);
  } catch {
    annees.value = [];
    promotions.value = [];
  }

  const avant = JSON.stringify(filtres.value);
  if (filtres.value.etudiant) {
    await appliquerEtudiantCible(filtres.value.etudiant);
  } else if (!Object.keys(filtres.value).some((k) => route.query[k])) {
    // Arrivée sans filtre : l'année en cours. Une recherche reçue (n° de dossier
    // depuis un paiement) ou des filtres relus de l'URL valent toutes années.
    filtres.value.anneeId = referentiels.anneeCourante?.id ?? null;
  }

  // Un filtre posé ci-dessus relance déjà la liste par l'observateur.
  if (JSON.stringify(filtres.value) === avant) await liste.recharger();
});
</script>

<style scoped lang="scss">
.inscriptions-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--up-3);
}
.inscriptions-cartes__carte {
  background: var(--up-plaque);
}


.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 590;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.champ--brouillon { background: #e8e8ed; color: #33463f; }
.champ--attente-paiement { background: #fcd116; color: #1d1d1f; }
.champ--payee { background: #007a4d; color: #fff; }
.champ--validee { background: #0066cc; color: #fff; }
.champ--annulee { background: #ce1126; color: #fff; }
</style>
