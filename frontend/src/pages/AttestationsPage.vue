<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Attestations</div>
        <div class="page-sous-titre">
          Documents officiels vérifiables par QR code — tout scan public est
          journalisé, rien ne s'efface, tout se révoque.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="school"
          label="Bulletins"
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
          label="Émettre une attestation"
          @click="ouvrirEmission()"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (numéro, nom, matricule)…"
      @reinitialiser="reinitialiser"
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
          label="Type de document"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Année académique"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Promotion"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="attestations"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="attestations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="verified_user" size="32px" color="grey-5" />
          <div class="q-mt-sm">Aucune attestation pour ces critères.</div>
          <q-btn
            v-if="peutEmettre"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Émettre une attestation"
            class="q-mt-sm"
            @click="ouvrirEmission()"
          />
        </div>
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
          <q-chip :color="p.row.statut === 'EMISE' ? 'secondary' : 'negative'" text-color="white" dense>
            {{ LIBELLE_STATUT_ATTESTATION[p.row.statut] ?? p.row.statut }}
          </q-chip>
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
            aria-label="Journal des vérifications de ce document"
            @click.stop="ouvrirVerifications(p.row)"
          >
            <q-tooltip>Journal des vérifications de ce document</q-tooltip>
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
            round
            icon="qr_code_2"
            aria-label="Voir le détail et le QR du document"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>Détail et QR du document</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            aria-label="Imprimer le document"
            @click.stop="imprimer(p.row)"
          >
            <q-tooltip>Imprimer le document A4</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutRevoquer && p.row.statut === 'EMISE'"
            flat
            dense
            round
            color="negative"
            icon="block"
            aria-label="Révoquer le document"
            @click.stop="revoquer(p.row)"
          >
            <q-tooltip>Révoquer le document</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="attestations-cartes">
      <q-card
        v-for="a in attestations"
        :key="a.id"
        flat
        bordered
        class="carte attestations-cartes__carte"
        @click="ouvrirDetail(a)"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip :color="a.statut === 'EMISE' ? 'secondary' : 'negative'" text-color="white" dense>
              {{ LIBELLE_STATUT_ATTESTATION[a.statut] ?? a.statut }}
            </q-chip>
            <q-space />
            <div class="text-caption text-grey-7">{{ a.numero }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ a.etudiant?.nom }} {{ a.etudiant?.prenom }}
          </div>
          <div class="text-caption text-grey-7">{{ a.etudiant?.matricule }}</div>
          <div class="q-mt-sm text-caption">
            {{ LIBELLE_TYPE_ATTESTATION[a.type] ?? a.type }} ·
            {{ a.annee?.libelle ?? '—' }}{{ a.promotion?.nom ? ` · ${a.promotion.nom}` : '' }}
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            Émise le {{ dateLisible(a.emiseLe) }} · {{ a._count?.verifications ?? 0 }} vérification(s)
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat dense no-caps icon="qr_code_2" label="QR" @click.stop="ouvrirDetail(a)" />
          <q-btn flat dense no-caps icon="print" label="Imprimer" @click.stop="imprimer(a)" />
          <q-btn
            v-if="peutRevoquer && a.statut === 'EMISE'"
            flat
            dense
            no-caps
            color="negative"
            icon="block"
            label="Révoquer"
            @click.stop="revoquer(a)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!attestations.length" class="etat-vide plaque">
        <q-icon name="verified_user" size="32px" color="grey-5" />
        <div class="q-mt-sm">Aucune attestation pour ces critères.</div>
      </div>
    </div>

    <pagination-bar
      v-if="total"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <attestation-dialog
      v-model="dialogEmission"
      :prefill="prefillEmission"
      @enregistre="recharger"
    />

    <!-- Détail d'une attestation : QR peint sur le panneau -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ detail?.numero }}</div>
          <div class="page-sous-titre q-mt-xs">
            {{ detail ? LIBELLE_TYPE_ATTESTATION[detail.type] ?? detail.type : '' }} —
            {{ detail ? LIBELLE_STATUT_ATTESTATION[detail.statut] ?? detail.statut : '' }}
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
              — matricule {{ detail.etudiant?.matricule }}
            </div>
            <div v-if="detail.motif">Motif : {{ detail.motif }}</div>
            <div>
              Parcours : {{ detail.annee?.libelle ?? '—' }}
              {{ detail.promotion?.nom ? ` · ${detail.promotion.nom}` : '' }}
            </div>
            <div class="q-mt-sm">
              Émise le {{ dateLisible(detail.emiseLe) }} par
              {{ detail.emisePar ? `${detail.emisePar.prenom} ${detail.emisePar.nom}` : '—' }}
            </div>
            <div v-if="detail.statut === 'REVOQUEE'" class="text-negative">
              Révoquée le {{ dateLisible(detail.revoqueeLe) }} — {{ detail.motifRevocation }}
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
          <q-btn
            v-if="detail?.anneeId && detail?.promotionId"
            flat
            no-caps
            color="secondary"
            icon="school"
            label="Bulletin"
            @click="allerBulletin(detail)"
          />
          <q-btn
            v-if="detail"
            flat
            no-caps
            color="primary"
            icon="print"
            label="Imprimer"
            @click="imprimer(detail)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Révocation : la décision inverse de l'émission, le motif est exigé -->
    <q-dialog v-model="dialogRevocation">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Révoquer {{ attestationARevoquer?.numero }}</div>
          <div class="text-caption text-grey-7">
            Le QR cessera de garantir le document : l'authenticité de la
            révocation est elle-même vérifiable en ligne. L'opération est définitive.
          </div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="motifRevocation"
            outlined
            dense
            type="textarea"
            rows="3"
            label="Motif de révocation *"
            hint="Trois caractères minimum — ce motif est affiché lors des vérifications publiques"
            autofocus
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="negative"
            unelevated
            no-caps
            icon="block"
            label="Révoquer définitivement"
            :disable="motifRevocation.trim().length < 3"
            :loading="revocationEnCours"
            @click="confirmerRevocation"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Journal des vérifications -->
    <q-dialog v-model="dialogVerifications">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Journal des vérifications</div>
          <div class="text-caption text-grey-7">
            {{ attestationVerifs?.numero }} — chaque scan du QR, partout dans le monde, laisse une trace.
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
                    :label="v.resultat ? 'valide' : 'échec'"
                    class="q-mr-sm"
                  />
                  {{ dateHeureLisible(v.verifieeLe) }}
                </q-item-label>
                <q-item-label caption>IP : {{ v.ip ?? 'inconnue' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="!verifications.length">
              <q-item-section class="text-grey-7">Aucune vérification enregistrée.</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import AttestationDialog from '../components/AttestationDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import {
  LIBELLE_STATUT_ATTESTATION,
  LIBELLE_TYPE_ATTESTATION,
  dateHeureLisible,
  dateLisible,
} from '../utils/libelles';
import type { AnneeAcademique, Attestation, Promotion, ChipFiltre } from '../types';

/** Ligne du journal des vérifications (types.ts n'expose pas encore le modèle). */
interface VerificationAttestation {
  id: string;
  attestationId: string;
  ip?: string | null;
  resultat: boolean;
  verifieeLe: string;
}

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const attestations = ref<Attestation[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filtres = ref<Record<string, any>>({});

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

const peutEmettre = computed(() => auth.aRole(['SCOLARITE', 'ADMIN']));
const peutRevoquer = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, icone: 'search', defaut: true });
  }
  if (filtres.value.type) {
    cs.push({
      label: `Type : ${LIBELLE_TYPE_ATTESTATION[filtres.value.type] ?? filtres.value.type}`,
      value: filtres.value.type,
      icone: 'description',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: `Statut : ${LIBELLE_STATUT_ATTESTATION[filtres.value.statut] ?? filtres.value.statut}`,
      value: filtres.value.statut,
      icone: 'verified',
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: `Année : ${a?.libelle ?? '?'}`, value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  return cs;
});

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.etudiant?.nom ?? ''} ${r.etudiant?.prenom ?? ''}`, align: 'left' },
  { name: 'parcours', label: 'Année / promotion', field: 'anneeId', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'verifications', label: 'Vérifications', field: (r) => r._count?.verifications ?? 0, align: 'center' },
  { name: 'emiseLe', label: 'Émise le', field: 'emiseLe', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

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
  window.open(`${API_URL}/attestations/${a.id}/imprimer?token=${auth.token}`, '_blank');
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
    $q.notify({ type: 'warning', message: 'Attestation révoquée — le QR ne sera plus valable' });
    dialogRevocation.value = false;
    await recharger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Révocation impossible' });
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

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/attestations', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        type: filtres.value.type || undefined,
        statut: filtres.value.statut || undefined,
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        search: filtres.value.recherche || undefined,
      },
    });
    attestations.value = data.data ?? [];
    total.value = data.total ?? attestations.value.length;
  } catch (e: any) {
    attestations.value = [];
    total.value = 0;
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Chargement des attestations impossible' });
  } finally {
    chargement.value = false;
  }
}

async function recharger() {
  page.value = 1;
  await charger();
}

async function chargerTout() {
  page.value = 1;
  pageSize.value = Math.max(total.value, 200);
  await charger();
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  charger();
}

async function chargerReferentiels() {
  const [rAnnees, rPromotions] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = rAnnees.data.data;
  promotions.value = rPromotions.data.data;
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.type,
    filtres.value.statut,
    filtres.value.anneeId,
    filtres.value.promotionId,
  ],
  () => {
    page.value = 1;
    charger();
  },
);

onMounted(async () => {
  await Promise.all([charger(), chargerReferentiels()]);

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
