<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Patrimoine</div>
        <div class="page-sous-titre">
          Inventaire des équipements de l'université — chaque pièce porte un QR
          d'inventaire et un carnet de réparations
        </div>
      </div>
      <div class="col-auto" v-if="onglet === 'equipements' && auth.peutPlanifier">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvel équipement"
          @click="ouvrirEquipement(null)"
        />
      </div>
      <div class="col-auto" v-if="onglet === 'categories' && auth.peutPlanifier">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle catégorie"
          @click="ouvrirCategorie(null)"
        />
      </div>
    </div>

    <q-tabs
      v-model="onglet"
      dense
      align="left"
      narrow-indicator
      class="onglets-panneau q-mb-md"
    >
      <q-tab name="equipements" icon="inventory_2" label="Équipements" no-caps />
      <q-tab name="categories" icon="category" label="Catégories" no-caps />
      <q-tab name="reparations" icon="build" label="Réparations" no-caps />
    </q-tabs>

    <!-- ============================== Équipements -->
    <template v-if="onglet === 'equipements'">
      <filter-bar
        v-model="filtres"
        placeholder="Rechercher (libellé, n° série, n° d'inventaire, QR…)"
        :recherche="true"
        @reinitialiser="reinitialiserFiltres"
      >
        <template #avances>
          <autocomplete-async
            v-model="filtres.categorieId"
            label="Catégorie"
            endpoint="/patrimoine/categories"
            :label-fn="(c) => `${c.libelle} (${c.code})`"
            preload
          />
          <autocomplete-async
            v-model="filtres.departementId"
            label="Département"
            endpoint="/departements"
            :label-fn="(d) => d.nom"
            preload
          />
          <q-select
            v-model="filtres.actif"
            :options="[
              { label: 'En service', value: 'true' },
              { label: 'Hors service', value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            clearable
            label="Statut"
          />
          <q-select
            v-model="filtres.enReparation"
            :options="[
              { label: 'En réparation', value: 'true' },
              { label: 'Disponible', value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            clearable
            label="État"
          />
        </template>
        <template #actions>
          <view-toggle
            cle="patrimoine.equipements"
            :modes="['tableau', 'cartes']"
            @update:mode="(v: string) => (modeEquipements = v as 'tableau' | 'cartes')"
          />
        </template>
      </filter-bar>

      <pagination-bar
        :page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :show-all="false"
        @update:page="pagination.page = $event; chargerEquipements()"
        @update:page-size="pagination.pageSize = $event; pagination.page = 1; chargerEquipements()"
        @tous="chargerToutEquipements"
      />

      <q-table
        v-if="modeEquipements === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="equipements"
        :columns="colonnesEquipements"
        row-key="id"
        :loading="chargement"
        :rows-per-page-options="[0]"
        hide-bottom
      >
        <template #body-cell-libelle="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.libelle }}</div>
            <div class="text-caption text-grey-7">{{ p.row.numeroInventaire }}</div>
          </q-td>
        </template>
        <template #body-cell-categorie="p">
          <q-td :props="p">
            <q-chip dense color="primary" text-color="white">
              {{ p.row.categorie?.libelle ?? '—' }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-valeur="p">
          <q-td :props="p" class="text-right chiffres">
            <span v-if="p.row.valeurAcquisition != null">
              {{ montantLisible(p.row.valeurAcquisition) }} <span class="text-caption">GNF</span>
            </span>
            <span v-else class="text-grey-6">—</span>
          </q-td>
        </template>
        <template #body-cell-etat="p">
          <q-td :props="p">
            <q-chip
              dense
              :color="p.row.enReparation ? 'warning' : p.row.actif ? 'positive' : 'grey-7'"
              text-color="white"
            >
              {{
                p.row.enReparation
                  ? 'En réparation'
                  : p.row.actif
                  ? 'En service'
                  : 'Hors service'
              }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense round icon="visibility" @click="voirDetails(p.row)">
              <q-tooltip>Détails</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="print" @click="imprimerEtiquette(p.row)">
              <q-tooltip>Étiquette A4</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier && !p.row.enReparation"
              flat
              dense
              round
              icon="build"
              @click="ouvrirReparation(p.row, 'declarer')"
            >
              <q-tooltip>Déclarer une réparation</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="edit"
              @click="ouvrirEquipement(p.row)"
            />
            <q-btn
              v-if="auth.estAdmin"
              flat
              dense
              round
              color="negative"
              icon="delete"
              @click="supprimerEquipement(p.row)"
            />
          </q-td>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div
          v-for="e in equipements"
          :key="e.id"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
        >
          <q-card flat bordered class="carte full-height">
            <q-card-section>
              <div class="text-h6 ellipsis">{{ e.libelle }}</div>
              <div class="text-caption text-grey-7">{{ e.numeroInventaire }}</div>
            </q-card-section>
            <q-card-section class="row items-center">
              <div class="col-4 text-center">
                <canvas :ref="(el) => enregistrerCanvas(el, e)" />
              </div>
              <div class="col-8">
                <q-chip dense color="primary" text-color="white">
                  {{ e.categorie?.libelle ?? '—' }}
                </q-chip>
                <div class="text-caption text-grey-7 q-mt-xs">
                  {{ e.departement?.nom ?? 'Sans département' }}
                </div>
                <div class="text-caption text-grey-7" v-if="e.valeurAcquisition != null">
                  {{ montantLisible(e.valeurAcquisition) }} GNF
                </div>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <q-chip
                dense
                :color="e.enReparation ? 'warning' : e.actif ? 'positive' : 'grey-7'"
                text-color="white"
              >
                {{
                  e.enReparation
                    ? 'En réparation'
                    : e.actif
                    ? 'En service'
                    : 'Hors service'
                }}
              </q-chip>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right">
              <q-btn flat dense round icon="visibility" @click="voirDetails(e)">
                <q-tooltip>Détails</q-tooltip>
              </q-btn>
              <q-btn flat dense round icon="print" @click="imprimerEtiquette(e)">
                <q-tooltip>Étiquette A4</q-tooltip>
              </q-btn>
              <q-btn
                v-if="auth.peutPlanifier && !e.enReparation"
                flat
                dense
                round
                icon="build"
                @click="ouvrirReparation(e, 'declarer')"
              >
                <q-tooltip>Déclarer réparation</q-tooltip>
              </q-btn>
              <q-btn
                v-if="auth.peutPlanifier"
                flat
                dense
                round
                icon="edit"
                @click="ouvrirEquipement(e)"
              />
            </q-card-actions>
          </q-card>
        </div>
        <div v-if="!equipements.length && !chargement" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="inventory_2" size="42px" color="grey-5" />
          <div class="q-mt-sm">Aucun équipement</div>
        </div>
      </div>
    </template>

    <!-- ============================== Catégories -->
    <template v-if="onglet === 'categories'">
      <q-table
        flat
        bordered
        class="carte"
        :rows="categories"
        :columns="colonnesCategories"
        row-key="id"
        :loading="chargementCategories"
        :pagination="{ rowsPerPage: 20 }"
      >
        <template #body-cell-equipements="p">
          <q-td :props="p" class="text-right chiffres">
            {{ p.row._count?.equipements ?? 0 }}
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="edit"
              @click="ouvrirCategorie(p.row)"
            />
            <q-btn
              v-if="auth.estAdmin"
              flat
              dense
              round
              color="negative"
              icon="delete"
              @click="supprimerCategorie(p.row)"
            />
          </q-td>
        </template>
      </q-table>
    </template>

    <!-- ============================== Réparations -->
    <template v-if="onglet === 'reparations'">
      <q-card flat bordered class="carte">
        <q-card-section>
          <div class="text-subtitle2">Réparations en cours</div>
          <div class="text-caption text-grey-7">
            Badge de délai : vert < 7 jours, orange < 30 jours, rouge au-delà
          </div>
        </q-card-section>
        <q-table
          flat
          bordered
          :rows="reparationsEnCours"
          :columns="colonnesReparations"
          row-key="id"
          :loading="chargementReparations"
          :pagination="{ rowsPerPage: 20 }"
          hide-bottom
        >
          <template #body-cell-equipement="p">
            <q-td :props="p">
              <div class="text-weight-medium">{{ p.row.equipement?.libelle ?? '—' }}</div>
              <div class="text-caption text-grey-7">
                {{ p.row.equipement?.numeroInventaire ?? '—' }}
              </div>
            </q-td>
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <q-chip
                dense
                :color="p.row.statut === 'EN_COURS' ? 'warning' : 'accent'"
                text-color="white"
              >
                {{ p.row.statut === 'EN_COURS' ? 'En cours' : 'Déclarée' }}
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-declarLe="p">
            <q-td :props="p">
              {{ dateLisible(p.row.dateDeclaration) }}
            </q-td>
          </template>
          <template #body-cell-delai="p">
            <q-td :props="p">
              <q-chip
                dense
                :color="couleurDelai(joursEcarts(p.row.dateDeclaration))"
                text-color="white"
              >
                {{ joursEcarts(p.row.dateDeclaration) }} j
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="auth.peutPlanifier"
                flat
                dense
                round
                color="positive"
                icon="check_circle"
                @click="resoudreReparation(p.row)"
              >
                <q-tooltip>Marquer résolu</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card>
    </template>

    <patrimoine-dialog
      v-model="dialogEquipement"
      :equipement="equipementEdite"
      @enregistre="chargerEquipements"
    />

    <q-dialog v-model="dialogCategorie">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ categorieEditee ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="formCategorie.code"
            outlined
            dense
            label="Code *"
            hint="Ex. : VIDEO, MICRO, ORDI"
            class="q-mb-md"
          />
          <q-input
            v-model="formCategorie.libelle"
            outlined
            dense
            label="Libellé *"
            hint="Ex. : Vidéoprojecteur"
            class="q-mb-md"
          />
          <q-input
            v-model.number="formCategorie.dureeAmortissement"
            type="number"
            min="1"
            outlined
            dense
            label="Durée d'amortissement (mois)"
            hint="Ex. : 60 (5 ans)"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            label="Enregistrer"
            :loading="enregistrementCategorie"
            :disable="formCategorie.code.length < 2 || formCategorie.libelle.length < 2"
            @click="enregistrerCategorie"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <reparation-dialog
      v-model="dialogReparation"
      :mode="modeReparation"
      :equipement="equipementReparation"
      :reparation-ouverte="reparationOuverte"
      @enregistre="chargerReparations; chargerEquipements()"
    />

    <q-dialog v-model="dialogDetails">
      <q-card style="width: 720px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ equipementDetail?.libelle }}</div>
            <div class="text-caption text-grey-7">{{ equipementDetail?.numeroInventaire }}</div>
          </div>
          <q-btn flat dense round icon="close" v-close-popup />
        </q-card-section>
        <q-card-section v-if="equipementDetail">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-4 text-center">
              <canvas :ref="(el) => enregistrerCanvasDetail(el)" />
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ equipementDetail.qrCode }}
              </div>
            </div>
            <div class="col-12 col-sm-8">
              <q-list dense>
                <q-item><q-item-section avatar><q-icon name="category" /></q-item-section><q-item-section>{{ equipementDetail.categorie?.libelle }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="tag" /></q-item-section><q-item-section>{{ equipementDetail.numeroSerie }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="apartment" /></q-item-section><q-item-section>{{ equipementDetail.departement?.nom ?? '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="meeting_room" /></q-item-section><q-item-section>{{ equipementDetail.salle ? `${equipementDetail.salle.code} — ${equipementDetail.salle.nom}` : '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="shopping_cart" /></q-item-section><q-item-section>{{ equipementDetail.dateAcquisition ? dateLisible(equipementDetail.dateAcquisition) : '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="payments" /></q-item-section><q-item-section>{{ equipementDetail.valeurAcquisition != null ? `${montantLisible(equipementDetail.valeurAcquisition)} GNF` : '—' }}</q-item-section></q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
        <q-card-section v-if="reparationsDetail.length">
          <div class="text-subtitle2 q-mb-sm">Carnet de réparations</div>
          <q-list separator>
            <q-item v-for="r in reparationsDetail" :key="r.id">
              <q-item-section>
                <q-item-label>{{ r.description }}</q-item-label>
                <q-item-label caption>
                  {{ dateLisible(r.dateDeclaration) }}
                  <template v-if="r.prestataire"> · {{ r.prestataire }}</template>
                  <template v-if="r.cout"> · {{ montantLisible(r.cout) }} GNF</template>
                </q-item-label>
                <q-item-label caption v-if="r.notes">
                  <em>{{ r.notes }}</em>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip
                  dense
                  :color="r.statut === 'TERMINE' ? 'positive' : r.statut === 'ANNULE' ? 'grey-7' : 'warning'"
                  text-color="white"
                >
                  {{ libelleStatutReparation(r.statut) }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import PatrimoineDialog from '../components/PatrimoineDialog.vue';
import ReparationDialog from '../components/ReparationDialog.vue';
import { dateLisible, montantLisible } from '../utils/libelles';
import type {
  CategoriePatrimoine,
  EquipementPatrimoine,
  ReparationMateriel,
  StatutReparation,
} from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<'equipements' | 'categories' | 'reparations'>('equipements');

const equipements = ref<EquipementPatrimoine[]>([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });
const modeEquipements = ref<'tableau' | 'cartes'>('tableau');
const chargement = ref(false);

const categories = ref<CategoriePatrimoine[]>([]);
const chargementCategories = ref(false);

const reparationsEnCours = ref<ReparationMateriel[]>([]);
const reparationsDetail = ref<ReparationMateriel[]>([]);
const chargementReparations = ref(false);

const dialogEquipement = ref(false);
const equipementEdite = ref<EquipementPatrimoine | null>(null);

const dialogCategorie = ref(false);
const categorieEditee = ref<CategoriePatrimoine | null>(null);
const formCategorie = ref({ code: '', libelle: '', dureeAmortissement: 60 as number | null });
const enregistrementCategorie = ref(false);

const dialogReparation = ref(false);
const modeReparation = ref<'declarer' | 'resoudre'>('declarer');
const equipementReparation = ref<EquipementPatrimoine | null>(null);
const reparationOuverte = ref<ReparationMateriel | null>(null);

const dialogDetails = ref(false);
const equipementDetail = ref<EquipementPatrimoine | null>(null);

const colonnesEquipements: QTableColumn[] = [
  { name: 'libelle', label: 'Équipement', field: 'libelle', align: 'left' },
  { name: 'categorie', label: 'Catégorie', field: 'categorie', align: 'left' },
  {
    name: 'departement',
    label: 'Département',
    field: (r: EquipementPatrimoine) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'valeur', label: 'Valeur', field: 'valeur', align: 'right' },
  {
    name: 'serie',
    label: 'N° série',
    field: 'numeroSerie',
    align: 'left',
  },
  { name: 'etat', label: 'État', field: 'etat', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesCategories: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'libelle', label: 'Libellé', field: 'libelle', align: 'left' },
  {
    name: 'dureeAmortissement',
    label: 'Amortissement (mois)',
    field: (r: CategoriePatrimoine) => r.dureeAmortissement ?? '—',
    align: 'right',
  },
  { name: 'equipements', label: 'Équipements', field: 'equipements', align: 'right' },
  { name: 'actif', label: 'État', field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesReparations: QTableColumn[] = [
  { name: 'equipement', label: 'Équipement', field: 'equipement', align: 'left' },
  { name: 'description', label: 'Description', field: 'description', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'declarLe', label: 'Déclarée le', field: 'dateDeclaration', align: 'left' },
  { name: 'delai', label: 'Délai', field: 'delai', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

// --- Helpers

const cartes = ref<
  Map<string, HTMLCanvasElement | null>
>(new Map());

function enregistrerCanvas(el: any, e: EquipementPatrimoine) {
  if (!el) return;
  cartes.value.set(e.id, el);
  QRCode.toCanvas(el, e.qrCode, { width: 96, margin: 1 }).catch(() => {});
}

function enregistrerCanvasDetail(el: any) {
  if (!el || !equipementDetail.value) return;
  QRCode.toCanvas(el, equipementDetail.value.qrCode, { width: 180, margin: 1 }).catch(() => {});
}

function joursEcarts(date: string): number {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function couleurDelai(j: number): string {
  if (j < 7) return 'positive';
  if (j < 30) return 'warning';
  return 'negative';
}

function libelleStatutReparation(s: StatutReparation): string {
  return s === 'DECLARE'
    ? 'Déclarée'
    : s === 'EN_COURS'
    ? 'En cours'
    : s === 'TERMINE'
    ? 'Terminée'
    : 'Annulée';
}

function reinitialiserFiltres() {
  filtres.value = { recherche: filtres.value.recherche ?? '' };
  pagination.value.page = 1;
  chargerEquipements();
}

// --- Liste

const queryEquipements = computed(() => {
  const f = filtres.value;
  return {
    page: pagination.value.page,
    pageSize: pagination.value.pageSize,
    search: (f.recherche ?? '').toString().trim() || undefined,
    categorieId: f.categorieId || undefined,
    departementId: f.departementId || undefined,
    actif: f.actif || undefined,
    enReparation: f.enReparation || undefined,
  };
});

async function chargerEquipements() {
  chargement.value = true;
  try {
    const { data } = await api.get('/patrimoine/equipements', { params: queryEquipements.value });
    equipements.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerToutEquipements() {
  chargement.value = true;
  try {
    const { data } = await api.get('/patrimoine/equipements', {
      params: { ...queryEquipements.value, all: '1' },
    });
    equipements.value = data.data;
    pagination.value.total = data.total;
    pagination.value.page = 1;
    pagination.value.pageSize = data.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerCategories() {
  chargementCategories.value = true;
  try {
    const { data } = await api.get('/patrimoine/categories', { params: { all: '1' } });
    categories.value = Array.isArray(data) ? data : data.data ?? [];
  } finally {
    chargementCategories.value = false;
  }
}

async function chargerReparations() {
  chargementReparations.value = true;
  try {
    const { data } = await api.get('/patrimoine/equipements');
    void data;
    // Récupère toutes les réparations en cours via une route dédiée : faute
    // de mieux, on parcourt les équipements et leurs réparations.
    const equipementsListe = equipements.value.length
      ? equipements.value
      : (
          await api.get('/patrimoine/equipements', { params: { all: '1' } })
        ).data.data;
    const listes = await Promise.all(
      equipementsListe.map((e: EquipementPatrimoine) =>
        api
          .get(`/patrimoine/equipements/${e.id}/reparations`)
          .then((r) => r.data)
          .catch(() => []),
      ),
    );
    const aplats: ReparationMateriel[] = [];
    for (const l of listes) {
      for (const r of l as ReparationMateriel[]) {
        if (r.statut === 'EN_COURS' || r.statut === 'DECLARE') aplats.push(r);
      }
    }
    aplats.sort(
      (a, b) => new Date(a.dateDeclaration).getTime() - new Date(b.dateDeclaration).getTime(),
    );
    reparationsEnCours.value = aplats;
  } finally {
    chargementReparations.value = false;
  }
}

// --- Actions

function ouvrirEquipement(e: EquipementPatrimoine | null) {
  equipementEdite.value = e;
  dialogEquipement.value = true;
}

function ouvrirCategorie(c: CategoriePatrimoine | null) {
  categorieEditee.value = c;
  if (c) {
    formCategorie.value = {
      code: c.code,
      libelle: c.libelle,
      dureeAmortissement: c.dureeAmortissement ?? null,
    };
  } else {
    formCategorie.value = { code: '', libelle: '', dureeAmortissement: 60 };
  }
  dialogCategorie.value = true;
}

async function enregistrerCategorie() {
  enregistrementCategorie.value = true;
  try {
    const payload = {
      code: formCategorie.value.code.trim(),
      libelle: formCategorie.value.libelle.trim(),
      dureeAmortissement: formCategorie.value.dureeAmortissement ?? undefined,
    };
    if (categorieEditee.value) {
      await api.put(`/patrimoine/categories/${categorieEditee.value.id}`, payload);
      $q.notify({ type: 'positive', message: 'Catégorie mise à jour' });
    } else {
      await api.post('/patrimoine/categories', payload);
      $q.notify({ type: 'positive', message: 'Catégorie enregistrée' });
    }
    dialogCategorie.value = false;
    await chargerCategories();
  } finally {
    enregistrementCategorie.value = false;
  }
}

function supprimerCategorie(c: CategoriePatrimoine) {
  $q.dialog({
    title: 'Supprimer la catégorie ?',
    message: `« ${c.libelle} » — refusée si des équipements y sont rattachés.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    try {
      await api.delete(`/patrimoine/categories/${c.id}`);
      $q.notify({ type: 'positive', message: 'Catégorie supprimée' });
      await chargerCategories();
    } catch (e: any) {
      $q.notify({
        type: 'negative',
        message: e?.response?.data?.message ?? 'Suppression impossible',
      });
    }
  });
}

function supprimerEquipement(e: EquipementPatrimoine) {
  $q.dialog({
    title: 'Supprimer l’équipement ?',
    message: `${e.numeroInventaire} — refusée si une réparation a été consignée.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    try {
      await api.delete(`/patrimoine/equipements/${e.id}`);
      $q.notify({ type: 'positive', message: 'Équipement supprimé' });
      await chargerEquipements();
    } catch (err: any) {
      $q.notify({
        type: 'negative',
        message: err?.response?.data?.message ?? 'Suppression impossible',
      });
    }
  });
}

function ouvrirReparation(
  e: EquipementPatrimoine,
  mode: 'declarer' | 'resoudre',
  reparation?: ReparationMateriel | null,
) {
  equipementReparation.value = e;
  modeReparation.value = mode;
  reparationOuverte.value = reparation ?? null;
  dialogReparation.value = true;
}

function resoudreReparation(r: ReparationMateriel) {
  const eq = equipements.value.find((e) => e.id === r.equipementId);
  if (!eq) return;
  ouvrirReparation(eq, 'resoudre', r);
}

function imprimerEtiquette(e: EquipementPatrimoine) {
  window.open(
    `${API_URL}/patrimoine/equipements/${e.id}/imprimer?token=${auth.token}`,
    '_blank',
  );
}

async function voirDetails(e: EquipementPatrimoine) {
  equipementDetail.value = e;
  dialogDetails.value = true;
  const { data } = await api.get(`/patrimoine/equipements/${e.id}/reparations`);
  reparationsDetail.value = data;
}

// --- Wiring

watch(onglet, (v) => {
  if (v === 'reparations') chargerReparations();
  if (v === 'categories' && !categories.value.length) chargerCategories();
});

watch(filtres, () => {
  pagination.value.page = 1;
  chargerEquipements();
}, { deep: true });

onMounted(async () => {
  await chargerCategories();
  await chargerEquipements();
});
</script>
