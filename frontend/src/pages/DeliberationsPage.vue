<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('deliberations.title')" :subtitle="$t('deliberations.subtitle')">
      <template #actions>
<div class="col-auto">
        <q-btn
          v-if="peutSaisir"
          unelevated
          color="primary"
          no-caps
          icon="gavel"
          :label="$t('deliberations.actions.newDeliberation')"
          @click="dialogOuvert = true"
        />
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutVoirBulletins"
          outline
          color="secondary"
          no-caps
          icon="school"
          :label="$t('deliberations.actions.reportCards')"
          @click="allerBulletins(null)"
        />
      </div>
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('deliberations.filters.search')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('deliberations.filters.anneeAcademique')"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('deliberations.filters.promotion')"
        />
        <semestre-select
          v-model="filtres.session"
          type="session"
          :label="$t('deliberations.filters.session')"
          clearable
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('deliberations.filters.statut')"
        />
      </template>
    </filter-bar>

    <q-table :grid="$q.screen.lt.md"
      flat
      bordered
      class="carte"
      :rows="deliberationsPage"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
      @row-click="(_, row) => ouvrirDetail(row)"
    >

        <template #item="p">
    <div class="col-12 q-pb-sm"><q-card flat bordered class="carte">
      <q-card-section>
        <div v-for="c in p.cols.filter(c => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
          <div class="text-caption text-grey-7">{{ c.label }}</div>
          <template v-if="c.name === 'session'">{{ LIBELLE_SESSION_DELIBERATION[p.row.session] ?? p.row.session }}</template>
  <template v-else-if="c.name === 'statut'">{{ LIBELLE_STATUT_DELIBERATION[p.row.statut] ?? p.row.statut }}</template>
  <template v-else-if="c.name === 'taux'">{{ p.row.tauxReussite == null ? '—' : pourcentLisible(p.row.tauxReussite) }}</template>
  <template v-else-if="c.name === 'effectif'">{{ p.row._count?.lignes ?? 0 }}</template>
  <template v-else-if="c.name === 'creeLe'">{{ dateLisible(p.row.creeLe) }}</template>
  <span v-else>{{ c.value }}</span>
        </div>
      </q-card-section>
      <q-card-actions align="right">
<q-btn
            flat
            dense no-caps
            icon="visibility"
            :aria-label="$t('deliberations.ariaLabels.detail')" :label="$t('deliberations.ariaLabels.detail')"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.detail') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            v-if="p.row.statut === 'BROUILLON' && peutSaisir"
            flat
            dense no-caps
            icon="replay"
            color="primary"
            :aria-label="$t('deliberations.ariaLabels.recalculate')" :label="$t('deliberations.ariaLabels.recalculate')"
            @click.stop="calculer(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.recalculate') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="p.row.statut === 'BROUILLON' && estJury"
            flat
            dense
            no-caps
            icon="verified_user"
            color="positive"
            :label="$t('deliberations.actions.validateJury')"
            @click.stop="valider(p.row)"
          />
<q-btn v-if="peutVoirBulletins" v-close-popup
            flat
            dense no-caps
            icon="school"
            color="primary"
            :aria-label="$t('deliberations.ariaLabels.reportCards')" :label="$t('deliberations.ariaLabels.reportCards')"
            @click.stop="allerBulletins(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.reportCards') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="print"
            :aria-label="$t('deliberations.ariaLabels.printPv')" :label="$t('deliberations.ariaLabels.printPv')"
            @click.stop="imprimerPv(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.printPv') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-card-actions>
    </q-card></div>
  </template>
