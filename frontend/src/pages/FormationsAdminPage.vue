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

    <q-table
      flat
      bordered
      class="carte"
      :rows="formations"
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
            placeholder="Titre, catégorie, lieu…"
            @update:model-value="recharger"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Statut"
            style="min-width: 150px"
            @update:model-value="recharger"
          />
        </div>
      </template>

      <!-- Corps peint à la main : la ligne s'étend en plaque « registre » -->
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
              flat
              dense
              round
              color="secondary"
              icon="publish"
              @click="publier(p.row)"
            >
              <q-tooltip>Publier la formation (vitrine en ligne)</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'PUBLIEE'"
              flat
              dense
              round
              color="warning"
              icon="lock"
              @click="cloturer(p.row)"
            >
              <q-tooltip>Clôturer : plus aucune demande acceptée</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="edit" @click="ouvrirModification(p.row)">
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="group" @click="basculerRegistre(p)">
              <q-tooltip>Inscriptions de la formation</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'BROUILLON'"
              flat
              dense
              round
              color="negative"
              icon="delete_outline"
              @click="supprimer(p.row)"
            >
              <q-tooltip>Supprimer le brouillon (aucune demande déposée)</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>

        <!-- Registre : le panneau se descend sous la ligne étendue -->
        <tr v-if="p.expand" :key="`${p.row.id}-registre`" class="ligne-detail">
          <td colspan="6" class="q-pa-md">
            <div class="row items-center q-mb-sm">
              <div class="pochoir">Registre — {{ p.row.titre }}</div>
              <q-space />
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                label="Recharger"
                icon="refresh"
                @click="chargerRegistre(p.row, true)"
              />
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
                    flat
                    dense
                    round
                    color="secondary"
                    icon="check_circle"
                    @click="confirmer(r.row)"
                  >
                    <q-tooltip>Confirmer : paiement Mobile Money réussi (guichet)</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="r.row.statut !== 'ANNULEE'"
                    flat
                    dense
                    round
                    color="negative"
                    icon="block"
                    @click="annuler(r.row)"
                  >
                    <q-tooltip>Annuler la demande</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="r.row.statut === 'CONFIRMEE'"
                    flat
                    dense
                    round
                    icon="print"
                    @click="imprimerCertificat(r.row)"
                  >
                    <q-tooltip>Attestation de formation (A4)</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </td>
        </tr>
      </template>
    </q-table>

    <formation-dialog v-model="dialogFormation" :formation="formationEnCours" @enregistre="recharger" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FormationDialog from '../components/FormationDialog.vue';
import {
  LIBELLE_STATUT_FORMATION,
  LIBELLE_STATUT_INSCRIPTION_FORMATION,
  LIBELLE_STATUT_PAIEMENT,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Formation, InscriptionFormation, Paiement, StatutFormation } from '../types';

/** Ligne du registre : le paiement et la fiche sont joints par le serveur. */
interface InscriptionFormationDetail extends InscriptionFormation {
  formation?: Formation | null;
  etudiant?: Etudiant | null;
  paiement?: Paiement | null;
}

const $q = useQuasar();
const auth = useAuthStore();

const formations = ref<Formation[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 });

const filtres = ref({ search: '', statut: null as StatutFormation | null });

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

// ------------------------------------------------------------ registre

const registres = ref<Record<string, InscriptionFormationDetail[]>>({});
const registreCharge = ref<Record<string, boolean>>({});

/** Extension inline (panneau « registre » descendu sous la ligne). */
function basculerRegistre(p: { row: Formation; expand: boolean }) {
  p.expand = !p.expand;
  if (p.expand) void chargerRegistre(p.row);
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

// ------------------------------------------------------------ actions

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

function publier(f: Formation) {
  $q.dialog({
    title: 'Publier cette formation ?',
    message: `« ${f.titre} » entre en vitrine publique : les demandes et les paiements Mobile Money deviendront possibles.`,
    cancel: true,
    ok: { color: 'secondary', label: 'Publier' },
  }).onOk(async () => {
    await api.post(`/formations/${f.id}/publier`);
    $q.notify({ type: 'positive', message: 'Formation publiée — en vente sur la vitrine' });
    await recharger();
  });
}

function cloturer(f: Formation) {
  $q.dialog({
    title: 'Clôturer cette formation ?',
    message:
      `La vitrine cessera d'offrir « ${f.titre} » ; les demandes en attente ` +
      'ne pourront plus être confirmées. Le circuit de la promotion devient officiel.',
    cancel: true,
    ok: { color: 'warning', label: 'Clôturer' },
  }).onOk(async () => {
    await api.post(`/formations/${f.id}/cloturer`);
    $q.notify({ type: 'warning', message: 'Formation close — plus aucune nouvelle demande' });
    await recharger();
  });
}

function supprimer(f: Formation) {
  $q.dialog({
    title: 'Supprimer ce brouillon ?',
    message: `« ${f.titre} » ne s'est jamais vendu : sa suppression ne laisse aucune trace client.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/formations/${f.id}`);
    $q.notify({ type: 'warning', message: 'Brouillon supprimé' });
    await recharger();
  });
}

function confirmer(i: InscriptionFormationDetail) {
  $q.dialog({
    title: 'Confirmer le paiement ?',
    message:
      `Confirmation pilote : l'opérateur Mobile Money a encaissé — ${i.paiement?.reference ?? 'le paiement'} ` +
      `passe REUSSI et la demande ${i.numero} passe CONFIRMEE.`,
    cancel: true,
    ok: { color: 'secondary', label: 'Confirmer' },
  }).onOk(async () => {
    await api.post(`/formations/inscriptions/${i.id}/confirmer`);
    $q.notify({ type: 'positive', message: `${i.numero} confirmée — place réservée` });
    await recharger();
  });
}

function annuler(i: InscriptionFormationDetail) {
  $q.dialog({
    title: 'Annuler cette demande ?',
    message: `La demande ${i.numero} sera annulée ; sa place est libérée pour la vitrine.`,
    cancel: 'Non, garder',
    ok: { color: 'negative', label: 'Annuler la demande' },
  }).onOk(async () => {
    await api.post(`/formations/inscriptions/${i.id}/annuler`);
    $q.notify({ type: 'warning', message: `${i.numero} annulée` });
    await recharger();
  });
}

function imprimerCertificat(i: InscriptionFormationDetail) {
  window.open(`${API_URL}/formations/${i.id}/certificat?token=${auth.token}`, '_blank');
}

// ------------------------------------------------------------ chargement

async function repondreRequete(props: {
  pagination: { page: number; rowsPerPage: number; rowsNumber?: number };
}) {
  const { page, rowsPerPage } = props.pagination;
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page,
      pageSize: rowsPerPage === 0 ? undefined : rowsPerPage,
      ...(filtres.value.statut ? { statut: filtres.value.statut } : {}),
      ...(filtres.value.search ? { search: filtres.value.search } : {}),
    };
    const { data } = await api.get('/formations', { params });
    formations.value = data.data;
    pagination.value.rowsNumber = data.total;
    pagination.value.page = data.page;
  } finally {
    chargement.value = false;
  }
}

async function recharger() {
  pagination.value.page = 1;
  await repondreRequete({ pagination: pagination.value });
}

onMounted(() => repondreRequete({ pagination: pagination.value }));
</script>