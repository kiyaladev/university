<template>
  <q-page class="q-pa-md">
    <section-navigation section="documents" />
    <en-tete-page :title="$t('attestations.title')" :subtitle="$t('attestations.subtitle')">
      <template #actions>
        <div class="col-auto">
          <q-btn
            outline
            color="secondary"
            no-caps
            icon="school"
            :label="$t('attestations.actions.bulletins')"
            @click="router.push({ name: 'bulletins' })"
          />
        </div>
        <div class="col-auto">
          <q-btn
            v-if="peutEmettre"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('attestations.actions.issue')"
            @click="ouvrirEmission()"
          />
        </div>
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('attestations.filters.searchPlaceholder')"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="optionsTypes"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('attestations.filters.type')"
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
          :label="$t('attestations.filters.promotion')"
        />
      </template>
    </barre-filtres>

    <attestations-tableau
      v-if="modeVue === 'tableau'"
      :lignes="liste.lignes"
      :colonnes="colonnes"
      :chargement="liste.chargement"
      :peut-emettre="peutEmettre"
      :peut-revoquer="peutRevoquer"
      :est-admin="auth.estAdmin"
      @detail="ouvrirDetail"
      @verifications="ouvrirVerifications"
      @imprimer="imprimer"
      @revoquer="revoquer"
      @emettre="ouvrirEmission()"
    />

    <attestations-cartes
      v-else
      :lignes="liste.lignes"
      :chargement="liste.chargement"
      :peut-revoquer="peutRevoquer"
      @detail="ouvrirDetail"
      @imprimer="imprimer"
      @revoquer="revoquer"
    />

    <barre-pagination
      v-if="liste.total"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-attestation v-model="dialogEmission" :prefill="prefillEmission" @enregistre="recharger" />

    <!-- Détail d'une attestation : QR peint sur le panneau -->
    <attestations-detail-dialog
      v-model="dialogDetail"
      :attestation="detail"
      @bulletin="allerBulletin"
      @imprimer="imprimer"
    />

    <!-- Révocation : la décision inverse de l'émission, le motif est exigé -->
    <attestations-revocation-dialog
      v-model="dialogRevocation"
      v-model:motif="motifRevocation"
      :attestation="attestationARevoquer"
      :envoi="revocationEnCours"
      @valider="confirmerRevocation"
    />

    <!-- Journal des vérifications -->
    <attestations-verifications-dialog
      v-model="dialogVerifications"
      :attestation="attestationVerifs"
      :verifications="verifications"
    />
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueAttestation from '../components/DialogueAttestation.vue';
import AttestationsTableau from '../components/AttestationsTableau.vue';
import AttestationsCartes from '../components/AttestationsCartes.vue';
import AttestationsDetailDialog from '../components/AttestationsDetailDialog.vue';
import AttestationsRevocationDialog from '../components/AttestationsRevocationDialog.vue';
import AttestationsVerificationsDialog from '../components/AttestationsVerificationsDialog.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import { LIBELLE_STATUT_ATTESTATION, LIBELLE_TYPE_ATTESTATION } from '@/shared/utils/libelles';
import type { AnneeAcademique, Attestation, Promotion, ChipFiltre, FiltresPage } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { attestationsService, type VerificationAttestation } from '../services/attestations';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const modeVue = usePresentationListe();

const filtres = ref<FiltresPage>({ recherche: '', type: null, statut: null, anneeId: null, promotionId: null });
const liste = reactive(
  useListePaginee<Attestation>({
    filtres,
    // Arrivée depuis un bulletin (`emettre=1`) : la query sert au préremplissage
    // de l'émission, pas aux filtres de la liste.
    syncUrl: route.query.emettre !== '1',
    charger: ({ filtres: f, ...p }) =>
      attestationsService.liste({
        ...pageApi(p),
        type: f.type || undefined,
        statut: f.statut || undefined,
        anneeId: f.anneeId || undefined,
        promotionId: f.promotionId || undefined,
        search: texteApi(f.recherche),
      }),
  }),
);

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);

const optionsTypes = computed(() =>
  Object.entries(LIBELLE_TYPE_ATTESTATION).map(([value, label]) => ({ value, label })),
);
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_ATTESTATION).map(([value, label]) => ({ value, label })),
);
const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);

