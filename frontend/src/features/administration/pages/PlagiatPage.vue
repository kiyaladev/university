<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('plagiatPage.title')" :subtitle="$t('plagiatPage.subtitle')">
      <template #actions>
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="library_books"
          :label="$t('plagiatPage.actions.library')"
          @click="router.push({ name: 'bibliotheque' })"
        />
        <q-btn
          v-if="auth.estAdmin"
          unelevated
          color="negative"
          no-caps
          icon="refresh"
          :label="$t('plagiatPage.actions.recalculateAll')"
          :loading="recalculEnCours"
          @click="lancerRecalcul"
        />
      </template>
    </en-tete-page>

    <!-- KPIs : chiffres globaux renvoyés par le moteur, tous statuts confondus -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">{{ $t('plagiatPage.kpis.total') }}</div>
            <div class="kpi-carte__chiffre">{{ kpis.total }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">{{ $t('plagiatPage.kpis.avgScore') }}</div>
            <div class="kpi-carte__chiffre">
              {{ nombreLisible(kpis.scoreMoyen, 1) }}<span class="kpi-carte__unite">%</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">{{ $t('plagiatPage.kpis.pending') }}</div>
            <div class="kpi-carte__chiffre text-orange">{{ kpis.enAttente }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card flat bordered class="carte kpi-carte">
          <q-card-section>
            <div class="text-caption text-grey-7 text-uppercase">{{ $t('plagiatPage.kpis.arbitrated') }}</div>
            <div class="kpi-carte__chiffre">
              <span class="text-positive">{{ kpis.acquittees }}</span>
              <span class="kpi-carte__unite"> {{ $t('plagiatPage.kpis.acquittedSuffix') }}</span>
              <span class="text-negative">{{ kpis.confirmees }}</span>
              <span class="kpi-carte__unite"> {{ $t('plagiatPage.kpis.confirmedSuffix') }}</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-banner v-if="dernierRecap" dense class="bg-positive text-white q-mb-md">
      <template #avatar><q-icon name="check_circle" /></template>
      <div class="text-weight-medium">{{ dernierRecap.titre }}</div>
      <div class="text-caption">{{ dernierRecap.message }}</div>
      <template #action>
        <q-btn
          flat
          dense
          no-caps
          :label="$t('plagiatPage.banner.dismiss')"
          :aria-label="$t('plagiatPage.banner.dismissAria')"
          @click="dernierRecap = null"
        />
      </template>
    </q-banner>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('plagiatPage.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-input
          v-model.number="filtres.scoreMin"
          type="number"
          min="0"
          max="100"
          dense
          outlined
          clearable
          :label="$t('plagiatPage.filters.scoreMin')"
        />
        <champ-recherche
          v-model="filtres.documentId"
          endpoint="/documents"
          :label-fn="(d) => `${d.titre}${d.auteurs ? ' — ' + d.auteurs : ''}`"
          :label="$t('plagiatPage.filters.document')"
          :placeholder="$t('plagiatPage.filters.documentPlaceholder')"
          clearable
        />
        <champ-date v-model="filtres.dateMin" :label="$t('plagiatPage.filters.detectedFrom')" />
        <champ-date v-model="filtres.dateMax" :label="$t('plagiatPage.filters.detectedTo')" />
      </template>
    </barre-filtres>

    <!-- Top 5 documents les plus dupliqués -->
    <q-banner v-if="topDocuments.length" dense class="carte q-mb-md">
      <template #avatar><q-icon name="leaderboard" color="primary" /></template>
      <div class="text-caption text-weight-medium q-mb-xs">{{ $t('plagiatPage.topDocuments.title') }}</div>
      <ol class="q-pl-md q-mb-none">
        <li v-for="d in topDocuments" :key="d.id" class="text-caption">
          {{ d.titre }} {{ $t('common.format.emptyValue') }}
          <span class="text-grey-9">{{ $t('plagiatPage.topDocuments.count', { count: d.compte }) }}</span>
        </li>
      </ol>
    </q-banner>

    <div v-if="liste.chargement" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <etat-vide
      v-else-if="!suspicionsFiltrees.length"
      icone="verified"
      :titre="filtresActifs ? $t('plagiatPage.emptyState.filteredTitle') : $t('plagiatPage.emptyState.defaultTitle')"
      :aide="filtresActifs ? $t('plagiatPage.emptyState.filteredHint') : $t('plagiatPage.emptyState.defaultHint')"
    >
      <template v-if="filtresActifs" #action>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="refresh"
          :label="$t('common.actions.reset_filters')"
          @click="reinitialiser"
        />
      </template>
    </etat-vide>

    <template v-else>
      <q-table
        v-if="modeVue === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="suspicionsPage"
        :columns="colonnes"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        @row-click="(_, row) => voirDetail(row)"
      >
        <template #body-cell-score="p">
          <q-td :props="p" class="text-center">
            <q-badge :color="couleurScore(p.row.score)" text-color="white" dense>
              {{ Math.round(p.row.score) }} %
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-documentA="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.documentA?.titre ?? '—' }}</div>
            <div class="text-caption text-grey-7">{{ p.row.documentA?.auteurs ?? '—' }}</div>
          </q-td>
        </template>
        <template #body-cell-documentB="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.documentB?.titre ?? '—' }}</div>
            <div class="text-caption text-grey-7">{{ p.row.documentB?.auteurs ?? '—' }}</div>
          </q-td>
        </template>
        <template #body-cell-statut="p">
          <q-td :props="p">
            <PastilleStatut domaine="suspicion" :statut="p.row.statut" />
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              flat
              dense
              round
              icon="open_in_new"
              :aria-label="$t('plagiatPage.table.actions.viewDetailAria')"
              @click.stop="voirDetail(p.row)"
            >
              <q-tooltip>{{ $t('plagiatPage.table.actions.viewDetailTooltip') }}</q-tooltip>
            </q-btn>
            <template v-if="peutDecider && p.row.statut === 'EN_ATTENTE'">
              <q-btn
                flat
                dense
                round
                color="positive"
                icon="thumb_down"
                :aria-label="$t('plagiatPage.table.actions.acquitAria')"
                @click.stop="acquitter(p.row)"
              >
                <q-tooltip>{{ $t('plagiatPage.table.actions.acquitTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                color="negative"
                icon="gavel"
                :aria-label="$t('plagiatPage.table.actions.confirmAria')"
                @click.stop="confirmer(p.row)"
              >
                <q-tooltip>{{ $t('plagiatPage.table.actions.confirmTooltip') }}</q-tooltip>
              </q-btn>
            </template>
          </q-td>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div v-for="s in suspicionsPage" :key="s.id" class="col-12 col-sm-6 col-lg-4">
          <fiche-plagiat
            :suspicion="s"
            :show-actions="peutDecider"
            @voir="voirDetail"
            @acquitter="acquitter"
            @confirmer="confirmer"
          />
        </div>
      </div>

      <barre-pagination
        :page="page"
        :page-size="pageSize"
        :total="suspicionsFiltrees.length"
        :show-all="false"
        @update:page="(v) => (page = v)"
        @update:page-size="
          (v) => {
            pageSize = v;
            page = 1;
          }
        "
      />
    </template>

    <!-- Dialog de décision rapide (acquittement / confirmation) -->
    <dialogue-formulaire
      v-model="decisionDialogOuvert"
      :titre="
        decisionStatut === 'ACQUITTE' ? $t('plagiatPage.dialog.titleAcquit') : $t('plagiatPage.dialog.titleConfirm')
      "
      :envoi="decisionEnCours"
      :libelle-valider="
        decisionStatut === 'ACQUITTE' ? $t('plagiatPage.dialog.acquitSubmit') : $t('plagiatPage.dialog.confirmSubmit')
      "
      :couleur-valider="decisionStatut === 'ACQUITTE' ? 'positive' : 'negative'"
      :desactive="decisionStatut === 'CONFIRME' && !decisionMotif.trim()"
      @valider="validerDecision"
    >
      <template v-if="decisionCourante">
        <div class="text-caption text-grey-7 q-mb-md">
          {{ $t('common.fields.score') }} <strong>{{ Math.round(decisionCourante.score) }} %</strong>
          {{ $t('common.format.emptyValue') }}
          {{
            $t('plagiatPage.dialog.comparisonDocs', {
              documentA: decisionCourante.documentA?.titre ?? '—',
              documentB: decisionCourante.documentB?.titre ?? '—',
            })
          }}
        </div>
        <q-banner dense :class="decisionStatut === 'CONFIRME' ? 'bg-red-1 text-red-10 q-mb-md' : 'carte q-mb-md'">
          <template #avatar>
            <q-icon
              :name="decisionStatut === 'CONFIRME' ? 'warning' : 'info'"
              :color="decisionStatut === 'CONFIRME' ? 'negative' : 'primary'"
            />
          </template>
          <template v-if="decisionStatut === 'CONFIRME'">
            {{ $t('plagiatPage.dialog.confirmWarning') }}
          </template>
          <template v-else>
            {{ $t('plagiatPage.dialog.acquitWarning') }}
          </template>
        </q-banner>
        <q-input
          v-model="decisionMotif"
          outlined
          dense
          type="textarea"
          autogrow
          :label="
            decisionStatut === 'CONFIRME' ? $t('common.fields.motifRequired') : $t('plagiatPage.dialog.motifOptional')
          "
        />
      </template>
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import FichePlagiat from '../components/FichePlagiat.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { useAuthStore } from '@/stores/auth';
import { dateLisible, nombreLisible } from '@/shared/utils/libelles';
import type { SuspicionPlagiat, ChipFiltre } from '@/types';
import {
  lireRecapitulatifRecalcul,
  lireTableauDeBordPlagiat,
  plagiatService,
} from '@/features/administration/services/plagiat';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { confirmer: demanderConfirmation } = useConfirmation();

const modeVue = usePresentationListe();

/**
 * `GET /documents/plagiat` renvoie un tableau de bord complet — file d'attente,
 * compteurs globaux et top des documents — sans paramètre de filtre ni de
 * pagination : le tri, la recherche et la pagination sont donc faits ici.
 */
const kpis = ref({ total: 0, scoreMoyen: 0, enAttente: 0, acquittees: 0, confirmees: 0 });
const topDocuments = ref<Array<{ id: string; titre: string; compte: number }>>([]);

const page = ref(1);
const pageSize = ref(12);
const recalculEnCours = ref(false);
const dernierRecap = ref<{ titre: string; message: string } | null>(null);

// La bibliothèque renvoie ici avec le document à examiner.
const filtres = ref<Record<string, any>>(route.query.documentId ? { documentId: String(route.query.documentId) } : {});

const liste = reactive(
  useListePaginee<SuspicionPlagiat>({
    filtres,
    pageSize: 0,
    clesLocales: true,
    charger: async () => {
      const tableau = lireTableauDeBordPlagiat(await plagiatService.tableauDeBord());
      kpis.value = tableau.kpis;
      topDocuments.value = tableau.topDocuments;
      page.value = 1;
      return { data: tableau.suspicions };
    },
  }),
);
const suspicions = computed(() => liste.lignes);

const peutDecider = computed(() => auth.peut('plagiat.decider'));

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'score', label: t('common.fields.score'), field: 'score', align: 'center', sortable: true },
  { name: 'documentA', label: t('plagiatPage.table.columns.documentA'), field: 'documentAId', align: 'left' },
  { name: 'documentB', label: t('plagiatPage.table.columns.documentB'), field: 'documentBId', align: 'left' },
  {
    name: 'detecteLe',
    label: t('plagiatPage.table.columns.detectedOn'),
    field: (r) => dateLisible(r.detecteLe),
    align: 'center',
    sortable: true,
  },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function couleurScore(score: number): string {
  if (score >= 80) return 'negative';
  if (score >= 50) return 'warning';
  return 'positive';
}

const filtresActifs = computed(() =>
  Boolean(
    filtres.value.recherche ||
    filtres.value.documentId ||
    filtres.value.dateMin ||
    filtres.value.dateMax ||
    (filtres.value.scoreMin ?? null) !== null,
  ),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('plagiatPage.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if ((filtres.value.scoreMin ?? null) !== null && filtres.value.scoreMin !== '') {
    cs.push({
      label: t('plagiatPage.chips.scoreMin', { value: filtres.value.scoreMin }),
      value: filtres.value.scoreMin,
      icone: 'speed',
    });
  }
  if (filtres.value.documentId) {
    cs.push({
      label: t('plagiatPage.chips.targetedDocument'),
      value: filtres.value.documentId,
      icone: 'description',
      cle: 'documentId',
    });
  }
  if (filtres.value.dateMin) {
    cs.push({
      label: t('plagiatPage.chips.since', { date: dateLisible(filtres.value.dateMin) }),
      value: filtres.value.dateMin,
      icone: 'event',
    });
  }
  if (filtres.value.dateMax) {
    cs.push({
      label: t('plagiatPage.chips.until', { date: dateLisible(filtres.value.dateMax) }),
      value: filtres.value.dateMax,
      icone: 'event',
    });
  }
  return cs;
});

const suspicionsFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '')
    .toLowerCase()
    .trim();
  const scoreMin = Number(filtres.value.scoreMin ?? NaN);
  const debut = filtres.value.dateMin ? new Date(String(filtres.value.dateMin)).getTime() : null;
  const fin = filtres.value.dateMax ? new Date(String(filtres.value.dateMax)).getTime() + 86_400_000 - 1 : null;

  return suspicions.value.filter((s) => {
    if (!Number.isNaN(scoreMin) && (s.score ?? 0) < scoreMin) return false;
    if (
      filtres.value.documentId &&
      s.documentAId !== filtres.value.documentId &&
      s.documentBId !== filtres.value.documentId
    )
      return false;
    const detecteLeTs = new Date(s.detecteLe).getTime();
    if (debut !== null && detecteLeTs < debut) return false;
    if (fin !== null && detecteLeTs > fin) return false;
    if (q) {
      const texte = [s.documentA?.titre, s.documentA?.auteurs, s.documentB?.titre, s.documentB?.auteurs, s.commentaire]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!texte.includes(q)) return false;
    }
    return true;
  });
});

