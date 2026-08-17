<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Examens & anti-fantômes</div>
        <div class="page-sous-titre">
          Planification des épreuves et scan des cartes étudiantes à l'entrée de la salle.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Planifier un examen"
          @click="ouvrirCreation"
        />
      </div>
      <div class="col-auto">
        <q-btn outline color="secondary" no-caps icon="qr_code_scanner" label="Page de scan" @click="$router.push('/examens/scan')" />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (intitulé, code examen…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle v-model="modeVue" :modes="['tableau', 'cartes']" cle="examens" />
      </template>
      <template #avances>
        <q-select v-model="filtres.type" :options="optionsTypes" outlined dense clearable emit-value map-options label="Type" />
        <autocomplete-async
          v-model="filtres.matiereId"
          endpoint="/matieres"
          label="Matière"
          :label-fn="(m) => `${m.code} — ${m.intitule}`"
        />
        <autocomplete-async
          v-model="filtres.promotionId"
          endpoint="/referentiel/promotions"
          label="Promotion"
          :label-fn="(p) => `${p.nom} — ${p.niveau}`"
        />
        <autocomplete-async
          v-model="filtres.anneeId"
          endpoint="/referentiel/annees"
          label="Année"
          :label-fn="(a) => a.libelle"
        />
        <champ-date v-model="filtres.dateDebut" label="Du" />
        <champ-date v-model="filtres.dateFin" label="Au" />
      </template>
    </filter-bar>

    <q-tabs v-model="onglet" dense no-caps align="left" class="text-grey-9 q-mb-md">
      <q-tab name="PLANIFIE" label="Planifiés" icon="event" />
      <q-tab name="EN_COURS" label="En cours" icon="play_circle_outline" />
      <q-tab name="TERMINE" label="Terminés" icon="task_alt" />
    </q-tabs>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="examensFiltres"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge color="primary" :label="libelleType(p.row.type)" />
        </q-td>
      </template>
      <template #body-cell-creneau="p">
        <q-td :props="p">
          <div>{{ dateLisible(p.row.dateExamen) }}</div>
          <div class="text-caption text-grey-7">{{ p.row.heureDebut }}–{{ p.row.heureFin }}</div>
        </q-td>
      </template>
      <template #body-cell-presence="p">
        <q-td :props="p" class="text-right">
          <q-chip dense size="sm" :color="p.row.nbPresents >= p.row.nbInscrits ? 'positive' : 'primary'">
            {{ p.row.nbPresents }} / {{ p.row.nbInscrits }}
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="couleurStatut(p.row.statut)" :label="libelleStatut(p.row.statut)" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" color="primary" @click.stop="ouvrirDetail(p.row)">
            <q-tooltip>Détail</q-tooltip>
          </q-btn>
          <template v-if="p.row.statut === 'PLANIFIE' && peutDemarrer">
            <q-btn flat dense round icon="play_arrow" color="positive" @click.stop="demarrer(p.row)">
              <q-tooltip>Démarrer l'examen</q-tooltip>
            </q-btn>
          </template>
          <template v-if="p.row.statut === 'EN_COURS' && peutTerminer">
            <q-btn flat dense round icon="stop" color="negative" @click.stop="terminer(p.row)">
              <q-tooltip>Terminer</q-tooltip>
            </q-btn>
          </template>
          <q-btn flat dense round icon="qr_code_scanner" @click.stop="voirScans(p.row)">
            <q-tooltip>Voir les scans</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="e in examensFiltres" :key="e.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte carte-examen full-height" @click="ouvrirDetail(e)">
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-7">{{ e.codeExamen }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ e.intitule }}</div>
                <div class="text-caption">
                  {{ e.matiere?.intitule ?? '—' }} · {{ e.promotion?.nom ?? '—' }}
                </div>
              </div>
              <q-badge :color="couleurStatut(e.statut)" :label="libelleStatut(e.statut)" />
            </div>
          </q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-sm text-caption">
              <div class="col-6"><q-icon name="event" size="14px" /> {{ dateLisible(e.dateExamen) }}</div>
              <div class="col-6 text-right"><q-icon name="schedule" size="14px" /> {{ e.heureDebut }}–{{ e.heureFin }}</div>
              <div class="col-6"><q-icon name="meeting_room" size="14px" /> {{ e.salle?.code ?? '—' }}</div>
              <div class="col-6 text-right">
                <q-chip dense size="sm" :color="e.nbPresents >= e.nbInscrits ? 'positive' : 'primary'">
                  {{ e.nbPresents }} / {{ e.nbInscrits }}
                </q-chip>
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-if="e.statut === 'PLANIFIE' && peutDemarrer" flat dense no-caps icon="play_arrow" color="positive" label="Démarrer" @click.stop="demarrer(e)" />
            <q-btn v-if="e.statut === 'EN_COURS' && peutTerminer" flat dense no-caps icon="stop" color="negative" label="Terminer" @click.stop="terminer(e)" />
            <q-btn flat dense no-caps icon="qr_code_scanner" label="Scans" @click.stop="voirScans(e)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!examensFiltres.length" class="col-12 text-center text-grey-7 q-pa-xl">
        Aucun examen ne correspond aux filtres.
      </div>
    </div>

    <pagination-bar
      :page.sync="filtres.page"
      :page-size.sync="filtres.pageSize"
      :total="total"
      @tous="chargerTout"
    />

    <examen-dialog v-model="dialogOuvert" @cree="charger" />

    <q-dialog v-model="dialogScans">
      <q-card style="width: 760px; max-width: 95vw">
        <q-card-section v-if="examenScans">
          <div class="text-h6">Scans — {{ examenScans.codeExamen }}</div>
          <div class="text-caption text-grey-7">{{ examenScans.intitule }}</div>
        </q-card-section>
        <q-card-section>
          <q-table
            flat
            dense
            :rows="scans"
            :columns="colonnesScans"
            row-key="id"
            :loading="chargementScans"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-valide="p">
              <q-td :props="p">
                <q-badge :color="p.row.valide ? 'positive' : 'negative'" :label="p.row.valide ? 'OK' : 'Rejet'" />
                <div v-if="p.row.motifRejet" class="text-caption text-grey-7">{{ p.row.motifRejet }}</div>
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ChampDate from '../components/ChampDate.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ExamenDialog from '../components/ExamenDialog.vue';
import {
  LIBELLE_STATUT_EXAMEN,
  LIBELLE_TYPE_EXAMEN,
  aujourdhui,
  dateLisible,
  dateHeureLisible,
  decalerJours,
} from '../utils/libelles';
import type { Examen } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const onglet = ref<'PLANIFIE' | 'EN_COURS' | 'TERMINE'>('PLANIFIE');
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const examens = ref<Examen[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogOuvert = ref(false);
const dialogScans = ref(false);
const examenScans = ref<Examen | null>(null);
const scans = ref<any[]>([]);
const chargementScans = ref(false);

const filtres = ref<Record<string, any>>({
  recherche: '',
  type: null as string | null,
  matiereId: null as string | null,
  promotionId: null as string | null,
  anneeId: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -30),
  dateFin: aujourdhui(),
  page: 1,
  pageSize: 20,
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutDemarrer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'CONTROLEUR']));
const peutTerminer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const optionsTypes = (['PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_EXAMEN[value],
}));

