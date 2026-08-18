<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Demandes de documents</div>
        <div class="page-sous-titre">
          L'étudiant formule sa demande en ligne, paie les frais au tarif
          paramétré, la scolarité traite, marque le document comme prêt et le
          remet au guichet.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.estAdmin"
          outline
          color="primary"
          no-caps
          icon="price_change"
          label="Tarifs des demandes"
          :to="{ name: 'tarifs-demandes' }"
        />
      </div>
    </div>

    <q-banner v-if="filtres.etudiantId" class="note--info q-mb-md">
      Registre restreint aux demandes d'un seul étudiant (lien entrant).
      <template #action>
        <q-btn flat no-caps label="Voir toutes les demandes" @click="retirerFiltreEtudiant" />
      </template>
    </q-banner>

    <div class="row q-col-gutter-md q-mb-md">
      <div v-for="s in plaques" :key="s.cle" class="col-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres" :class="{ 'text-warning': s.alerte }">
              {{ stats?.[s.cle] ?? 0 }}
            </div>
            <div class="pochoir text-grey-7">{{ s.libelle }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 text-caption text-grey-7">
        Recettes encaissées : {{ montantLisible(stats?.recettes ?? 0) }} GNF.
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (N°, motif, matricule…)"
      :recherche="true"
      @reinitialiser="filtres = { recherche: '' }; pagination.page = 1; requeter()"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUTS"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Type"
        />
        <autocomplete-async
          v-model="filtres.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
          label="Étudiant"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="documents-demande.admin"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; requeter()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; requeter()"
      @tous="chargerTout"
    />

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="demandes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
      @row-click="(_, row) => selectionner(row)"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          Aucune demande pour ces critères. Les demandes sont créées par les
          étudiants depuis « Mes demandes de documents ».
        </div>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
      </template>
      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <template v-if="p.row.etudiant">
            <div>{{ p.row.etudiant.prenom }} {{ p.row.etudiant.nom }}</div>
            <div class="text-caption text-grey-7">{{ p.row.etudiant.matricule }}</div>
          </template>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="demande-statut" :class="`statut-${p.row.statut}`">
            <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-frais="p">
        <q-td :props="p" class="text-right chiffres">
          {{ montantLisible(p.row.frais) }} {{ p.row.devise }}
          <q-icon
            v-if="p.row.paiement?.statut === 'REUSSI'"
            name="check_circle"
            color="positive"
            size="16px"
            class="q-ml-xs"
          >
            <q-tooltip>Paiement confirmé</q-tooltip>
          </q-icon>
          <q-icon
            v-else-if="p.row.paiement?.statut === 'EN_ATTENTE'"
            name="hourglass_top"
            color="warning"
            size="16px"
            class="q-ml-xs"
          >
            <q-tooltip>Paiement en attente</q-tooltip>
          </q-icon>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'EN_ATTENTE_PAIEMENT'"
            flat
            dense
            round
            icon="verified"
            color="positive"
            :loading="enCours === 'confirmer'"
            @click.stop="confirmerPaiement(p.row)"
          >
            <q-tooltip>Confirmer le paiement</q-tooltip>
          </q-btn>
          <q-btn
            v-if="['PAYEE', 'EN_TRAITEMENT'].includes(p.row.statut)"
            flat
            dense
            round
            icon="play_arrow"
            :loading="enCours === 'traitement'"
            @click.stop="lancerTraitement(p.row)"
          >
            <q-tooltip>Lancer le traitement</q-tooltip>
          </q-btn>
          <q-btn
            v-if="['PAYEE', 'EN_TRAITEMENT'].includes(p.row.statut)"
            flat
            dense
            round
            icon="check_circle"
            color="positive"
            :loading="enCours === 'prete'"
            @click.stop="marquerPrete(p.row)"
          >
            <q-tooltip>Marquer prête</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'PRETE'"
            flat
            dense
            round
            icon="assignment_turned_in"
            color="positive"
            :loading="enCours === 'remettre'"
            @click.stop="remettre(p.row)"
          >
            <q-tooltip>Remettre</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut !== 'REMISE' && p.row.statut !== 'REJETEE'"
            flat
            dense
            round
            icon="block"
            color="negative"
            :loading="enCours === 'rejeter'"
            @click.stop="rejeter(p.row)"
          >
            <q-tooltip>Rejeter</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="visibility" @click.stop="selectionner(p.row)">
            <q-tooltip>Détail</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="d in demandes" :key="d.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-start q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ d.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ libelleType(d.type) }}</div>
              <div v-if="d.etudiant" class="text-caption text-grey-7">
                {{ d.etudiant.prenom }} {{ d.etudiant.nom }} · {{ d.etudiant.matricule }}
              </div>
            </div>
            <span class="demande-statut" :class="`statut-${d.statut}`">
              <span class="pochoir">{{ libelleStatut(d.statut) }}</span>
            </span>
          </q-card-section>
          <q-card-section class="q-pt-sm q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(d.creeLe) }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="payments" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption chiffres">
                {{ montantLisible(d.frais) }} {{ d.devise }}
                <q-icon
                  v-if="d.paiement?.statut === 'REUSSI'"
                  name="check_circle"
                  color="positive"
                  size="14px"
                  class="q-ml-xs"
                />
                <q-icon
                  v-else-if="d.paiement?.statut === 'EN_ATTENTE'"
                  name="hourglass_top"
                  color="warning"
                  size="14px"
                  class="q-ml-xs"
                />
              </span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-gutter-xs">
            <q-btn
              v-if="d.statut === 'EN_ATTENTE_PAIEMENT'"
              flat
              dense
              no-caps
              icon="verified"
              color="positive"
              label="Confirmer"
              :loading="enCours === 'confirmer'"
              @click.stop="confirmerPaiement(d)"
            />
            <q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(d.statut)"
              flat
              dense
              no-caps
              icon="play_arrow"
              label="Traiter"
              :loading="enCours === 'traitement'"
              @click.stop="lancerTraitement(d)"
            />
            <q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(d.statut)"
              flat
              dense
              no-caps
              icon="check_circle"
              color="positive"
              label="Prête"
              :loading="enCours === 'prete'"
              @click.stop="marquerPrete(d)"
            />
            <q-btn
              v-if="d.statut === 'PRETE'"
              flat
              dense
              no-caps
              icon="assignment_turned_in"
              color="positive"
              label="Remettre"
              :loading="enCours === 'remettre'"
              @click.stop="remettre(d)"
            />
            <q-btn
              v-if="d.statut !== 'REMISE' && d.statut !== 'REJETEE'"
              flat
              dense
              no-caps
              icon="block"
              color="negative"
              label="Rejeter"
              :loading="enCours === 'rejeter'"
              @click.stop="rejeter(d)"
            />
            <q-btn flat dense no-caps icon="visibility" label="Détail" @click.stop="selectionner(d)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!chargement && !demandes.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="description" size="42px" color="grey-5" />
        <div class="q-mt-sm">
          Aucune demande pour ces critères. Les demandes sont créées par les
          étudiants depuis « Mes demandes de documents ».
        </div>
      </div>
    </div>

    <!-- Dialog de détail -->
    <q-dialog v-model="detailOuvert">
      <q-card style="width: 640px; max-width: 96vw">
        <q-card-section v-if="demandeSelectionnee" class="row items-center no-wrap">
          <div class="col">
            <div class="text-h6">{{ demandeSelectionnee.numero }}</div>
            <div class="text-caption text-grey-7">{{ libelleType(demandeSelectionnee.type) }}</div>
          </div>
          <span class="demande-statut" :class="`statut-${demandeSelectionnee.statut}`">
            <span class="pochoir">{{ libelleStatut(demandeSelectionnee.statut) }}</span>
          </span>
        </q-card-section>
        <q-card-section v-if="demandeSelectionnee" class="q-pt-none">
          <workflow-stepper
            :etapes="ETAPES_DEMANDE"
            :actuel="demandeSelectionnee.statut"
            :readonly="true"
          />
          <div class="demande-meta q-mt-md">
            <div>
              <span class="pochoir">Étudiant</span>
              <span v-if="demandeSelectionnee.etudiant">
                {{ demandeSelectionnee.etudiant.prenom }} {{ demandeSelectionnee.etudiant.nom }} ({{ demandeSelectionnee.etudiant.matricule }})
                <q-btn
                  flat
                  dense
                  no-caps
                  size="sm"
                  icon="badge"
                  label="Sa carte"
                  @click="ouvrirCarteEtudiante(demandeSelectionnee)"
                />
              </span>
              <span v-else>—</span>
            </div>
            <div>
              <span class="pochoir">Inscription</span>
              <span>{{ demandeSelectionnee.inscription?.numero ?? '—' }}</span>
            </div>
            <div>
              <span class="pochoir">Frais</span>
              <span class="chiffres">
                {{ montantLisible(demandeSelectionnee.frais) }} {{ demandeSelectionnee.devise }}
              </span>
            </div>
            <div>
              <span class="pochoir">Paiement</span>
              <span v-if="demandeSelectionnee.paiement">
                {{ demandeSelectionnee.paiement.reference }} · {{ libellePaiement(demandeSelectionnee.paiement.statut) }}
              </span>
              <span v-else class="text-grey-7">Non initié</span>
            </div>
            <div>
              <span class="pochoir">Traitée par</span>
              <span v-if="demandeSelectionnee.traitePar">
                {{ demandeSelectionnee.traitePar.prenom }} {{ demandeSelectionnee.traitePar.nom }}
              </span>
              <span v-else>—</span>
            </div>
            <div>
              <span class="pochoir">Créée le</span>
              <span>{{ dateHeureLisible(demandeSelectionnee.creeLe) }}</span>
            </div>
            <div v-if="demandeSelectionnee.remiseLe">
              <span class="pochoir">Remise le</span>
              <span>{{ dateHeureLisible(demandeSelectionnee.remiseLe) }}</span>
            </div>
          </div>
          <div v-if="demandeSelectionnee.motif" class="q-mt-md">
            <span class="section-titre">Motif</span>
            <div class="demande-motif" style="white-space: pre-wrap">{{ demandeSelectionnee.motif }}</div>
          </div>
          <div v-if="demandeSelectionnee.notes" class="q-mt-md">
            <span class="section-titre">Notes</span>
            <div class="demande-notes" style="white-space: pre-wrap">{{ demandeSelectionnee.notes }}</div>
          </div>
          <div v-if="demandeSelectionnee.notification" class="q-mt-md">
            <span class="section-titre">Notification SMS</span>
            <div class="demande-notification" style="white-space: pre-wrap">{{ demandeSelectionnee.notification }}</div>
          </div>
          <div class="row q-mt-md q-gutter-sm">
            <q-btn
              v-if="demandeSelectionnee.statut === 'EN_ATTENTE_PAIEMENT'"
              unelevated
              color="positive"
              no-caps
              icon="verified"
              label="Confirmer le paiement"
              :loading="enCours === 'confirmer'"
              @click="confirmerPaiement(demandeSelectionnee)"
            />
            <q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(demandeSelectionnee.statut)"
              unelevated
              color="primary"
              no-caps
              icon="play_arrow"
              label="Lancer le traitement"
              :loading="enCours === 'traitement'"
              @click="lancerTraitement(demandeSelectionnee)"
            />
            <q-btn
              v-if="['PAYEE', 'EN_TRAITEMENT'].includes(demandeSelectionnee.statut)"
              unelevated
              color="positive"
              no-caps
              icon="check_circle"
              label="Marquer prête"
              :loading="enCours === 'prete'"
              @click="marquerPrete(demandeSelectionnee)"
            />
            <q-btn
              v-if="demandeSelectionnee.statut === 'PRETE'"
              unelevated
              color="positive"
              no-caps
              icon="assignment_turned_in"
              label="Remettre"
              :loading="enCours === 'remettre'"
              @click="remettre(demandeSelectionnee)"
            />
            <q-btn
              v-if="demandeSelectionnee.statut !== 'REMISE' && demandeSelectionnee.statut !== 'REJETEE'"
              outline
              color="negative"
              no-caps
              icon="block"
              label="Rejeter"
              :loading="enCours === 'rejeter'"
              @click="rejeter(demandeSelectionnee)"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import WorkflowStepper from '../components/WorkflowStepper.vue';
import {
  LIBELLE_STATUT_DEMANDE,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_DEMANDE,
  dateHeureLisible,
  montantLisible,
  optionsDepuis,
} from '../utils/libelles';
import type { DemandeDocument, StatutDemande, StatutPaiement, TypeDemandeDocument } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const ETAPES_DEMANDE = [
  { identifiant: 'EN_ATTENTE_PAIEMENT', libelle: 'Paiement', icone: 'payments' },
  { identifiant: 'PAYEE', libelle: 'Payée', icone: 'verified' },
  { identifiant: 'EN_TRAITEMENT', libelle: 'Traitement', icone: 'build' },
  { identifiant: 'PRETE', libelle: 'Prête', icone: 'check_circle' },
  { identifiant: 'REMISE', libelle: 'Remise', icone: 'task_alt' },
];

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_DEMANDE);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_DEMANDE);

