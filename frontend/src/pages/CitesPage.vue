<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Cités universitaires</div>
        <div class="page-sous-titre">
          Attribution transparente des chambres — critères sociaux et mérite, pilotée avec le
          rectorat (Centre des Œuvres Universitaires)
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="boutonOnglet"
          @click="ouvrirCourant"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="residences" icon="apartment" label="Résidences" no-caps />
      <q-tab name="chambres" icon="meeting_room" label="Chambres" no-caps />
      <q-tab name="attributions" icon="how_to_reg" label="Attributions" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------------------ -->
      <!-- Résidences : le parc, en un coup d'œil                              -->
      <!-- ------------------------------------------------------------------ -->
      <q-tab-panel name="residences" class="q-pa-none">
        <div v-if="chargement" class="q-pa-md text-center"><q-spinner color="primary" /></div>
        <div v-else class="row q-col-gutter-md">
          <div v-for="r in residences" :key="r.id" class="col-12 col-md-6 col-xl-4">
            <q-card flat bordered class="carte">
              <q-card-section class="row items-center q-pb-none">
                <div class="col">
                  <div class="text-uppercase text-caption text-grey-7">{{ r.code }}</div>
                  <div class="text-subtitle1 text-weight-medium">{{ r.nom }}</div>
                </div>
                <q-btn
                  v-if="chefParc"
                  flat dense round icon="edit"
                  @click="ouvrirResidence(r)"
                >
                  <q-tooltip>Modifier la résidence</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="auth.estAdmin"
                  flat dense round color="negative" icon="delete"
                  @click="supprimerResidence(r)"
                >
                  <q-tooltip>Supprimer (si aucun logement)</q-tooltip>
                </q-btn>
              </q-card-section>

              <q-card-section class="q-pt-none q-gutter-y-xs">
                <div class="row items-center">
                  <q-icon name="place" size="16px" class="q-mr-sm text-grey-6" />
                  <span class="text-caption">{{ r.ville ?? '—' }}</span>
                </div>
                <div class="row items-center">
                  <q-icon name="bed" size="16px" class="q-mr-sm text-grey-6" />
                  <span class="text-caption">Capacité : {{ nombreLisible(r.capacite) }} lits</span>
                </div>
                <div class="row items-center q-gutter-xs">
                  <q-icon name="meeting_room" size="16px" class="q-mr-sm text-grey-6" />
                  <q-chip dense size="sm" color="positive" text-color="white">
                    {{ compteLibres(r) }} libres
                  </q-chip>
                  <q-chip dense size="sm" color="amber-8" text-color="white">
                    {{ compteReservees(r) }} réservées
                  </q-chip>
                  <q-chip dense size="sm" color="blue-grey-5" text-color="white">
                    {{ compteOccupees(r) }} occupées
                  </q-chip>
                </div>
              </q-card-section>

              <q-separator />
              <q-card-actions class="text-caption text-grey-7 q-px-md">
                <q-icon name="person_outline" size="16px" class="q-mr-xs" />
                {{ r.responsable ?? 'Aucun responsable renseigné' }}
                <q-space />
                <q-badge v-if="!r.actif" color="grey-7" label="inactive" />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- ----------------------------------------------------------------- -->
      <!-- Chambres : le parc filtré                                          -->
      <!-- ----------------------------------------------------------------- -->
      <q-tab-panel name="chambres" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="chambresFiltrees"
          :columns="colonnesChambres"
          row-key="id"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #top-left>
            <div class="row items-center q-gutter-sm">
              <q-input v-model="chambreRecherche" dense outlined clearable placeholder="Code…">
                <template #prepend><q-icon name="search" /></template>
              </q-input>
              <q-select
                v-model="filtreResidenceId"
                :options="optionsResidences"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="Résidence"
                style="min-width: 150px"
              />
              <q-select
                v-model="filtreCategorie"
                :options="optionsCategories"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="Catégorie"
                style="min-width: 160px"
              />
              <q-select
                v-model="filtreStatutChambre"
                :options="optionsStatutsChambre"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="Statut"
                style="min-width: 140px"
              />
            </div>
          </template>

          <template #body-cell-categorie="p">
            <q-td :props="p">{{ LIBELLE_CATEGORIE_CHAMBRE[p.row.categorie] ?? p.row.categorie }}</q-td>
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <span class="champ champ-statut champ-statut--dense" :class="classeStatutChambre(p.row.statut)">
                <span class="pochoir">{{ LIBELLE_STATUT_CHAMBRE[p.row.statut] ?? p.row.statut }}</span>
              </span>
            </q-td>
          </template>
          <template #body-cell-loyer="p">
            <q-td :props="p" class="text-right">{{ montantLisible(p.row.loyer) }} {{ p.row.devise }}</q-td>
          </template>
          <template #body-cell-residence="p">
            <q-td :props="p">{{ p.row.residence?.nom ?? '—' }}</q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn v-if="peutGererChambres" flat dense round icon="edit" @click="ouvrirChambre(p.row)" />
              <q-btn
                v-if="auth.estAdmin"
                flat dense round
                color="negative" icon="delete"
                @click="supprimerChambre(p.row)"
              />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ----------------------------------------------------------------- -->
      <!-- Attributions : demandes, score, décisions du jury                  -->
      <!-- ----------------------------------------------------------------- -->
      <q-tab-panel name="attributions" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="attributions"
          :columns="colonnesAttributions"
          row-key="id"
          :loading="chargementAttributions"
          :pagination="paginationAttributions"
          @request="requeteAttributions"
        >
          <template #top-left>
            <div class="row q-gutter-sm">
              <q-select
                v-model="filtreAnneeId"
                :options="optionsAnnees"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="Année"
                style="min-width: 150px"
                @update:model-value="rechargerAttributions"
              />
              <q-select
                v-model="filtreStatutAttribution"
                :options="optionsStatutsAttribution"
                dense
                outlined
                clearable
                emit-value
                map-options
                label="Statut"
                style="min-width: 140px"
                @update:model-value="rechargerAttributions"
              />
              <q-input
                v-model="rechercheEtudiant"
                dense
                outlined
                clearable
                placeholder="Étudiant…"
                @update:model-value="rechargerAttributions"
                @keydown.enter="rechargerAttributions"
              >
                <template #prepend><q-icon name="search" /></template>
              </q-input>
            </div>
          </template>

          <template #body-cell-createdAt="p">
            <q-td :props="p">{{ dateLisible(p.row.createdAt) }}</q-td>
          </template>
          <template #body-cell-etudiant="p">
            <q-td :props="p">
              <div class="text-weight-medium">{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
              <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
            </q-td>
          </template>
          <template #body-cell-annee="p">
            <q-td :props="p">{{ p.row.annee?.libelle ?? '—' }}</q-td>
          </template>
          <template #body-cell-chambre="p">
            <q-td :props="p">
              <div class="text-weight-medium">{{ p.row.chambre?.code }}</div>
              <div class="text-caption text-grey-7">{{ p.row.chambre?.residence?.nom }}</div>
            </q-td>
          </template>
          <template #body-cell-loyer="p">
            <q-td :props="p" class="text-right">
              {{ p.row.chambre ? montantLisible(p.row.chambre.loyer) + ' ' + p.row.chambre.devise : '—' }}
            </q-td>
          </template>
          <template #body-cell-score="p">
            <q-td :props="p">
              <q-badge
                v-if="p.row.critereScore !== null"
                dense
                :color="couleurScore(p.row.critereScore)"
                text-color="white"
              >
                {{ p.row.critereScore }}
              </q-badge>
              <span v-else class="text-grey-6">—</span>
            </q-td>
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <span class="champ champ-statut champ-statut--dense" :class="classeStatutAttribution(p.row.statut)">
                <span class="pochoir">{{ LIBELLE_STATUT_ATTRIBUTION[p.row.statut] ?? p.row.statut }}</span>
              </span>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="p.row.statut === 'EN_ATTENTE' && peutDecider"
                flat dense round
                color="primary" icon="gavel"
                @click="ouvrirDecision(p.row)"
              >
                <q-tooltip>Décision du jury</q-tooltip>
              </q-btn>
              <q-btn
                v-if="['EN_ATTENTE', 'ACCORDEE'].includes(p.row.statut) && auth.estAdmin"
                flat dense round
                color="negative" icon="undo"
                @click="retirerAttribution(p.row)"
              >
                <q-tooltip>Retirer l’attribution</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Dialogues -->
    <residence-dialog v-model="residenceDialog" :residence="residenceEditee" @enregistre="chargerTout" />
    <chambre-dialog v-model="chambreDialog" :chambre="chambreEditee" :residences="residences" @enregistre="chargerTout" />
    <attribution-dialog
      v-model="attributionDialog"
      :chambres="chambres"
      :annees="annees"
      :annee-defaut-id="anneeDefaut"
      @enregistre="chargerTout"
    />

    <!-- Décision du jury : aucune demi-mesure, ACCORDER ou REFUSER -->
    <q-dialog v-model="decisionDialog">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">Décision du jury</q-card-section>
        <q-card-section class="q-pt-none text-caption text-grey-7">
          {{ decision?.etudiant?.nom }} {{ decision?.etudiant?.prenom }} —
          {{ decision?.chambre?.code }} ({{ decision?.chambre?.residence?.nom }})
          <template v-if="decision?.critereScore !== null"> · score {{ decision?.critereScore }}</template>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="commentaireDecision"
            outlined
            dense
            type="textarea"
            label="Commentaire (facultatif)"
            :autogrow="true"
            rows="2"
          />
          <div class="row q-gutter-sm q-mt-md">
            <q-btn
              unelevated
              color="positive"
              icon="check_circle"
              label="Accorder la chambre"
              class="col"
              :loading="decisionEnCours"
              @click="decider('ACCORDEE')"
            />
            <q-btn
              unelevated
              color="negative"
              icon="cancel"
              label="Refuser"
              class="col"
              :loading="decisionEnCours"
              @click="decider('REFUSEE')"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat v-close-popup label="Fermer" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ResidenceDialog from '../components/ResidenceDialog.vue';
import ChambreDialog from '../components/ChambreDialog.vue';
import AttributionDialog from '../components/AttributionDialog.vue';
import {
  LIBELLE_CATEGORIE_CHAMBRE,
  LIBELLE_STATUT_ATTRIBUTION,
  LIBELLE_STATUT_CHAMBRE,
  dateLisible,
  montantLisible,
  nombreLisible,
} from '../utils/libelles';
import type { AnneeAcademique, AttributionLogement, Chambre, Residence } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref('residences');

const residences = ref<Residence[]>([]);
const chambres = ref<Chambre[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const attributions = ref<AttributionLogement[]>([]);

const chargement = ref(false);
const chargementAttributions = ref(false);

const residenceDialog = ref(false);
const residenceEditee = ref<Residence | null>(null);
const chambreDialog = ref(false);
const chambreEditee = ref<Chambre | null>(null);
const attributionDialog = ref(false);

// ---------------------------------------------------------------- filtres
const chambreRecherche = ref('');
const filtreResidenceId = ref<string | null>(null);
const filtreCategorie = ref<string | null>(null);
const filtreStatutChambre = ref<string | null>(null);
const rechercheEtudiant = ref('');
const filtreAnneeId = ref<string | null>(null);
const filtreStatutAttribution = ref<string | null>(null);
const anneeDefaut = ref<string | null>(null);

const paginationAttributions = ref({ page: 1, rowsPerPage: 25, rowsNumber: 0 });

// ------------------------------------------------------------- colonnes
const colonnesChambres: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'residence', label: 'Résidence', field: 'residence', align: 'left' },
  { name: 'categorie', label: 'Catégorie', field: 'categorie', align: 'left', sortable: true },
  { name: 'lits', label: 'Lits', field: 'lits', align: 'center' },
  { name: 'loyer', label: 'Loyer', field: 'loyer', align: 'right', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesAttributions: QTableColumn[] = [
  { name: 'createdAt', label: 'Demandé le', field: 'createdAt', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: 'id', align: 'left' },
  { name: 'chambre', label: 'Chambre', field: 'id', align: 'left' },
  { name: 'annee', label: 'Année', field: 'annee', align: 'left' },
  { name: 'score', label: 'Score', field: 'critereScore', align: 'center' },
  { name: 'loyer', label: 'Loyer', field: 'id', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

// ---------------------------------------------------------------- droits
const chefParc = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutGererChambres = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));
const peutDecider = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));
const peutCreerAttribution = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const peutGerer = computed(() =>
  onglet.value === 'residences' ? chefParc.value
    : onglet.value === 'chambres' ? peutGererChambres.value
      : peutCreerAttribution.value,
);

