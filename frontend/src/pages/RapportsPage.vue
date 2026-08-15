<template>
  <q-page class="q-pa-md">
    <div class="page-titre">Rapports & états</div>
    <div class="page-sous-titre q-mb-md">
      Exploitation des contrôles : assiduité, volume horaire réalisé, paiement des vacataires
    </div>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm items-center">
        <div class="col-6 col-md-2">
          <champ-date v-model="filtres.dateDebut" label="Du" />
        </div>
        <div class="col-6 col-md-2">
          <champ-date v-model="filtres.dateFin" label="Au" />
        </div>
        <div class="col-12 col-md-3">
          <q-select
            v-model="filtres.departementId"
            :options="optionsDepartements"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Département"
          />
        </div>
        <div class="col-12 col-md-3">
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
        </div>
        <div class="col-auto">
          <q-btn round color="primary" icon="refresh" :loading="chargement" @click="charger" />
        </div>
        <div class="col-auto">
          <q-btn
            outline
            color="secondary"
            no-caps
            icon="table_view"
            label="Exporter en CSV"
            @click="exporter"
          >
            <q-tooltip>Exporte l’onglet affiché (tableur Excel / LibreOffice)</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="assiduite" icon="how_to_reg" label="Assiduité des enseignants" no-caps />
      <q-tab name="volume" icon="timelapse" label="Volume horaire" no-caps />
      <q-tab name="paiement" icon="payments" label="État de paiement" no-caps />
      <q-tab name="registre" icon="menu_book" label="Registre" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- Assiduité -->
      <q-tab-panel name="assiduite" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="assiduite?.lignes ?? []"
          :columns="colonnesAssiduite"
          row-key="enseignantId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #top-right>
            <div class="text-caption text-grey-7">
              Total : {{ assiduite?.total?.planifiees ?? 0 }} séances ·
              présence {{ pourcentLisible(assiduite?.total?.tauxPresence) }} ·
              {{ heuresLisibles(assiduite?.total?.heuresRealisees) }} réalisées
            </div>
          </template>
          <template #body-cell-taux="p">
            <q-td :props="p">
              <div class="row items-center no-wrap q-gutter-sm">
                <q-linear-progress
                  class="col"
                  style="min-width: 90px"
                  :value="p.row.tauxPresence / 100"
                  size="10px"
                  rounded
                  :color="p.row.tauxPresence >= 85 ? 'positive' : p.row.tauxPresence >= 70 ? 'warning' : 'negative'"
                />
                <div class="col-auto text-caption text-weight-medium" style="width: 46px">
                  {{ pourcentLisible(p.row.tauxPresence) }}
                </div>
              </div>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="print" @click="imprimerFiche(p.row.enseignantId)">
                <q-tooltip>Fiche individuelle</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- Volume horaire -->
      <q-tab-panel name="volume" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="volume?.lignes ?? []"
          :columns="colonnesVolume"
          row-key="affectationId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-avancement="p">
            <q-td :props="p">
              <div class="row items-center no-wrap q-gutter-sm">
                <q-linear-progress
                  class="col"
                  style="min-width: 90px"
                  :value="Math.min(1, p.row.tauxContrat / 100)"
                  size="10px"
                  rounded
                  :color="p.row.tauxContrat >= 90 ? 'positive' : p.row.tauxContrat >= 50 ? 'primary' : 'warning'"
                />
                <div class="col-auto text-caption text-weight-medium" style="width: 46px">
                  {{ pourcentLisible(p.row.tauxContrat) }}
                </div>
              </div>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- État de paiement -->
      <q-tab-panel name="paiement" class="q-pa-none">
        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-caption text-grey-7">Heures payables sur la période</div>
              <div class="text-h5 text-weight-bold">{{ heuresLisibles(paiement?.totalHeures) }}</div>
            </div>
            <div class="col">
              <div class="text-caption text-grey-7">Montant total</div>
              <div class="text-h5 text-weight-bold text-primary">
                {{ montantLisible(paiement?.totalMontant) }} GNF
              </div>
            </div>
            <div class="col-auto">
              <q-select
                v-model="statutEnseignant"
                :options="STATUTS_ENSEIGNANT"
                outlined
                dense
                clearable
                label="Statut"
                style="min-width: 160px"
                @update:model-value="charger"
              />
            </div>
            <div class="col-auto">
              <q-btn color="primary" unelevated icon="print" no-caps label="Imprimer l’état" @click="imprimerPaiement" />
            </div>
          </q-card-section>
        </q-card>

        <q-table
          flat
          bordered
          class="carte"
          :rows="paiement?.lignes ?? []"
          :columns="colonnesPaiement"
          row-key="enseignantId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body="p">
            <q-tr :props="p">
              <q-td v-for="col in p.cols" :key="col.name" :props="p">{{ col.value }}</q-td>
            </q-tr>
            <q-tr v-if="p.row.detail?.length" :props="p" class="ligne-detail">
              <q-td colspan="100%">
                <div class="text-caption text-grey-8">
                  <span v-for="d in p.row.detail" :key="d.libelle" class="q-mr-md">
                    {{ d.libelle }} : {{ d.heures }} h ({{ d.seances }} séances)
                  </span>
                </div>
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- Registre -->
      <q-tab-panel name="registre" class="q-pa-none">
        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-caption text-grey-7">
                Transcription du registre de contrôle sur la période sélectionnée
              </div>
              <div class="text-subtitle2">
                {{ registre?.total ?? 0 }} séance(s) ·
                {{ registre?.synthese?.controlees ?? 0 }} contrôlée(s) ·
                {{ registre?.synthese?.absent ?? 0 }} absence(s)
              </div>
            </div>
            <div class="col-auto">
              <q-btn color="primary" unelevated icon="print" no-caps label="Imprimer le registre" @click="imprimerRegistre" />
            </div>
          </q-card-section>
        </q-card>

        <q-table
          flat
          bordered
          class="carte"
          :rows="registre?.lignes ?? []"
          :columns="colonnesRegistre"
          row-key="seanceId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-statut="p">
            <q-td :props="p">
              <champ-statut :statut="p.row.statut" dense />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import type { QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import {
  LIBELLE_STATUT_PRESENCE,
  STATUTS_ENSEIGNANT,
  aujourdhui,
  decalerJours,
  dureeLisible,
  heuresLisibles,
  montantLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { Departement, Promotion } from '../types';

const auth = useAuthStore();

const onglet = ref('assiduite');
const chargement = ref(false);
const assiduite = ref<any>(null);
const volume = ref<any>(null);
const paiement = ref<any>(null);
const registre = ref<any>(null);
const departements = ref<Departement[]>([]);
const promotions = ref<Promotion[]>([]);
const statutEnseignant = ref<string | null>('VACATAIRE');

const filtres = ref({
  dateDebut: decalerJours(aujourdhui(), -30),
  dateFin: aujourdhui(),
  departementId: null as string | null,
  promotionId: null as string | null,
});

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);
const optionsPromotions = computed(() =>
  promotions.value.map((p) => ({ label: p.nom, value: p.id })),
);

const colonnesAssiduite: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left' },
  { name: 'nom', label: 'Enseignant', field: 'nom', align: 'left', sortable: true },
  { name: 'departement', label: 'Départ.', field: 'departement', align: 'left' },
  { name: 'planifiees', label: 'Progr.', field: 'planifiees', align: 'right', sortable: true },
  { name: 'controlees', label: 'Contr.', field: 'controlees', align: 'right' },
  { name: 'assurees', label: 'Assur.', field: 'assurees', align: 'right' },
  { name: 'retard', label: 'Retards', field: 'retard', align: 'right', sortable: true },
  { name: 'absent', label: 'Absences', field: 'absent', align: 'right', sortable: true },
  {
    name: 'heures',
    label: 'Heures',
    field: (r: any) => heuresLisibles(r.heuresRealisees),
    align: 'right',
  },
  { name: 'taux', label: 'Présence', field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'enseignantId', align: 'right' },
];

