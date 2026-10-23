<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('common.fields.payments')" :subtitle="$t('paiements.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('paiements.actions.new')"
          @click="dialogPaiement = true"
        />
      </template>
    </en-tete-page>

    <!-- Arrivée depuis un dossier ou une fiche étudiant : le ciblage est annoncé. -->
    <q-banner v-if="libelleCible" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="filter_alt" /></template>
      {{ libelleCible }}
      <template #action>
        <q-btn flat dense no-caps :label="$t('paiements.actions.viewAll')" @click="retirerCible" />
      </template>
    </q-banner>

    <div class="resume-liste" role="status">
      <span
        >{{ $t('paiements.kpis.totalCollected') }} :
        <strong>{{ montantLisible(kpis.totalEncaisse) }} {{ $t('common.units.gnf') }}</strong></span
      >
      <span
        >{{ $t('paiements.kpis.pending') }} : <strong>{{ kpis.enAttente }}</strong></span
      >
      <span v-if="kpis.echoues"
        >{{ $t('paiements.kpis.failed') }} : <strong>{{ kpis.echoues }}</strong></span
      >
    </div>

    <!-- Le registre est paginé côté serveur : ces totaux portent sur ce qui est affiché. -->
    <div class="text-caption text-grey-7 q-mb-md">
      {{
        $t('paiements.summary', {
          count: liste.lignes.length,
          total: liste.total,
          plural: liste.lignes.length > 1 ? 's' : '',
        })
      }}
    </div>

    <barre-filtres
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
          :label="$t('common.fields.status')"
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
          :label="$t('common.fields.operator')"
        />
        <q-input
          v-model="filtres.motif"
          outlined
          dense
          clearable
          :label="$t('common.fields.motif')"
          :placeholder="$t('paiements.filters.reasonPlaceholder')"
        />
        <champ-recherche
          v-model="filtres.inscriptionId"
          endpoint="/inscriptions"
          :label-fn="(i) => `${i.numero} — ${i.etudiant?.nom ?? ''} ${i.etudiant?.prenom ?? ''}`"
          :label="$t('paiements.filters.enrollment')"
          clearable
        />
        <champ-recherche
          v-model="filtres.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
          :label="$t('common.fields.student')"
          clearable
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('paiements.filters.from')" />
        <champ-date v-model="filtres.dateFin" :label="$t('paiements.filters.to')" />
      </template>
    </barre-filtres>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="paiementsFiltres"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :pagination="{ rowsPerPage: 0 }"
      :hide-bottom="liste.chargement || paiementsFiltres.length > 0"
    >
      <template #no-data>
        <etat-vide icone="payments" :titre="messageVide">
          <template #action>
            <div class="q-gutter-sm">
              <q-btn
                v-if="filtresActifs"
                outline
                no-caps
                icon="refresh"
                :label="$t('common.actions.reset_filters')"
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
          </template>
        </etat-vide>
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
            {{ p.row.operateur ? (LIBELLE_OPERATEUR_MM[p.row.operateur] ?? p.row.operateur) : '—' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="paiement" :statut="p.row.statut" />
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

    <q-linear-progress
      :aria-label="$t('common.messages.loading')"
      v-if="modeVue === 'cartes' && liste.chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="paiements-cartes">
      <q-card v-for="p in paiementsFiltres" :key="p.id" flat bordered class="carte paiements-cartes__carte">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <PastilleStatut domaine="paiement" :statut="p.statut" />
            <span class="champ badge-source q-ml-xs" :class="`badge-source--${sourceDe(p).toLowerCase()}`">
              {{ libelleSource(p) }}
            </span>
            <q-space />
            <div class="text-caption text-grey-7">{{ p.reference }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ p.etudiant?.nom }} {{ p.etudiant?.prenom }}</div>
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
                {{ p.operateur ? (LIBELLE_OPERATEUR_MM[p.operateur] ?? p.operateur) : '—' }}
              </div>
            </div>
            <div class="col-6 text-right">
              <div class="text-caption text-grey-7">{{ $t('common.fields.amount') }}</div>
              <div class="text-weight-medium lettrage chiffres">{{ montantLisible(p.montant) }} {{ p.devise }}</div>
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
            :label="$t('common.actions.details')"
            @click="ouvrirDetail(p)"
          />
          <actions-secondaires>
            <q-btn
              v-close-popup
              v-if="routeModule(p)"
              flat
              dense
              color="primary"
              icon="open_in_new"
              no-caps
              :label="$t('paiements.cards.openModule', { module: libelleSource(p) })"
              @click="ouvrirModule(p)"
            />
            <q-btn
              v-close-popup
              v-if="peutSimuler(p)"
              flat
              dense
              color="positive"
              icon="check"
              no-caps
              :label="$t('paiements.cards.success')"
              @click="simuler(p, 'REUSSI')"
            />
            <q-btn
              v-close-popup
              v-if="peutSimuler(p)"
              flat
              dense
              color="negative"
              icon="close"
              no-caps
              :label="$t('paiements.cards.failed')"
              @click="simuler(p, 'ECHOUE')"
            />
            <q-btn
              v-close-popup
              v-if="peutAnnuler(p)"
              flat
              dense
              color="negative"
              icon="block"
              no-caps
              :label="$t('common.actions.cancel')"
              @click="ouvrirAnnulation(p)"
            />
            <q-btn
              v-close-popup
              v-if="p.inscription || p.inscriptionId"
              flat
              dense
              icon="how_to_reg"
              no-caps
              :label="$t('paiements.cards.enrollment')"
              @click="voirInscription(p)"
            />
            <q-btn
              v-close-popup
              v-if="p.etudiant"
              flat
              dense
              icon="person"
              no-caps
              :label="$t('common.fields.student')"
              @click="voirEtudiant(p)"
            />
          </actions-secondaires>
        </q-card-actions>
      </q-card>
      <etat-vide v-if="!paiementsFiltres.length" icone="payments" :titre="messageVide">
        <template #action>
          <div class="q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
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
        </template>
      </etat-vide>
    </div>

    <barre-pagination
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-paiement v-model="dialogPaiement" @paye="liste.recharger()" />

    <!-- Détail d'une transaction -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ detail?.reference }}</div>
          <div class="text-caption text-grey-7">
            {{
              detail
                ? `${LIBELLE_MODE_PAIEMENT[detail.mode] ?? detail.mode} · ${LIBELLE_STATUT_PAIEMENT[detail.statut] ?? detail.statut}`
                : ''
            }}
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
                <q-item-label caption>{{ $t('common.fields.amount') }}</q-item-label>
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
                  {{ detail?.operateur ? (LIBELLE_OPERATEUR_MM[detail.operateur] ?? detail.operateur) : '—' }}
                  · {{ detail?.telephone ?? '—' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>{{ $t('common.fields.motif') }}</q-item-label>
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
                  {{
                    detail?.creePar
                      ? `${detail.creePar.prenom} ${detail.creePar.nom}`
                      : $t('paiements.detail.createdByFallback')
                  }}
                  {{
                    detail?.completeLe
                      ? $t('paiements.detail.completedOn', { date: dateHeureLisible(detail.completeLe) })
                      : ''
                  }}
                  {{
                    detail?.motifAnnulation
                      ? $t('paiements.detail.cancelReason', { reason: detail.motifAnnulation })
                      : ''
                  }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.actions.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Annulation : le motif est exigé -->
    <dialogue-formulaire
      v-model="dialogAnnulation"
      taille="s"
      :titre="$t('paiements.dialogs.cancelTitle', { reference: paiementAnnuler?.reference })"
      :sous-titre="`${paiementAnnuler ? LIBELLE_STATUT_PAIEMENT[paiementAnnuler.statut] : ''} ${$t('common.format.emptyValue')} ${$t('paiements.dialogs.cancelSubtitle')}`"
      :envoi="annulationEnCours"
      :libelle-valider="$t('paiements.dialogs.cancelConfirm')"
      icone-valider="block"
      couleur-valider="negative"
      :desactive="motifAnnulation.trim().length < 3"
      @valider="confirmerAnnulation"
    >
      <q-input
        v-model="motifAnnulation"
        outlined
        dense
        type="textarea"
        rows="3"
        :label="$t('paiements.dialogs.cancelReasonLabel')"
        autofocus
      />
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import DialoguePaiement from '@/shared/components/DialoguePaiement.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_PAIEMENT,
  dateHeureLisible,
  dateLisible,
  montantLisible,
} from '@/shared/utils/libelles';
import type { Etudiant, Inscription, ModePaiement, Paiement, StatutPaiement, ChipFiltre } from '@/types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const modeVue = usePresentationListe();

/** `?inscription=<id>` ou `?etudiant=<id>` : registre ciblé dès l'ouverture. */
const cibleUrl = (cle: string) => (typeof route.query[cle] === 'string' && route.query[cle]) || null;
const inscriptionUrl = cibleUrl('inscription');

const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null,
  mode: null,
  operateur: null,
  motif: '',
  inscriptionId: inscriptionUrl,
  etudiantId: inscriptionUrl ? null : cibleUrl('etudiant'),
  dateDebut: null,
  dateFin: null,
});

/**
 * Registre paginé côté serveur. L'opérateur, le motif et les dates ne sont
 * pas compris par `GET /paiements` : ils filtrent la page affichée.
 */
const liste = reactive(
  useListePaginee<Paiement>({
    filtres,
    clesLocales: ['operateur', 'motif', 'dateDebut', 'dateFin'],
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/paiements', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            statut: f.statut || undefined,
            mode: f.mode || undefined,
            inscriptionId: f.inscriptionId || undefined,
            etudiantId: f.etudiantId || undefined,
          },
        })
        .then((r) => r.data),
  }),
);
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