const boutonOnglet = computed(() =>
  onglet.value === 'residences' ? 'Nouvelle résidence'
    : onglet.value === 'chambres' ? 'Nouvelle chambre'
      : 'Nouvelle attribution',
);

function ouvrirCourant() {
  if (onglet.value === 'residences') ouvrirResidence(null);
  else if (onglet.value === 'chambres') ouvrirChambre(null);
  else attributionDialog.value = true;
}

// ----------------------------------------------------------- résidences
function ouvrirResidence(r: Residence | null) {
  residenceEditee.value = r;
  residenceDialog.value = true;
}

function supprimerResidence(r: Residence) {
  $q.dialog({
    title: 'Supprimer la résidence',
    message: `Supprimer définitivement ${r.nom} (${r.code}) ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/residences/${r.id}`);
    $q.notify({ type: 'positive', message: 'Résidence supprimée' });
    await chargerTout();
  });
}

const chambresResidence = (r: Residence) => r.chambres ?? [];
const compteLibres = (r: Residence) => chambresResidence(r).filter((c) => c.statut === 'LIBRE').length;
const compteReservees = (r: Residence) => chambresResidence(r).filter((c) => c.statut === 'RESERVEE').length;
const compteOccupees = (r: Residence) => chambresResidence(r).filter((c) => c.statut === 'OCCUPEE').length;