const peutEmettre = computed(() => auth.peut('attestations.emettre'));
const peutRevoquer = computed(() => auth.peut('attestations.revoquer'));

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('attestations.filters.searchChip', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.type) {
    cs.push({
      label: t('attestations.filters.typeChip', {
        value: LIBELLE_TYPE_ATTESTATION[filtres.value.type] ?? filtres.value.type,
      }),
      value: filtres.value.type,
      icone: 'description',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('attestations.filters.statusChip', {
        value: LIBELLE_STATUT_ATTESTATION[filtres.value.statut] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'verified',
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({
      label: t('attestations.filters.yearChip', { value: a?.libelle ?? '?' }),
      value: filtres.value.anneeId,
      icone: 'calendar_today',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('attestations.filters.promotionChip', { value: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  {
    name: 'etudiant',
    label: t('common.fields.student'),
    field: (r) => `${r.etudiant?.nom ?? ''} ${r.etudiant?.prenom ?? ''}`,
    align: 'left',
  },
  { name: 'parcours', label: t('attestations.table.columns.parcours'), field: 'anneeId', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'center' },
  {
    name: 'verifications',
    label: t('attestations.table.columns.verifications'),
    field: (r) => r._count?.verifications ?? 0,
    align: 'center',
  },
  { name: 'emiseLe', label: t('common.fields.issuedOn'), field: 'emiseLe', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

// ------------------------------------------------------------------ émission
const dialogEmission = ref(false);
const prefillEmission = ref<Record<string, string> | null>(null);

function ouvrirEmission(prefill: Record<string, string> | null = null) {
  prefillEmission.value = prefill;
  dialogEmission.value = true;
}

// --------------------------------------------------------- QR du détail
const dialogDetail = ref(false);
const detail = ref<Attestation | null>(null);

function ouvrirDetail(a: Attestation) {
  detail.value = a;
  dialogDetail.value = true;
}

function imprimer(a: Attestation) {
  void ouvrirImpression(`/attestations/${a.id}/imprimer`);
}

/** Attestation → bulletin : on remonte au relevé de la même promotion. */
function allerBulletin(a: Attestation) {
  void router.push({
    name: 'bulletins',
    query: {
      ...(a.anneeId ? { anneeId: a.anneeId } : {}),
      ...(a.promotionId ? { promotionId: a.promotionId } : {}),
    },
  });
}

// -------------------------------------------------------------------- révocation
const dialogRevocation = ref(false);
const attestationARevoquer = ref<Attestation | null>(null);
const motifRevocation = ref('');
const revocationEnCours = ref(false);

function revoquer(a: Attestation) {
  attestationARevoquer.value = a;
  motifRevocation.value = '';
  dialogRevocation.value = true;
}

async function confirmerRevocation() {
  if (!attestationARevoquer.value) return;
  revocationEnCours.value = true;
  try {
    await attestationsService.revoquer(attestationARevoquer.value.id, motifRevocation.value);
    $q.notify({ type: 'warning', message: t('attestations.messages.revoked') });
    dialogRevocation.value = false;
    await recharger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    revocationEnCours.value = false;
  }
}

// ----------------------------------------------------------- journal des scans
const dialogVerifications = ref(false);
const verifications = ref<VerificationAttestation[]>([]);
const attestationVerifs = ref<Attestation | null>(null);

async function ouvrirVerifications(a: Attestation) {
  attestationVerifs.value = a;
  verifications.value = [];
  dialogVerifications.value = true;
  try {
    verifications.value = await attestationsService.verifications(a.id);
  } catch {
    verifications.value = [];
  }
}

// ------------------------------------------------------------------ chargement

/** Après une émission ou une révocation : retour en tête de liste. */
async function recharger() {
  if (liste.page === 1) await liste.recharger();
  else liste.page = 1;
}

async function chargerReferentiels() {
  [annees.value, promotions.value] = await Promise.all([referentiels.annees(), referentiels.promotions()]);
}

onMounted(async () => {
  await chargerReferentiels();

  // Chaîne : un bulletin ADMIS ouvre l'émission de l'attestation de réussite.
  if (route.query.emettre === '1') {
    ouvrirEmission({
      etudiantId: String(route.query.etudiantId ?? ''),
      type: String(route.query.type ?? 'REUSSITE'),
      anneeId: String(route.query.anneeId ?? ''),
      promotionId: String(route.query.promotionId ?? ''),
    });
  }
});
</script>
