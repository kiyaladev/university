<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('deliberations.title')" :subtitle="$t('deliberations.subtitle')">
      <template v-if="peutSaisir || peutVoirBulletins" #actions>
        <q-btn
          v-if="peutSaisir"
          unelevated
          color="primary"
          no-caps
          icon="gavel"
          :label="$t('deliberations.actions.newDeliberation')"
          @click="dialogOuvert = true"
        />
        <q-btn
          v-if="peutVoirBulletins"
          outline
          color="secondary"
          no-caps
          icon="school"
          :label="$t('deliberations.actions.reportCards')"
          @click="allerBulletins(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
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
          :label="$t('common.fields.academicYear')"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.promotion')"
        />
        <choix-semestre
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
          :label="$t('common.fields.status')"
        />
      </template>
    </barre-filtres>

    <deliberations-tableau
      :lignes="deliberationsPage"
      :colonnes="colonnes"
      :chargement="delib.chargement"
      :peut-saisir="peutSaisir"
      :est-jury="estJury"
      :peut-voir-bulletins="peutVoirBulletins"
      @detail="ouvrirDetail"
      @calculer="calculer"
      @valider="valider"
      @bulletins="allerBulletins"
      @imprimer-pv="imprimerPv"
      @creer="dialogOuvert = true"
    />

    <barre-pagination
      v-if="totalFiltre"
      :page="page"
      :page-size="pageSize"
      :total="totalFiltre"
      :show-all="false"
      @update:page="(v) => (page = v)"
      @update:page-size="
        (v) => {
          pageSize = v;
          page = 1;
        }
      "
    />

    <dialogue-deliberation
      v-model="dialogOuvert"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="delib.recharger()"
    />

    <!-- Détail des lignes : les décisions individuelles du jury -->
    <deliberations-detail-dialog
      v-model="dialogDetail"
      :detail="detail"
      :colonnes="colonnesDetail"
      :chargement-detail="chargementDetail"
      :peut-voir-bulletins="peutVoirBulletins"
      @bulletins="allerBulletins"
      @imprimer-pv="imprimerPv"
      @imprimer-bulletin="imprimerBulletin"
    />
  </q-page>
</template>

<script setup lang="ts">
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueDeliberation from '../components/DialogueDeliberation.vue';
import DeliberationsTableau from '../components/DeliberationsTableau.vue';
import DeliberationsDetailDialog from '../components/DeliberationsDetailDialog.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChoixSemestre from '../components/ChoixSemestre.vue';
import { LIBELLE_SESSION_DELIBERATION, LIBELLE_STATUT_DELIBERATION } from '@/shared/utils/libelles';
import type { AnneeAcademique, DeliberationLigne, Matiere, Promotion, ChipFiltre } from '@/types';
import type { DeliberationListe } from '@/features/scolarite/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { deliberationsService } from '../services/deliberations';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const peutVoirBulletins = computed(() => auth.peut('bulletins.voir'));
const router = useRouter();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const peutSaisir = computed(() => auth.peut('deliberations.saisir'));
/** Le jury : direction et administrateur figent les résultats. */
const estJury = computed(() => auth.peut('deliberations.juger'));

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);

/** Pagination locale : l'API rend tout (`all=1`), on découpe ici. */
const page = ref(1);
const pageSize = ref(15);

const FILTRES_VIDES = { recherche: '', anneeId: null, promotionId: null, session: null, statut: null };
const filtres = ref<Record<string, any>>({ ...FILTRES_VIDES });

/**
 * `/deliberations` ne filtre que sur l'année : promotion, session, statut et
 * recherche sont appliqués ici, sur la liste complète déjà chargée (`all=1`).
 */