const colonnesVolume: QTableColumn[] = [
  { name: 'enseignant', label: 'Enseignant', field: 'enseignant', align: 'left', sortable: true },
  { name: 'matiere', label: 'Matière', field: 'matiere', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: 'promotion', align: 'left' },
  { name: 'prevu', label: 'Contrat (h)', field: 'volumeHorairePrevu', align: 'right' },
  { name: 'realise', label: 'Réalisé (h)', field: 'heuresRealisees', align: 'right', sortable: true },
  { name: 'reste', label: 'Reste (h)', field: 'reste', align: 'right' },
  { name: 'seances', label: 'Séances', field: 'planifiees', align: 'right' },
  { name: 'avancement', label: 'Avancement', field: 'tauxContrat', align: 'left', sortable: true },
];

const colonnesPaiement: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left' },
  { name: 'nom', label: 'Enseignant', field: 'nom', align: 'left', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statutEnseignant', align: 'left' },
  { name: 'departement', label: 'Départ.', field: 'departement', align: 'left' },
  { name: 'seances', label: 'Séances', field: 'seancesAssurees', align: 'right' },
  { name: 'heures', label: 'Heures', field: 'heuresRealisees', align: 'right', sortable: true },
  {
    name: 'taux',
    label: 'Taux horaire',
    field: (r: any) => montantLisible(r.tauxHoraire),
    align: 'right',
  },
  {
    name: 'montant',
    label: 'Montant (GNF)',
    field: (r: any) => montantLisible(r.montant),
    align: 'right',
    sortable: true,
  },
];