// ---------------------------------------------------------------- chambres
const optionsResidences = computed(() =>
  residences.value.map((r) => ({ label: `${r.code} — ${r.nom}`, value: r.id })),
);
const optionsCategories = computed(() =>
  Object.entries(LIBELLE_CATEGORIE_CHAMBRE).map(([value, label]) => ({ value, label })),
);
const optionsStatutsChambre = computed(() =>
  Object.entries(LIBELLE_STATUT_CHAMBRE).map(([value, label]) => ({ value, label })),
);

function ouvrirChambre(c: Chambre | null) {
  chambreEditee.value = c;
  chambreDialog.value = true;
}

function supprimerChambre(c: Chambre) {
  $q.dialog({
    title: 'Supprimer la chambre',
    message: `Supprimer définitivement la chambre ${c.code} ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/chambres/${c.id}`);
    $q.notify({ type: 'positive', message: 'Chambre supprimée' });
    await chargerTout();
  });
}

const chambresFiltrees = computed(() => {
  const q = chambreRecherche.value.trim().toLowerCase();
  return chambres.value.filter((c) => {
    if (filtreResidenceId.value && c.residenceId !== filtreResidenceId.value) return false;
    if (filtreCategorie.value && c.categorie !== filtreCategorie.value) return false;
    if (filtreStatutChambre.value && c.statut !== filtreStatutChambre.value) return false;
    if (q && !c.code.toLowerCase().includes(q)) return false;
    return true;
  });
});