const sourceDe = (p: Paiement): SourcePaiement => (p as Paiement & { source?: SourcePaiement }).source ?? 'INSCRIPTION';
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

const peutCreer = computed(() => auth.peut('paiements.creer'));
const peutSimuler = (p: Paiement) => auth.peut('paiements.simuler') && estInscription(p) && p.statut === 'EN_ATTENTE';
const peutAnnuler = (p: Paiement) =>
  auth.peut('paiements.annuler') && estInscription(p) && !['REUSSI', 'ANNULE', 'REMBOURSE'].includes(p.statut);

const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsModes = computed(() => Object.entries(LIBELLE_MODE_PAIEMENT).map(([value, label]) => ({ value, label })));
const optionsOperateurs = computed(() =>
  Object.entries(LIBELLE_OPERATEUR_MM).map(([value, label]) => ({ value, label })),
);

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'reference',
    label: t('paiements.table.columns.reference'),
    field: 'reference',
    align: 'left',
    sortable: true,
  },
  { name: 'source', label: t('paiements.table.columns.source'), field: 'source', align: 'left', sortable: true },
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiant', align: 'left' },
  { name: 'mode', label: t('paiements.table.columns.mode'), field: 'mode', align: 'left' },
  { name: 'montant', label: t('common.fields.amount'), field: 'montant', align: 'right', sortable: true },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'motif', label: t('common.fields.motif'), field: 'motif', align: 'left' },
  { name: 'transactionId', label: t('paiements.table.columns.transaction'), field: 'transactionId', align: 'left' },
  { name: 'horodatage', label: t('common.fields.date'), field: 'horodatage', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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
  const lignes = liste.lignes;
  let totalEncaisse = 0;
  let enAttente = 0;
  let echoues = 0;
  for (const p of lignes) {
    if (p.statut === 'REUSSI') totalEncaisse += p.montant;
    if (p.statut === 'EN_ATTENTE') enAttente++;
    if (p.statut === 'ECHOUE') echoues++;
  }
  return { totalEncaisse, enAttente, echoues };
});

