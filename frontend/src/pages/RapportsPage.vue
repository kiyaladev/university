<template>
  <q-page class="q-pa-md">
    <section-navigation section="presence" />
    <page-header :title="$t('rapports.title')" :subtitle="$t('rapports.subtitle')" />

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm items-center">
        <div class="col-6 col-md-2">
          <champ-date v-model="filtres.dateDebut" :label="$t('rapports.filters.dateDebut')" />
        </div>
        <div class="col-6 col-md-2">
          <champ-date v-model="filtres.dateFin" :label="$t('rapports.filters.dateFin')" />
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
            :label="$t('rapports.filters.departement')"
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
            :label="$t('rapports.filters.promotion')"
          />
        </div>
        <div class="col-auto">
          <q-btn
            round
            color="primary"
            icon="refresh"
            :aria-label="$t('rapports.actions.reloadAria')"
            :loading="chargement"
            @click="charger"
          >
            <q-tooltip>{{ $t('rapports.actions.reloadTooltip') }}</q-tooltip>
          </q-btn>
        </div>
        <div class="col-auto">
          <q-btn
            v-if="onglet !== 'controleurs'"
            outline
            color="secondary"
            no-caps
            icon="table_view"
            :label="$t('rapports.actions.export', { onglet: libelleOnglet })"
            @click="exporter"
          >
            <q-tooltip>
              {{ $t('rapports.actions.exportTooltip', { onglet: libelleOnglet, periode: periodeLisible }) }}
            </q-tooltip>
          </q-btn>
        </div>
        <div class="col-12 text-caption text-grey-7">
          {{ $t('rapports.period.analyzed', { periode: periodeLisible }) }}
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="peutSignerReleve" flat bordered class="carte q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">{{ $t('rapports.releveSigne.title') }}</div>
          <div class="text-caption text-grey-7">{{ $t('rapports.releveSigne.description') }}</div>
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn color="primary" unelevated icon="draw" no-caps :label="$t('rapports.releveSigne.action')" @click="dialogReleve = true" />
        </div>
      </q-card-section>
    </q-card>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="assiduite" icon="how_to_reg" :label="$t('rapports.tabs.assiduite')" no-caps />
      <q-tab name="volume" icon="timelapse" :label="$t('rapports.tabs.volume')" no-caps />
      <q-tab v-if="peutVoirCouverture" name="controleurs" icon="route" :label="$t('rapports.tabs.controleurs')" no-caps />
      <q-tab v-if="peutVoirPaiement" name="paiement" icon="payments" :label="$t('rapports.tabs.paiement')" no-caps />
      <q-tab name="registre" icon="menu_book" :label="$t('rapports.tabs.registre')" no-caps />
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
              {{ $t('rapports.assiduite.total', {
                planifiees: assiduite?.total?.planifiees ?? 0,
                presence: pourcentLisible(assiduite?.total?.tauxPresence),
                heures: heuresLisibles(assiduite?.total?.heuresRealisees),
              }) }}
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
                :aria-label="$t('rapports.actions.printFicheAria', { nom: p.row.nom })"
                @click="imprimerFiche(p.row.enseignantId)"
              >
                <q-tooltip>{{ $t('rapports.actions.printFicheTooltip') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <etat-vide icone="how_to_reg" :titre="$t('rapports.assiduite.emptyState.title')" :aide="$t('rapports.assiduite.emptyState.message')">
              <template #action>
                <q-btn flat no-caps color="primary" icon="event" :label="$t('rapports.assiduite.emptyState.action')" to="/emploi-du-temps" />
              </template>
            </etat-vide>
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
            <etat-vide icone="timelapse" :titre="$t('rapports.volume.emptyState.title')" :aide="$t('rapports.volume.emptyState.message')">
              <template #action>
                <q-btn flat no-caps color="primary" icon="assignment_ind" :label="$t('rapports.volume.emptyState.action')" to="/affectations" />
              </template>
            </etat-vide>
          </template>
        </q-table>
      </q-tab-panel>

      <q-tab-panel v-if="peutVoirCouverture" name="controleurs" class="q-pa-none">
        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-subtitle2">{{ $t('rapports.controleurs.title') }}</div>
              <div class="text-caption text-grey-7">{{ $t('rapports.controleurs.help') }}</div>
            </div>
            <div class="col-auto text-caption">
              {{ $t('rapports.controleurs.unassigned', { count: couverture?.nonAffectees?.seancesPassees ?? 0 }) }}
            </div>
          </q-card-section>
        </q-card>
        <q-table
          flat bordered class="carte"
          :rows="couverture?.lignes ?? []"
          :columns="colonnesControleurs"
          row-key="controleurId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-tauxCouverture="p">
            <q-td :props="p"><barre-taux :valeur="p.row.tauxCouverture" /></q-td>
          </template>
          <template #body-cell-tauxParAssigne="p">
            <q-td :props="p"><barre-taux :valeur="p.row.tauxParAssigne" /></q-td>
          </template>
          <template #no-data>
            <etat-vide icone="route" :titre="$t('rapports.controleurs.emptyTitle')" :aide="$t('rapports.controleurs.emptyHelp')">
              <template #action>
                <q-btn flat no-caps color="primary" icon="event" :label="$t('rapports.controleurs.emptyAction')" to="/seances" />
              </template>
            </etat-vide>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- État de paiement -->
      <q-tab-panel v-if="peutVoirPaiement" name="paiement" class="q-pa-none">
        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-caption text-grey-7">{{ $t('rapports.paiement.heuresPayables') }}</div>
              <div class="text-h5 text-weight-bold">{{ heuresLisibles(paiement?.totalHeures) }}</div>
            </div>
            <div class="col">
              <div class="text-caption text-grey-7">{{ $t('rapports.paiement.montantTotal') }}</div>
              <div class="text-h5 text-weight-bold text-primary">
                {{ montantLisible(paiement?.totalMontant) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}
              </div>
            </div>
            <div class="col-auto">
              <q-select
                v-model="statutEnseignant"
                :options="STATUTS_ENSEIGNANT"
                outlined
                dense
                clearable
                :label="$t('rapports.filters.statut')"
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
                :label="$t('rapports.actions.printPaiement')"
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
                    {{ $t('rapports.paiement.detailLine', { libelle: d.libelle, heures: heuresLisibles(d.heures), seances: d.seances }) }}
                  </span>
                </div>
              </q-td>
            </q-tr>
          </template>
          <template #no-data>
            <etat-vide icone="payments" :titre="$t('rapports.paiement.emptyState.title')" :aide="$t('rapports.paiement.emptyState.message')">
              <template #action>
                <q-btn flat no-caps color="primary" icon="fact_check" :label="$t('rapports.paiement.emptyState.action')" to="/controle" />
              </template>
            </etat-vide>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- Registre -->
      <q-tab-panel name="registre" class="q-pa-none">
        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-caption text-grey-7">
                {{ $t('rapports.registre.subtitle') }}
              </div>
              <div class="text-subtitle2">
                {{ $t('rapports.registre.summary', {
                  total: registre?.total ?? 0,
                  controlees: registre?.synthese?.controlees ?? 0,
                  absences: registre?.synthese?.absent ?? 0,
                }) }}
              </div>
            </div>
            <div class="col-auto">
              <q-btn
                color="primary"
                unelevated
                icon="print"
                no-caps
                :label="$t('rapports.actions.printRegistre')"
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
            <etat-vide icone="menu_book" :titre="$t('rapports.registre.emptyState.title')" :aide="$t('rapports.registre.emptyState.message')">
              <template #action>
                <q-btn flat no-caps color="primary" icon="event" :label="$t('rapports.registre.emptyState.action')" to="/seances" />
              </template>
            </etat-vide>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <q-dialog v-model="dialogReleve" persistent>
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ $t('rapports.releveSigne.dialogTitle') }}</div>
          <div class="text-caption text-grey-7">{{ $t('rapports.releveSigne.dialogHelp') }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="semaineDebut" type="date" outlined dense :label="$t('rapports.releveSigne.weekStart')" />
          <div class="text-caption text-grey-7 q-mt-xs q-mb-md">
            {{ $t('rapports.releveSigne.weekRange', { end: dateLisible(semaineFin) }) }}
          </div>
          <signature-pad v-model="signatureChef" :label="$t('rapports.releveSigne.signatureLabel')" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('rapports.releveSigne.cancel')" :disable="generationReleve" @click="dialogReleve = false" />
          <q-btn color="primary" unelevated no-caps icon="picture_as_pdf" :loading="generationReleve" :label="$t('rapports.releveSigne.generate')" @click="genererReleve" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import SectionNavigation from '../components/SectionNavigation.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import { useImpressionFicheEnseignant } from '../composables/useImpressionFicheEnseignant';
import BarreTaux from '../components/BarreTaux.vue';
import ChampStatut from '../components/ChampStatut.vue';
import SignaturePad from '../components/SignaturePad.vue';
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
import { ouvrirImpression, telechargerFichier } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const peutVoirPaiement = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));
const peutVoirCouverture = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));
const peutSignerReleve = computed(() => auth.aRole(['CHEF_DEPARTEMENT']) && !!auth.utilisateur?.departementId);
const { t } = useI18n();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

