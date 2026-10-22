<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('paiements.title')" :subtitle="$t('paiements.subtitle')">
      <template #actions>
        <q-btn v-if="peutCreer" unelevated color="primary" no-caps icon="add"
          :label="$t('paiements.actions.new')" @click="dialogPaiement = true" />
      </template>
    </page-header>

    <!-- Arrivée depuis un dossier ou une fiche étudiant : le ciblage est annoncé. -->
    <q-banner v-if="libelleCible" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="filter_alt" /></template>
      {{ libelleCible }}
      <template #action>
        <q-btn flat dense no-caps :label="$t('paiements.actions.viewAll')" @click="retirerCible" />
      </template>
    </q-banner>

    <div class="resume-liste" role="status">
      <span>{{ $t('paiements.kpis.totalCollected') }} : <strong>{{ montantLisible(kpis.totalEncaisse) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</strong></span>
      <span>{{ $t('paiements.kpis.pending') }} : <strong>{{ kpis.enAttente }}</strong></span>
      <span v-if="kpis.echoues">{{ $t('paiements.kpis.failed') }} : <strong>{{ kpis.echoues }}</strong></span>
    </div>

    <!-- Le registre est paginé côté serveur : ces totaux portent sur ce qui est affiché. -->
    <div class="text-caption text-grey-7 q-mb-md">
      {{
        $t('paiements.summary', {
          count: paiements.length,
          total,
          plural: paiements.length > 1 ? 's' : '',
        })
      }}
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('paiements.filters.searchPlaceholder')"
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
          :label="$t('paiements.filters.status')"
        />
      </template>
      <template #avances>

        <q-select
          v-model="filtres.mode"
          :options="optionsModes"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('paiements.filters.mode')"
        />
        <q-select
          v-model="filtres.operateur"
          :options="optionsOperateurs"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('paiements.filters.operator')"
        />
        <q-input
          v-model="filtres.motif"
          outlined
          dense
          clearable
          :label="$t('paiements.filters.reason')"
          :placeholder="$t('paiements.filters.reasonPlaceholder')"
        />
        <autocomplete-async
          v-model="filtres.inscriptionId"
          endpoint="/inscriptions"
          :label-fn="(i) => `${i.numero} — ${i.etudiant?.nom ?? ''} ${i.etudiant?.prenom ?? ''}`"
          :label="$t('paiements.filters.enrollment')"
          clearable
        />
        <autocomplete-async
          v-model="filtres.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
          :label="$t('paiements.filters.student')"
          clearable
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('paiements.filters.from')" />
        <champ-date v-model="filtres.dateFin" :label="$t('paiements.filters.to')" />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="paiementsFiltres"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
      :hide-bottom="chargement || paiementsFiltres.length > 0"
    >
      <template #no-data>
        <div class="paiements-vide">
          <q-icon name="payments" size="42px" class="q-mb-sm" />
          <div>{{ messageVide }}</div>
          <div class="q-mt-sm q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('paiements.actions.resetFilters')"
              @click="reinitialiser"
            />
            <q-btn
              v-if="peutCreer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('paiements.actions.new')"
              @click="dialogPaiement = true"
            />
          </div>
        </div>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.etudiant?.matricule }}
            <span v-if="p.row.inscription?.numero"> · {{ p.row.inscription.numero }}</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-source="p">
        <q-td :props="p">
          <span class="champ badge-source" :class="`badge-source--${sourceDe(p.row).toLowerCase()}`">
            {{ libelleSource(p.row) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>

      <template #body-cell-modep="p">
        <q-td :props="p">
          <div>{{ LIBELLE_MODE_PAIEMENT[p.row.mode] ?? p.row.mode }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.operateur ? LIBELLE_OPERATEUR_MM[p.row.operateur] ?? p.row.operateur : '—' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_PAIEMENT[p.row.statut] ?? p.row.statut }}
          </span>
        </q-td>
      </template>

      <template #body-cell-horodatage="p">
        <q-td :props="p">{{ dateHeureLisible(p.row.horodatage) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="info"
            color="primary"
            :aria-label="$t('paiements.table.actions.details')"
            @click="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('paiements.table.actions.details') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.inscription || p.row.inscriptionId"
            flat
            dense
            round
            icon="how_to_reg"
            :aria-label="$t('paiements.table.actions.viewEnrollmentAria')"
            @click="voirInscription(p.row)"
          >
            <q-tooltip>{{ $t('paiements.table.actions.viewEnrollmentTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.etudiant"
            flat
            dense
            round
            icon="person"
            :aria-label="$t('paiements.table.actions.viewStudentAria')"
            @click="voirEtudiant(p.row)"
          >
            <q-tooltip>{{ $t('paiements.table.actions.viewStudentTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="routeModule(p.row)"
            flat
            dense
            round
            icon="open_in_new"
            color="primary"
            :aria-label="$t('paiements.table.actions.openModule', { module: libelleSource(p.row) })"
            @click="ouvrirModule(p.row)"
          >
            <q-tooltip>{{ $t('paiements.table.actions.openModule', { module: libelleSource(p.row) }) }}</q-tooltip>
          </q-btn>
          <template v-if="peutSimuler(p.row)">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="check"
              :aria-label="$t('paiements.table.actions.confirmAria')"
              @click="simuler(p.row, 'REUSSI')"
            >
              <q-tooltip>{{ $t('paiements.table.actions.confirmTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="close"
              :aria-label="$t('paiements.table.actions.markFailedAria')"
              @click="simuler(p.row, 'ECHOUE')"
            >
              <q-tooltip>{{ $t('paiements.table.actions.markFailedTooltip') }}</q-tooltip>
            </q-btn>
          </template>
          <q-btn
            v-if="peutAnnuler(p.row)"
            flat
            dense
            round
            color="negative"
            icon="block"
            :aria-label="$t('paiements.table.actions.cancel')"
            @click="ouvrirAnnulation(p.row)"
          >
            <q-tooltip>{{ $t('paiements.table.actions.cancel') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-linear-progress :aria-label="$t('common.messages.loading')"
      v-if="modeVue === 'cartes' && chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="paiements-cartes">
      <q-card
        v-for="p in paiementsFiltres"
        :key="p.id"
        flat
        bordered
        class="carte paiements-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <span class="champ badge-statut" :class="classeStatut(p.statut)">
              {{ LIBELLE_STATUT_PAIEMENT[p.statut] ?? p.statut }}
            </span>
            <span class="champ badge-source q-ml-xs" :class="`badge-source--${sourceDe(p).toLowerCase()}`">
              {{ libelleSource(p) }}
            </span>
            <q-space />
            <div class="text-caption text-grey-7">{{ p.reference }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ p.etudiant?.nom }} {{ p.etudiant?.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            {{ p.etudiant?.matricule }}
            <span v-if="p.inscription?.numero"> · {{ p.inscription.numero }}</span>
          </div>
          <div class="row q-mt-sm q-col-gutter-sm">
            <div class="col-6">
              <div class="text-caption text-grey-7">{{ $t('paiements.cards.mode') }}</div>
              <div class="text-weight-medium">
                {{ LIBELLE_MODE_PAIEMENT[p.mode] ?? p.mode }}
              </div>
              <div class="text-caption text-grey-7">
                {{ p.operateur ? LIBELLE_OPERATEUR_MM[p.operateur] ?? p.operateur : '—' }}
              </div>
            </div>
            <div class="col-6 text-right">
              <div class="text-caption text-grey-7">{{ $t('paiements.cards.amount') }}</div>
              <div class="text-weight-medium lettrage chiffres">
                {{ montantLisible(p.montant) }} {{ p.devise }}
              </div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ dateHeureLisible(p.horodatage) }}
          </div>
          <div v-if="p.transactionId" class="text-caption text-grey-7">
            {{ $t('paiements.cards.transaction', { id: p.transactionId }) }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
<q-btn
            flat
            dense
            color="primary"
            icon="info"
            no-caps
            :label="$t('paiements.cards.details')"
            @click="ouvrirDetail(p)"
          />
<actions-secondaires>
<q-btn v-close-popup
            v-if="routeModule(p)"
            flat
            dense
            color="primary"
            icon="open_in_new"
            no-caps
            :label="$t('paiements.cards.openModule', { module: libelleSource(p) })"
            @click="ouvrirModule(p)"
          />
<q-btn v-close-popup
            v-if="peutSimuler(p)"
            flat
            dense
            color="positive"
            icon="check"
            no-caps
            :label="$t('paiements.cards.success')"
            @click="simuler(p, 'REUSSI')"
          />
<q-btn v-close-popup
            v-if="peutSimuler(p)"
            flat
            dense
            color="negative"
            icon="close"
            no-caps
            :label="$t('paiements.cards.failed')"
            @click="simuler(p, 'ECHOUE')"
          />
<q-btn v-close-popup
            v-if="peutAnnuler(p)"
            flat
            dense
            color="negative"
            icon="block"
            no-caps
            :label="$t('paiements.cards.cancel')"
            @click="ouvrirAnnulation(p)"
          />
<q-btn v-close-popup
            v-if="p.inscription || p.inscriptionId"
            flat
            dense
            icon="how_to_reg"
            no-caps
            :label="$t('paiements.cards.enrollment')"
            @click="voirInscription(p)"
          />
<q-btn v-close-popup
            v-if="p.etudiant"
            flat
            dense
            icon="person"
            no-caps
            :label="$t('paiements.cards.student')"
            @click="voirEtudiant(p)"
          />
</actions-secondaires>
</q-card-actions>
      </q-card>
      <div v-if="!paiementsFiltres.length" class="paiements-vide">
        <q-icon name="payments" size="42px" class="q-mb-sm" />
        <div>{{ messageVide }}</div>
        <div class="q-mt-sm q-gutter-sm">
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            :label="$t('paiements.actions.resetFilters')"
            @click="reinitialiser"
          />
          <q-btn
            v-if="peutCreer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('paiements.actions.new')"
            @click="dialogPaiement = true"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      v-if="paiements.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <paiement-dialog v-model="dialogPaiement" @paye="charger" />

    <!-- Détail d'une transaction -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ detail?.reference }}</div>
          <div class="text-caption text-grey-7">
            {{ detail ? `${LIBELLE_MODE_PAIEMENT[detail.mode] ?? detail.mode} · ${LIBELLE_STATUT_PAIEMENT[detail.statut] ?? detail.statut}` : '' }}
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-list separator dense>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.studentFile') }}</q-item-label>
                <q-item-label>
                  {{ detail?.etudiant ? `${detail.etudiant.nom} ${detail.etudiant.prenom}` : '—' }}
                  {{ detail?.inscription?.numero ? ` · ${detail.inscription.numero}` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.amount') }}</q-item-label>
                <q-item-label>{{ montantLisible(detail?.montant) }} {{ detail?.devise }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.transaction') }}</q-item-label>
                <q-item-label>{{ detail?.transactionId ?? $t('paiements.detail.transactionNone') }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.operatorPhone') }}</q-item-label>
                <q-item-label>
                  {{ detail?.operateur ? LIBELLE_OPERATEUR_MM[detail.operateur] ?? detail.operateur : '—' }}
                  · {{ detail?.telephone ?? '—' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.reason') }}</q-item-label>
                <q-item-label>{{ detail?.motif ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.timestamp') }}</q-item-label>
                <q-item-label>{{ detail ? dateHeureLisible(detail.horodatage) : '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('paiements.detail.createdBy') }}</q-item-label>
                <q-item-label>
                  {{ detail?.creePar ? `${detail.creePar.prenom} ${detail.creePar.nom}` : $t('paiements.detail.createdByFallback') }}
                  {{ detail?.completeLe ? $t('paiements.detail.completedOn', { date: dateHeureLisible(detail.completeLe) }) : '' }}
                  {{ detail?.motifAnnulation ? $t('paiements.detail.cancelReason', { reason: detail.motifAnnulation }) : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('paiements.dialogs.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Annulation : le motif est exigé -->
    <q-dialog v-model="dialogAnnulation">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ $t('paiements.dialogs.cancelTitle', { reference: paiementAnnuler?.reference }) }}</div>
          <div class="text-caption text-grey-7">
            {{ paiementAnnuler ? LIBELLE_STATUT_PAIEMENT[paiementAnnuler.statut] : '' }} {{ $t('rectoratPage.subtitleFallback') }}
            {{ $t('paiements.dialogs.cancelSubtitle') }}
          </div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="motifAnnulation"
            outlined
            dense
            type="textarea"
            rows="3"
            :label="$t('paiements.dialogs.cancelReasonLabel')"
            autofocus
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('paiements.dialogs.close')" v-close-popup />
          <q-btn
            color="negative"
            unelevated
            no-caps
            icon="block"
            :label="$t('paiements.dialogs.cancelConfirm')"
            :disable="motifAnnulation.trim().length < 3"
            :loading="annulationEnCours"
            @click="confirmerAnnulation"
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
import PaiementDialog from '../components/PaiementDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_PAIEMENT,
  dateHeureLisible,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Inscription, ModePaiement, Paiement, StatutPaiement, ChipFiltre } from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

const paiements = ref<Paiement[]>([]);
const chargement = ref(false);
const modeVue = usePresentationListe();

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
/** Tant que les filtres d'ouverture ne sont pas posés, le watcher ne recharge pas. */
const pret = ref(false);

const filtres = ref<Record<string, any>>({});
/** Contexte reçu en paramètre d'URL (`?inscription=…` ou `?etudiant=…`). */
const dossierCible = ref<Inscription | null>(null);
const etudiantCible = ref<Etudiant | null>(null);

const dialogPaiement = ref(false);
const dialogDetail = ref(false);
const detail = ref<Paiement | null>(null);
const dialogAnnulation = ref(false);
const paiementAnnuler = ref<Paiement | null>(null);
const motifAnnulation = ref('');
const annulationEnCours = ref(false);

/** Portefeuille d'origine, calculé par `GET /paiements`. */
type SourcePaiement = 'INSCRIPTION' | 'FORMATION' | 'RESTO' | 'RECETTE' | 'DOCUMENT';

/** Écran de gestion de chaque portefeuille autre que les inscriptions. */
const ROUTE_SOURCE: Record<Exclude<SourcePaiement, 'INSCRIPTION'>, string> = {
  FORMATION: '/formations-admin',
  RESTO: '/resto',
  RECETTE: '/recettes',
  DOCUMENT: '/demandes-docs',
};

const sourceDe = (p: Paiement): SourcePaiement =>
  (p as Paiement & { source?: SourcePaiement }).source ?? 'INSCRIPTION';
const libelleSource = (p: Paiement) => t(`paiements.sources.${sourceDe(p)}`);
/** Seuls les paiements d'inscription se confirment ou s'annulent ici. */
const estInscription = (p: Paiement) => sourceDe(p) === 'INSCRIPTION';

/** Lien vers le module qui gère le paiement, si l'utilisateur peut l'ouvrir. */
function routeModule(p: Paiement): string | null {
  const source = sourceDe(p);
  if (source === 'INSCRIPTION') return null;
  const chemin = ROUTE_SOURCE[source];
  const roles = router.resolve(chemin).meta.roles as Parameters<typeof auth.aRole>[0] | undefined;
  if (roles && !auth.aRole(roles)) return null;
  return chemin;
}

function ouvrirModule(p: Paiement) {
  const chemin = routeModule(p);
  if (chemin) void router.push(chemin);
}

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutSimuler = (p: Paiement) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && estInscription(p) && p.statut === 'EN_ATTENTE';
const peutAnnuler = (p: Paiement) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && estInscription(p) && !['REUSSI', 'ANNULE', 'REMBOURSE'].includes(p.statut);

const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsModes = computed(() =>
  Object.entries(LIBELLE_MODE_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsOperateurs = computed(() =>
  Object.entries(LIBELLE_OPERATEUR_MM).map(([value, label]) => ({ value, label })),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'reference', label: t('paiements.table.columns.reference'), field: 'reference', align: 'left', sortable: true },
  { name: 'source', label: t('paiements.table.columns.source'), field: 'source', align: 'left', sortable: true },
  { name: 'etudiant', label: t('paiements.table.columns.student'), field: 'etudiant', align: 'left' },
  { name: 'mode', label: t('paiements.table.columns.mode'), field: 'mode', align: 'left' },
  { name: 'montant', label: t('paiements.table.columns.amount'), field: 'montant', align: 'right', sortable: true },
  { name: 'statut', label: t('paiements.table.columns.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'motif', label: t('paiements.table.columns.reason'), field: 'motif', align: 'left' },
  { name: 'transactionId', label: t('paiements.table.columns.transaction'), field: 'transactionId', align: 'left' },
  { name: 'horodatage', label: t('paiements.table.columns.date'), field: 'horodatage', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const classeStatut = (s: string) =>
  ({
    EN_ATTENTE: 'champ--attente-paiement',
    REUSSI: 'champ--payee',
    ECHOUE: 'champ--annulee',
    ANNULE: 'champ--brouillon',
    REMBOURSE: 'champ--brouillon',
  })[s] ?? 'champ--brouillon';

/** Contexte d'arrivée, résumé en une phrase au-dessus du registre. */
const libelleCible = computed(() => {
  if (dossierCible.value) {
    const d = dossierCible.value;
    const qui = d.etudiant
      ? t('paiements.context.enrollmentWho', { prenom: d.etudiant.prenom, nom: d.etudiant.nom })
      : '';
    return t('paiements.context.enrollment', { numero: d.numero, who: qui });
  }
  if (filtres.value.inscriptionId && !dossierCible.value) {
    return t('paiements.context.enrollmentGeneric');
  }
  if (etudiantCible.value) {
    const e = etudiantCible.value;
    return t('paiements.context.student', { prenom: e.prenom, nom: e.nom, matricule: e.matricule });
  }
  return '';
});

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value ? t('paiements.emptyState.filtered') : t('paiements.emptyState.default'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('paiements.chips.search', { query: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('paiements.chips.status', {
        status: LIBELLE_STATUT_PAIEMENT[filtres.value.statut as StatutPaiement] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  if (filtres.value.mode) {
    cs.push({
      label: t('paiements.chips.mode', {
        mode: LIBELLE_MODE_PAIEMENT[filtres.value.mode as ModePaiement] ?? filtres.value.mode,
      }),
      value: filtres.value.mode,
      icone: 'payments',
    });
  }
  if (filtres.value.operateur) {
    cs.push({
      label: t('paiements.chips.operator', {
        operator: LIBELLE_OPERATEUR_MM[filtres.value.operateur] ?? filtres.value.operateur,
      }),
      value: filtres.value.operateur,
      icone: 'cell_tower',
    });
  }
  if (filtres.value.motif) {
    cs.push({
      label: t('paiements.chips.reason', { reason: filtres.value.motif }),
      value: filtres.value.motif,
      icone: 'description',
    });
  }
  if (filtres.value.inscriptionId) {
    cs.push({
      label: t('paiements.chips.enrollment', {
        numero: dossierCible.value?.numero ?? t('paiements.chips.enrollmentSelected'),
      }),
      value: filtres.value.inscriptionId,
      icone: 'how_to_reg',
    });
  }
  if (filtres.value.etudiantId) {
    cs.push({
      label: t('paiements.chips.student', {
        matricule: etudiantCible.value?.matricule ?? t('paiements.chips.studentSelected'),
      }),
      value: filtres.value.etudiantId,
      icone: 'person',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: t('paiements.chips.from', { date: dateLisible(filtres.value.dateDebut) }),
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: t('paiements.chips.to', { date: dateLisible(filtres.value.dateFin) }),
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

const kpis = computed(() => {
  const liste = paiements.value;
  let totalEncaisse = 0;
  let enAttente = 0;
  let echoues = 0;
  for (const p of liste) {
    if (p.statut === 'REUSSI') totalEncaisse += p.montant;
    if (p.statut === 'EN_ATTENTE') enAttente++;
    if (p.statut === 'ECHOUE') echoues++;
  }
  return { totalEncaisse, enAttente, echoues };
});

/** Filtrage client pour les critères que le backend ne gère pas encore. */
const paiementsFiltres = computed(() => {
  let liste = paiements.value;
  if (filtres.value.operateur) {
    liste = liste.filter((p) => p.operateur === filtres.value.operateur);
  }
  if (filtres.value.motif) {
    const needle = String(filtres.value.motif).toLowerCase();
    liste = liste.filter((p) => (p.motif ?? '').toLowerCase().includes(needle));
  }
  if (filtres.value.dateDebut) {
    const d = new Date(filtres.value.dateDebut).getTime();
    liste = liste.filter((p) => new Date(p.horodatage).getTime() >= d);
  }
  if (filtres.value.dateFin) {
    const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
    liste = liste.filter((p) => new Date(p.horodatage).getTime() <= d);
  }
  return liste;
});

function ouvrirDetail(p: Paiement) {
  detail.value = p;
  dialogDetail.value = true;
}

/**
 * Retour au dossier d'inscription qui porte le paiement : par l'étudiant si
 * on le connaît, sinon par le numéro de dossier posé en recherche.
 */
function voirInscription(p: Paiement) {
  const etudiantId = p.etudiantId ?? p.inscription?.etudiantId ?? null;
  if (etudiantId) {
    void router.push({ path: '/inscriptions', query: { etudiant: etudiantId } });
    return;
  }
  const numero = p.inscription?.numero;
  if (!numero) return;
  void router.push({ path: '/inscriptions', query: { recherche: numero } });
}

/** Retour à la fiche de l'étudiant payeur. */
function voirEtudiant(p: Paiement) {
  if (!p.etudiant) return;
  void router.push({ path: '/etudiants', query: { recherche: p.etudiant.matricule } });
}

function simuler(p: Paiement, statut: 'REUSSI' | 'ECHOUE') {
  $q.dialog({
    title:
      statut === 'REUSSI'
        ? t('paiements.confirmDialog.title')
        : t('paiements.confirmDialog.titleFailed'),
    message: t('paiements.confirmDialog.message', {
      reference: p.reference,
      amount: `${montantLisible(p.montant)} ${p.devise}`,
      outcome:
        statut === 'REUSSI'
          ? t('paiements.confirmDialog.outcomeSuccess')
          : t('paiements.confirmDialog.outcomeFailed'),
    }),
    ok: {
      color: statut === 'REUSSI' ? 'positive' : 'negative',
      label: t('paiements.confirmDialog.confirmLabel'),
      unelevated: true,
    },
    cancel: true,
  }).onOk(async () => {
    await api.post(`/paiements/${p.id}/simuler`, { statut });
    $q.notify({
      type: 'positive',
      message: statut === 'REUSSI' ? t('paiements.messages.confirmed') : t('paiements.messages.markedFailed'),
    });
    await charger();
  });
}

function ouvrirAnnulation(p: Paiement) {
  paiementAnnuler.value = p;
  motifAnnulation.value = '';
  dialogAnnulation.value = true;
}

async function confirmerAnnulation() {
  annulationEnCours.value = true;
  try {
    await api.post(`/paiements/${paiementAnnuler.value!.id}/annuler`, {
      motif: motifAnnulation.value,
    });
    $q.notify({ type: 'warning', message: t('paiements.messages.cancelled') });
    dialogAnnulation.value = false;
    await charger();
  } finally {
    annulationEnCours.value = false;
  }
}

/** Paramètres réellement compris par `GET /paiements`. */
function paramsServeur(): Record<string, any> {
  const params: Record<string, any> = { all: '1' };
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.statut) params.statut = filtres.value.statut;
  if (filtres.value.mode) params.mode = filtres.value.mode;
  if (filtres.value.inscriptionId) params.inscriptionId = filtres.value.inscriptionId;
  if (filtres.value.etudiantId) params.etudiantId = filtres.value.etudiantId;
  return params;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/paiements', {
      params: { ...paramsServeur(), page: page.value, pageSize: pageSize.value },
    });
    paiements.value = data.data ?? [];
    total.value = data.total ?? paiements.value.length;
  } catch {
    paiements.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/paiements', {
      params: { ...paramsServeur(), pageSize: 1000 },
    });
    paiements.value = data.data ?? [];
    total.value = paiements.value.length;
    pageSize.value = Math.max(paiements.value.length, 1);
    page.value = 1;
  } catch {
    paiements.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  dossierCible.value = null;
  etudiantCible.value = null;
  void router.replace({ path: '/paiements' });
  page.value = 1;
  void charger();
}

/** Lève le ciblage venu de l'URL sans toucher aux autres filtres. */
async function retirerCible() {
  // Le drapeau évite que chaque retrait de filtre déclenche sa propre requête.
  pret.value = false;
  dossierCible.value = null;
  etudiantCible.value = null;
  delete filtres.value.inscriptionId;
  delete filtres.value.etudiantId;
  await router.replace({ path: '/paiements' });
  page.value = 1;
  pret.value = true;
  await charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.statut,
    filtres.value.mode,
    filtres.value.inscriptionId,
    filtres.value.etudiantId,
  ],
  () => {
    if (!pret.value) return;
    page.value = 1;
    void charger();
  },
);

/** `/paiements?inscription=<id>` — encaissements d'un dossier précis. */
async function appliquerDossierCible(id: string) {
  filtres.value.inscriptionId = id;
  try {
    const { data } = await api.get('/inscriptions', { params: { all: '1' } });
    const liste: Inscription[] = Array.isArray(data) ? data : data.data ?? [];
    dossierCible.value = liste.find((i) => i.id === id) ?? null;
  } catch {
    dossierCible.value = null;
  }
}

/** `/paiements?etudiant=<id>` — tous les encaissements d'un étudiant. */
async function appliquerEtudiantCible(id: string) {
  filtres.value.etudiantId = id;
  try {
    const { data } = await api.get(`/etudiants/${id}`);
    etudiantCible.value = data;
  } catch {
    etudiantCible.value = null;
  }
}

onMounted(async () => {
  const dossier = route.query.inscription as string | undefined;
  const etudiant = route.query.etudiant as string | undefined;
  if (dossier) await appliquerDossierCible(dossier);
  else if (etudiant) await appliquerEtudiantCible(etudiant);
  pret.value = true;
  await charger();
});
</script>

<style scoped lang="scss">
.paiements-kpi {
  background: var(--up-plaque);
  border: var(--up-filet);
}
.paiements-kpi__valeur {
  font-size: 1.4rem;
  margin-top: 2px;
}
.paiements-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--up-3);
}
.paiements-cartes__carte {
  background: var(--up-plaque);
}

// État vide : on nomme la cause et on offre la sortie.
.paiements-vide {
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
.champ--payee { background: #007a4d; color: #fff; }
.champ--annulee { background: #ce1126; color: #fff; }

.champ.badge-source {
  display: inline-flex;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 590;
  white-space: nowrap;
  background: #e8e8ed;
  color: #33463f;
}
.badge-source--inscription { background: #e3ecf7; color: #15518f; }
</style>
