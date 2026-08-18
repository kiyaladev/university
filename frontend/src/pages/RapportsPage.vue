<template>
  <q-page class="q-pa-md">
    <div class="page-titre">Rapports & états</div>
    <div class="page-sous-titre q-mb-md">
      Les états ligne à ligne du registre de contrôle, sur une période choisie :
      qui a assuré quoi, combien d'heures, combien à payer. C'est la pièce
      justificative — imprimable et exportable. Les indicateurs de suivi
      quotidien sont dans Statistiques, la synthèse annuelle dans le Tableau de
      bord Rectorat.
    </div>

    <liens-croises
      :liens="[
        { to: '/statistiques', libelle: 'Statistiques', icone: 'query_stats', aide: 'Indicateurs de contrôle au jour le jour' },
        { to: '/rectorat', libelle: 'Tableau de bord Rectorat', icone: 'dashboard', aide: 'Synthèse annuelle : effectifs, réussite, masse salariale' },
        { to: '/paie', libelle: 'Paie des vacataires', icone: 'payments', aide: 'Feuilles mensuelles issues de ces heures contrôlées' },
      ]"
    />

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
          <q-btn
            round
            color="primary"
            icon="refresh"
            aria-label="Recharger les états sur la période"
            :loading="chargement"
            @click="charger"
          >
            <q-tooltip>Recharger les états</q-tooltip>
          </q-btn>
        </div>
        <div class="col-auto">
          <q-btn
            outline
            color="secondary"
            no-caps
            icon="table_view"
            :label="`Exporter ${libelleOnglet} en CSV`"
            @click="exporter"
          >
            <q-tooltip>
              Tableur (Excel / LibreOffice) — {{ libelleOnglet }}, {{ periodeLisible }}
            </q-tooltip>
          </q-btn>
        </div>
        <div class="col-12 text-caption text-grey-7">
          Période analysée : {{ periodeLisible }} — 30 derniers jours par défaut.
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
              <barre-taux :valeur="p.row.tauxPresence" />
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="print"
                :aria-label="`Imprimer la fiche individuelle de ${p.row.nom}`"
                @click="imprimerFiche(p.row.enseignantId)"
              >
                <q-tooltip>Fiche individuelle (A4)</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <div class="etat-vide">
              <q-icon name="how_to_reg" size="36px" />
              <div class="text-subtitle2 q-mt-sm">Aucune séance programmée sur la période</div>
              <div class="text-caption">
                L'assiduité se calcule à partir des séances de l'emploi du temps.
                Élargissez la période ou retirez les filtres département / promotion.
              </div>
              <q-btn flat dense no-caps color="primary" icon="event" label="Ouvrir l'emploi du temps" to="/emploi-du-temps" />
            </div>
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
              <!-- Un contrat est « en avance » bien plus tôt qu'un taux de
                   présence : les seuils sont propres à cet indicateur. -->
              <barre-taux :valeur="p.row.tauxContrat" :seuil-bas="50" :seuil-haut="90" />
            </q-td>
          </template>
          <template #no-data>
            <div class="etat-vide">
              <q-icon name="timelapse" size="36px" />
              <div class="text-subtitle2 q-mt-sm">Aucune charge d'enseignement sur la période</div>
              <div class="text-caption">
                Le volume horaire compare les heures réalisées au contrat de chaque
                affectation. Sans affectation, rien à comparer.
              </div>
              <q-btn flat dense no-caps color="primary" icon="assignment_ind" label="Ouvrir les charges d'enseignement" to="/affectations" />
            </div>
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
              <q-btn
                color="primary"
                unelevated
                icon="print"
                no-caps
                label="Imprimer l’état de paiement (A4)"
                @click="imprimerPaiement"
              >
                <q-tooltip>{{ periodeLisible }}{{ statutEnseignant ? ` — ${statutEnseignant.toLowerCase()}s` : '' }}</q-tooltip>
              </q-btn>
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
                    {{ d.libelle }} : {{ heuresLisibles(d.heures) }} ({{ d.seances }} séances)
                  </span>
                </div>
              </q-td>
            </q-tr>
          </template>
          <template #no-data>
            <div class="etat-vide">
              <q-icon name="payments" size="36px" />
              <div class="text-subtitle2 q-mt-sm">Aucune heure payable sur la période</div>
              <div class="text-caption">
                Seules les heures constatées lors d'un contrôle sont payables.
                Vérifiez la période, ou le filtre de statut ci-dessus.
              </div>
              <q-btn flat dense no-caps color="primary" icon="fact_check" label="Ouvrir le contrôle des séances" to="/controle" />
            </div>
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
              <q-btn
                color="primary"
                unelevated
                icon="print"
                no-caps
                label="Imprimer le registre (A4)"
                @click="imprimerRegistre"
              >
                <q-tooltip>{{ periodeLisible }}</q-tooltip>
              </q-btn>
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
          <template #no-data>
            <div class="etat-vide">
              <q-icon name="menu_book" size="36px" />
              <div class="text-subtitle2 q-mt-sm">Registre vide sur la période</div>
              <div class="text-caption">
                Le registre transcrit les séances programmées, contrôlées ou non.
                Élargissez la période pour retrouver des lignes.
              </div>
              <q-btn flat dense no-caps color="primary" icon="event" label="Ouvrir les séances" to="/seances" />
            </div>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useImpressionFicheEnseignant } from '../composables/useImpressionFicheEnseignant';
