<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute } from 'vue-router';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import CarteDialog from '../components/CarteDialog.vue';
import { CLASSE_STATUT_CARTE, LIBELLE_STATUT_CARTE } from '../utils/libelles';
import type { CarteEtudiante } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();

const cartes = ref<CarteEtudiante[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });

/**
 * Liaison depuis les autres écrans du dossier (demandes de documents,
 * réclamations) : `/cartes-etudiantes?etudiantId=…` ouvre directement la ou
 * les cartes de l'étudiant concerné.
 */
const etudiantId = ref<string>(String(route.query.etudiantId ?? ''));

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEmettre = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutModifier = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutRevoquer = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const dialogEmission = ref(false);
const dialogRevocation = ref(false);
const dialogDetail = ref(false);
const carteEnEdition = ref<CarteEtudiante | null>(null);
const carteRevocation = ref<CarteEtudiante | null>(null);
const carteDetail = ref<CarteEtudiante | null>(null);
const motifRevocation = ref('');
const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');

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

/** Ouvre la page publique de vérification, exactement comme le ferait un scan. */
function ouvrirVerification() {
  if (urlVerification.value) window.open(urlVerification.value, '_blank');
}

async function copierUrlVerification() {
  try {
    await navigator.clipboard.writeText(urlVerification.value);
    $q.notify({ type: 'positive', message: 'Lien de vérification copié.' });
  } catch {
    $q.notify({ type: 'warning', message: 'Copie impossible : sélectionnez le lien à la main.' });
  }
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
  if (!carteRevocation.value || motifRevocation.value.trim().length < 3) return;
  try {
    await api.post(`/cartes-etudiantes/${carteRevocation.value.id}/revoquer`, {
      motif: motifRevocation.value.trim(),
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
    if (etudiantId.value) params.etudiantId = etudiantId.value;
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

/** Retire le filtre « un seul étudiant » posé par un lien entrant. */
function retirerFiltreEtudiant() {
  etudiantId.value = '';
  recharger();
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR');
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

    <q-banner v-if="etudiantId" class="note--info q-mb-md">
      Liste restreinte aux cartes d'un seul étudiant (lien entrant).
      <template #action>
        <q-btn flat no-caps label="Voir toutes les cartes" @click="retirerFiltreEtudiant" />
      </template>
    </q-banner>

    <filter-bar
      v-model="filtres"
      placeholder="Matricule, nom, jeton du QR…"
      @update:model-value="recharger"
    >
      <template #actions>
        <view-toggle
          cle="cartes-etudiantes"
          :modes="['tableau', 'cartes']"
          :defaut="modeVue"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

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
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          Aucune carte pour ces critères. Émettez-en une depuis le dossier d'un
          étudiant inscrit.
        </div>
      </template>
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
          <span class="champ champ-statut" :class="CLASSE_STATUT_CARTE[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT_CARTE[p.row.statut] ?? p.row.statut }}</span>
          </span>
          <div v-if="p.row.motifRevocation" class="text-caption text-grey-7">
            {{ p.row.motifRevocation }}
          </div>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            round
            dense
            icon="qr_code_2"
            aria-label="QR de vérification"
            @click="ouvrirDetail(p.row)"
          >
            <q-tooltip>QR de vérification</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="print" aria-label="Imprimer la carte" @click="imprimer(p.row)">
            <q-tooltip>Imprimer</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutModifier"
            flat
            round
            dense
            icon="edit"
            aria-label="Modifier la carte"
            @click="ouvrirModification(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'EMISE' && peutRevoquer"
            flat
            round
            dense
            icon="block"
            color="negative"
            aria-label="Révoquer la carte"
            @click="ouvrirRevocation(p.row)"
          >
            <q-tooltip>Révoquer</q-tooltip>
          </q-btn>
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
            <span class="champ champ-statut" :class="CLASSE_STATUT_CARTE[c.statut]">
              <span class="pochoir">{{ LIBELLE_STATUT_CARTE[c.statut] }}</span>
            </span>
          </q-card-section>
          <q-separator />
          <q-card-section class="text-caption">
            Émise le {{ dateFr(c.dateEmission) }}<br>
            Valable jusqu'au {{ dateFr(c.dateValidite) }}
            <div v-if="c.motifRevocation" class="text-grey-7 q-mt-xs">
              Motif de révocation : {{ c.motifRevocation }}
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense icon="qr_code_2" label="QR" no-caps @click="ouvrirDetail(c)" />
            <q-btn flat dense icon="print" label="Imprimer" no-caps @click="imprimer(c)" />
            <q-btn
              v-if="peutModifier"
              flat
              dense
              icon="edit"
              label="Modifier"
              no-caps
              @click="ouvrirModification(c)"
            />
            <q-btn
              v-if="c.statut === 'EMISE' && peutRevoquer"
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
      <div v-if="!chargement && !cartes.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="badge" size="42px" color="grey-5" />
        <div class="q-mt-sm">
          Aucune carte pour ces critères. Émettez-en une depuis le dossier d'un
          étudiant inscrit.
        </div>
      </div>
    </div>

    <!-- Dialog émission / édition -->
    <carte-dialog v-model="dialogEmission" :carte="carteEnEdition" @enregistre="charger" />

    <!-- Dialog révocation -->
    <q-dialog v-model="dialogRevocation">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">Révoquer la carte</div>
            <div v-if="carteRevocation?.etudiant" class="text-caption text-grey-7">
              {{ carteRevocation.etudiant.prenom }} {{ carteRevocation.etudiant.nom }} ·
              {{ carteRevocation.etudiant.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" aria-label="Fermer" @click="dialogRevocation = false" />
        </q-card-section>
        <q-card-section>
          <q-banner class="note--alerte q-mb-md">
            Action irréversible : la carte devient inutilisable et tout scan de
            son QR affichera « carte non valable ». L'étudiant en est informé sur
            « Ma carte étudiante ».
          </q-banner>
          <q-input
            v-model="motifRevocation"
            label="Motif de révocation"
            hint="3 caractères minimum — il sera affiché à l'étudiant."
            outlined
            dense
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" no-caps @click="dialogRevocation = false" />
          <q-btn
            unelevated
            color="negative"
            no-caps
            label="Révoquer définitivement"
            :disable="motifRevocation.trim().length < 3"
            @click="confirmerRevocation"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog détail + QR -->
    <q-dialog v-model="dialogDetail">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">QR de vérification</div>
            <div v-if="carteDetail?.etudiant" class="text-caption text-grey-7">
              {{ carteDetail.etudiant.prenom }} {{ carteDetail.etudiant.nom }} ·
              {{ carteDetail.etudiant.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" aria-label="Fermer" @click="dialogDetail = false" />
        </q-card-section>
        <q-card-section class="text-center">
          <canvas ref="canvasQr" />
          <div class="text-caption text-grey-7 q-mt-sm">
            Scannez ce QR pour vérifier l'authenticité de la carte. Toute
            consultation est journalisée.
          </div>
          <div class="text-caption text-grey-7 q-mt-xs url-verification">
            <code>{{ urlVerification }}</code>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps icon="content_copy" label="Copier le lien" @click="copierUrlVerification" />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="verified_user"
            label="Ouvrir la vérification"
            @click="ouvrirVerification"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
/* Pas d'arrondi : la carte est une plaque, comme partout ailleurs. */
.carte-carte {
  border: var(--up-filet-fin);
  height: 100%;
  background: var(--up-plaque);
}

/* Pastille de statut : même gabarit que sur « Ma carte étudiante ». */
.champ-statut {
  display: inline-flex;
  padding: 3px 8px;
  min-height: 24px;
}
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }

.url-verification code {
  word-break: break-all;
}
</style>