const chipsFiltres = computed(() => {
  const chips: any[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, defaut: true });
  }
  if (filtres.value.type) {
    chips.push({ label: `Type : ${LIBELLE_TYPE_EXAMEN[filtres.value.type] ?? filtres.value.type}`, value: filtres.value.type });
  }
  return chips;
});

const examensFiltres = computed(() => {
  if (onglet.value === 'PLANIFIE') {
    return examens.value.filter((e) => e.statut === 'PLANIFIE');
  }
  if (onglet.value === 'EN_COURS') {
    return examens.value.filter((e) => e.statut === 'EN_COURS');
  }
  return examens.value.filter((e) => e.statut === 'TERMINE' || e.statut === 'ANNULE');
});

const colonnes: QTableColumn[] = [
  { name: 'codeExamen', label: 'Code', field: 'codeExamen', align: 'left', sortable: true },
  { name: 'intitule', label: 'Intitulé', field: 'intitule', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'creneau', label: 'Date & heure', field: 'dateExamen', align: 'left' },
  { name: 'matiere', label: 'Matière', field: (r: Examen) => r.matiere?.intitule ?? '—', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: (r: Examen) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'salle', label: 'Salle', field: (r: Examen) => r.salle?.code ?? '—', align: 'left' },
  { name: 'presence', label: 'Présents', field: 'nbPresents', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesScans: QTableColumn[] = [
  { name: 'heure', label: 'Heure', field: (r: any) => dateHeureLisible(r.heureScan), align: 'left' },
  { name: 'porteur', label: 'Porteur', field: (r: any) => `${r.prenomPorteur ?? ''} ${r.nomPorteur ?? ''}`.trim(), align: 'left' },
  { name: 'matricule', label: 'Matricule saisi', field: 'matriculeSaisi', align: 'left' },
  { name: 'valide', label: 'Résultat', field: 'valide', align: 'left' },
  { name: 'scanneur', label: 'Opérateur', field: (r: any) => r.scanneur ? `${r.scanneur.prenom} ${r.scanneur.nom}` : '—', align: 'left' },
];

function couleurStatut(s: string) {
  switch (s) {
    case 'PLANIFIE':
      return 'primary';
    case 'EN_COURS':
      return 'orange';
    case 'TERMINE':
      return 'positive';
    case 'ANNULE':
      return 'negative';
    default:
      return 'grey-5';
  }
}

function libelleStatut(s: string) {
  return LIBELLE_STATUT_EXAMEN[s] ?? s;
}

function libelleType(s: string) {
  return LIBELLE_TYPE_EXAMEN[s] ?? s;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/examens', {
      params: {
        all: '1',
        search: filtres.value.recherche || undefined,
        type: filtres.value.type || undefined,
        matiereId: filtres.value.matiereId || undefined,
        promotionId: filtres.value.promotionId || undefined,
        anneeId: filtres.value.anneeId || undefined,
        dateDebut: filtres.value.dateDebut || undefined,
        dateFin: filtres.value.dateFin || undefined,
        page: filtres.value.page,
        pageSize: filtres.value.pageSize,
      },
    });
    examens.value = data.data;
    total.value = data.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  filtres.value.page = 1;
  filtres.value.pageSize = Math.max(total.value, 200);
  await charger();
}

