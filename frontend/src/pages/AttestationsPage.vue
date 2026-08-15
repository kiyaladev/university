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
          v-if="peutEmettre"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Émettre une attestation"
          @click="dialogEmission = true"
        />
      </div>
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="attestations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="pagination"
      :rows-per-page-options="[10, 20, 50]"
      @request="repondreRequete"
    >
      <template #top-left>
        <div class="row q-gutter-sm items-center">
          <q-input
            v-model="filtres.search"
            dense
            outlined
            clearable
            debounce="300"
            placeholder="Numéro, nom, matricule…"
            @update:model-value="recharger"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="filtres.type"
            :options="optionsTypes"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Type"
            style="min-width: 160px"
            @update:model-value="recharger"
          />
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Statut"
            style="min-width: 140px"
            @update:model-value="recharger"
          />
          <q-select
            v-model="filtres.anneeId"
            :options="optionsAnnees"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Année"
            style="min-width: 150px"
            @update:model-value="recharger"
          />
          <q-select
            v-model="filtres.promotionId"
            :options="optionsPromotions"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Promotion"
            style="min-width: 180px"
            @update:model-value="recharger"
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
          <q-chip
            :color="p.row.statut === 'EMISE' ? 'secondary' : 'negative'"
            text-color="white"
            dense
          >
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
        <q-td :props="p">
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            no-caps
            :label="String(p.row._count?.verifications ?? 0)"
            icon="qr_code_scanner"
            @click="ouvrirVerifications(p.row)"
          >
            <q-tooltip>Journal des vérifications de ce document</q-tooltip>
          </q-btn>
          <span v-else class="chiffres">{{ p.row._count?.verifications ?? 0 }}</span>
        </q-td>
      </template>

      <template #body-cell-emiseLe="p">
        <q-td :props="p">
          <div>{{ dateFr(p.row.emiseLe) }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.emisePar ? `${p.row.emisePar.prenom} ${p.row.emisePar.nom}` : '—' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="qr_code_2" @click="ouvrirDetail(p.row)">
            <q-tooltip>Détail et QR du document</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="print" @click="imprimer(p.row)">
            <q-tooltip>Imprimer le document A4</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutRevoguer && p.row.statut === 'EMISE'"
            flat
            dense
            round
            color="negative"
            icon="block"
            @click="revoguer(p.row)"
          >
            <q-tooltip>Révoquer le document</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <attestation-dialog v-model="dialogEmission" @enregistre="recharger" />

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
              Émise le {{ dateFr(detail.emiseLe) }} par
              {{ detail.emisePar ? `${detail.emisePar.prenom} ${detail.emisePar.nom}` : '—' }}
            </div>
            <div v-if="detail.statut === 'REVOQUEE'" class="text-negative">
              Révoquée le {{ dateFr(detail.revoqueeLe) }} — {{ detail.motifRevocation }}
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
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
          <div class="text-h6">Révoquer {{ attestationRevoguer?.numero }}</div>
          <div class="text-caption text-grey-7">
            Le QR cessera de garantir le document : l'authenticité de la
            révocation est elle-même vérifiable en ligne.
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
            label="Révoquer"
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
                  {{ dateHeureFr(v.verifieeLe) }}
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
import { computed, nextTick, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import AttestationDialog from '../components/AttestationDialog.vue';
import { LIBELLE_STATUT_ATTESTATION, LIBELLE_TYPE_ATTESTATION } from '../utils/libelles';
import type { AnneeAcademique, Attestation, Promotion } from '../types';

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

const attestations = ref<Attestation[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 });

const filtres = ref({
  search: '',
  type: null as string | null,
  statut: null as string | null,
  anneeId: null as string | null,
  promotionId: null as string | null,
});

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<{ id: string; nom: string; anneeId: string }[]>([]);

const optionsTypes = computed(() =>
  Object.entries(LIBELLE_TYPE_ATTESTATION).map(([value, label]) => ({ value, label })),
);
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_ATTESTATION).map(([value, label]) => ({ value, label })),
);
const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const optionsPromotions = computed(() => {
  let liste = promotions.value;
  if (filtres.value.anneeId) liste = liste.filter((p) => p.anneeId === filtres.value.anneeId);
  return liste.map((p) => ({ label: p.nom, value: p.id }));
});

const peutEmettre = computed(() => auth.aRole(['SCOLARITE', 'ADMIN']));
const peutRevoguer = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', align: 'left' },
  { name: 'parcours', label: 'Année / Promo', field: 'parcours', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'verifications', label: 'Vérifs', field: 'verifications', align: 'center' },
  { name: 'emiseLe', label: 'Émise le', field: 'emiseLe', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const dialogEmission = ref(false);

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

// -------------------------------------------------------------------- révocation
const dialogRevocation = ref(false);
const attestationRevoguer = ref<Attestation | null>(null);
const motifRevocation = ref('');
const revocationEnCours = ref(false);

function revoguer(a: Attestation) {
  attestationRevoguer.value = a;
  motifRevocation.value = '';
  dialogRevocation.value = true;
}

async function confirmerRevocation() {
  revocationEnCours.value = true;
  try {
    await api.post(`/attestations/${attestationRevoguer.value!.id}/revoquer`, {
      motifRevocation: motifRevocation.value,
    });
    $q.notify({ type: 'warning', message: 'Attestation révoquée — le QR ne sera plus valable' });
    dialogRevocation.value = false;
    await recharger();
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
  const { data } = await api.get(`/attestations/${a.id}/verifications`);
  verifications.value = data;
}

// ------------------------------------------------------------------ chargement

async function repondreRequete(props: {
  pagination: { page: number; rowsPerPage: number; rowsNumber?: number };
}) {
  const { page, rowsPerPage } = props.pagination;
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page,
      pageSize: rowsPerPage === 0 ? undefined : rowsPerPage,
      ...(filtres.value.type ? { type: filtres.value.type } : {}),
      ...(filtres.value.statut ? { statut: filtres.value.statut } : {}),
      ...(filtres.value.anneeId ? { anneeId: filtres.value.anneeId } : {}),
      ...(filtres.value.promotionId ? { promotionId: filtres.value.promotionId } : {}),
      ...(filtres.value.search ? { search: filtres.value.search } : {}),
    };
    const { data } = await api.get('/attestations', { params });
    attestations.value = data.data;
    pagination.value.rowsNumber = data.total;
    pagination.value.page = data.page;
  } finally {
    chargement.value = false;
  }
}

async function recharger() {
  pagination.value.page = 1;
  await charger();
}

async function charger() {
  await repondreRequete({ pagination: pagination.value });
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateHeureFr(v: string): string {
  return new Date(v).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function chargerReferentiels() {
  const [rAnnees, rPromotions] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = rAnnees.data.data;
  promotions.value = rPromotions.data.data;
}

onMounted(async () => {
  await Promise.all([charger(), chargerReferentiels()]);
});
</script>