// ------------------------------------------------------------- attributions
const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const optionsStatutsAttribution = computed(() =>
  Object.entries(LIBELLE_STATUT_ATTRIBUTION).map(([value, label]) => ({ value, label })),
);

function rechargerAttributions() {
  paginationAttributions.value = { ...paginationAttributions.value, page: 1 };
  chargerAttributions();
}

async function requeteAttributions(props: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }) {
  paginationAttributions.value = { ...paginationAttributions.value, ...props.pagination };
  await chargerAttributions();
}

async function chargerAttributions() {
  chargementAttributions.value = true;
  try {
    const { data } = await api.get('/attributions-logement', {
      params: {
        page: paginationAttributions.value.page,
        pageSize: paginationAttributions.value.rowsPerPage,
        anneeId: filtreAnneeId.value || undefined,
        statut: filtreStatutAttribution.value || undefined,
        search: rechercheEtudiant.value.trim() || undefined,
      },
    });
    attributions.value = data.data;
    paginationAttributions.value = {
      ...paginationAttributions.value,
      rowsNumber: data.total,
    };
  } finally {
    chargementAttributions.value = false;
  }
}

// ------------------------------------------------------- décision du jury
const decisionDialog = ref(false);
const decision = ref<AttributionLogement | null>(null);
const commentaireDecision = ref('');
const decisionEnCours = ref(false);