const colonnesRegistre: QTableColumn[] = [
  { name: 'date', label: 'Date', field: 'date', align: 'left', sortable: true },
  { name: 'horaire', label: 'Horaire', field: 'horaire', align: 'left' },
  { name: 'enseignant', label: 'Enseignant', field: 'enseignant', align: 'left' },
  { name: 'matiere', label: 'Matière', field: 'matiere', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: 'promotion', align: 'left' },
  { name: 'salle', label: 'Salle', field: 'salle', align: 'left' },
  { name: 'statut', label: 'Constat', field: 'statut', align: 'left' },
  { name: 'arrivee', label: 'Arrivée', field: 'heureArrivee', align: 'left' },
  { name: 'duree', label: 'Durée', field: (r: any) => dureeLisible(r.dureeMinutes), align: 'left' },
  { name: 'effectif', label: 'Étud.', field: 'effectifPresent', align: 'right' },
  { name: 'theme', label: 'Thème déroulé', field: 'thematiqueTraitee', align: 'left' },
];

function parametres() {
  return {
    dateDebut: filtres.value.dateDebut,
    dateFin: filtres.value.dateFin,
    departementId: filtres.value.departementId || undefined,
    promotionId: filtres.value.promotionId || undefined,
  };
}

function url(base: string, chemin: string, extra = '') {
  const p = parametres();
  return (
    `${API_URL}/${base}/${chemin}?dateDebut=${p.dateDebut}&dateFin=${p.dateFin}` +
    `${p.departementId ? `&departementId=${p.departementId}` : ''}${extra}&token=${auth.token}`
  );
}

const urlImpression = (chemin: string, extra = '') => url('impression', chemin, extra);

/** Export CSV de l'onglet affiché. */
function exporter() {
  const chemins: Record<string, string> = {
    assiduite: 'presence-enseignants',
    volume: 'volume-horaire',
    paiement: 'etat-paiement',
    registre: 'registre',
  };
  const extra =
    onglet.value === 'paiement' && statutEnseignant.value
      ? `&statutEnseignant=${statutEnseignant.value}`
      : '';
  window.open(url('export', chemins[onglet.value], extra), '_blank');
}

const imprimerRegistre = () => window.open(urlImpression('registre'), '_blank');
const imprimerPaiement = () =>
  window.open(
    urlImpression('etat-paiement', statutEnseignant.value ? `&statutEnseignant=${statutEnseignant.value}` : ''),
    '_blank',
  );
const imprimerFiche = (id: string) => window.open(urlImpression(`fiche-enseignant/${id}`), '_blank');

async function charger() {
  chargement.value = true;
  try {
    const p = parametres();
    const [a, v, pa, r] = await Promise.all([
      api.get('/rapports/presence-enseignants', { params: p }),
      api.get('/rapports/volume-horaire', { params: p }),
      api.get('/rapports/etat-paiement', {
        params: { ...p, statutEnseignant: statutEnseignant.value || undefined },
      }),
      api.get('/rapports/registre', { params: p }),
    ]);
    assiduite.value = a.data;
    volume.value = v.data;
    paiement.value = pa.data;
    registre.value = r.data;
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });

onMounted(async () => {
  const [d, p] = await Promise.all([
    api.get('/departements', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  departements.value = d.data.data;
  promotions.value = p.data.data;
  await charger();
});
</script>
