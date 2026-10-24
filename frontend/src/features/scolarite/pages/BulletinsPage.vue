<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('bulletins.title')" :subtitle="$t('bulletins.subtitle')">
      <template #actions>
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="gavel"
          :label="$t('bulletins.actions.deliberations')"
          @click="router.push({ name: 'deliberations' })"
        />
        <q-btn
          v-if="nbImprimables"
          unelevated
          color="primary"
          no-caps
          icon="print"
          :label="$t('bulletins.actions.imprimerTous', { n: nbImprimables })"
          @click="imprimerTous"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('bulletins.filters.search')"
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
          :label="$t('bulletins.filters.promotion')"
        />
        <choix-semestre v-model="filtres.session" type="session" :label="$t('bulletins.filters.session')" clearable />
        <q-select
          v-model="filtres.decision"
          :options="optionsDecisions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('bulletins.filters.decision')"
        />
      </template>
    </barre-filtres>

    <!-- Aperçu d'un bulletin : on quitte la liste le temps de la lecture -->
    <bulletins-apercu
      v-if="bulletinSelectionne"
      :bulletin="bulletinSelectionne"
      :ligne="ligneSelectionnee"
      :chemin-impression="cheminBulletinCourant"
      @fermer="fermerApercu"
      @aller-attestation="allerAttestation"
    />

    <template v-else>
      <bulletins-fiches-panel
        :sans-promotion="!filtres.promotionId"
        :aucune-deliberation="aucuneDeliberation"
        :nb-imprimables="nbImprimables"
        :total="lignesFiltrees.length"
        :chargement="bl.chargement"
        @voir-deliberations="router.push({ name: 'deliberations' })"
      />

      <template v-if="filtres.promotionId">
        <bulletins-tableau
          v-if="modeVue === 'tableau'"
          :lignes="lignesPage"
          :colonnes="colonnes"
          :chargement="bl.chargement"
          @selectionner="selectionner"
          @imprimer="imprimerUn"
          @aller-attestation="allerAttestation"
        />

        <bulletins-cartes
          v-else
          :lignes="lignesPage"
          @selectionner="selectionner"
          @imprimer="imprimerUn"
          @aller-attestation="allerAttestation"
        />

        <barre-pagination
          v-if="lignesFiltrees.length"
          :page="page"
          :page-size="pageSize"
          :total="lignesFiltrees.length"
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
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { useReferentielsStore } from '@/stores/referentiels';
import BulletinsApercu from '../components/BulletinsApercu.vue';
import BulletinsCartes from '../components/BulletinsCartes.vue';
import BulletinsFichesPanel from '../components/BulletinsFichesPanel.vue';
import BulletinsTableau from '../components/BulletinsTableau.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChoixSemestre from '../components/ChoixSemestre.vue';
import { ouvrirImpression, ouvrirImpressions } from '@/shared/services/impression';
import { LIBELLE_DECISION_JURY, LIBELLE_SESSION_DELIBERATION } from '@/shared/utils/libelles';
import type { ParametresListe } from '@/shared/services/http';
import type {
  AnneeAcademique,
  Deliberation,
  DeliberationLigne,
  Inscription,
  Promotion,
  SessionDeliberation,
  ChipFiltre,
  FiltresPage,
} from '@/types';
import type { Bulletin, LigneBulletin } from '@/features/scolarite/types';
import { deliberationsService } from '../services/deliberations';
import { inscriptionsService } from '../services/inscriptions';

const $q = useQuasar();
const router = useRouter();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
/** Délibérations du filtre, rechargées en détail pour disposer de leurs lignes. */
const deliberations = ref<Deliberation[]>([]);

/**
 * `anneeId`, `promotionId` et `session` arrivent aussi de la délibération
 * d'origine (`/bulletins?promotionId=…`) : ce sont les mêmes clés d'URL.
 */
const FILTRES_VIDES = { recherche: '', anneeId: null, promotionId: null, session: null, decision: null };
const filtres = ref<FiltresPage>({ ...FILTRES_VIDES });
const modeVue = usePresentationListe();
/** Pagination locale : la liste de la promotion arrive entière. */
const page = ref(1);
const pageSize = ref(20);

