<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('bulletins.title')" :subtitle="$t('bulletins.subtitle')">
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
    </page-header>

    <filter-bar
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
        <semestre-select
          v-model="filtres.session"
          type="session"
          :label="$t('bulletins.filters.session')"
          clearable
        />
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
    </filter-bar>

    <!-- Aperçu d'un bulletin : on quitte la liste le temps de la lecture -->
    <div v-if="bulletinSelectionne" class="bulletins-apercu">
      <div class="row items-center q-col-gutter-sm q-mb-md">
        <div class="col-auto">
          <q-btn outline no-caps icon="arrow_back" :label="$t('bulletins.apercu.retourListe')" @click="fermerApercu" />
        </div>
        <q-space />
        <div class="col-auto">
          <q-btn
            v-if="ligneSelectionnee?.decision === 'ADMIS'"
            outline
            color="secondary"
            no-caps
            icon="verified_user"
            :label="$t('bulletins.apercu.emettreAttestation')"
            @click="allerAttestation(ligneSelectionnee)"
          />
        </div>
      </div>
      <bulletin-card :bulletin="bulletinSelectionne" :chemin-impression="cheminBulletinCourant" />
    </div>

    <template v-else>
      <!-- Guidage : sans promotion, la liste n'a pas de sens -->
      <etat-vide
        v-if="!filtres.promotionId"
        class="plaque"
        icone="school"
        :titre="$t('bulletins.guidance.choisirPromotion')"
        :aide="$t('bulletins.guidance.text')"
      >
        <template #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="gavel"
            :label="$t('bulletins.guidance.voirDeliberations')"
            @click="router.push({ name: 'deliberations' })"
          />
        </template>
      </etat-vide>

      <template v-else>
        <q-banner v-if="!bl.chargement && !aucuneDeliberation" dense class="carte q-mb-md">
          <template #avatar><q-icon name="info" color="primary" /></template>
          {{ $t('bulletins.banners.infoImprimables', { nbImprimables, total: lignesFiltrees.length }) }}
        </q-banner>

        <q-banner v-if="!bl.chargement && aucuneDeliberation" dense class="carte q-mb-md">
          <template #avatar><q-icon name="warning" color="warning" /></template>
          {{ $t('bulletins.banners.aucuneDeliberation') }}
          <template #action>
            <q-btn flat dense no-caps :label="$t('bulletins.banners.creerDeliberation')" @click="router.push({ name: 'deliberations' })" />
          </template>
        </q-banner>

        <q-table
          v-if="modeVue === 'tableau'"
          flat
          bordered
          class="carte"
          :rows="lignesPage"
          :columns="colonnes"
          row-key="inscriptionId"
          :loading="bl.chargement"
          :pagination="{ rowsPerPage: 0 }"
          @row-click="(_, row) => selectionner(row)"
        >
          <template #no-data>
            <etat-vide icone="school" :titre="$t('bulletins.table.emptyState')" />
          </template>

          <template #body-cell-moyenne="p">
            <q-td :props="p" class="text-center chiffres">
              <span :class="{ 'text-negative': p.row.moyenne !== null && p.row.moyenne < 10 }">
                {{ p.row.moyenne !== null ? p.row.moyenne.toFixed(2) : '—' }}
              </span>
            </q-td>
          </template>

          <template #body-cell-decision="p">
            <q-td :props="p" class="text-center">
              <PastilleStatut v-if="p.row.decision" domaine="decision" :statut="p.row.decision" />
              <span v-else class="text-grey-7">{{ $t('bulletins.table.nonDelibere') }}</span>
            </q-td>
          </template>

          <template #body-cell-rang="p">
            <q-td :props="p" class="text-center chiffres">{{ p.row.rang ?? '—' }}</q-td>
          </template>

          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
<q-btn
                flat
                dense no-caps
                icon="visibility"
                :aria-label="$t('bulletins.table.ariaLabels.voirBulletin')" :label="$t('bulletins.table.ariaLabels.voirBulletin')"
                @click.stop="selectionner(p.row)"
              >
                <q-tooltip>{{ $t('bulletins.table.tooltips.voirBulletin') }}</q-tooltip>
              </q-btn>
