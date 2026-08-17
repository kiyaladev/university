<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import CarteDialog from '../components/CarteDialog.vue';
import type { CarteEtudiante } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const cartes = ref<CarteEtudiante[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEmettre = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutModifier = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutRevoguer = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const dialogEmission = ref(false);
const dialogRevocation = ref(false);
const dialogDetail = ref(false);
const carteEnEdition = ref<CarteEtudiante | null>(null);
const carteRevocation = ref<CarteEtudiante | null>(null);
const carteDetail = ref<CarteEtudiante | null>(null);
const motifRevocation = ref('');
const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');

const LIBELLE_STATUT: Record<string, string> = {
  EMISE: 'Émise',
  REVOQUEE: 'Révoquée',
};
const CLASSE_STATUT: Record<string, string> = {
  EMISE: 'badge--ok',
  REVOQUEE: 'badge--ko',
};

const colonnes: QTableColumn[] = [
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', align: 'left' },
  { name: 'matricule', label: 'Matricule', field: 'etudiant', align: 'left' },
  { name: 'emission', label: 'Émise le', field: 'dateEmission', align: 'left' },
  { name: 'validite', label: 'Validité', field: 'dateValidite', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrirDetail(c: CarteEtudiante) {
  carteDetail.value = c;
  urlVerification.value = `${window.location.origin}/#/verification-carte?carte=${encodeURIComponent(c.id)}&k=${encodeURIComponent(c.qrToken)}`;
  dialogDetail.value = true;
  void nextTick(() => {
    if (canvasQr.value) {
      void QRCode.toCanvas(canvasQr.value, urlVerification.value, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
  });
}

function imprimer(c: CarteEtudiante) {
  window.open(`${API_URL}/cartes-etudiantes/${c.id}/imprimer?token=${auth.token}`, '_blank');
}

function ouvrirRevocation(c: CarteEtudiante) {
  carteRevocation.value = c;
  motifRevocation.value = '';
  dialogRevocation.value = true;
}

async function confirmerRevocation() {
  if (!carteRevocation.value || !motifRevocation.value) return;
  try {
    await api.post(`/cartes-etudiantes/${carteRevocation.value.id}/revoquer`, {
      motif: motifRevocation.value,
    });
    $q.notify({ type: 'warning', message: 'Carte révoquée.' });
    dialogRevocation.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Révocation impossible.' });
  }
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    const recherche = filtres.value.recherche;
    if (recherche) params.search = recherche;
    const { data } = await api.get('/cartes-etudiantes', { params });
    cartes.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR');
}

function definirNip(c: CarteEtudiante) {
  $q.dialog({
    title: 'Définir le NIP',
    message: `Carte de ${c.etudiant?.prenom ?? ''} ${c.etudiant?.nom ?? ''} — le NIP doit comporter 4 à 6 chiffres.`,
    prompt: {
      model: '',
      isValid: (v: string) => /^\d{4,6}$/.test(v),
      type: 'text',
    },
    cancel: true,
  }).onOk(async (nip: string) => {
    await api.post(`/cartes-etudiantes/${c.id}/nip`, { nip });
    $q.notify({ type: 'positive', message: 'NIP défini par la scolarité.' });
  });
}

function ouvrirModification(c: CarteEtudiante) {
  carteEnEdition.value = c;
  dialogEmission.value = true;
}

function ouvrirEmission() {
  carteEnEdition.value = null;
  dialogEmission.value = true;
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Cartes étudiantes</div>
        <div class="page-sous-titre">
          Carte numérique vérifiable par QR code, avec NIP personnel.
        </div>
      </div>
      <div class="col-auto">
        <view-toggle
          cle="cartes-etudiantes"
          :modes="['tableau', 'cartes']"
          :defaut="modeVue"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
        <q-btn
          v-if="peutEmettre"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Émettre une carte"
          @click="ouvrirEmission"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Matricule, nom, jeton…"
      @update:model-value="recharger"
    />

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; charger()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; charger()"
    />

    <!-- Vue tableau -->
    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="cartes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <strong>{{ p.row.etudiant?.prenom }} {{ p.row.etudiant?.nom }}</strong>
        </q-td>
      </template>
      <template #body-cell-matricule="p">
        <q-td :props="p"><code>{{ p.row.etudiant?.matricule ?? '—' }}</code></q-td>
      </template>
      <template #body-cell-emission="p">
        <q-td :props="p">{{ dateFr(p.row.dateEmission) }}</q-td>
      </template>
      <template #body-cell-validite="p">
        <q-td :props="p">{{ dateFr(p.row.dateValidite) }}</q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-statut" :class="CLASSE_STATUT[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT[p.row.statut] ?? p.row.statut }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat round dense icon="qr_code_2" @click="ouvrirDetail(p.row)" />
          <q-btn flat round dense icon="print" @click="imprimer(p.row)" />
          <q-btn
            v-if="peutModifier"
            flat
            round
            dense
            icon="edit"
            @click="ouvrirModification(p.row)"
          />
          <q-btn
            v-if="p.row.statut === 'EMISE' && peutRevoguer"
            flat
            round
            dense
            icon="block"
            color="negative"
            @click="ouvrirRevocation(p.row)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div v-for="c in cartes" :key="c.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="carte-carte">
          <q-card-section class="row items-center q-gutter-sm">
            <q-avatar size="56px" color="grey-3" text-color="primary">
              <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.etudiant?.prenom}`" />
              <q-icon v-else name="person" size="32px" />
            </q-avatar>
            <div class="col">
              <div class="text-weight-bold">{{ c.etudiant?.prenom }} {{ c.etudiant?.nom }}</div>
              <div class="text-caption text-grey-7">
                Matricule <code>{{ c.etudiant?.matricule }}</code>
              </div>
            </div>
            <span class="champ champ-statut" :class="CLASSE_STATUT[c.statut]">
              <span class="pochoir">{{ LIBELLE_STATUT[c.statut] }}</span>
            </span>
          </q-card-section>
          <q-separator />
          <q-card-section class="text-caption">
            Émise le {{ dateFr(c.dateEmission) }}<br>
            Valable jusqu'au {{ dateFr(c.dateValidite) }}
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense icon="qr_code_2" label="QR" no-caps @click="ouvrirDetail(c)" />
            <q-btn flat dense icon="print" label="Imprimer" no-caps @click="imprimer(c)" />
            <q-btn
              v-if="peutModifier"
              flat
              dense
              icon="lock"
              label="NIP"
              no-caps
              @click="definirNip(c)"
            />
            <q-btn
              v-if="c.statut === 'EMISE' && peutRevoguer"
              flat
              dense
              icon="block"
              color="negative"
              label="Révoquer"
              no-caps
              @click="ouvrirRevocation(c)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <!-- Dialog émission / édition -->
    <carte-dialog v-model="dialogEmission" :carte="carteEnEdition" @enregistre="charger" />

    <!-- Dialog révocation -->
    <q-dialog v-model="dialogRevocation">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Révoquer la carte</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogRevocation = false" />
        </q-card-section>
        <q-card-section>
          <q-banner class="bg-orange-1 text-orange-10 q-mb-md">
            Cette action rend la carte inutilisable et invalide tout scan QR.
          </q-banner>
          <q-input
            v-model="motifRevocation"
            label="Motif de révocation"
            outlined
            dense
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" no-caps @click="dialogRevocation = false" />
          <q-btn unelevated color="negative" no-caps label="Confirmer" :disable="!motifRevocation" @click="confirmerRevocation" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog détail + QR -->
    <q-dialog v-model="dialogDetail">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center">
          <div class="text-h6">QR de vérification</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogDetail = false" />
        </q-card-section>
        <q-card-section class="text-center">
          <canvas ref="canvasQr" />
          <div class="text-caption text-grey-7 q-mt-sm">
            Scannez ce QR pour vérifier l'authenticité de la carte.
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.carte-carte {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  height: 100%;
}
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }
</style>