const bl = reactive(
  useListePaginee<LigneBulletin>({
    filtres,
    pageSize: 0,
    syncUrl: true,
    clesLocales: ['recherche', 'decision'],
    charger: () => chargerLignes().then((data) => ({ data })),
  }),
);
const lignes = computed(() => bl.lignes);
const bulletinSelectionne = ref<Bulletin | null>(null);
const ligneSelectionnee = ref<LigneBulletin | null>(null);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsDecisions = Object.entries(LIBELLE_DECISION_JURY).map(([value, label]) => ({ value, label }));

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('bulletins.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({
      label: t('bulletins.chips.annee', { value: a?.libelle ?? '?' }),
      value: filtres.value.anneeId,
      icone: 'calendar_today',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('bulletins.chips.promo', { value: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  if (filtres.value.session) {
    cs.push({
      label: t('bulletins.chips.session', {
        value: LIBELLE_SESSION_DELIBERATION[filtres.value.session] ?? filtres.value.session,
      }),
      value: filtres.value.session,
      icone: 'flag',
    });
  }
  if (filtres.value.decision) {
    cs.push({
      label: t('bulletins.chips.decision', {
        value: LIBELLE_DECISION_JURY[filtres.value.decision] ?? filtres.value.decision,
      }),
      value: filtres.value.decision,
      icone: 'gavel',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('common.fields.studentId'), field: 'matricule', align: 'left', sortable: true },
  {
    name: 'etudiant',
    label: t('common.fields.student'),
    field: (r) => `${r.nom} ${r.prenom}`,
    align: 'left',
    sortable: true,
  },
  { name: 'moyenne', label: t('bulletins.table.columns.moyenne'), field: 'moyenne', align: 'center', sortable: true },
  { name: 'decision', label: t('common.fields.decision'), field: 'decision', align: 'center' },
  { name: 'mention', label: t('bulletins.table.columns.mention'), field: (r) => r.mention ?? '—', align: 'left' },
  { name: 'rang', label: t('bulletins.table.columns.rang'), field: 'rang', align: 'center', sortable: true },
  { name: 'actions', label: '', field: 'inscriptionId', align: 'right' },
]);

/** Recherche texte + décision : filtrés ici, la source ne sait pas le faire. */
const lignesFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '')
    .toLowerCase()
    .trim();
  return lignes.value.filter((l) => {
    if (filtres.value.decision && l.decision !== filtres.value.decision) return false;
    if (!q) return true;
    return `${l.nom} ${l.prenom} ${l.matricule}`.toLowerCase().includes(q);
  });
});

