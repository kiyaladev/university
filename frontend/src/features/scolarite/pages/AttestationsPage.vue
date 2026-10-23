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
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #no-data>
        <etat-vide icone="verified_user" :titre="$t('attestations.emptyState.title')">
          <template v-if="peutEmettre" #action>
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('attestations.actions.issue')"
              class="q-mt-sm"
              @click="ouvrirEmission()"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_ATTESTATION[p.row.type] ?? p.row.type }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="attestation" :statut="p.row.statut" />
        </q-td>
      </template>

      <template #body-cell-parcours="p">
        <q-td :props="p">
          <div>{{ p.row.annee?.libelle ?? '—' }}</div>
          <div class="text-caption text-grey-7">{{ p.row.promotion?.nom ?? '' }}</div>
        </q-td>
      </template>

      <template #body-cell-verifications="p">
        <q-td :props="p" class="text-center">
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            no-caps
            :label="String(p.row._count?.verifications ?? 0)"
            icon="qr_code_scanner"
            :aria-label="$t('attestations.actionsColumn.verificationsAria')"
            @click.stop="ouvrirVerifications(p.row)"
          >
            <q-tooltip>{{ $t('attestations.actionsColumn.verificationsTooltip') }}</q-tooltip>
          </q-btn>
          <span v-else class="chiffres">{{ p.row._count?.verifications ?? 0 }}</span>
        </q-td>
      </template>

      <template #body-cell-emiseLe="p">
        <q-td :props="p">
          <div>{{ dateLisible(p.row.emiseLe) }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.emisePar ? `${p.row.emisePar.prenom} ${p.row.emisePar.nom}` : '—' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            no-caps
            icon="qr_code_2"
            :aria-label="$t('attestations.actionsColumn.detailAria')"
            :label="$t('attestations.actionsColumn.detailAria')"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>{{ $t('attestations.actionsColumn.detailTooltip') }}</q-tooltip>
          </q-btn>
          <actions-secondaires>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="print"
              :aria-label="$t('attestations.actionsColumn.printAria')"
              :label="$t('attestations.actionsColumn.printAria')"
              @click.stop="imprimer(p.row)"
            >
              <q-tooltip>{{ $t('attestations.actionsColumn.printTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              v-if="peutRevoquer && p.row.statut === 'EMIS'"
              flat
              dense
              no-caps
              color="negative"
              icon="block"
              :aria-label="$t('attestations.actionsColumn.revokeAria')"
              :label="$t('attestations.actionsColumn.revokeAria')"
              @click.stop="revoquer(p.row)"
            >
              <q-tooltip>{{ $t('attestations.actionsColumn.revokeTooltip') }}</q-tooltip>
            </q-btn>
          </actions-secondaires>
        </q-td>
      </template>
    </q-table>

    <div v-else class="attestations-cartes">
      <q-card
        v-for="a in liste.lignes"
        :key="a.id"
        flat
        bordered
        class="carte attestations-cartes__carte"
        @click="ouvrirDetail(a)"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <PastilleStatut domaine="attestation" :statut="a.statut" />
            <q-space />
            <div class="text-caption text-grey-7">{{ a.numero }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ a.etudiant?.nom }} {{ a.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ a.etudiant?.matricule }}</div>
          <div class="q-mt-sm text-caption">
            {{ LIBELLE_TYPE_ATTESTATION[a.type] ?? a.type }} · {{ a.annee?.libelle ?? '—'
            }}{{ a.promotion?.nom ? ` · ${a.promotion.nom}` : '' }}
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{
              $t('attestations.card.issuedOn', { date: dateLisible(a.emiseLe), count: a._count?.verifications ?? 0 })
            }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            flat
            dense
            no-caps
            icon="qr_code_2"
            :label="$t('attestations.actions.qr')"
            @click.stop="ouvrirDetail(a)"
          />
          <actions-secondaires>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="print"
              :label="$t('common.actions.print')"
              @click.stop="imprimer(a)"
            />
            <q-btn
              v-close-popup
              v-if="peutRevoquer && a.statut === 'EMIS'"
              flat
              dense
              no-caps
              color="negative"
              icon="block"
              :label="$t('common.actions.revoke')"
              @click.stop="revoquer(a)"
            />
          </actions-secondaires>
        </q-card-actions>
      </q-card>
      <etat-vide
        v-if="!liste.chargement && !liste.lignes.length"
        class="plaque"
        icone="verified_user"
        :titre="$t('attestations.emptyState.title')"
      />
    </div>

    <barre-pagination
      v-if="liste.total"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-attestation v-model="dialogEmission" :prefill="prefillEmission" @enregistre="recharger" />

    <!-- Détail d'une attestation : QR peint sur le panneau -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ detail?.numero }}</div>
          <div class="page-sous-titre q-mt-xs">
            {{ detail ? (LIBELLE_TYPE_ATTESTATION[detail.type] ?? detail.type) : '' }}
            {{ $t('common.format.emptyValue') }}
            {{ detail ? (LIBELLE_STATUT_ATTESTATION[detail.statut] ?? detail.statut) : '' }}
          </div>
        </q-card-section>
        <q-card-section class="text-center">
          <canvas ref="canvasQr" style="width: 210px; height: 210px" />
          <div class="text-caption text-grey-7 q-mt-sm q-break-all">{{ urlVerification }}</div>
        </q-card-section>
        <q-card-section class="text-caption">
          <div v-if="detail">
            <div>
              <strong>{{ detail.etudiant?.nom }} {{ detail.etudiant?.prenom }}</strong>
              {{ $t('attestations.detail.matricule', { matricule: detail.etudiant?.matricule }) }}
            </div>
            <div v-if="detail.motif">{{ $t('attestations.detail.motif', { motif: detail.motif }) }}</div>
            <div>
              {{
                $t('attestations.detail.parcours', {
                  annee: detail.annee?.libelle ?? '—',
                  promotion: detail.promotion?.nom ? ` · ${detail.promotion.nom}` : '',
                })
              }}
            </div>
            <div class="q-mt-sm">
              {{
                $t('attestations.detail.issuedOnBy', {
                  date: dateLisible(detail.emiseLe),
                  who: detail.emisePar ? `${detail.emisePar.prenom} ${detail.emisePar.nom}` : '—',
                })
              }}
            </div>
            <div v-if="detail.statut === 'REVOQUE'" class="text-negative">
              {{
                $t('attestations.detail.revokedOnBy', {
                  date: dateLisible(detail.revoqueeLe),
                  motif: detail.motifRevocation,
                })
              }}
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.actions.close')" v-close-popup />
          <q-btn
            v-if="detail?.anneeId && detail?.promotionId"
            flat
            no-caps
            color="secondary"
            icon="school"
            :label="$t('attestations.detail.bulletin')"
            @click="allerBulletin(detail)"
          />
          <q-btn
            v-if="detail"
            flat
            no-caps
            color="primary"
            icon="print"
            :label="$t('common.actions.print')"
            @click="imprimer(detail)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Révocation : la décision inverse de l'émission, le motif est exigé -->
    <dialogue-formulaire
      v-model="dialogRevocation"
      taille="s"
      :titre="$t('attestations.revocation.title', { numero: attestationARevoquer?.numero })"
      :sous-titre="$t('attestations.revocation.warning')"
      :envoi="revocationEnCours"
      :desactive="motifRevocation.trim().length < 3"
      couleur-valider="negative"
      icone-valider="block"
      :libelle-valider="$t('attestations.revocation.confirm')"
      @valider="confirmerRevocation"
    >
      <q-input
        v-model="motifRevocation"
        outlined
        dense
        type="textarea"
        rows="3"
        :label="$t('attestations.revocation.motifLabel')"
        :hint="$t('attestations.revocation.motifHint')"
        autofocus
      />
    </dialogue-formulaire>

    <!-- Journal des vérifications -->
    <q-dialog v-model="dialogVerifications">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ $t('attestations.verificationsDialog.title') }}</div>
          <div class="text-caption text-grey-7">
            {{ $t('attestations.verificationsDialog.subtitle', { numero: attestationVerifs?.numero }) }}
          </div>
        </q-card-section>
        <q-card-section class="q-pa-none">
          <q-list separator dense>
            <q-item v-for="v in verifications" :key="v.id">
              <q-item-section>
                <q-item-label>
                  <q-chip
                    dense
                    :color="v.resultat ? 'secondary' : 'negative'"
                    text-color="white"
                    :label="
                      v.resultat
                        ? $t('attestations.verificationsDialog.valid')
                        : $t('attestations.verificationsDialog.failed')
                    "
                    class="q-mr-sm"
                  />
                  {{ dateHeureLisible(v.verifieeLe) }}
                </q-item-label>
                <q-item-label caption>{{
                  $t('attestations.verificationsDialog.ip', {
                    ip: v.ip ?? $t('attestations.verificationsDialog.ipUnknown'),
                  })
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!verifications.length">
              <q-item-section class="text-grey-7">{{ $t('attestations.verificationsDialog.empty') }}</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.actions.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '@/boot/axios';

import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueAttestation from '../components/DialogueAttestation.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import {
  LIBELLE_STATUT_ATTESTATION,
  LIBELLE_TYPE_ATTESTATION,
  dateHeureLisible,
  dateLisible,
} from '@/shared/utils/libelles';
import type { AnneeAcademique, Attestation, Promotion, ChipFiltre } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';

/** Ligne du journal des vérifications (types/ n'expose pas encore le modèle). */
interface VerificationAttestation {
  id: string;
  attestationId: string;
  ip?: string | null;
  resultat: boolean;
  verifieeLe: string;
}

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const modeVue = usePresentationListe();

const filtres = ref<Record<string, any>>({ recherche: '', type: null, statut: null, anneeId: null, promotionId: null });
const liste = reactive(
  useListePaginee<Attestation>({
    filtres,
    // Arrivée depuis un bulletin (`emettre=1`) : la query sert au préremplissage
    // de l'émission, pas aux filtres de la liste.
    syncUrl: route.query.emettre !== '1',
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/attestations', {
          params: {
            ...pageApi(p),
            type: f.type || undefined,
            statut: f.statut || undefined,
            anneeId: f.anneeId || undefined,
            promotionId: f.promotionId || undefined,
            search: texteApi(f.recherche),
          },
        })
        .then((r) => r.data),
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
const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');

function ouvrirDetail(a: Attestation) {
  detail.value = a;
  urlVerification.value = `${prochainUrl()}/verification?ref=${encodeURIComponent(a.numero)}&k=${encodeURIComponent(a.qrToken)}`;
  dialogDetail.value = true;
  void nextTick(() => {
    if (canvasQr.value) {
      void QRCode.toCanvas(canvasQr.value, urlVerification.value, {
        width: 210,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
  });
}

function prochainUrl(): string {
  // Origine de la SPA affichée dans le navigateur : c'est elle que le scan du
  // QR doit atteindre (l'hôte de l'API ne sert pas l'application).
  return window.location.origin + '/#';
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
    await api.post(`/attestations/${attestationARevoquer.value.id}/revoquer`, {
      motifRevocation: motifRevocation.value,
    });
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
    const { data } = await api.get(`/attestations/${a.id}/verifications`);
    verifications.value = data;
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

<style scoped lang="scss">
.attestations-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.attestations-cartes__carte {
  cursor: pointer;
}
</style>
