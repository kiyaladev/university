<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Formations & certifications</div>
        <div class="page-sous-titre">
          Hub de formation continue : les formations se publient, se remplissent
          et se confirment au guichet (mode pilote). La scolarité remet ensuite
          l'attestation de formation.
        </div>
      </div>
      <div class="col-auto">
        <q-btn unelevated color="primary" no-caps icon="add" label="Nouvelle formation" @click="ouvrirNouvelle" />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (titre, catégorie, lieu…)"
      :recherche="true"
      @reinitialiser="reinitialiserFiltres"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-input
          v-model="filtres.categorie"
          dense
          outlined
          label="Catégorie"
          clearable
        />
        <q-input
          v-model.number="filtres.prixMin"
          type="number"
          min="0"
          dense
          outlined
          label="Prix min"
          clearable
        />
        <q-input
          v-model.number="filtres.prixMax"
          type="number"
          min="0"
          dense
          outlined
          label="Prix max"
          clearable
        />
      </template>
      <template #actions>
        <view-toggle
          cle="formations.admin"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (mode = v as 'tableau' | 'cartes')"
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

    <!-- Statistiques -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats.nbFormes }}</div>
            <div class="pochoir text-grey-7">Formés (inscriptions confirmées)</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ montantLisible(stats.recette) }} <span class="text-h6">GNF</span></div>
            <div class="pochoir text-grey-7">Recette encaissée</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats.tauxRemplissage }} %</div>
            <div class="pochoir text-grey-7">Taux de remplissage</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats.total }}</div>
            <div class="pochoir text-grey-7">Formations</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-table
      v-if="mode === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="formations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body="p">
        <q-tr :props="p" :class="{ 'ligne-detail': p.expand }">
          <q-td key="titre" :props="p">
            <div class="text-weight-bold">{{ p.row.titre }}</div>
            <div class="text-caption text-grey-7">{{ p.row.categorie ?? '—' }}</div>
          </q-td>
          <q-td key="statut" :props="p" class="text-center">
            <q-chip :color="couleurStatut(p.row.statut)" text-color="white" dense>
              {{ LIBELLE_STATUT_FORMATION[p.row.statut] ?? p.row.statut }}
            </q-chip>
          </q-td>
          <q-td key="prix" :props="p" class="text-right chiffres">
            <span v-if="p.row.prix > 0">{{ montantLisible(p.row.prix) }} {{ p.row.devise }}</span>
            <span v-else class="text-grey-6">Gratuite</span>
          </q-td>
          <q-td key="duree" :props="p" class="text-center chiffres">
            {{ p.row.dureeHeures ? `${p.row.dureeHeures} h` : '—' }}
            <div class="text-caption text-grey-7">{{ datesLisible(p.row) }}</div>
          </q-td>
          <q-td key="capacite" :props="p" class="text-center chiffres">
            {{ p.row.capacite ?? 'Libre' }}
            <span v-if="p.row.capacite" class="text-caption text-grey-7">
              · {{ p.row._count?.inscriptions ?? 0 }} demandes
            </span>
          </q-td>
          <q-td key="actions" :props="p" class="text-right">
            <q-btn
              v-if="p.row.statut === 'BROUILLON'"
              flat dense round color="secondary" icon="publish"
              @click="publier(p.row)"
            >
              <q-tooltip>Publier la formation</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'PUBLIEE'"
              flat dense round color="warning" icon="lock"
              @click="cloturer(p.row)"
            >
              <q-tooltip>Clôturer</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="edit" @click="ouvrirModification(p.row)">
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="group" @click="basculerRegistre(p)">
              <q-tooltip>Inscriptions</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'BROUILLON'"
              flat dense round color="negative" icon="delete_outline"
              @click="supprimer(p.row)"
            >
              <q-tooltip>Supprimer le brouillon</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>

        <tr v-if="p.expand" :key="`${p.row.id}-registre`" class="ligne-detail">
          <td colspan="6" class="q-pa-md">
            <div class="row items-center q-mb-sm">
              <div class="pochoir">Registre — {{ p.row.titre }}</div>
              <q-space />
              <q-btn flat dense no-caps color="primary" label="Recharger" icon="refresh" @click="chargerRegistre(p.row, true)" />
            </div>
            <q-table
              flat
              bordered
              class="carte"
              :rows="registres[p.row.id] ?? []"
              :columns="colonnesRegistre"
              row-key="id"
              :loading="!!registreCharge[p.row.id]"
              hide-bottom
            >
              <template #body-cell-inscrit="r">
                <q-td :props="r">
                  <div>{{ nomInscrit(r.row) }}</div>
                  <div class="text-caption text-grey-7">
                    {{ r.row.telephone ?? '—' }}<span v-if="r.row.email"> · {{ r.row.email }}</span>
                  </div>
                </q-td>
              </template>

              <template #body-cell-statut="r">
                <q-td :props="r">
                  <q-chip :color="couleurInscription(r.row.statut)" text-color="white" dense>
                    {{ LIBELLE_STATUT_INSCRIPTION_FORMATION[r.row.statut] ?? r.row.statut }}
                  </q-chip>
                </q-td>
              </template>

              <template #body-cell-paiement="r">
                <q-td :props="r">
                  <div class="chiffres">
                    {{ montantLisible(r.row.paiement?.montant) }} {{ r.row.paiement?.devise ?? 'GNF' }}
                  </div>
                  <div class="text-caption text-grey-7">{{ r.row.paiement?.reference ?? '—' }}</div>
                </q-td>
              </template>

              <template #body-cell-paiementStatut="r">
                <q-td :props="r">
                  <q-chip :color="couleurPaiement(r.row.paiement?.statut)" text-color="white" dense>
                    {{ LIBELLE_STATUT_PAIEMENT[r.row.paiement?.statut ?? ''] ?? '—' }}
                  </q-chip>
                </q-td>
              </template>

              <template #body-cell-actionsRegistre="r">
                <q-td :props="r" class="text-right">
                  <q-btn
                    v-if="r.row.statut === 'EN_ATTENTE'"
                    flat dense round color="secondary" icon="check_circle"
                    @click="confirmer(r.row)"
                  >
                    <q-tooltip>Confirmer le paiement</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="r.row.statut !== 'ANNULEE'"
                    flat dense round color="negative" icon="block"
                    @click="annuler(r.row)"
                  >
                    <q-tooltip>Annuler la demande</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="r.row.statut === 'CONFIRMEE'"
                    flat dense round icon="print"
                    @click="imprimerCertificat(r.row)"
                  >
                    <q-tooltip>Attestation de formation</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </td>
        </tr>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div v-if="chargement" class="col-12 q-pa-md text-center">
        <q-spinner color="primary" />
      </div>
      <div v-for="f in formations" :key="f.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ f.categorie ?? '—' }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ f.titre }}</div>
            </div>
            <q-chip :color="couleurStatut(f.statut)" text-color="white" dense>
              {{ LIBELLE_STATUT_FORMATION[f.statut] ?? f.statut }}
            </q-chip>
          </q-card-section>
          <q-card-section class="text-center">
            <div class="text-h3 chiffres">{{ montantLisible(f.prix) }} <span class="text-h6">{{ f.devise }}</span></div>
            <div class="text-caption text-grey-7 q-mt-sm">
              <span v-if="f.dureeHeures">{{ f.dureeHeures }} h</span>
              <span v-if="f.dateDebut"> · {{ datesLisible(f) }}</span>
            </div>
            <div class="q-mt-md">
              <q-badge
                :color="placesRestantes(f) > 0 ? 'positive' : 'negative'"
                :label="placesRestantesStr(f)"
              />
            </div>
          </q-card-section>
          <q-card-actions class="q-px-md">
            <q-btn flat dense no-caps icon="group" label="Inscriptions" @click="basculerRegistreCarte(f)" />
            <q-space />
            <q-btn flat dense round icon="edit" @click="ouvrirModification(f)">
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn
              v-if="f.statut === 'BROUILLON'"
              flat dense round color="secondary" icon="publish"
              @click="publier(f)"
            >
              <q-tooltip>Publier</q-tooltip>
            </q-btn>
            <q-btn
              v-if="f.statut === 'PUBLIEE'"
              flat dense round color="warning" icon="lock"
              @click="cloturer(f)"
            >
              <q-tooltip>Clôturer</q-tooltip>
            </q-btn>
            <q-btn
              v-if="f.statut === 'BROUILLON'"
              flat dense round color="negative" icon="delete_outline"
              @click="supprimer(f)"
            >
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-card-actions>
          <q-slide-transition>
            <div v-if="registreOuvert[f.id]" class="q-px-md q-pb-md">
              <q-separator class="q-mb-sm" />
              <div class="row items-center q-mb-sm">
                <div class="pochoir">Registre — {{ f.titre }}</div>
                <q-space />
                <q-btn flat dense no-caps color="primary" label="Recharger" icon="refresh" @click="chargerRegistre(f, true)" />
              </div>
              <q-table
                flat
                bordered
                class="carte"
                :rows="registres[f.id] ?? []"
                :columns="colonnesRegistre"
                row-key="id"
                :loading="!!registreCharge[f.id]"
                hide-bottom
                :rows-per-page-options="[0]"
              >
                <template #body-cell-inscrit="r">
                  <q-td :props="r">
                    <div>{{ nomInscrit(r.row) }}</div>
                    <div class="text-caption text-grey-7">
                      {{ r.row.telephone ?? '—' }}
                    </div>
                  </q-td>
                </template>
                <template #body-cell-statut="r">
                  <q-td :props="r">
                    <q-chip :color="couleurInscription(r.row.statut)" text-color="white" dense>
                      {{ LIBELLE_STATUT_INSCRIPTION_FORMATION[r.row.statut] ?? r.row.statut }}
                    </q-chip>
                  </q-td>
                </template>
                <template #body-cell-paiementStatut="r">
                  <q-td :props="r">
                    <q-chip :color="couleurPaiement(r.row.paiement?.statut)" text-color="white" dense>
                      {{ LIBELLE_STATUT_PAIEMENT[r.row.paiement?.statut ?? ''] ?? '—' }}
                    </q-chip>
                  </q-td>
                </template>
                <template #body-cell-actionsRegistre="r">
                  <q-td :props="r" class="text-right">
                    <q-btn
                      v-if="r.row.statut === 'EN_ATTENTE'"
                      flat dense round color="secondary" icon="check_circle"
                      @click="confirmer(r.row)"
                    >
                      <q-tooltip>Confirmer</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="r.row.statut !== 'ANNULEE'"
                      flat dense round color="negative" icon="block"
                      @click="annuler(r.row)"
                    >
                      <q-tooltip>Annuler</q-tooltip>
                    </q-btn>
                  </q-td>
                </template>
              </q-table>
            </div>
          </q-slide-transition>
        </q-card>
      </div>
      <div v-if="!chargement && !formations.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="school" size="42px" color="grey-5" />
        <div class="q-mt-sm">Aucune formation</div>
      </div>
    </div>

    <formation-dialog v-model="dialogFormation" :formation="formationEnCours" @enregistre="requeter" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import FormationDialog from '../components/FormationDialog.vue';