const lignesPage = computed(() =>
  lignesFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

const nbImprimables = computed(() => lignesFiltrees.value.filter((l) => l.deliberationId).length);
const aucuneDeliberation = computed(() => deliberations.value.length === 0);

const cheminBulletinCourant = computed(() => {
  const l = ligneSelectionnee.value;
  if (!l?.deliberationId) return undefined;
  return `/deliberations/${l.deliberationId}/releve/${l.inscriptionId}`;
});

/**
 * Le listing des délibérations ne porte pas ses lignes : chaque délibération
 * retenue est donc rechargée en détail, sinon aucun bulletin ne serait édité.
 */
async function chargerDeliberations() {
  deliberations.value = [];
  if (!filtres.value.anneeId && !filtres.value.promotionId) return;

  const page = await deliberationsService.liste({ all: '1', anneeId: filtres.value.anneeId || undefined });
  const candidates: Deliberation[] = (page.data ?? []).filter((d: Deliberation) => {
    if (filtres.value.promotionId && d.promotionId !== filtres.value.promotionId) return false;
    if (filtres.value.session && d.session !== filtres.value.session) return false;
    return true;
  });

  const details = await Promise.all(
    candidates
      .slice(0, 20)
      .map((d) => deliberationsService.lire(d.id).catch(() => ({ ...d, lignes: [] as DeliberationLigne[] }))),
  );
  deliberations.value = details;
}

/** Inscrits de la promotion, croisés avec les décisions de jury. */
async function chargerLignes(): Promise<LigneBulletin[]> {
  if (!filtres.value.promotionId) {
    deliberations.value = [];
    return [];
  }
  try {
    await chargerDeliberations();

    const params: ParametresListe = { all: '1', pageSize: 500, promotionId: filtres.value.promotionId };
    if (filtres.value.anneeId) params.anneeId = filtres.value.anneeId;
    const inscriptions: Inscription[] = await inscriptionsService.tous(params);

    // La session la plus récente prime : le rattrapage écrase la session normale.
    const parInscription = new Map<string, { deliberationId: string; ligne: DeliberationLigne }>();
    for (const d of deliberations.value) {
      for (const l of d.lignes ?? []) {
        parInscription.set(l.inscriptionId, { deliberationId: d.id, ligne: l });
      }
    }

    return inscriptions.map((ins) => {
      const res = parInscription.get(ins.id);
      const etu = ins.etudiant;
      return {
        inscriptionId: ins.id,
        etudiantId: etu?.id ?? null,
        matricule: etu?.matricule ?? '—',
        nom: etu?.nom ?? '',
        prenom: etu?.prenom ?? '',
        moyenne: res?.ligne.moyenne ?? null,
        decision: res?.ligne.decision ?? null,
        mention: res?.ligne.mention ?? null,
        rang: res?.ligne.rang ?? null,
        deliberationId: res?.deliberationId ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Aperçu à l'écran : le détail par UE n'existe que dans le document officiel
 * (route d'impression). On n'affiche donc ici que ce que l'on sait vrai.
 */
function selectionner(row: LigneBulletin) {
  const deliberation = deliberations.value.find((d) => d.id === row.deliberationId) ?? null;
  const promo = promotions.value.find((p) => p.id === filtres.value.promotionId);
  const annee = annees.value.find((a) => a.id === filtres.value.anneeId);

  ligneSelectionnee.value = row;
  bulletinSelectionne.value = {
    etudiant: { matricule: row.matricule, nom: row.nom, prenom: row.prenom },
    promotion: promo?.nom ?? '—',
    annee: annee?.libelle ?? '—',
    session: deliberation
      ? (LIBELLE_SESSION_DELIBERATION[deliberation.session] ?? deliberation.session)
      : filtres.value.session
        ? LIBELLE_SESSION_DELIBERATION[filtres.value.session as SessionDeliberation]
        : LIBELLE_SESSION_DELIBERATION.NORMALE,
    dateDeliberation: deliberation?.valideeLe ?? deliberation?.creeLe,
    lignes: [],
    moyenneGenerale: row.moyenne ?? 0,
    decision: (row.decision as Bulletin['decision']) ?? null,
    mention: row.mention ?? undefined,
    rang: row.rang ?? undefined,
    effectif: deliberation?.lignes?.length ?? 0,
  };
}

function fermerApercu() {
  bulletinSelectionne.value = null;
  ligneSelectionnee.value = null;
}

function imprimerUn(row: LigneBulletin) {
  if (!row.deliberationId) {
    $q.notify({ type: 'warning', message: t('bulletins.messages.aucuneDeliberationEtudiant') });
    return;
  }
  void ouvrirImpression(`/deliberations/${row.deliberationId}/releve/${row.inscriptionId}`);
}

async function imprimerTous() {
  const imprimables = lignesFiltrees.value.filter((l) => l.deliberationId);
  if (!imprimables.length) {
    $q.notify({ type: 'warning', message: t('bulletins.messages.aucunBulletinDisponible') });
    return;
  }
  const ok = await confirmer({
    titre: t('bulletins.dialogs.imprimerPromotion.title'),
    message: t('bulletins.dialogs.imprimerPromotion.message', { n: imprimables.length }),
    ok: t('bulletins.dialogs.imprimerPromotion.ok'),
  });
  if (!ok) return;
  void ouvrirImpressions(imprimables.map((l) => `/deliberations/${l.deliberationId}/releve/${l.inscriptionId}`));
}

/** Bulletin → attestation : la page Attestations ouvre l'émission préremplie. */
function allerAttestation(l: LigneBulletin | null) {
  if (!l?.etudiantId) {
    $q.notify({ type: 'warning', message: t('bulletins.messages.etudiantNonIdentifie') });
    return;
  }
  void router.push({
    name: 'attestations',
    query: {
      emettre: '1',
      etudiantId: l.etudiantId,
      type: 'REUSSITE',
      ...(filtres.value.anneeId ? { anneeId: filtres.value.anneeId } : {}),
      ...(filtres.value.promotionId ? { promotionId: filtres.value.promotionId } : {}),
    },
  });
}

function reinitialiser() {
  filtres.value = { ...FILTRES_VIDES };
}

// Changer de promotion, d'année ou de session ferme l'aperçu en cours.
watch(() => [filtres.value.anneeId, filtres.value.promotionId, filtres.value.session], fermerApercu);
// Nouvelle liste ou nouveau filtre local : retour à la première page.
watch(
  () => [bl.lignes, filtres.value.recherche, filtres.value.decision],
  () => {
    page.value = 1;
  },
);

onMounted(async () => {
  [annees.value, promotions.value] = await Promise.all([referentiels.annees(), referentiels.promotions()]);
});
</script>