import BarreTaux from '../components/BarreTaux.vue';
import ChampStatut from '../components/ChampStatut.vue';
import LiensCroises from '../components/LiensCroises.vue';
import {
  STATUTS_ENSEIGNANT,
  aujourdhui,
  dateLisible,
  decalerJours,
  dureeLisible,
  heuresLisibles,
  montantLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { Departement, Promotion } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

/** Périmètre de chaque onglet : sert au libellé du bouton d'export et au chemin d'API. */
const ONGLETS: Record<string, { libelle: string; chemin: string }> = {
  assiduite: { libelle: 'l’assiduité des enseignants', chemin: 'presence-enseignants' },
  volume: { libelle: 'le volume horaire', chemin: 'volume-horaire' },
  paiement: { libelle: 'l’état de paiement', chemin: 'etat-paiement' },
  registre: { libelle: 'le registre', chemin: 'registre' },
};

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

const libelleOnglet = computed(() => ONGLETS[onglet.value]?.libelle ?? 'l’onglet affiché');
const periodeLisible = computed(
  () => `du ${dateLisible(filtres.value.dateDebut)} au ${dateLisible(filtres.value.dateFin)}`,
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

/**
 * Une URL d'impression ou d'export porte exactement les mêmes filtres que le
 * tableau affiché — promotion comprise, sans quoi le CSV ne correspondrait pas
 * à ce que l'écran montre.
 */
function url(base: string, chemin: string, extra = '') {
  const p = parametres();
  return (
    `${API_URL}/${base}/${chemin}?dateDebut=${p.dateDebut}&dateFin=${p.dateFin}` +
    `${p.departementId ? `&departementId=${p.departementId}` : ''}` +
    `${p.promotionId ? `&promotionId=${p.promotionId}` : ''}${extra}&token=${auth.token}`
  );
}

const urlImpression = (chemin: string, extra = '') => url('impression', chemin, extra);

/** Export CSV de l'onglet affiché, filtres et période inclus. */
function exporter() {
  const extra =
    onglet.value === 'paiement' && statutEnseignant.value
      ? `&statutEnseignant=${statutEnseignant.value}`
      : '';
  window.open(url('export', ONGLETS[onglet.value].chemin, extra), '_blank');
}

const imprimerRegistre = () => window.open(urlImpression('registre'), '_blank');
const imprimerPaiement = () =>
  window.open(
    urlImpression('etat-paiement', statutEnseignant.value ? `&statutEnseignant=${statutEnseignant.value}` : ''),
    '_blank',
  );
const imprimerFiche = (id: string) =>
  ouvrirFicheEnseignant(id, filtres.value.dateDebut, filtres.value.dateFin);

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
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des états impossible.',
    });
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });

onMounted(async () => {
  try {
    const [d, p] = await Promise.all([
      api.get('/departements', { params: { all: '1' } }),
      api.get('/promotions', { params: { all: '1' } }),
    ]);
    departements.value = d.data.data;
    promotions.value = p.data.data;
  } catch {
    $q.notify({ type: 'warning', message: 'Départements et promotions indisponibles : les filtres resteront vides.' });
  }
  await charger();
});
</script>

<style scoped lang="scss">
</style>