<actions-secondaires>
<q-btn v-close-popup
                flat
                dense no-caps
                icon="picture_as_pdf"
                :color="p.row.deliberationId ? 'primary' : 'grey-5'"
                :disable="!p.row.deliberationId"
                :aria-label="$t('bulletins.table.ariaLabels.imprimerBulletin')" :label="$t('bulletins.table.ariaLabels.imprimerBulletin')"
                @click.stop="imprimerUn(p.row)"
              >
                <q-tooltip>
                  {{ p.row.deliberationId ? $t('bulletins.table.tooltips.imprimerOfficiel') : $t('bulletins.table.tooltips.aucuneDeliberationEtudiant') }}
                </q-tooltip>
              </q-btn>
<q-btn v-close-popup
                v-if="p.row.decision === 'ADMIS'"
                flat
                dense no-caps
                icon="verified_user"
                color="secondary"
                :aria-label="$t('bulletins.table.ariaLabels.emettreAttestation')" :label="$t('bulletins.table.ariaLabels.emettreAttestation')"
                @click.stop="allerAttestation(p.row)"
              >
                <q-tooltip>{{ $t('bulletins.table.tooltips.emettreAttestation') }}</q-tooltip>
              </q-btn>
</actions-secondaires>
</q-td>
          </template>
        </q-table>

        <div v-else class="bulletins-cartes">
          <q-card
            v-for="l in lignesPage"
            :key="l.inscriptionId"
            flat
            bordered
            class="carte bulletins-cartes__carte"
            @click="selectionner(l)"
          >
            <q-card-section>
              <div class="row items-center q-mb-xs">
                <PastilleStatut v-if="l.decision" domaine="decision" :statut="l.decision" />
                <q-badge v-else color="grey-6" :label="$t('bulletins.table.nonDelibere')" />
                <q-space />
                <div class="text-caption text-grey-7">{{ l.matricule }}</div>
              </div>
              <div class="text-subtitle1 text-weight-medium">{{ l.nom }} {{ l.prenom }}</div>
              <div class="row items-baseline q-gutter-md q-mt-sm">
                <div class="chiffres text-h6">
                  {{ l.moyenne !== null ? l.moyenne.toFixed(2) : '—' }}<span class="text-caption">{{ $t('common.units.outOf20') }}</span>
                </div>
                <div class="text-caption text-grey-7">
                  {{ $t('bulletins.cards.rang', { rang: l.rang ?? '—' }) }}{{ l.mention ? ` · ${l.mention}` : '' }}
                </div>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right">
<q-btn flat dense no-caps icon="visibility" :label="$t('bulletins.cards.bulletin')" @click.stop="selectionner(l)" />
<actions-secondaires>
<q-btn v-close-popup
                flat
                dense
                no-caps
                icon="picture_as_pdf"
                :label="$t('common.actions.print')"
                :disable="!l.deliberationId"
                @click.stop="imprimerUn(l)"
              />
<q-btn v-close-popup
                v-if="l.decision === 'ADMIS'"
                flat
                dense
                no-caps
                color="secondary"
                icon="verified_user"
                :label="$t('bulletins.cards.attestation')"
                @click.stop="allerAttestation(l)"
              />
</actions-secondaires>
</q-card-actions>
          </q-card>
          <etat-vide v-if="!lignesPage.length" class="plaque" icone="school" :titre="$t('bulletins.table.emptyState')" />
        </div>

        <pagination-bar
          v-if="lignesFiltrees.length"
          :page="page"
          :page-size="pageSize"
          :total="lignesFiltrees.length"
          :show-all="false"
          @update:page="(v) => (page = v)"
          @update:page-size="(v) => { pageSize = v; page = 1; }"
        />
      </template>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import EtatVide from '../components/EtatVide.vue';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import BulletinCard from '../components/BulletinCard.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import SemestreSelect from '../components/SemestreSelect.vue';
import { ouvrirImpression, ouvrirImpressions } from '../services/impression';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
} from '../utils/libelles';
import type {
  AnneeAcademique,
  Deliberation,
  DeliberationLigne,
  Inscription,
  Promotion,
  SessionDeliberation, ChipFiltre } from '../types';

/** Une ligne du listing : l'inscrit, enrichi de sa décision de jury s'il en a une. */
interface LigneBulletin {
  inscriptionId: string;
  etudiantId: string | null;
  matricule: string;
  nom: string;
  prenom: string;
  moyenne: number | null;
  decision: string | null;
  mention: string | null;
  rang: number | null;
  deliberationId: string | null;
}

interface BulletinView {
  etudiant: { matricule: string; nom: string; prenom: string };
  promotion: string;
  annee: string;
  session: string;
  dateDeliberation?: string;
  lignes: Array<{ matiere: string; code?: string; credits: number; moyenne: number; decision?: string }>;
  moyenneGenerale: number;
  decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT' | null;
  mention?: string;
  rang?: number;
  effectif?: number;
}