function reinitialiser() {
  filtres.value = {
    recherche: '',
    type: null,
    matiereId: null,
    promotionId: null,
    anneeId: null,
    dateDebut: decalerJours(aujourdhui(), -30),
    dateFin: aujourdhui(),
    page: 1,
    pageSize: 20,
  };
  charger();
}

function ouvrirCreation() {
  dialogOuvert.value = true;
}

function ouvrirDetail(_ex: Examen) {
  router.push({ path: '/examens/scan' });
}

function demarrer(e: Examen) {
  $q.dialog({
    title: "Démarrer l'examen",
    message: `Démarrer ${e.codeExamen} — ${e.intitule} ? Le nombre d'inscrits sera recalculé depuis les inscriptions VALIDEE de la promotion.`,
    cancel: true,
    ok: { color: 'positive', label: 'Démarrer', unelevated: true },
  }).onOk(async () => {
    try {
      await api.post(`/examens/${e.id}/demarrer`);
      $q.notify({ type: 'positive', message: 'Examen démarré' });
      await charger();
    } catch (err: any) {
      $q.notify({ type: 'negative', message: err?.response?.data?.message ?? 'Démarrage impossible' });
    }
  });
}

function terminer(e: Examen) {
  $q.dialog({
    title: "Terminer l'examen",
    message: `Clôturer ${e.codeExamen} ? Le compteur nbPresents est figé.`,
    cancel: true,
    ok: { color: 'negative', label: 'Terminer', unelevated: true },
  }).onOk(async () => {
    try {
      await api.post(`/examens/${e.id}/terminer`);
      $q.notify({ type: 'positive', message: 'Examen terminé' });
      await charger();
    } catch (err: any) {
      $q.notify({ type: 'negative', message: err?.response?.data?.message ?? 'Opération impossible' });
    }
  });
}

async function voirScans(e: Examen) {
  examenScans.value = e;
  dialogScans.value = true;
  chargementScans.value = true;
  try {
    const { data } = await api.get(`/examens/${e.id}/scans`);
    scans.value = data;
  } finally {
    chargementScans.value = false;
  }
}

watch(onglet, () => charger());
watch(
  () => [
    filtres.value.recherche,
    filtres.value.type,
    filtres.value.matiereId,
    filtres.value.promotionId,
    filtres.value.anneeId,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    filtres.value.page = 1;
    charger();
  },
);
onMounted(charger);
</script>

<style scoped lang="scss">
.carte-examen {
  cursor: pointer;
  transition: background var(--up-transition);
  border-left: 4px solid var(--up-encre);
  &:hover {
    background: var(--up-craie);
  }
}
</style>