<template #no-data>
        <div class="etat-vide">
          <q-icon name="gavel" size="32px" color="grey-5" />
          <div class="q-mt-sm">{{ $t('deliberations.emptyState.message') }}</div>
          <q-btn
            v-if="peutSaisir"
            unelevated
            color="primary"
            no-caps
            icon="gavel"
            :label="$t('deliberations.actions.newDeliberation')"
            class="q-mt-sm"
            @click="dialogOuvert = true"
          />
        </div>
      </template>

      <template #body-cell-session="p">
        <q-td :props="p">{{ LIBELLE_SESSION_DELIBERATION[p.row.session] ?? p.row.session }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="p.row.statut === 'VALIDEE' ? 'positive' : 'warning'">
            {{ LIBELLE_STATUT_DELIBERATION[p.row.statut] ?? p.row.statut }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-taux="p">
        <q-td :props="p" class="text-center">
          <template v-if="p.row.tauxReussite !== null && p.row.tauxReussite !== undefined">
            {{ pourcentLisible(p.row.tauxReussite) }}
          </template>
          <template v-else>{{ $t('rectoratPage.subtitleFallback') }}</template>
        </q-td>
      </template>

      <template #body-cell-effectif="p">
        <q-td :props="p" class="text-center chiffres">{{ p.row._count?.lignes ?? 0 }}</q-td>
      </template>

      <template #body-cell-creeLe="p">
        <q-td :props="p">{{ dateLisible(p.row.creeLe) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            flat
            dense no-caps
            icon="visibility"
            :aria-label="$t('deliberations.ariaLabels.detail')" :label="$t('deliberations.ariaLabels.detail')"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.detail') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            v-if="p.row.statut === 'BROUILLON' && peutSaisir"
            flat
            dense no-caps
            icon="replay"
            color="primary"
            :aria-label="$t('deliberations.ariaLabels.recalculate')" :label="$t('deliberations.ariaLabels.recalculate')"
            @click.stop="calculer(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.recalculate') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="p.row.statut === 'BROUILLON' && estJury"
            flat
            dense
            no-caps
            icon="verified_user"
            color="positive"
            :label="$t('deliberations.actions.validateJury')"
            @click.stop="valider(p.row)"
          />
<q-btn v-if="peutVoirBulletins" v-close-popup
            flat
            dense no-caps
            icon="school"
            color="primary"
            :aria-label="$t('deliberations.ariaLabels.reportCards')" :label="$t('deliberations.ariaLabels.reportCards')"
            @click.stop="allerBulletins(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.reportCards') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="print"
            :aria-label="$t('deliberations.ariaLabels.printPv')" :label="$t('deliberations.ariaLabels.printPv')"
            @click.stop="imprimerPv(p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.printPv') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <pagination-bar
      v-if="totalFiltre"
      :page="page"
      :page-size="pageSize"
      :total="totalFiltre"
      :show-all="false"
      @update:page="(v) => (page = v)"
      @update:page-size="(v) => { pageSize = v; page = 1; }"
    />

    <deliberation-dialog
      v-model="dialogOuvert"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="charger"
    />

    <!-- Détail des lignes : les décisions individuelles du jury -->
    <q-dialog v-model="dialogDetail" :maximized="$q.screen.lt.md">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section class="row items-center q-col-gutter-md">
          <div class="col">
            <div class="text-h6">{{ $t('deliberations.detail.title', { promotion: detail?.promotion?.nom ?? '—' }) }}</div>
            <div class="text-caption text-grey-7">
              {{ LIBELLE_SESSION_DELIBERATION[detail?.session ?? 'NORMALE'] }} ·
              {{ detail?.annee?.libelle ?? '—' }} ·
              {{ LIBELLE_STATUT_DELIBERATION[detail?.statut ?? 'BROUILLON'] }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn v-if="peutVoirBulletins" outline no-caps icon="school" :label="$t('deliberations.actions.reportCards')" @click="allerBulletins(detail)" />
          </div>
          <div class="col-auto">
            <q-btn outline no-caps icon="print" :label="$t('deliberations.actions.pv')" @click="imprimerPv(detail)" />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="close" :aria-label="$t('deliberations.ariaLabels.close')" v-close-popup />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-linear-progress v-if="chargementDetail" indeterminate color="primary" class="q-mb-sm" />
          <q-table
            flat
            bordered
            :rows="detailLignes"
            :columns="colonnesDetail"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #no-data>
              <div class="etat-vide">
                <q-icon name="how_to_reg" size="28px" color="grey-5" />
                <div class="q-mt-sm">
                  {{ $t('deliberations.detail.emptyLines') }}
                </div>
              </div>
            </template>
            <template #body-cell-moyenne="p">
              <q-td :props="p" class="text-center chiffres">
                {{ p.row.moyenne !== null && p.row.moyenne !== undefined ? p.row.moyenne.toFixed(2) : '—' }}
              </q-td>
            </template>
            <template #body-cell-decision="p">
              <q-td :props="p">
                <q-badge :color="couleurDecision(p.row.decision)">
                  {{ LIBELLE_DECISION_JURY[p.row.decision] ?? p.row.decision }}
                </q-badge>
              </q-td>
            </template>
            <template #body-cell-actions="p">
              <q-td :props="p" class="text-right">
                <q-btn
                  flat
                  dense
                  round
                  icon="print"
                  :aria-label="$t('deliberations.ariaLabels.printBulletin')"
                  @click="imprimerBulletin(p.row)"
                >
                  <q-tooltip>{{ $t('deliberations.tooltips.bulletinIndividuel') }}</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('deliberations.actions.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import DeliberationDialog from '../components/DeliberationDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import SemestreSelect from '../components/SemestreSelect.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_STATUT_DELIBERATION,
  dateLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { AnneeAcademique, Deliberation, DeliberationLigne, Matiere, Promotion, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const peutVoirBulletins = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const router = useRouter();
const { t } = useI18n();

/** La liste renvoie l'effectif agrégé, absent du modèle partagé. */
interface DeliberationListe extends Deliberation {
  _count?: { lignes: number };
}

const peutSaisir = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
/** Le jury : direction et administrateur figent les résultats. */
const estJury = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const deliberations = ref<DeliberationListe[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const chargement = ref(false);

const page = ref(1);
const pageSize = ref(15);

const filtres = ref<Record<string, any>>({});

const dialogOuvert = ref(false);
const dialogDetail = ref(false);
const detail = ref<DeliberationListe | null>(null);
const chargementDetail = ref(false);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsStatuts = [
  { label: LIBELLE_STATUT_DELIBERATION.BROUILLON, value: 'BROUILLON' },
  { label: LIBELLE_STATUT_DELIBERATION.VALIDEE, value: 'VALIDEE' },
];

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('deliberations.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: t('deliberations.chips.annee', { value: a?.libelle ?? '?' }), value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: t('deliberations.chips.promo', { value: p?.nom ?? '?' }), value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.session) {
    cs.push({
      label: t('deliberations.chips.session', { value: LIBELLE_SESSION_DELIBERATION[filtres.value.session] ?? filtres.value.session }),
      value: filtres.value.session,
      icone: 'flag',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('deliberations.chips.statut', { value: LIBELLE_STATUT_DELIBERATION[filtres.value.statut] ?? filtres.value.statut }),
      value: filtres.value.statut,
      icone: 'verified',
    });
  }
  return cs;
});

/**
 * `/deliberations` ne filtre que sur l'année : promotion, session, statut et
 * recherche sont appliqués ici, sur la liste complète déjà chargée (`all=1`).
 */
const deliberationsFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
  return deliberations.value.filter((d) => {
    if (filtres.value.promotionId && d.promotionId !== filtres.value.promotionId) return false;
    if (filtres.value.session && d.session !== filtres.value.session) return false;
    if (filtres.value.statut && d.statut !== filtres.value.statut) return false;
    if (q && !`${d.promotion?.nom ?? ''} ${d.annee?.libelle ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
});

const totalFiltre = computed(() => deliberationsFiltrees.value.length);
const deliberationsPage = computed(() =>
  deliberationsFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'promotion', label: t('deliberations.table.columns.promotion'), field: (r) => r.promotion?.nom ?? '—', align: 'left', sortable: true },
  { name: 'annee', label: t('deliberations.table.columns.annee'), field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'session', label: t('deliberations.table.columns.session'), field: 'session', align: 'left' },
  { name: 'statut', label: t('deliberations.table.columns.statut'), field: 'statut', align: 'left' },
  { name: 'taux', label: t('deliberations.table.columns.taux'), field: 'tauxReussite', align: 'center', sortable: true },
  { name: 'effectif', label: t('deliberations.table.columns.effectif'), field: (r) => r._count?.lignes ?? 0, align: 'center' },
  { name: 'creeLe', label: t('deliberations.table.columns.creeLe'), field: 'creeLe', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesDetail = computed<QTableColumn[]>(() => [
  { name: 'rang', label: t('deliberations.table.detailColumns.rang'), field: 'rang', align: 'center' },
  { name: 'matricule', label: t('deliberations.table.detailColumns.matricule'), field: (r) => r.inscription?.etudiant?.matricule ?? '—', align: 'left' },
  { name: 'etudiant', label: t('deliberations.table.detailColumns.etudiant'), field: (r) => `${r.inscription?.etudiant?.nom ?? ''} ${r.inscription?.etudiant?.prenom ?? ''}`.trim() || '—', align: 'left' },
  { name: 'moyenne', label: t('deliberations.table.detailColumns.moyenne'), field: 'moyenne', align: 'center' },
  { name: 'decision', label: t('deliberations.table.detailColumns.decision'), field: 'decision', align: 'center' },
  { name: 'mention', label: t('deliberations.table.detailColumns.mention'), field: (r) => r.mention ?? '—', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const detailLignes = computed<DeliberationLigne[]>(() => detail.value?.lignes ?? []);

function couleurDecision(d: string): string {
  return d === 'ADMIS' ? 'positive' : d === 'AJOURNE' ? 'warning' : 'negative';
}

function imprimerPv(d: DeliberationListe | null) {
  if (!d) return;
  void ouvrirImpression(`/deliberations/${d.id}/imprimer`);
}

function imprimerBulletin(l: DeliberationLigne) {
  if (!detail.value) return;
  void ouvrirImpression(`/deliberations/${detail.value.id}/releve/${l.inscriptionId}`);
}

/**
 * La liste ne renvoie pas les lignes : le détail est rechargé sur l'identifiant
 * pour afficher les décisions individuelles réelles.
 */
async function ouvrirDetail(d: DeliberationListe) {
  detail.value = d;
  dialogDetail.value = true;
  chargementDetail.value = true;
  try {
    const { data } = await api.get(`/deliberations/${d.id}`);
    detail.value = data;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargementDetail.value = false;
  }
}

function calculer(d: DeliberationListe) {
  $q.dialog({
    title: t('deliberations.dialogs.recalculate.title'),
    message: t('deliberations.dialogs.recalculate.message'),
    cancel: true,
    ok: { color: 'primary', label: t('deliberations.dialogs.recalculate.ok'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/deliberations/${d.id}/calculer`);
      $q.notify({ type: 'positive', message: t('deliberations.messages.recalculated') });
      await charger();
    } catch {
      /* notifié par l'intercepteur */
    }
  });
}

function valider(d: DeliberationListe) {
  $q.dialog({
    title: t('deliberations.dialogs.validate.title'),
    html: false,
    message: t('deliberations.dialogs.validate.message'),
    cancel: { flat: true, label: t('deliberations.actions.back'), noCaps: true },
    ok: { color: 'positive', label: t('deliberations.dialogs.validate.ok'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/deliberations/${d.id}/valider`);
      $q.notify({ type: 'positive', message: t('deliberations.messages.validated') });
      await charger();
    } catch {
      /* notifié par l'intercepteur */
    }
  });
}

/** Délibération → bulletins : la page Bulletins s'ouvre sur la même promotion. */
function allerBulletins(d: DeliberationListe | null) {
  void router.push({
    name: 'bulletins',
    query: d
      ? { anneeId: d.anneeId, promotionId: d.promotionId, session: d.session }
      : {},
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/deliberations', {
      params: { all: '1', anneeId: filtres.value.anneeId || undefined },
    });
    deliberations.value = data.data ?? [];
  } catch {
    deliberations.value = [];
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  charger();
}

watch(() => filtres.value.anneeId, () => {
  page.value = 1;
  charger();
});
watch(
  () => [filtres.value.promotionId, filtres.value.session, filtres.value.statut, filtres.value.recherche],
  () => {
    page.value = 1;
  },
);

onMounted(async () => {
  [annees.value, promotions.value, matieres.value] = await Promise.all([
    referentiels.annees(),
    referentiels.promotions(),
    referentiels.matieres().catch(() => []),
  ]);
  await charger();
});
</script>

<style scoped lang="scss">
</style>