const $q = useQuasar();
const router = useRouter();
const auth = useAuthStore();
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
const filtres = ref<Record<string, any>>({ ...FILTRES_VIDES });
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
const bulletinSelectionne = ref<BulletinView | null>(null);
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
    cs.push({ label: t('bulletins.chips.search', { value: filtres.value.recherche }), value: filtres.value.recherche, icone: 'search', defaut: true });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: t('bulletins.chips.annee', { value: a?.libelle ?? '?' }), value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: t('bulletins.chips.promo', { value: p?.nom ?? '?' }), value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.session) {
    cs.push({
      label: t('bulletins.chips.session', { value: LIBELLE_SESSION_DELIBERATION[filtres.value.session] ?? filtres.value.session }),
      value: filtres.value.session,
      icone: 'flag',
    });
  }
  if (filtres.value.decision) {
    cs.push({
      label: t('bulletins.chips.decision', { value: LIBELLE_DECISION_JURY[filtres.value.decision] ?? filtres.value.decision }),
      value: filtres.value.decision,
      icone: 'gavel',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('common.fields.studentId'), field: 'matricule', align: 'left', sortable: true },
  { name: 'etudiant', label: t('common.fields.student'), field: (r) => `${r.nom} ${r.prenom}`, align: 'left', sortable: true },
  { name: 'moyenne', label: t('bulletins.table.columns.moyenne'), field: 'moyenne', align: 'center', sortable: true },
  { name: 'decision', label: t('common.fields.decision'), field: 'decision', align: 'center' },
  { name: 'mention', label: t('bulletins.table.columns.mention'), field: (r) => r.mention ?? '—', align: 'left' },
  { name: 'rang', label: t('bulletins.table.columns.rang'), field: 'rang', align: 'center', sortable: true },
  { name: 'actions', label: '', field: 'inscriptionId', align: 'right' },
]);

/** Recherche texte + décision : filtrés ici, la source ne sait pas le faire. */
const lignesFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
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

  const { data } = await api.get('/deliberations', {
    params: { all: '1', anneeId: filtres.value.anneeId || undefined },
  });
  const candidates: Deliberation[] = (data.data ?? []).filter((d: Deliberation) => {
    if (filtres.value.promotionId && d.promotionId !== filtres.value.promotionId) return false;
    if (filtres.value.session && d.session !== filtres.value.session) return false;
    return true;
  });

  const details = await Promise.all(
    candidates.slice(0, 20).map((d) =>
      api
        .get(`/deliberations/${d.id}`)
        .then((r) => r.data as Deliberation)
        .catch(() => ({ ...d, lignes: [] as DeliberationLigne[] })),
    ),
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

    const params: Record<string, any> = { all: '1', pageSize: 500, promotionId: filtres.value.promotionId };
    if (filtres.value.anneeId) params.anneeId = filtres.value.anneeId;
    const { data } = await api.get('/inscriptions', { params });
    const inscriptions: Inscription[] = data.data ?? [];

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
      : (filtres.value.session
          ? LIBELLE_SESSION_DELIBERATION[filtres.value.session as SessionDeliberation]
          : LIBELLE_SESSION_DELIBERATION.NORMALE),
    dateDeliberation: deliberation?.valideeLe ?? deliberation?.creeLe,
    lignes: [],
    moyenneGenerale: row.moyenne ?? 0,
    decision: (row.decision as BulletinView['decision']) ?? null,
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
  void ouvrirImpressions(
    imprimables.map((l) => `/deliberations/${l.deliberationId}/releve/${l.inscriptionId}`),
  );
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
watch(
  () => [filtres.value.anneeId, filtres.value.promotionId, filtres.value.session],
  fermerApercu,
);
// Nouvelle liste ou nouveau filtre local : retour à la première page.
watch(
  () => [bl.lignes, filtres.value.recherche, filtres.value.decision],
  () => {
    page.value = 1;
  },
);

onMounted(async () => {
  [annees.value, promotions.value] = await Promise.all([
    referentiels.annees(),
    referentiels.promotions(),
  ]);
});
</script>

<style scoped lang="scss">
.bulletins-apercu {
  max-width: 900px;
  margin: 0 auto;
}
.bulletins-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.bulletins-cartes__carte {
  cursor: pointer;
}
</style>