/** Périmètre de chaque onglet : sert au libellé du bouton d'export et au chemin d'API. */
const ONGLETS: Record<string, { chemin: string }> = {
  assiduite: { chemin: 'presence-enseignants' },
  volume: { chemin: 'volume-horaire' },
  paiement: { chemin: 'etat-paiement' },
  registre: { chemin: 'registre' },
};

const onglet = ref('assiduite');
const chargement = ref(false);
const assiduite = ref<any>(null);
const volume = ref<any>(null);
const paiement = ref<any>(null);
const registre = ref<any>(null);
const couverture = ref<any>(null);
const departements = ref<Departement[]>([]);
const promotions = ref<Promotion[]>([]);
const statutEnseignant = ref<string | null>('VACATAIRE');
const dialogReleve = ref(false);
const generationReleve = ref(false);
const signatureChef = ref<string | null>(null);
const semaineDebut = ref(lundiDe(aujourdhui()));

function lundiDe(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

const semaineFin = computed(() => {
  const d = new Date(`${semaineDebut.value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
});

async function genererReleve() {
  if (!auth.utilisateur?.departementId || !signatureChef.value) {
    $q.notify({ type: 'warning', message: t('rapports.releveSigne.signatureRequired') });
    return;
  }
  if (lundiDe(semaineDebut.value) !== semaineDebut.value) {
    $q.notify({ type: 'warning', message: t('rapports.releveSigne.mondayRequired') });
    return;
  }
  generationReleve.value = true;
  try {
    // Silencieux : en `blob`, le message du serveur est illisible pour
    // l'intercepteur ; le message local du catch est plus parlant.
    const response = await api.post('/impression/releve-hebdomadaire', {
      departementId: auth.utilisateur.departementId,
      dateDebut: semaineDebut.value,
      dateFin: semaineFin.value,
      signatureBase64: signatureChef.value,
    }, { responseType: 'blob', silencieux: true });
    const url = URL.createObjectURL(response.data);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `releve-hebdomadaire-${semaineDebut.value}.pdf`;
    lien.click();
    URL.revokeObjectURL(url);
    dialogReleve.value = false;
    signatureChef.value = null;
    $q.notify({ type: 'positive', message: t('rapports.releveSigne.success') });
  } catch {
    $q.notify({ type: 'negative', message: t('rapports.releveSigne.error') });
  } finally {
    generationReleve.value = false;
  }
}

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

const libelleOnglet = computed(() => {
  const cles = ['assiduite', 'volume', 'paiement', 'registre'];
  return cles.includes(onglet.value) ? t(`rapports.onglets.${onglet.value}`) : t('rapports.onglets.defaut');
});
const periodeLisible = computed(
  () => t('rapports.period.range', { debut: dateLisible(filtres.value.dateDebut), fin: dateLisible(filtres.value.dateFin) }),
);

const colonnesAssiduite = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('rapports.assiduite.table.columns.matricule'), field: 'matricule', align: 'left' },
  { name: 'nom', label: t('rapports.assiduite.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  { name: 'departement', label: t('rapports.assiduite.table.columns.departement'), field: 'departement', align: 'left' },
  { name: 'planifiees', label: t('rapports.assiduite.table.columns.planifiees'), field: 'planifiees', align: 'right', sortable: true },
  { name: 'controlees', label: t('rapports.assiduite.table.columns.controlees'), field: 'controlees', align: 'right' },
  { name: 'assurees', label: t('rapports.assiduite.table.columns.assurees'), field: 'assurees', align: 'right' },
  { name: 'retard', label: t('rapports.assiduite.table.columns.retard'), field: 'retard', align: 'right', sortable: true },
  { name: 'absent', label: t('rapports.assiduite.table.columns.absent'), field: 'absent', align: 'right', sortable: true },
  {
    name: 'heures',
    label: t('rapports.assiduite.table.columns.heures'),
    field: (r: any) => heuresLisibles(r.heuresRealisees),
    align: 'right',
  },
  { name: 'taux', label: t('rapports.assiduite.table.columns.taux'), field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'enseignantId', align: 'right' },
]);

const colonnesVolume = computed<QTableColumn[]>(() => [
  { name: 'enseignant', label: t('rapports.volume.table.columns.enseignant'), field: 'enseignant', align: 'left', sortable: true },
  { name: 'matiere', label: t('rapports.volume.table.columns.matiere'), field: 'matiere', align: 'left' },
  { name: 'promotion', label: t('rapports.volume.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'prevu', label: t('rapports.volume.table.columns.prevu'), field: 'volumeHorairePrevu', align: 'right' },
  { name: 'realise', label: t('rapports.volume.table.columns.realise'), field: 'heuresRealisees', align: 'right', sortable: true },
  { name: 'reste', label: t('rapports.volume.table.columns.reste'), field: 'reste', align: 'right' },
  { name: 'seances', label: t('rapports.volume.table.columns.seances'), field: 'planifiees', align: 'right' },
  { name: 'avancement', label: t('rapports.volume.table.columns.avancement'), field: 'tauxContrat', align: 'left', sortable: true },
]);

const colonnesPaiement = computed<QTableColumn[]>(() => [
  { name: 'matricule', label: t('rapports.paiement.table.columns.matricule'), field: 'matricule', align: 'left' },
  { name: 'nom', label: t('rapports.paiement.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  { name: 'statut', label: t('rapports.paiement.table.columns.statut'), field: 'statutEnseignant', align: 'left' },
  { name: 'departement', label: t('rapports.paiement.table.columns.departement'), field: 'departement', align: 'left' },
  { name: 'seances', label: t('rapports.paiement.table.columns.seances'), field: 'seancesAssurees', align: 'right' },
  { name: 'heures', label: t('rapports.paiement.table.columns.heures'), field: 'heuresRealisees', align: 'right', sortable: true },
  {
    name: 'taux',
    label: t('rapports.paiement.table.columns.taux'),
    field: (r: any) => montantLisible(r.tauxHoraire),
    align: 'right',
  },
  {
    name: 'montant',
    label: t('rapports.paiement.table.columns.montant'),
    field: (r: any) => montantLisible(r.montant),
    align: 'right',
    sortable: true,
  },
]);

const colonnesRegistre = computed<QTableColumn[]>(() => [
  { name: 'date', label: t('rapports.registre.table.columns.date'), field: 'date', align: 'left', sortable: true },
  { name: 'horaire', label: t('rapports.registre.table.columns.horaire'), field: 'horaire', align: 'left' },
  { name: 'enseignant', label: t('rapports.registre.table.columns.enseignant'), field: 'enseignant', align: 'left' },
  { name: 'matiere', label: t('rapports.registre.table.columns.matiere'), field: 'matiere', align: 'left' },
  { name: 'promotion', label: t('rapports.registre.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'salle', label: t('rapports.registre.table.columns.salle'), field: 'salle', align: 'left' },
  { name: 'statut', label: t('rapports.registre.table.columns.statut'), field: 'statut', align: 'left' },
  { name: 'arrivee', label: t('rapports.registre.table.columns.arrivee'), field: 'heureArrivee', align: 'left' },
  { name: 'duree', label: t('rapports.registre.table.columns.duree'), field: (r: any) => dureeLisible(r.dureeMinutes), align: 'left' },
  { name: 'effectif', label: t('rapports.registre.table.columns.effectif'), field: 'effectifPresent', align: 'right' },
  { name: 'theme', label: t('rapports.registre.table.columns.theme'), field: 'thematiqueTraitee', align: 'left' },
]);

const colonnesControleurs = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('rapports.controleurs.columns.controller'), field: 'nom', align: 'left', sortable: true },
  { name: 'seancesPassees', label: t('rapports.controleurs.columns.assigned'), field: 'seancesPassees', align: 'right', sortable: true },
  { name: 'visitees', label: t('rapports.controleurs.columns.visited'), field: 'visitees', align: 'right', sortable: true },
  { name: 'nonVisitees', label: t('rapports.controleurs.columns.missed'), field: 'nonVisitees', align: 'right', sortable: true },
  { name: 'realiseesParAssigne', label: t('rapports.controleurs.columns.byAssigned'), field: 'realiseesParAssigne', align: 'right' },
  { name: 'realiseesParUnAutre', label: t('rapports.controleurs.columns.coveredByPeer'), field: 'realiseesParUnAutre', align: 'right' },
  { name: 'tauxCouverture', label: t('rapports.controleurs.columns.coverage'), field: (r: any) => pourcentLisible(r.tauxCouverture), align: 'left', sortable: true },
  { name: 'tauxParAssigne', label: t('rapports.controleurs.columns.ownRate'), field: (r: any) => pourcentLisible(r.tauxParAssigne), align: 'left', sortable: true },
]);

function parametres() {
  return {
    dateDebut: filtres.value.dateDebut,
    dateFin: filtres.value.dateFin,
    departementId: filtres.value.departementId || undefined,
    promotionId: filtres.value.promotionId || undefined,
  };
}

/**
 * Une impression ou un export porte exactement les mêmes filtres que le tableau
 * affiché — promotion comprise, sans quoi le CSV ne correspondrait pas à ce que
 * l'écran montre.
 */
function chemin(base: string, suffixe: string, extra: Record<string, string | undefined> = {}) {
  return { chemin: `/${base}/${suffixe}`, params: { ...parametres(), ...extra } };
}

const extraStatutEnseignant = () =>
  onglet.value === 'paiement' || statutEnseignant.value
    ? { statutEnseignant: statutEnseignant.value }
    : {};

/** Export CSV de l'onglet affiché, filtres et période inclus. */
function exporter() {
  const { chemin: c, params } = chemin('export', ONGLETS[onglet.value].chemin, extraStatutEnseignant());
  void telechargerFichier(c, params, `${onglet.value}.csv`);
}

const imprimerRegistre = () => {
  const { chemin: c, params } = chemin('impression', 'registre');
  void ouvrirImpression(c, params);
};

const imprimerPaiement = () => {
  const { chemin: c, params } = chemin('impression', 'etat-paiement', extraStatutEnseignant());
  void ouvrirImpression(c, params);
};
const imprimerFiche = (id: string) =>
  ouvrirFicheEnseignant(id, filtres.value.dateDebut, filtres.value.dateFin);

async function charger() {
  chargement.value = true;
  try {
    const p = parametres();
    const [a, v, pa, r, c] = await Promise.all([
      api.get('/rapports/presence-enseignants', { params: p }),
      api.get('/rapports/volume-horaire', { params: p }),
      peutVoirPaiement.value ? api.get('/rapports/etat-paiement', {
        params: { ...p, statutEnseignant: statutEnseignant.value || undefined },
      }) : Promise.resolve({ data: null }),
      api.get('/rapports/registre', { params: p }),
      peutVoirCouverture.value ? api.get('/rapports/couverture-controleurs', { params: p }) : Promise.resolve({ data: null }),
    ]);
    assiduite.value = a.data;
    volume.value = v.data;
    paiement.value = pa.data;
    registre.value = r.data;
    couverture.value = c.data;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

watch(filtres, charger, { deep: true });

onMounted(async () => {
  try {
    [departements.value, promotions.value] = await Promise.all([
      referentiels.departements(),
      referentiels.promotions(),
    ]);
  } catch {
    /* l'intercepteur axios a déjà affiché le motif ; la page reste utilisable sans filtres */
  }
  await charger();
});
</script>

<style scoped lang="scss">
</style>