const suspicionsPage = computed(() =>
  suspicionsFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
}

function voirDetail(s: SuspicionPlagiat) {
  void router.push({ name: 'plagiat-detail', params: { id: s.id } });
}

// Dialog de décision rapide
const decisionDialogOuvert = ref(false);
const decisionCourante = ref<SuspicionPlagiat | null>(null);
const decisionStatut = ref<'ACQUITTE' | 'CONFIRME'>('ACQUITTE');
const decisionMotif = ref('');
const decisionEnCours = ref(false);

function ouvrirDecision(s: SuspicionPlagiat, statut: 'ACQUITTE' | 'CONFIRME') {
  decisionCourante.value = s;
  decisionStatut.value = statut;
  decisionMotif.value = '';
  decisionDialogOuvert.value = true;
}

const acquitter = (s: SuspicionPlagiat) => ouvrirDecision(s, 'ACQUITTE');
const confirmer = (s: SuspicionPlagiat) => ouvrirDecision(s, 'CONFIRME');

async function validerDecision() {
  if (!decisionCourante.value) return;
  if (decisionStatut.value === 'CONFIRME' && !decisionMotif.value.trim()) {
    $q.notify({ type: 'warning', message: t('plagiatPage.messages.motifRequired') });
    return;
  }
  decisionEnCours.value = true;
  try {
    await plagiatService.acquitter(decisionCourante.value.id, {
      decision: decisionStatut.value,
      commentaire: decisionMotif.value.trim() || undefined,
    });
    $q.notify({
      type: 'positive',
      message:
        decisionStatut.value === 'ACQUITTE' ? t('plagiatPage.messages.acquitted') : t('plagiatPage.messages.confirmed'),
    });
    decisionDialogOuvert.value = false;
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    decisionEnCours.value = false;
  }
}

async function lancerRecalcul() {
  const ok = await demanderConfirmation({
    titre: t('plagiatPage.messages.recalculateDialogTitle'),
    message: t('plagiatPage.messages.recalculateDialogMessage'),
    ok: t('plagiatPage.messages.recalculateDialogOk'),
    danger: true,
  });
  if (!ok) return;
  recalculEnCours.value = true;
  try {
    const recap = lireRecapitulatifRecalcul(await plagiatService.recalculer());
    dernierRecap.value = {
      titre: t('plagiatPage.messages.recalculateDoneTitle'),
      message: t('plagiatPage.messages.recalculateDoneMessage', {
        created: recap.creees,
        updated: recap.misesAJour,
        ignored: recap.ignorees,
      }),
    };
    $q.notify({ type: 'positive', message: t('plagiatPage.messages.recalculateSuccess') });
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    recalculEnCours.value = false;
  }
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.scoreMin,
    filtres.value.documentId,
    filtres.value.dateMin,
    filtres.value.dateMax,
  ],
  () => {
    page.value = 1;
  },
);
</script>

<style scoped>
.kpi-carte__chiffre {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
  color: var(--up-encre);
}
.kpi-carte__unite {
  font-size: 1rem;
  font-weight: 600;
}
</style>