const delib = reactive(
  useListePaginee<DeliberationListe>({
    filtres,
    pageSize: 0,
    syncUrl: true,
    clesLocales: ['recherche', 'promotionId', 'session', 'statut'],
    charger: ({ filtres: f }) => deliberationsService.liste({ all: '1', anneeId: f.anneeId || undefined }),
  }),
);

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
  { label: LIBELLE_STATUT_DELIBERATION.VALIDE, value: 'VALIDE' },
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
    cs.push({
      label: t('deliberations.chips.annee', { value: a?.libelle ?? '?' }),
      value: filtres.value.anneeId,
      icone: 'calendar_today',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('deliberations.chips.promo', { value: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  if (filtres.value.session) {
    cs.push({
      label: t('deliberations.chips.session', {
        value: LIBELLE_SESSION_DELIBERATION[filtres.value.session] ?? filtres.value.session,
      }),
      value: filtres.value.session,
      icone: 'flag',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('deliberations.chips.statut', {
        value: LIBELLE_STATUT_DELIBERATION[filtres.value.statut] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'verified',
    });
  }
  return cs;
});

const deliberationsFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '')
    .toLowerCase()
    .trim();
  return delib.lignes.filter((d) => {
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
  {
    name: 'promotion',
    label: t('deliberations.table.columns.promotion'),
    field: (r) => r.promotion?.nom ?? '—',
    align: 'left',
    sortable: true,
  },
  { name: 'annee', label: t('common.fields.year'), field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'session', label: t('deliberations.table.columns.session'), field: 'session', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'taux',
    label: t('deliberations.table.columns.taux'),
    field: 'tauxReussite',
    align: 'center',
    sortable: true,
  },
  { name: 'effectif', label: t('common.fields.students'), field: (r) => r._count?.lignes ?? 0, align: 'center' },
  { name: 'creeLe', label: t('common.fields.createdOn'), field: 'creeLe', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesDetail = computed<QTableColumn[]>(() => [
  { name: 'rang', label: t('deliberations.table.detailColumns.rang'), field: 'rang', align: 'center' },
  {
    name: 'matricule',
    label: t('common.fields.studentId'),
    field: (r) => r.inscription?.etudiant?.matricule ?? '—',
    align: 'left',
  },
  {
    name: 'etudiant',
    label: t('common.fields.student'),
    field: (r) => `${r.inscription?.etudiant?.nom ?? ''} ${r.inscription?.etudiant?.prenom ?? ''}`.trim() || '—',
    align: 'left',
  },
  { name: 'moyenne', label: t('deliberations.table.detailColumns.moyenne'), field: 'moyenne', align: 'center' },
  { name: 'decision', label: t('common.fields.decision'), field: 'decision', align: 'center' },
  {
    name: 'mention',
    label: t('deliberations.table.detailColumns.mention'),
    field: (r) => r.mention ?? '—',
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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
    detail.value = await deliberationsService.lire(d.id);
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargementDetail.value = false;
  }
}

/** Confirme, appelle l'action du jury puis recharge la liste. */
async function agir(
  d: DeliberationListe,
  action: 'calculer' | 'valider',
  cle: 'recalculate' | 'validate',
  succes: string,
) {
  const ok = await confirmer({
    titre: t(`deliberations.dialogs.${cle}.title`),
    message: t(`deliberations.dialogs.${cle}.message`),
    ok: t(`deliberations.dialogs.${cle}.ok`),
    couleur: cle === 'validate' ? 'positive' : 'primary',
  });
  if (!ok) return;
  try {
    await deliberationsService.action(d.id, action);
  } catch {
    return; /* notifié par l'intercepteur */
  }
  $q.notify({ type: 'positive', message: succes });
  await delib.recharger();
}

function calculer(d: DeliberationListe) {
  void agir(d, 'calculer', 'recalculate', t('deliberations.messages.recalculated'));
}

function valider(d: DeliberationListe) {
  void agir(d, 'valider', 'validate', t('deliberations.messages.validated'));
}

/** Délibération → bulletins : la page Bulletins s'ouvre sur la même promotion. */
function allerBulletins(d: DeliberationListe | null) {
  void router.push({
    name: 'bulletins',
    query: d ? { anneeId: d.anneeId, promotionId: d.promotionId, session: d.session } : {},
  });
}

function reinitialiser() {
  filtres.value = { ...FILTRES_VIDES };
}

// Tout changement de filtre ramène à la première page locale.
watch(
  () => [
    filtres.value.anneeId,
    filtres.value.promotionId,
    filtres.value.session,
    filtres.value.statut,
    filtres.value.recherche,
  ],
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
});
</script>