/** Filtrage client pour les critères que le backend ne gère pas encore. */
const paiementsFiltres = computed(() => {
  let lignes = liste.lignes;
  if (filtres.value.operateur) {
    lignes = lignes.filter((p) => p.operateur === filtres.value.operateur);
  }
  if (filtres.value.motif) {
    const needle = String(filtres.value.motif).toLowerCase();
    lignes = lignes.filter((p) => (p.motif ?? '').toLowerCase().includes(needle));
  }
  if (filtres.value.dateDebut) {
    const d = new Date(filtres.value.dateDebut).getTime();
    lignes = lignes.filter((p) => new Date(p.horodatage).getTime() >= d);
  }
  if (filtres.value.dateFin) {
    const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
    lignes = lignes.filter((p) => new Date(p.horodatage).getTime() <= d);
  }
  return lignes;
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

async function simuler(p: Paiement, statut: 'REUSSI' | 'ECHOUE') {
  const ok = await confirmer({
    titre: statut === 'REUSSI' ? t('paiements.confirmDialog.title') : t('paiements.confirmDialog.titleFailed'),
    message: t('paiements.confirmDialog.message', {
      reference: p.reference,
      amount: `${montantLisible(p.montant)} ${p.devise}`,
      outcome:
        statut === 'REUSSI' ? t('paiements.confirmDialog.outcomeSuccess') : t('paiements.confirmDialog.outcomeFailed'),
    }),
    ok: t('common.actions.confirm'),
    danger: statut === 'ECHOUE',
  });
  if (!ok) return;
  try {
    await api.post(`/paiements/${p.id}/simuler`, { statut });
  } catch {
    return; // l'intercepteur axios affiche le motif
  }
  $q.notify({
    type: 'positive',
    message: statut === 'REUSSI' ? t('paiements.messages.confirmed') : t('paiements.messages.markedFailed'),
  });
  await liste.recharger();
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
    await liste.recharger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    annulationEnCours.value = false;
  }
}

function reinitialiser() {
  dossierCible.value = null;
  etudiantCible.value = null;
  // Pas `liste.reinitialiser()` : l'état initial porte la cible de l'URL.
  filtres.value = {
    recherche: '',
    statut: null,
    mode: null,
    operateur: null,
    motif: '',
    inscriptionId: null,
    etudiantId: null,
    dateDebut: null,
    dateFin: null,
  };
  void router.replace({ path: '/paiements' });
}

/** Lève le ciblage venu de l'URL sans toucher aux autres filtres. */
async function retirerCible() {
  dossierCible.value = null;
  etudiantCible.value = null;
  // Une seule affectation : une seule requête.
  filtres.value = { ...filtres.value, inscriptionId: null, etudiantId: null };
  await router.replace({ path: '/paiements' });
}

/** `/paiements?inscription=<id>` — encaissements d'un dossier précis. */
async function appliquerDossierCible(id: string) {
  try {
    const { data } = await api.get('/inscriptions', { params: { all: '1' } });
    const liste: Inscription[] = Array.isArray(data) ? data : (data.data ?? []);
    dossierCible.value = liste.find((i) => i.id === id) ?? null;
  } catch {
    dossierCible.value = null;
  }
}

/** `/paiements?etudiant=<id>` — tous les encaissements d'un étudiant. */
async function appliquerEtudiantCible(id: string) {
  try {
    const { data } = await api.get(`/etudiants/${id}`);
    etudiantCible.value = data;
  } catch {
    etudiantCible.value = null;
  }
}

// Le filtre est déjà posé ; on ne charge ici que le libellé du bandeau.
onMounted(() => {
  if (filtres.value.inscriptionId) void appliquerDossierCible(filtres.value.inscriptionId);
  else if (filtres.value.etudiantId) void appliquerEtudiantCible(filtres.value.etudiantId);
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

.champ.badge-source {
  display: inline-flex;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 590;
  white-space: nowrap;
  background: #e8e8ed;
  color: #33463f;
}
.badge-source--inscription {
  background: #e3ecf7;
  color: #15518f;
}
</style>