import {
  LIBELLE_STATUT_FORMATION,
  LIBELLE_STATUT_INSCRIPTION_FORMATION,
  LIBELLE_STATUT_PAIEMENT,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Formation, InscriptionFormation, Paiement, StatutFormation } from '../types';

interface InscriptionFormationDetail extends InscriptionFormation {
  formation?: Formation | null;
  etudiant?: Etudiant | null;
  paiement?: Paiement | null;
}

const $q = useAuthStore();
const q = useQuasar();

const formations = ref<Formation[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });

const filtres = ref<Record<string, any>>({ recherche: '' });
const mode = ref<'tableau' | 'cartes'>('tableau');

const optionsStatuts = Object.entries(LIBELLE_STATUT_FORMATION).map(([value, label]) => ({
  value: value as StatutFormation,
  label,
}));

const colonnes: QTableColumn[] = [
  { name: 'titre', label: 'Formation', field: 'titre', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'prix', label: 'Prix', field: 'prix', align: 'right' },
  { name: 'duree', label: 'Durée', field: 'dureeHeures', align: 'center' },
  { name: 'capacite', label: 'Places', field: 'capacite', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesRegistre: QTableColumn[] = [
  { name: 'numero', label: 'N° dossier', field: 'numero', align: 'left' },
  { name: 'inscrit', label: 'Inscrit(e)', field: 'inscrit', align: 'left' },
  { name: 'statut', label: 'Demande', field: 'statut', align: 'center' },
  { name: 'paiement', label: 'Montant', field: 'paiement', align: 'right' },
  { name: 'paiementStatut', label: 'Paiement', field: 'paiementStatut', align: 'center' },
  { name: 'actionsRegistre', label: '', field: 'id', align: 'right' },
];

const registres = ref<Record<string, InscriptionFormationDetail[]>>({});
const registreCharge = ref<Record<string, boolean>>({});
const registreOuvert = reactive<Record<string, boolean>>({});

function basculerRegistre(p: { row: Formation; expand: boolean }) {
  p.expand = !p.expand;
  if (p.expand) void chargerRegistre(p.row);
}

function basculerRegistreCarte(f: Formation) {
  registreOuvert[f.id] = !registreOuvert[f.id];
  if (registreOuvert[f.id]) void chargerRegistre(f);
}

async function chargerRegistre(f: Formation, force = false) {
  if (!registres.value[f.id] || force) {
    registreCharge.value[f.id] = true;
    try {
      const { data } = await api.get(`/formations/${f.id}/inscriptions`);
      registres.value[f.id] = Array.isArray(data) ? data : [];
    } catch {
      registres.value[f.id] = [];
    } finally {
      registreCharge.value[f.id] = false;
    }
  }
}

function couleurStatut(s: StatutFormation): string {
  return s === 'PUBLIEE' ? 'secondary' : s === 'COMPLETE' ? 'warning' : 'grey-7';
}

function couleurInscription(s: string): string {
  return s === 'CONFIRMEE' ? 'secondary' : s === 'ANNULEE' ? 'negative' : 'warning';
}

function couleurPaiement(s?: string): string {
  if (!s) return 'grey-6';
  return s === 'REUSSI' ? 'secondary' : s === 'ECHOUE' || s === 'ANNULE' ? 'negative' : 'warning';
}

function nomInscrit(i: InscriptionFormationDetail): string {
  if (i.nomComplet) return i.nomComplet;
  return i.etudiant ? `${i.etudiant.prenom} ${i.etudiant.nom}` : '—';
}

function datesLisible(f: Formation): string {
  if (!f.dateDebut) return '';
  if (!f.dateFin) return f.dateDebut;
  return `${f.dateDebut} → ${f.dateFin}`;
}

function placesRestantes(f: Formation): number {
  if (!f.capacite) return Number.POSITIVE_INFINITY;
  const occupe = (f._count?.inscriptions ?? 0) - (registres.value[f.id]?.filter((r) => r.statut === 'ANNULEE').length ?? 0);
  return Math.max(0, f.capacite - occupe);
}

function placesRestantesStr(f: Formation): string {
  if (!f.capacite) return 'Places illimitées';
  return `${placesRestantes(f)} / ${f.capacite} places`;
}

const dialogFormation = ref(false);
const formationEnCours = ref<Formation | null>(null);

function ouvrirNouvelle() {
  formationEnCours.value = null;
  dialogFormation.value = true;
}

function ouvrirModification(f: Formation) {
  formationEnCours.value = f;
  dialogFormation.value = true;
}

function reinitialiserFiltres() {
  filtres.value = { recherche: filtres.value.recherche ?? '' };
}

function publier(f: Formation) {
  q.dialog({
    title: 'Publier cette formation ?',
    message: `« ${f.titre} » entre en vitrine publique : les demandes et les paiements Mobile Money deviendront possibles.`,
    cancel: true,
    ok: { color: 'secondary', label: 'Publier' },
  }).onOk(async () => {
    await api.post(`/formations/${f.id}/publier`);
    q.notify({ type: 'positive', message: 'Formation publiée — en vente sur la vitrine' });
    await requeter();
  });
}

function cloturer(f: Formation) {
  q.dialog({
    title: 'Clôturer cette formation ?',
    message:
      `La vitrine cessera d'offrir « ${f.titre} » ; les demandes en attente ` +
      'ne pourront plus être confirmées. Le circuit de la promotion devient officiel.',
    cancel: true,
    ok: { color: 'warning', label: 'Clôturer' },
  }).onOk(async () => {
    await api.post(`/formations/${f.id}/cloturer`);
    q.notify({ type: 'warning', message: 'Formation close — plus aucune nouvelle demande' });
    await requeter();
  });
}

function supprimer(f: Formation) {
  q.dialog({
    title: 'Supprimer ce brouillon ?',
    message: `« ${f.titre} » ne s'est jamais vendu : sa suppression ne laisse aucune trace client.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/formations/${f.id}`);
    q.notify({ type: 'warning', message: 'Brouillon supprimé' });
    await requeter();
  });
}

function confirmer(i: InscriptionFormationDetail) {
  q.dialog({
    title: 'Confirmer le paiement ?',
    message:
      `Confirmation pilote : l'opérateur Mobile Money a encaissé — ${i.paiement?.reference ?? 'le paiement'} ` +
      `passe REUSSI et la demande ${i.numero} passe CONFIRMEE.`,
    cancel: true,
    ok: { color: 'secondary', label: 'Confirmer' },
  }).onOk(async () => {
    await api.post(`/formations/inscriptions/${i.id}/confirmer`);
    q.notify({ type: 'positive', message: `${i.numero} confirmée — place réservée` });
    await requeter();
  });
}

function annuler(i: InscriptionFormationDetail) {
  q.dialog({
    title: 'Annuler cette demande ?',
    message: `La demande ${i.numero} sera annulée ; sa place est libérée pour la vitrine.`,
    cancel: 'Non, garder',
    ok: { color: 'negative', label: 'Annuler la demande' },
  }).onOk(async () => {
    await api.post(`/formations/inscriptions/${i.id}/annuler`);
    q.notify({ type: 'warning', message: `${i.numero} annulée` });
    await requeter();
  });
}

function imprimerCertificat(i: InscriptionFormationDetail) {
  window.open(`${API_URL}/formations/${i.id}/certificat?token=${$q.token}`, '_blank');
}

// Stats
const stats = computed(() => {
  let nbFormes = 0;
  let recette = 0;
  let totalPlaces = 0;
  let placesOccupees = 0;
  for (const f of formations.value) {
    const inscriptions = registres.value[f.id] ?? [];
    const confirmes = inscriptions.filter((r) => r.statut === 'CONFIRMEE');
    nbFormes += confirmes.length;
    recette += confirmes.reduce((acc, r) => acc + (r.paiement?.montant ?? 0), 0);
    if (f.capacite) {
      totalPlaces += f.capacite;
      const occupe = inscriptions.filter((r) => r.statut !== 'ANNULEE').length;
      placesOccupees += Math.min(occupe, f.capacite);
    }
  }
  const tauxRemplissage = totalPlaces > 0 ? Math.round((placesOccupees / totalPlaces) * 100) : 0;
  return {
    nbFormes,
    recette,
    tauxRemplissage,
    total: formations.value.length,
  };
});

async function requeter() {
  chargement.value = true;
  try {
    const f = filtres.value;
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      search: (f.recherche ?? '').toString().trim() || undefined,
      statut: f.statut || undefined,
      categorie: f.categorie || undefined,
      prixMin: f.prixMin ?? undefined,
      prixMax: f.prixMax ?? undefined,
    };
    const { data } = await api.get('/formations', { params });
    formations.value = data.data;
    pagination.value.total = data.total;
    // Précharger les inscriptions pour les stats et la vue cartes
    await Promise.all(
      formations.value.map((f) => chargerRegistre(f)),
    );
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await requeter();
}

watch(filtres, () => {
  pagination.value.page = 1;
  void requeter();
}, { deep: true });

onMounted(() => {
  void requeter();
});
</script>

<style scoped lang="scss">
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}
</style>
