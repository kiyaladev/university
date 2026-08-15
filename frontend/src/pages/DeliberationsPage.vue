<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Délibérations</div>
        <div class="page-sous-titre">
          Sessions du jury : moyennes pondérées par les crédits, décisions ADMIS /
          AJOURNÉ / DÉFAILLANT
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutSaisir()"
          unelevated
          color="primary"
          no-caps
          icon="gavel"
          label="Nouvelle délibération"
          @click="dialogOuvert = true"
        />
      </div>
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="deliberations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :filter="recherche"
      :pagination="{ rowsPerPage: 15 }"
    >
      <template #top-left>
        <div class="row q-gutter-sm items-center">
          <q-input v-model="recherche" dense outlined clearable placeholder="Rechercher…">
            <template #prepend><q-icon name="search" /></template>
          </q-input>
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
            @update:model-value="charger"
          />
        </div>
      </template>

      <template #body-cell-session="p">
        <q-td :props="p">{{ LIBELLE_SESSION_DELIBERATION[p.row.session] }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="p.row.statut === 'VALIDEE' ? 'positive' : 'warning'">
            {{ LIBELLE_STATUT_DELIBERATION[p.row.statut] }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-taux="p">
        <q-td :props="p">
          <template v-if="p.row.tauxReussite !== null && p.row.tauxReussite !== undefined">
            {{ pourcentLisible(p.row.tauxReussite) }}
          </template>
          <template v-else>—</template>
        </q-td>
      </template>

      <template #body-cell-effectif="p">
        <q-td :props="p">{{ (p.row as any)._count?.lignes ?? 0 }}</q-td>
      </template>

      <template #body-cell-creeLe="p">
        <q-td :props="p">{{ dateLisible(p.row.creeLe) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" @click="ouvrirDetail(p.row)">
            <q-tooltip>Détail des lignes</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON' && peutSaisir()"
            flat
            dense
            round
            icon="replay"
            color="primary"
            @click="calculer(p.row)"
          >
            <q-tooltip>Recalculer moyennes et décisions</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON' && estJury()"
            flat
            dense
            no-caps
            icon="verified_user"
            color="positive"
            label="Valider le jury"
            @click="valider(p.row)"
          />
          <q-btn flat dense round icon="print" @click="imprimerPv(p.row)">
            <q-tooltip>Imprimer le PV</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <deliberation-dialog
      v-model="dialogOuvert"
      :annees="annees"
      :promotions="promotions"
      @enregistre="charger"
    />

    <!-- Détail des lignes -->
    <q-dialog v-model="dialogDetail" :maximized="$q.screen.lt.md">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">Délibération — {{ detail?.promotion?.nom }}</div>
            <div class="text-caption text-grey-7">
              {{ LIBELLE_SESSION_DELIBERATION[detail?.session ?? 'NORMALE'] }} ·
              {{ detail?.annee?.libelle }} ·
              {{
                detail?.statut === 'VALIDEE' ? 'validée par le jury' : 'brouillon'
              }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn outline no-caps icon="print" label="PV" @click="imprimerPv(detail)" />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-table
            flat
            bordered
            :rows="detailLignes"
            :columns="colonnesDetail"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-decision="p">
              <q-td :props="p">
                <q-badge :color="couleurDecision(p.row.decision)">
                  {{ LIBELLE_DECISION_JURY[p.row.decision] }}
                </q-badge>
              </q-td>
            </template>
            <template #body-cell-actions="p">
              <q-td :props="p" class="text-right">
                <q-btn flat dense round icon="print" @click="imprimerBulletin(p.row)">
                  <q-tooltip>Bulletin individuel</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import DeliberationDialog from '../components/DeliberationDialog.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_STATUT_DELIBERATION,
  dateLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { AnneeAcademique, Deliberation, DeliberationLigne, Promotion } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const peutSaisir = () => auth.aRole(['ADMIN', 'SCOLARITE']);
/** Le jury : direction et administrateur figent les résultats. */
const estJury = () => auth.aRole(['ADMIN', 'DIRECTION']);

const deliberations = ref<Deliberation[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtreAnneeId = ref<string | null>(null);
const dialogOuvert = ref(false);
const dialogDetail = ref(false);
const detail = ref<Deliberation | null>(null);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

const colonnes: QTableColumn[] = [
  { name: 'promotion', label: 'Promotion', field: (r) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'session', label: 'Session', field: 'session', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'taux', label: 'Taux de réussite', field: 'tauxReussite', align: 'center' },
  { name: 'effectif', label: 'Étudiants', field: 'id', align: 'center' },
  { name: 'creeLe', label: 'Créée le', field: 'creeLe', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesDetail: QTableColumn[] = [
  { name: 'rang', label: 'Rang', field: 'rang', align: 'center' },
  { name: 'matricule', label: 'Matricule', field: (r) => r.inscription?.etudiant?.matricule ?? '—', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.inscription?.etudiant?.nom ?? ''} ${r.inscription?.etudiant?.prenom ?? ''}`, align: 'left' },
  { name: 'moyenne', label: 'Moyenne', field: 'moyenne', align: 'center' },
  { name: 'decision', label: 'Décision', field: 'decision', align: 'center' },
  { name: 'mention', label: 'Mention', field: 'mention', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const detailLignes = computed<DeliberationLigne[]>(() => detail.value?.lignes ?? []);

function couleurDecision(d: string): string {
  return d === 'ADMIS' ? 'positive' : d === 'AJOURNE' ? 'warning' : 'negative';
}

function urlToken(chemin: string) {
  return `${API_URL}${chemin}${chemin.includes('?') ? '&' : '?'}token=${auth.token}`;
}

function imprimerPv(d: Deliberation) {
  window.open(urlToken(`/deliberations/${d.id}/imprimer`), '_blank');
}

function imprimerBulletin(l: DeliberationLigne) {
  if (!detail.value) return;
  window.open(
    urlToken(`/deliberations/${detail.value.id}/releve/${l.inscriptionId}`),
    '_blank',
  );
}

function ouvrirDetail(d: Deliberation) {
  detail.value = d;
  dialogDetail.value = true;
}

function calculer(d: Deliberation) {
  $q.dialog({
    title: 'Recalculer la délibération',
    message:
      'Les moyennes d’UE (pondérées par les coefficients), la moyenne générale (pondérée par les crédits), les décisions, rangs et taux de réussite seront recalculés sur les notes actuelles.',
    cancel: true,
    ok: { color: 'primary', label: 'Recalculer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    await api.post(`/deliberations/${d.id}/calculer`);
    $q.notify({ type: 'positive', message: 'Délibération recalculée' });
    await charger();
  });
}

function valider(d: Deliberation) {
  $q.dialog({
    title: 'Valider les résultats du jury',
    html: true,
    message: `<p>La décision est prise selon les règles écrites :</p>
      <ul>
        <li>moyenne générale = Σ(moyenne UE × crédits) / Σ(crédits) ;</li>
        <li>ADMIS si moyenne générale ≥ 10 et aucune matière sous 5/20 pour défaut d’absence ;</li>
        <li>DÉFAILLANT si une matière n’a aucune note à une épreuve clôturée ;</li>
        <li>AJOURNÉ sinon — en rattrapage, seuls les AJOURNÉ sont repositionnés.</li>
      </ul>
      <p><strong>Après validation, tout recalcul sera bloqué.</strong> Continuer ?</p>`,
    cancel: true,
    ok: { color: 'positive', label: 'Valider le jury', unelevated: true, noCaps: true },
  }).onOk(async () => {
    await api.post(`/deliberations/${d.id}/valider`);
    $q.notify({ type: 'positive', message: 'Délibération validée par le jury' });
    await charger();
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/deliberations', {
      params: { all: '1', anneeId: filtreAnneeId.value || undefined },
    });
    deliberations.value = data.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const [a, p] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = a.data.data;
  promotions.value = p.data.data;
  await charger();
});
</script>