function ouvrirDecision(a: AttributionLogement) {
  decision.value = a;
  commentaireDecision.value = '';
  decisionDialog.value = true;
}

async function decider(statut: 'ACCORDEE' | 'REFUSEE') {
  decisionEnCours.value = true;
  try {
    await api.put(`/attributions-logement/${decision.value!.id}/decider`, {
      statut,
      commentaire: commentaireDecision.value || undefined,
    });
    $q.notify({
      type: statut === 'ACCORDEE' ? 'positive' : 'info',
      message: statut === 'ACCORDEE' ? 'Attribution accordée — chambre occupée' : 'Demande refusée',
    });
    decisionDialog.value = false;
    await chargerTout();
  } finally {
    decisionEnCours.value = false;
  }
}

function retirerAttribution(a: AttributionLogement) {
  const etudiant = `${a.etudiant?.nom} ${a.etudiant?.prenom}`;
  $q.dialog({
    title: 'Retirer l’attribution',
    message: `Retirer l’attribution de ${etudiant} pour la chambre ${a.chambre?.code} (${a.chambre?.residence?.nom}) ? La chambre redeviendra ${'libre'}.`,
    prompt: { model: '', type: 'text', label: 'Motif du retrait (facultatif)' },
    cancel: true,
    ok: { color: 'negative', label: 'Retirer', unelevated: true },
  }).onOk(async (motif: string) => {
    await api.put(`/attributions-logement/${a.id}/retirer`, { motif: motif || undefined });
    $q.notify({ type: 'positive', message: 'Attribution retirée' });
    await chargerTout();
  });
}

// ------------------------------------------------------------------ labels
const classeStatutChambre = (s: string) =>
  ({
    LIBRE: 'champ--present',
    RESERVEE: 'champ--retard',
    OCCUPEE: 'champ--attente',
    MAINTENANCE: 'champ--absent',
  })[s] ?? 'champ--attente';

const classeStatutAttribution = (s: string) =>
  ({
    EN_ATTENTE: 'champ--attente',
    ACCORDEE: 'champ--present',
    REFUSEE: 'champ--absent',
    RETIREE: 'champ--retard',
  })[s] ?? 'champ--attente';

const couleurScore = (score: number) =>
  (score >= 70 ? 'positive' : score >= 40 ? 'warning' : 'negative');

// ------------------------------------------------------------------ chargement
async function chargerTout() {
  chargement.value = true;
  try {
    const [res, cham, ans] = await Promise.all([
      api.get('/residences', { params: { all: '1' } }),
      api.get('/chambres', { params: { all: '1' } }),
      api.get('/annees', { params: { all: '1' } }),
    ]);
    residences.value = res.data.data;
    chambres.value = cham.data.data;
    annees.value = ans.data.data;
    const active = annees.value.find((a) => a.active);
    if (active) {
      anneeDefaut.value = active.id;
      if (!filtreAnneeId.value) filtreAnneeId.value = active.id;
    }
    await chargerAttributions();
  } finally {
    chargement.value = false;
  }
}

onMounted(chargerTout);
</script>