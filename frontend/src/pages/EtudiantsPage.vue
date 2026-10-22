<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('etudiants.title')" :subtitle="$t('etudiants.subtitle')">
      <template #actions>
<div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('etudiants.actions.new')"
          @click="ouvrir(null)"
        />
      </div>
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('etudiants.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <autocomplete-async
          v-model="filtres.promotionId"
          endpoint="/promotions"
          :label-fn="(p) => p.nom"
          :label="$t('etudiants.filters.promotion')"
          clearable
        />
        <q-select
          v-model="filtres.actif"
          :options="optionsActif"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('etudiants.filters.status')"
        />
        <q-select
          v-model="filtres.sexe"
          :options="optionsSexe"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('etudiants.filters.gender')"
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('etudiants.filters.registeredFrom')" />
        <champ-date v-model="filtres.dateFin" :label="$t('etudiants.filters.registeredTo')" />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="etudiants"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
      :hide-bottom="chargement || etudiants.length > 0"
    >
      <template #no-data>
        <div class="etudiants-vide">
          <q-icon name="groups" size="42px" class="q-mb-sm" />
          <div>{{ messageVide }}</div>
          <div class="q-mt-sm q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('etudiants.actions.resetFilters')"
              @click="reinitialiser"
            />
            <q-btn
              v-if="peutGerer && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('etudiants.actions.new')"
              @click="ouvrir(null)"
            />
          </div>
        </div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-sexe="p">
        <q-td :props="p">
          <q-chip v-if="p.row.sexe" dense outline color="primary">
            {{ p.row.sexe === 'F' ? 'F' : 'M' }}
          </q-chip>
          <span v-else class="text-grey-7">{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip v-if="dernierePromo(p.row)" dense outline color="primary">
            {{ dernierePromo(p.row) }}
          </q-chip>
          <span v-else class="text-grey-7">{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>

      <template #body-cell-comptes="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{
              p.row.user
                ? $t('etudiants.table.accountTooltip', { email: p.row.user.email })
                : $t('etudiants.table.noAccountTooltip')
            }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-inscriptions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutValiderVoir && (p.row._count?.inscriptions ?? 0) > 0"
            flat
            dense
            no-caps
            class="chiffres"
            :label="String(p.row._count?.inscriptions ?? 0)"
            :aria-label="
              $t('etudiants.table.viewInscriptionsAria', {
                count: p.row._count?.inscriptions,
                name: `${p.row.prenom} ${p.row.nom}`,
              })
            "
            @click="voirInscriptions(p.row)"
          >
            <q-tooltip>{{ $t('etudiants.table.viewInscriptionsTooltip') }}</q-tooltip>
          </q-btn>
          <span v-else class="chiffres text-grey-7">
            {{ p.row._count?.inscriptions ?? 0 }}
          </span>
        </q-td>
      </template>

      <template #body-cell-actif="p">
        <q-td :props="p">
          <q-toggle
            :model-value="p.row.actif"
            color="secondary"
            :disable="!peutGererCompte(p.row)"
            :aria-label="$t('etudiants.table.activeToggleAria', { name: `${p.row.prenom} ${p.row.nom}` })"
            @update:model-value="(v) => basculerActif(p.row, v)"
          />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            v-if="peutValiderVoir"
            flat
            dense no-caps
            color="primary"
            icon="how_to_reg"
            :aria-label="$t('etudiants.actions.inscriptionsAria')" :label="$t('etudiants.actions.inscriptionsAria')"
            @click="allerAuxInscriptions(p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.inscriptionsTooltip') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            v-if="peutGerer"
            flat
            dense no-caps
            icon="edit"
            :aria-label="$t('etudiants.actions.editAria')" :label="$t('etudiants.actions.editAria')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.editTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutVoirPaiements"
            flat
            dense no-caps
            color="primary"
            icon="payments"
            :aria-label="$t('etudiants.actions.paiementsAria')" :label="$t('etudiants.actions.paiementsAria')"
            @click="allerAuxPaiements(p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.paiementsTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutValiderVoir"
            flat
            dense no-caps
            color="primary"
            icon="fact_check"
            :aria-label="$t('etudiants.actions.evaluationsAria')" :label="$t('etudiants.actions.evaluationsAria')"
            @click="allerAuxEvaluations(p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.evaluationsTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="peutGerer"
            flat
            dense no-caps
            color="primary"
            icon="print"
            :aria-label="$t('etudiants.actions.printAria')" :label="$t('etudiants.actions.printAria')"
            @click="imprimerAttestation(p.row)"
          >
            <q-tooltip>
              {{
                derniereInscription(p.row)
                  ? $t('etudiants.table.certificateTooltip')
                  : $t('etudiants.table.noCertificateTooltip')
              }}
            </q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <q-linear-progress
      v-if="modeVue === 'cartes' && chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="etudiants-cartes">
      <q-card
        v-for="e in etudiants"
        :key="e.id"
        flat
        bordered
        class="carte etudiants-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip
              :outline="e.actif"
              :color="e.actif ? 'positive' : 'grey-7'"
              :icon="e.actif ? 'check_circle' : 'remove_circle'"
              dense
              :label="e.actif ? $t('etudiants.cards.active') : $t('etudiants.cards.inactive')"
            />
            <q-chip v-if="e.sexe" dense outline color="primary">
              {{ e.sexe === 'F' ? $t('etudiants.options.gender.female') : $t('etudiants.options.gender.male') }}
            </q-chip>
            <q-space />
            <div class="text-caption text-grey-7">{{ e.matricule }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ e.nom }} {{ e.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            <span v-if="e.telephone">{{ e.telephone }}</span>
            <span v-else>{{ $t('rectoratPage.subtitleFallback') }}</span>
          </div>
          <div class="q-mt-sm">
            <q-chip
              v-if="dernierePromo(e)"
              outline
              color="primary"
              dense
              :label="dernierePromo(e)"
              icon="school"
            />
            <span v-else class="text-caption text-grey-7">{{ $t('etudiants.cards.noInscription') }}</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
<q-btn
            v-if="peutValiderVoir"
            flat
            dense
            color="primary"
            icon="how_to_reg"
            no-caps
            :label="$t('etudiants.actions.inscriptions')"
            @click="allerAuxInscriptions(e)"
          />
<actions-secondaires>
<q-btn v-close-popup
            v-if="peutGerer"
            flat
            dense
            icon="edit"
            no-caps
            :label="$t('etudiants.actions.edit')"
            @click="ouvrir(e)"
          />
<q-btn v-close-popup
            v-if="peutVoirPaiements"
            flat
            dense
            color="primary"
            icon="payments"
            no-caps
            :label="$t('etudiants.actions.paiements')"
            @click="allerAuxPaiements(e)"
          />
<q-btn v-close-popup
            v-if="peutValiderVoir"
            flat
            dense
            color="primary"
            icon="fact_check"
            no-caps
            :label="$t('etudiants.actions.evaluations')"
            @click="allerAuxEvaluations(e)"
          />
<q-btn v-close-popup
            v-if="peutGerer"
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            :label="$t('etudiants.actions.print')"
            @click="imprimerAttestation(e)"
          />
</actions-secondaires>
</q-card-actions>
      </q-card>
      <div v-if="!etudiants.length" class="etudiants-vide">
        <q-icon name="groups" size="42px" class="q-mb-sm" />
        <div>{{ messageVide }}</div>
        <div class="q-mt-sm q-gutter-sm">
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            :label="$t('etudiants.actions.resetFilters')"
            @click="reinitialiser"
          />
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('etudiants.actions.new')"
            @click="ouvrir(null)"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      v-if="etudiants.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <etudiant-dialog
      v-model="dialogOuvert"
      :etudiant="etudiantEdite"
      @enregistre="charger"
    />

    <!-- Dialog : inscriptions de l'étudiant -->
    <q-dialog v-model="dialogInscriptions">
      <q-card style="width: 780px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              {{ $t('etudiants.dialogInscriptions.title', { name: `${etudiantInscriptions?.nom} ${etudiantInscriptions?.prenom}` }) }}
            </div>
            <div class="text-caption text-grey-7">
              {{ etudiantInscriptions?.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('etudiants.dialogInscriptions.closeAria')" v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress v-if="chargementInscriptions" indeterminate color="primary" class="q-mb-sm" />
          <q-table
            v-else
            flat
            bordered
            :rows="listeInscriptions"
            :columns="colonnesInscriptions"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
            dense
          >
            <template #no-data>
              <div class="text-center q-pa-md text-grey-7">
                {{ $t('etudiants.dialogInscriptions.emptyState') }}
              </div>
            </template>
            <template #body-cell-statut="p">
              <q-td :props="p">
                <span class="champ badge-statut" :class="classeStatutInscription(p.row.statut)">
                  {{ LIBELLE_STATUT_INSCRIPTION[p.row.statut] ?? p.row.statut }}
                </span>
              </q-td>
            </template>
            <template #body-cell-montant="p">
              <q-td :props="p" class="text-right text-weight-medium chiffres">
                {{ montantLisible(p.row.montantFrais) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}
              </q-td>
            </template>
            <template #body-cell-actions="p">
              <q-td :props="p" class="text-right">
                <q-btn
                  v-if="peutVoirPaiements"
                  flat
                  dense
                  round
                  color="primary"
                  icon="payments"
                  :aria-label="$t('etudiants.dialogInscriptions.paiementsAria')"
                  @click="allerAuxPaiementsDuDossier(p.row)"
                >
                  <q-tooltip>{{ $t('etudiants.dialogInscriptions.paiementsTooltip') }}</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="print"
                  :aria-label="$t('etudiants.dialogInscriptions.printAria')"
                  @click="imprimerDossier(p.row)"
                >
                  <q-tooltip>{{ $t('etudiants.dialogInscriptions.printTooltip') }}</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('etudiants.actions.close')" v-close-popup />
          <q-btn
            v-if="peutValiderVoir && etudiantInscriptions"
            unelevated
            color="primary"
            no-caps
            icon="how_to_reg"
            :label="$t('etudiants.actions.openInInscriptions')"
            @click="allerAuxInscriptions(etudiantInscriptions)"
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import EtudiantDialog from '../components/EtudiantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  LIBELLE_STATUT_INSCRIPTION,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Inscription, Promotion, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

interface EtudiantRegistre extends Etudiant {
  inscriptions?: {
    id: string;
    promotionId?: string;
    promotion?: Promotion | null;
    createdAt?: string;
  }[];
}

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { t } = useI18n();

const etudiants = ref<EtudiantRegistre[]>([]);
const promotions = ref<Promotion[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const etudiantEdite = ref<EtudiantRegistre | null>(null);
const modeVue = usePresentationListe();

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
/** Tant que les filtres d'ouverture ne sont pas posés, le watcher ne recharge pas. */
const pret = ref(false);

const filtres = ref<Record<string, any>>({});

const dialogInscriptions = ref(false);
const listeInscriptions = ref<Inscription[]>([]);
const etudiantInscriptions = ref<EtudiantRegistre | null>(null);
const chargementInscriptions = ref(false);

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutValiderVoir = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT']));
/** Le suivi financier n'est ouvert qu'aux écrans qui portent la route /paiements. */
const peutVoirPaiements = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutGererCompte = (e: EtudiantRegistre) => auth.estAdmin || !e.user;

const optionsActif = computed(() => [
  { label: t('etudiants.options.status.active'), value: 'true' },
  { label: t('etudiants.options.status.inactive'), value: 'false' },
]);
const optionsSexe = computed(() => [
  { label: t('etudiants.options.gender.male'), value: 'M' },
  { label: t('etudiants.options.gender.female'), value: 'F' },
]);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('etudiants.table.columns.name'), field: 'nom', align: 'left', sortable: true },
  { name: 'sexe', label: t('etudiants.table.columns.gender'), field: 'sexe', align: 'left' },
  { name: 'promotion', label: t('etudiants.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'telephone', label: t('etudiants.table.columns.phone'), field: 'telephone', align: 'left' },
  { name: 'email', label: t('etudiants.table.columns.email'), field: 'email', align: 'left' },
  { name: 'comptes', label: t('etudiants.table.columns.account'), field: 'comptes', align: 'center' },
  { name: 'inscriptions', label: t('etudiants.table.columns.inscriptions'), field: 'inscriptions', align: 'right', sortable: true },
  { name: 'actif', label: t('etudiants.table.columns.active'), field: 'actif', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesInscriptions = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('etudiants.dialogInscriptions.columns.number'), field: 'numero', align: 'left' },
  { name: 'promotion', label: t('etudiants.dialogInscriptions.columns.promotion'), field: (r) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'annee', label: t('etudiants.dialogInscriptions.columns.year'), field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'statut', label: t('etudiants.dialogInscriptions.columns.status'), field: 'statut', align: 'left' },
  { name: 'montant', label: t('etudiants.dialogInscriptions.columns.amount'), field: 'montantFrais', align: 'right' },
  { name: 'date', label: t('etudiants.dialogInscriptions.columns.date'), field: (r) => dateLisible(r.createdAt), align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const classeStatutInscription = (s: string) =>
  ({
    BROUILLON: 'champ--brouillon',
    EN_ATTENTE_PAIEMENT: 'champ--attente-paiement',
    PAYEE: 'champ--payee',
    VALIDEE: 'champ--validee',
    ANNULEE: 'champ--annulee',
  })[s] ?? 'champ--brouillon';

const dernierePromo = (e: EtudiantRegistre) => e.inscriptions?.[0]?.promotion?.nom ?? null;

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value
    ? t('etudiants.emptyState.filtered')
    : t('etudiants.emptyState.none'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('etudiants.chips.search', { search: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('etudiants.chips.promotion', { promotion: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  if (filtres.value.actif) {
    cs.push({
      label: filtres.value.actif === 'true' ? t('etudiants.options.status.active') : t('etudiants.options.status.inactive'),
      value: filtres.value.actif,
      icone: 'toggle_on', cle: 'actif'});
  }
  if (filtres.value.sexe) {
    cs.push({
      label: t('etudiants.chips.gender', {
        gender: filtres.value.sexe === 'F' ? t('etudiants.options.gender.female') : t('etudiants.options.gender.male'),
      }),
      value: filtres.value.sexe,
      icone: 'wc',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: t('etudiants.chips.since', { date: dateLisible(filtres.value.dateDebut) }),
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: t('etudiants.chips.until', { date: dateLisible(filtres.value.dateFin) }),
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

function ouvrir(e: EtudiantRegistre | null) {
  etudiantEdite.value = e;
  dialogOuvert.value = true;
}

/** Dernier dossier connu — les inscriptions arrivent triées du plus récent au plus ancien. */
const derniereInscription = (e: EtudiantRegistre) => e.inscriptions?.[0] ?? null;

/**
 * Désactiver un étudiant lui ferme le portail et le retire des feuilles de
 * notes : la bascule se confirme, comme toute décision de registre.
 */
function basculerActif(e: EtudiantRegistre, v: unknown) {
  const actif = v === true;
  const appliquer = async () => {
    try {
      await api.put(`/etudiants/${e.id}`, { actif });
      e.actif = actif;
      $q.notify({
        type: 'positive',
        message: actif ? t('etudiants.messages.reactivated') : t('etudiants.messages.deactivated'),
      });
    } catch {
      /* Notification gérée par l'intercepteur axios */
    }
  };
  if (actif) {
    void appliquer();
    return;
  }
  $q.dialog({
    title: t('etudiants.confirmDeactivate.title'),
    message: t('etudiants.confirmDeactivate.message', { name: `${e.prenom} ${e.nom}`, matricule: e.matricule }),
    cancel: true,
    ok: { color: 'negative', label: t('etudiants.confirmDeactivate.confirm'), unelevated: true, noCaps: true },
  }).onOk(() => void appliquer());
  // Bascule refusée : la case reste pilotée par `actif`, rien à défaire.
}

/**
 * Dossiers de l'étudiant. `/inscriptions` ne filtre pas par `etudiantId` :
 * on interroge par matricule (unique, couvert par la recherche serveur) puis
 * on resserre côté client sur l'identifiant exact.
 */
async function voirInscriptions(e: EtudiantRegistre) {
  etudiantInscriptions.value = e;
  dialogInscriptions.value = true;
  chargementInscriptions.value = true;
  try {
    const { data } = await api.get('/inscriptions', {
      params: { all: '1', search: e.matricule },
    });
    const liste: Inscription[] = Array.isArray(data) ? data : data.data ?? [];
    listeInscriptions.value = liste.filter((i) => i.etudiantId === e.id);
  } catch {
    listeInscriptions.value = [];
  } finally {
    chargementInscriptions.value = false;
  }
}

/** Écran Inscriptions préfiltré sur l'étudiant. */
function allerAuxInscriptions(e: EtudiantRegistre) {
  void router.push({ path: '/inscriptions', query: { etudiant: e.id } });
}

/** Écran Paiements préfiltré sur l'étudiant. */
function allerAuxPaiements(e: EtudiantRegistre) {
  void router.push({ path: '/paiements', query: { etudiant: e.id } });
}

/** Écran Paiements préfiltré sur un dossier précis. */
function allerAuxPaiementsDuDossier(dossier: Inscription) {
  void router.push({ path: '/paiements', query: { inscription: dossier.id } });
}

/**
 * Les notes se tiennent par évaluation, pas par étudiant : on ouvre les
 * épreuves de sa promotion, d'où la saisie et la consultation sont accessibles.
 */
function allerAuxEvaluations(e: EtudiantRegistre) {
  const promotionId = derniereInscription(e)?.promotionId;
  if (!promotionId) {
    $q.notify({
      type: 'warning',
      message: t('etudiants.messages.noPromotion', { name: `${e.prenom} ${e.nom}` }),
    });
    return;
  }
  void router.push({ path: '/evaluations', query: { promotion: promotionId } });
}

/**
 * Le certificat d'inscription s'édite à partir d'un dossier, pas d'une fiche :
 * on imprime celui du dernier dossier de l'étudiant.
 */
function imprimerAttestation(e: EtudiantRegistre) {
  const dossier = derniereInscription(e);
  if (!dossier) {
    $q.notify({
      type: 'warning',
      message: t('etudiants.messages.noDossier', { name: `${e.prenom} ${e.nom}` }),
    });
    return;
  }
  void ouvrirImpression(`/inscriptions/${dossier.id}/attestation-inscription`);
}

/** Certificat d'un dossier précis, depuis la liste des dossiers de l'étudiant. */
function imprimerDossier(dossier: Inscription) {
  void ouvrirImpression(`/inscriptions/${dossier.id}/attestation-inscription`);
}

/**
 * Filtres transmis à `GET /etudiants` : tous sont appliqués par le serveur,
 * donc à l'ensemble du registre et au total paginé. Promotion et dates
 * portent sur les dossiers d'inscription de l'étudiant (date de création).
 */
function paramsServeur(): Record<string, any> {
  const params: Record<string, any> = {};
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.actif) params.actif = filtres.value.actif;
  if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
  if (filtres.value.sexe) params.sexe = filtres.value.sexe;
  if (filtres.value.dateDebut) params.dateDebut = filtres.value.dateDebut;
  if (filtres.value.dateFin) params.dateFin = filtres.value.dateFin;
  return params;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: { ...paramsServeur(), page: page.value, pageSize: pageSize.value },
    });
    const liste: EtudiantRegistre[] = data.data ?? [];
    etudiants.value = liste;
    total.value = data.total ?? liste.length;
  } catch {
    etudiants.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: { ...paramsServeur(), page: 1, pageSize: 1000 },
    });
    const liste: EtudiantRegistre[] = data.data ?? [];
    etudiants.value = liste;
    total.value = data.total ?? liste.length;
    pageSize.value = Math.max(liste.length, 1);
    page.value = 1;
  } catch {
    etudiants.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  void charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.promotionId,
    filtres.value.actif,
    filtres.value.sexe,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    if (!pret.value) return;
    page.value = 1;
    void charger();
  },
);

onMounted(async () => {
  try {
    promotions.value = await referentiels.promotions();
  } catch {
    promotions.value = [];
  }
  // `/etudiants?recherche=…` : arrivée depuis un dossier ou un paiement.
  const recherche = route.query.recherche as string | undefined;
  if (recherche) filtres.value.recherche = recherche;
  pret.value = true;
  await charger();
});
</script>

<style scoped lang="scss">
.etudiants-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.etudiants-cartes__carte {
  background: var(--up-plaque);
}

// État vide : on nomme la cause et on offre la sortie.
.etudiants-vide {
  grid-column: 1 / -1;
  padding: var(--up-5);
  text-align: center;
  color: var(--up-encre-douce);
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
.champ--payee { background: #007a4d; }
.champ--validee { background: #0066cc; }
.champ--annulee { background: #ce1126; }
</style>