const demandes = ref<DemandeDocument[]>([]);
const stats = ref<Record<string, number> | null>(null);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
/**
 * Liaison depuis les autres écrans du dossier (réclamations, carte) :
 * `/demandes-docs?etudiantId=…` ouvre le registre filtré sur cet étudiant.
 */
const filtres = ref<Record<string, any>>({
  recherche: '',
  etudiantId: String(route.query.etudiantId ?? '') || undefined,
});
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const chargement = ref(false);
const detailOuvert = ref(false);
const demandeSelectionnee = ref<DemandeDocument | null>(null);
const enCours = ref('');

const plaques = [
  { cle: 'EN_ATTENTE_PAIEMENT', libelle: 'À payer', alerte: false },
  { cle: 'EN_TRAITEMENT', libelle: 'En traitement', alerte: false },
  { cle: 'PRETE', libelle: 'Prêtes', alerte: false },
  { cle: 'pretesNonRemises', libelle: 'Prêtes > 7 j', alerte: true },
];

function libelleStatut(s: string) {
  return LIBELLE_STATUT_DEMANDE[s as StatutDemande] ?? s;
}
function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}
function libellePaiement(s: StatutPaiement | string) {
  return LIBELLE_STATUT_PAIEMENT[s] ?? s;
}

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', align: 'left' },
  { name: 'frais', label: 'Frais', field: 'frais', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  {
    name: 'creeLe',
    label: 'Créée le',
    field: 'creeLe',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function selectionner(d: DemandeDocument | null) {
  if (!d) return;
  demandeSelectionnee.value = d;
  detailOuvert.value = true;
}

/** Retire le filtre « un seul étudiant » posé par un lien entrant. */
function retirerFiltreEtudiant() {
  filtres.value = { ...filtres.value, etudiantId: undefined };
}

/** Rebond vers la carte étudiante du demandeur. */
function ouvrirCarteEtudiante(d: DemandeDocument | null) {
  if (!d?.etudiantId) return;
  detailOuvert.value = false;
  void router.push({ name: 'cartes-etudiantes', query: { etudiantId: d.etudiantId } });
}

async function requeter() {
  // Même périmètre que GET /documents-demande côté API.
  if (!auth.aRole(['ADMIN', 'SCOLARITE'])) return;
  chargement.value = true;
  try {
    const f = filtres.value;
    const { data } = await api.get('/documents-demande', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        statut: f.statut || undefined,
        type: f.type || undefined,
        etudiantId: f.etudiantId || undefined,
        search: (f.recherche ?? '').toString().trim() || undefined,
      },
    });
    demandes.value = data.data;
    pagination.value.total = data.total;
  } catch (e: any) {
    if (e?.response?.status === 403) {
      $q.notify({ type: 'warning', message: "Vous n'avez pas accès à cette section." });
    } else if (e?.response?.status !== 401) {
      $q.notify({
        type: 'negative',
        message: e?.response?.data?.message ?? 'Chargement impossible',
      });
    }
    demandes.value = [];
    pagination.value.total = 0;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await requeter();
}

async function chargerStats() {
  if (!auth.aRole(['ADMIN', 'SCOLARITE'])) return;
  try {
    const { data } = await api.get('/documents-demande/dashboard');
    stats.value = data;
  } catch {
    /* silencieux */
  }
}

function rafraichir() {
  void requeter();
  void chargerStats();
}

async function confirmerPaiement(d: DemandeDocument | null) {
  if (!d) return;
  enCours.value = 'confirmer';
  try {
    await api.post(`/documents-demande/${d.id}/confirmer-paiement`, {});
    $q.notify({ type: 'positive', message: 'Paiement confirmé' });
    rafraichir();
    if (demandeSelectionnee.value?.id === d.id) {
      const { data } = await api.get(`/documents-demande/${d.id}`);
      demandeSelectionnee.value = data as DemandeDocument;
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Confirmation impossible' });
  } finally {
    enCours.value = '';
  }
}

async function lancerTraitement(d: DemandeDocument | null) {
  if (!d) return;
  enCours.value = 'traitement';
  try {
    await api.post(`/documents-demande/${d.id}/lancer-traitement`, {});
    $q.notify({ type: 'positive', message: 'Traitement lancé' });
    rafraichir();
    if (demandeSelectionnee.value?.id === d.id) {
      const { data } = await api.get(`/documents-demande/${d.id}`);
      demandeSelectionnee.value = data as DemandeDocument;
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Lancement impossible' });
  } finally {
    enCours.value = '';
  }
}

async function marquerPrete(d: DemandeDocument | null) {
  if (!d) return;
  $q.dialog({
    title: 'Marquer prête',
    message: 'Un SMS sera envoyé à l\'étudiant. Message personnalisé (optionnel) :',
    prompt: { model: '', type: 'textarea' },
    cancel: true,
    ok: { label: 'Marquer prête', color: 'positive' },
  }).onOk(async (message: string) => {
    enCours.value = 'prete';
    try {
      await api.post(`/documents-demande/${d.id}/prete`, {
        message: message?.trim() || undefined,
      });
      $q.notify({ type: 'positive', message: 'Demande marquée prête, étudiant notifié' });
      rafraichir();
      if (demandeSelectionnee.value?.id === d.id) {
        const { data } = await api.get(`/documents-demande/${d.id}`);
        demandeSelectionnee.value = data as DemandeDocument;
      }
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Impossible de marquer prête' });
    } finally {
      enCours.value = '';
    }
  });
}

async function remettre(d: DemandeDocument | null) {
  if (!d) return;
  $q.dialog({
    title: 'Confirmer la remise',
    message: 'Note de remise (optionnel) :',
    prompt: { model: '', type: 'text' },
    cancel: true,
    ok: { label: 'Remettre', color: 'positive' },
  }).onOk(async (noteRemise: string) => {
    enCours.value = 'remettre';
    try {
      await api.post(`/documents-demande/${d.id}/remettre`, {
        noteRemise: noteRemise?.trim() || undefined,
      });
      $q.notify({ type: 'positive', message: 'Document remis' });
      rafraichir();
      if (demandeSelectionnee.value?.id === d.id) {
        const { data } = await api.get(`/documents-demande/${d.id}`);
        demandeSelectionnee.value = data as DemandeDocument;
      }
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Remise impossible' });
    } finally {
      enCours.value = '';
    }
  });
}

async function rejeter(d: DemandeDocument | null) {
  if (!d) return;
  $q.dialog({
    title: 'Rejeter la demande',
    message: 'Motif du rejet (obligatoire) :',
    prompt: { model: '', isValid: (v: string) => v.trim().length >= 3, type: 'textarea' },
    cancel: true,
    ok: { label: 'Rejeter', color: 'negative' },
  }).onOk(async (motif: string) => {
    if (!motif?.trim()) return;
    enCours.value = 'rejeter';
    try {
      await api.post(`/documents-demande/${d.id}/rejeter`, { motif: motif.trim() });
      $q.notify({ type: 'warning', message: 'Demande rejetée' });
      rafraichir();
      if (demandeSelectionnee.value?.id === d.id) {
        const { data } = await api.get(`/documents-demande/${d.id}`);
        demandeSelectionnee.value = data as DemandeDocument;
      }
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Rejet impossible' });
    } finally {
      enCours.value = '';
    }
  });
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.statut,
    filtres.value.type,
    filtres.value.etudiantId,
  ],
  () => {
    pagination.value.page = 1;
    void requeter();
  },
);

onMounted(() => {
  void requeter();
  void chargerStats();
});
</script>

<style scoped lang="scss">
$encre: #10251E;
$vert: #0F7A45;
$jaune-fonce: #C98A00;
$rouge: #C4122E;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

.demande-statut {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: #fff;
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &.statut-EN_ATTENTE_PAIEMENT { background: $jaune-fonce; }
  &.statut-PAYEE { background: #1e7a4c; }
  &.statut-EN_TRAITEMENT { background: $encre; }
  &.statut-PRETE { background: $vert; }
  &.statut-REMISE { background: #1565c0; }
  &.statut-REJETEE { background: $rouge; }
}

.demande-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--up-2);
  background: rgba(16, 37, 30, 0.04);
  padding: var(--up-2);
  border-left: var(--up-filet);

  .pochoir {
    display: block;
    color: var(--up-encre-douce);
    margin-bottom: 2px;
  }
}

.demande-motif,
.demande-notes,
.demande-notification {
  background: var(--up-craie);
  border: var(--up-filet-fin);
  padding: var(--up-2);
  border-radius: 0;
  font-size: 0.95rem;
}
</style>