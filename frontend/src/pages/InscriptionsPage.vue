<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Inscriptions</div>
        <div class="page-sous-titre">
          Dossiers de l’année : encaisser les frais par Mobile Money ou au
          guichet, valider les dossiers réglés, imprimer les certificats.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle inscription"
          @click="dialogInscription = true"
        />
      </div>
    </div>

    <!-- Filtres -->
    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm items-center">
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.anneeId"
            :options="optionsAnnees"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Année"
            @update:model-value="filtres.promotionId = null; charger()"
          />
        </div>
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.promotionId"
            :options="optionsPromotions"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Promotion"
            @update:model-value="charger"
          />
        </div>
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Statut"
            @update:model-value="charger"
          />
        </div>
        <div class="col-6 col-md-auto text-right text-caption text-grey-7">
          {{ inscriptions.length }} dossier(s)
        </div>
      </q-card-section>
    </q-card>

    <q-table
      flat
      bordered
      class="carte"
      :rows="inscriptions"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip dense outline color="primary">{{ p.row.promotion?.nom }}</q-chip>
          <div class="text-caption text-grey-7">{{ p.row.annee?.libelle }}</div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_INSCRIPTION[p.row.statut] ?? p.row.statut }}
          </span>
        </q-td>
      </template>

      <template #body-cell-montantFrais="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montantFrais) }}
        </q-td>
      </template>

      <template #body-cell-paye="p">
        <q-td :props="p" class="text-right">
          <span :class="{ 'text-positive text-weight-medium': solde(p.row) >= p.row.montantFrais }">
            {{ montantLisible(solde(p.row)) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            color="primary"
            icon="payments"
            @click="encaisser(p.row)"
          >
            <q-tooltip>Encaisser un paiement</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutValider(p.row)"
            flat
            dense
            round
            color="positive"
            icon="verified"
            @click="valider(p.row)"
          >
            <q-tooltip>Valider le dossier (frais réglés)</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutAnnuler(p.row)"
            flat
            dense
            round
            color="negative"
            icon="cancel"
            @click="annuler(p.row)"
          >
            <q-tooltip>Annuler le dossier</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="print" @click="imprimer(p.row)">
            <q-tooltip>Certificat d’inscription A4</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <inscription-dialog v-model="dialogInscription" @enregistre="charger" />
    <paiement-dialog
      v-model="dialogPaiement"
      :inscription-id="paiementInscriptionId"
      @paye="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import InscriptionDialog from '../components/InscriptionDialog.vue';
import PaiementDialog from '../components/PaiementDialog.vue';
import {
  LIBELLE_STATUT_INSCRIPTION,
  montantLisible,
} from '../utils/libelles';
import type { AnneeAcademique, Inscription, Paiement, Promotion } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const inscriptions = ref<Inscription[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const chargement = ref(false);

const filtres = ref<{
  anneeId: string | null;
  promotionId: string | null;
  statut: string | null;
}>({ anneeId: null, promotionId: null, statut: null });

const dialogInscription = ref(false);
const dialogPaiement = ref(false);
const paiementInscriptionId = ref<string | undefined>(undefined);

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const optionsPromotions = computed(() => {
  let liste = promotions.value;
  if (filtres.value.anneeId) liste = liste.filter((p) => p.anneeId === filtres.value.anneeId);
  return liste.map((p) => ({ label: p.nom, value: p.id }));
});
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_INSCRIPTION).map(([value, label]) => ({ value, label })),
);

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N° dossier', field: 'numero', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', align: 'left' },
  { name: 'promotion', label: 'Année / Promotion', field: 'promotion', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'montantFrais', label: 'Frais (GNF)', field: 'montantFrais', align: 'right', sortable: true },
  { name: 'paye', label: 'Payé (GNF)', field: 'paye', align: 'right' },
  { name: 'dateInscription', label: 'Créé le', field: 'createdAt', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const classeStatut = (s: string) =>
  ({
    BROUILLON: 'champ--brouillon',
    EN_ATTENTE_PAIEMENT: 'champ--attente-paiement',
    PAYEE: 'champ--payee',
    VALIDEE: 'champ--validee',
    ANNULEE: 'champ--annulee',
  })[s] ?? 'champ--brouillon';

/** Somme des paiements réussis du dossier. */
function solde(dossier: Inscription): number {
  return (dossier.paiements ?? [])
    .filter((p: Paiement) => p.statut === 'REUSSI')
    .reduce((t, p) => t + p.montant, 0);
}

const peutValider = (d: Inscription) =>
  auth.aRole(['SCOLARITE', 'ADMIN']) && d.statut === 'PAYEE';
const peutAnnuler = (d: Inscription) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && !['VALIDEE', 'ANNULEE'].includes(d.statut);

function encaisser(row: Inscription) {
  paiementInscriptionId.value = row.id;
  dialogPaiement.value = true;
}

function valider(dossier: Inscription) {
  $q.dialog({
    title: 'Valider le dossier',
    message: `Valider ${dossier.numero} (${dossier.etudiant?.prenom} ${dossier.etudiant?.nom}) ? Les frais sont réglés, le dossier devient définitif.`,
    cancel: true,
    ok: { label: 'Valider', color: 'positive', unelevated: true },
  }).onOk(async () => {
    await api.put(`/inscriptions/${dossier.id}/valider`);
    $q.notify({ type: 'positive', message: 'Dossier validé' });
    await charger();
  });
}

function annuler(dossier: Inscription) {
  $q.dialog({
    title: 'Annuler le dossier',
    message: `Annuler ${dossier.numero} ? Les paiements restent tracés au registre.`,
    cancel: true,
    ok: { color: 'negative', label: 'Annuler le dossier' },
  }).onOk(async () => {
    await api.put(`/inscriptions/${dossier.id}/annuler`);
    $q.notify({ type: 'warning', message: 'Dossier annulé' });
    await charger();
  });
}

function imprimer(dossier: Inscription) {
  window.open(
    `${API_URL}/inscriptions/${dossier.id}/attestation-inscription?token=${auth.token}`,
    '_blank',
  );
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/inscriptions', {
      params: {
        all: '1',
        anneeId: filtres.value.anneeId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        statut: filtres.value.statut || undefined,
      },
    });
    inscriptions.value = data.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const [rAnnees, rPromotions] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = rAnnees.data.data;
  promotions.value = rPromotions.data.data;
  filtres.value.anneeId = annees.value.find((a) => a.active)?.id ?? null;
  await charger();
});
</script>

<style>
.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.champ--brouillon { background: #cfd4d9; color: #33463f; }
.champ--attente-paiement { background: #e8a317; color: #10251e; }
.champ--payee { background: #1e7a4c; }
.champ--validee { background: #1565c0; }
.champ--annulee { background: #c2321e; }
</style>