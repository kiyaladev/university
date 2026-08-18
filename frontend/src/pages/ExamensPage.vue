<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Examens</div>
        <div class="page-sous-titre">
          Planification des épreuves et scan des cartes étudiantes à l'entrée de la salle.
          Chaque examen ouvre sur son tirage et sur son poste de scan.
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
          @click="dialogOuvert = true"
        />
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="qr_code_scanner"
          label="Poste de scan"
          @click="allerScan(null)"
        />
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutVoirTirage"
          outline
          color="secondary"
          no-caps
          icon="local_printshop"
          label="Tirage des épreuves"
          @click="allerTirage(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (code examen, intitulé, matière…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle
          cle="examens"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="optionsTypes"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Type d'épreuve"
        />
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
          label="Année académique"
          :label-fn="(a) => a.libelle"
        />
        <champ-date v-model="filtres.dateDebut" label="Épreuves du" />
        <champ-date v-model="filtres.dateFin" label="au" />
      </template>
    </filter-bar>

    <q-tabs v-model="onglet" dense no-caps align="left" class="onglets-panneau q-mb-md">
      <q-tab name="PLANIFIE" :label="LIBELLE_STATUT_EXAMEN.PLANIFIE" icon="event" />
      <q-tab name="EN_COURS" :label="LIBELLE_STATUT_EXAMEN.EN_COURS" icon="play_circle_outline" />
      <q-tab name="TERMINE" :label="LIBELLE_STATUT_EXAMEN.TERMINE" icon="task_alt" />
      <q-tab name="ANNULE" :label="LIBELLE_STATUT_EXAMEN.ANNULE" icon="block" />
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
      :pagination="{ rowsPerPage: 0 }"
      @row-click="(_, row) => ouvrirFiche(row)"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="quiz" size="32px" color="grey-5" />
          <div class="q-mt-sm">{{ messageVide }}</div>
          <q-btn
            v-if="peutCreer && onglet === 'PLANIFIE'"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Planifier un examen"
            class="q-mt-sm"
            @click="dialogOuvert = true"
          />
        </div>
      </template>

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
          <q-btn
            flat
            dense
            round
            icon="visibility"
            color="primary"
            aria-label="Ouvrir la fiche de l'examen"
            @click.stop="ouvrirFiche(p.row)"
          >
            <q-tooltip>Fiche de l'examen</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'PLANIFIE' && peutDemarrer"
            flat
            dense
            round
            icon="play_arrow"
            color="positive"
            aria-label="Démarrer l'examen"
            @click.stop="demarrer(p.row)"
          >
            <q-tooltip>Démarrer l'examen</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'EN_COURS' && peutTerminer"
            flat
            dense
            round
            icon="stop"
            color="negative"
            aria-label="Terminer l'examen"
            @click.stop="terminer(p.row)"
          >
            <q-tooltip>Terminer l'examen</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="qr_code_scanner"
            aria-label="Ouvrir le poste de scan de cet examen"
            @click.stop="allerScan(p.row)"
          >
            <q-tooltip>Scanner les cartes de cet examen</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutVoirTirage"
            flat
            dense
            round
            icon="local_printshop"
            aria-label="Voir le tirage de cet examen"
            @click.stop="allerTirage(p.row)"
          >
            <q-tooltip>Tirage des épreuves de cet examen</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="e in examensFiltres" :key="e.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte carte-examen full-height" @click="ouvrirFiche(e)">
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
            <q-btn
              v-if="e.statut === 'PLANIFIE' && peutDemarrer"
              flat
              dense
              no-caps
              icon="play_arrow"
              color="positive"
              label="Démarrer"
              @click.stop="demarrer(e)"
            />
            <q-btn
              v-if="e.statut === 'EN_COURS' && peutTerminer"
              flat
              dense
              no-caps
              icon="stop"
              color="negative"
              label="Terminer"
              @click.stop="terminer(e)"
            />
            <q-btn
              v-if="peutVoirTirage"
              flat
              dense
              no-caps
              icon="local_printshop"
              label="Tirage"
              @click.stop="allerTirage(e)"
            />
            <q-btn flat dense no-caps icon="qr_code_scanner" label="Scanner" @click.stop="allerScan(e)" />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!examensFiltres.length" class="col-12">
        <div class="etat-vide plaque">
          <q-icon name="quiz" size="32px" color="grey-5" />
          <div class="q-mt-sm">{{ messageVide }}</div>
          <q-btn
            v-if="peutCreer && onglet === 'PLANIFIE'"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Planifier un examen"
            class="q-mt-sm"
            @click="dialogOuvert = true"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      v-if="total"
      :page="filtres.page"
      :page-size="filtres.pageSize"
      :total="total"
      @update:page="(v) => { filtres.page = v; charger(); }"
      @update:page-size="(v) => { filtres.pageSize = v; filtres.page = 1; charger(); }"
      @tous="chargerTout"
    />

    <examen-dialog v-model="dialogOuvert" @cree="charger" />

    <!-- Fiche de l'examen : les trois maillons de la chaîne au même endroit -->
    <q-dialog v-model="dialogFiche" :maximized="$q.screen.lt.md">
      <q-card style="width: 820px; max-width: 95vw">
        <q-card-section v-if="examenFiche" class="row items-start q-col-gutter-md">
          <div class="col">
            <div class="text-caption text-grey-7">{{ examenFiche.codeExamen }}</div>
            <div class="text-h6">{{ examenFiche.intitule }}</div>
            <div class="text-caption text-grey-7">
              {{ libelleType(examenFiche.type) }} ·
              {{ examenFiche.matiere?.intitule ?? '—' }} ·
              {{ examenFiche.promotion?.nom ?? '—' }}
            </div>
          </div>
          <div class="col-auto">
            <q-badge :color="couleurStatut(examenFiche.statut)" :label="libelleStatut(examenFiche.statut)" />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="close" aria-label="Fermer la fiche" v-close-popup />
          </div>
        </q-card-section>

        <q-card-section v-if="examenFiche" class="q-pt-none">
          <div class="row q-col-gutter-md text-caption">
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">Date</div>
              <div class="text-weight-medium">{{ dateLisible(examenFiche.dateExamen) }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">Horaire</div>
              <div class="text-weight-medium">{{ examenFiche.heureDebut }}–{{ examenFiche.heureFin }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">Salle</div>
              <div class="text-weight-medium">{{ examenFiche.salle?.code ?? '—' }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">Présents / inscrits</div>
              <div class="text-weight-medium chiffres">
                {{ examenFiche.nbPresents }} / {{ examenFiche.nbInscrits }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <!-- Suite de la chaîne : tirage puis scan -->
        <q-card-section class="row q-gutter-sm items-center">
          <span class="section-titre">Suite de la chaîne</span>
          <q-space />
          <q-btn
            v-if="peutVoirTirage"
            outline
            no-caps
            color="secondary"
            icon="local_printshop"
            label="Tirage des épreuves"
            @click="allerTirage(examenFiche)"
          />
          <q-btn
            outline
            no-caps
            color="secondary"
            icon="qr_code_scanner"
            label="Scanner les cartes"
            @click="allerScan(examenFiche)"
          />
        </q-card-section>

        <q-separator />

        <q-card-section>
          <span class="section-titre">Journal des scans</span>
          <q-table
            flat
            dense
            :rows="scans"
            :columns="colonnesScans"
            row-key="id"
            :loading="chargementScans"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #no-data>
              <div class="etat-vide">
                <q-icon name="qr_code_scanner" size="28px" color="grey-5" />
                <div class="q-mt-sm">Aucune carte scannée pour cet examen.</div>
              </div>
            </template>
            <template #body-cell-valide="p">
              <q-td :props="p">
                <q-badge :color="p.row.valide ? 'positive' : 'negative'" :label="p.row.valide ? 'Validé' : 'Rejeté'" />
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
import type { Examen, ScanExamen, StatutExamen, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const onglet = ref<StatutExamen>('PLANIFIE');
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const examens = ref<Examen[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogOuvert = ref(false);

const dialogFiche = ref(false);
const examenFiche = ref<Examen | null>(null);
const scans = ref<ScanExamen[]>([]);
const chargementScans = ref(false);

/** Les épreuves planifiées sont devant nous : la fenêtre par défaut regarde en avant. */
function filtresParDefaut() {
  return {
    recherche: '',
    type: null as string | null,
    matiereId: null as string | null,
    promotionId: null as string | null,
    anneeId: null as string | null,
    dateDebut: decalerJours(aujourdhui(), -30),
    dateFin: decalerJours(aujourdhui(), 90),
    page: 1,
    pageSize: 20,
  };
}

const filtres = ref<Record<string, any>>(filtresParDefaut());

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutDemarrer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'CONTROLEUR']));
const peutTerminer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
/** La route `tirage` est réservée à l'administration et à la scolarité. */
const peutVoirTirage = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const optionsTypes = (['PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_EXAMEN[value],
}));

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, icone: 'search', defaut: true });
  }
  if (filtres.value.type) {
    chips.push({
      label: `Type : ${LIBELLE_TYPE_EXAMEN[filtres.value.type] ?? filtres.value.type}`,
      value: filtres.value.type,
      icone: 'category',
    });
  }
  return chips;
});

/**
 * Le statut est filtré côté serveur (onglets) ; la recherche texte, elle,
 * n'est pas gérée par `/examens` : on l'applique sur les lignes chargées pour
 * que le champ ne reste pas décoratif.
 */
const examensFiltres = computed(() => {
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
  if (!q) return examens.value;
  return examens.value.filter((e) =>
    [e.codeExamen, e.intitule, e.matiere?.intitule, e.promotion?.nom]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

const messageVide = computed(() =>
  filtres.value.recherche
    ? 'Aucun examen ne correspond à cette recherche.'
    : `Aucun examen « ${libelleStatut(onglet.value).toLowerCase()} » sur cette période.`,
);

const colonnes: QTableColumn[] = [
  { name: 'codeExamen', label: 'Code', field: 'codeExamen', align: 'left', sortable: true },
  { name: 'intitule', label: 'Intitulé', field: 'intitule', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'creneau', label: 'Date & heure', field: 'dateExamen', align: 'left', sortable: true },
  { name: 'matiere', label: 'Matière', field: (r: Examen) => r.matiere?.intitule ?? '—', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: (r: Examen) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'salle', label: 'Salle', field: (r: Examen) => r.salle?.code ?? '—', align: 'left' },
  { name: 'presence', label: 'Présents', field: 'nbPresents', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesScans: QTableColumn[] = [
  { name: 'heure', label: 'Heure', field: (r: ScanExamen) => dateHeureLisible(r.heureScan), align: 'left' },
  { name: 'porteur', label: 'Porteur', field: (r: ScanExamen) => `${r.prenomPorteur ?? ''} ${r.nomPorteur ?? ''}`.trim() || '—', align: 'left' },
  { name: 'matricule', label: 'Matricule saisi', field: (r: ScanExamen) => r.matriculeSaisi ?? '—', align: 'left' },
  { name: 'valide', label: 'Résultat', field: 'valide', align: 'left' },
  { name: 'scanneur', label: 'Opérateur', field: (r: ScanExamen) => (r.scanneur ? `${r.scanneur.prenom} ${r.scanneur.nom}` : '—'), align: 'left' },
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
        statut: onglet.value,
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
    examens.value = data.data ?? [];
    total.value = data.total ?? examens.value.length;
  } catch (e: any) {
    examens.value = [];
    total.value = 0;
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Chargement des examens impossible' });
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
  filtres.value = filtresParDefaut();
  charger();
}

/** Fiche : infos de l'examen + journal des scans, avec les liens de la chaîne. */
async function ouvrirFiche(e: Examen) {
  examenFiche.value = e;
  dialogFiche.value = true;
  scans.value = [];
  chargementScans.value = true;
  try {
    const { data } = await api.get(`/examens/${e.id}/scans`);
    scans.value = Array.isArray(data) ? data : (data?.data ?? []);
  } catch {
    scans.value = [];
  } finally {
    chargementScans.value = false;
  }
}

/** Examen → tirage : la page Tirage se filtre d'elle-même sur cet examen. */
function allerTirage(e: Examen | null) {
  void router.push({ name: 'tirage', query: e ? { examenId: e.id } : {} });
}

/** Examen → scan : le poste de scan présélectionne l'examen. */
function allerScan(e: Examen | null) {
  void router.push({ name: 'scan-examen', query: e ? { examenId: e.id } : {} });
}

function demarrer(e: Examen) {
  $q.dialog({
    title: "Démarrer l'examen",
    message: `Démarrer ${e.codeExamen} — ${e.intitule} ? Le nombre d'inscrits sera recalculé depuis les inscriptions validées de la promotion, et le poste de scan s'ouvrira à cet examen.`,
    cancel: true,
    ok: { color: 'positive', label: 'Démarrer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/examens/${e.id}/demarrer`);
      $q.notify({ type: 'positive', message: 'Examen démarré' });
      // Le changement d'onglet déclenche lui-même le rechargement.
      if (onglet.value === 'EN_COURS') await charger();
      else onglet.value = 'EN_COURS';
    } catch (err: any) {
      $q.notify({ type: 'negative', message: err?.response?.data?.message ?? 'Démarrage impossible' });
    }
  });
}

function terminer(e: Examen) {
  $q.dialog({
    title: "Terminer l'examen",
    message: `Clôturer ${e.codeExamen} — ${e.intitule} ? Le nombre de présents est figé : plus aucune carte ne pourra être scannée pour cette épreuve. Cette opération est définitive.`,
    cancel: true,
    ok: { color: 'negative', label: 'Terminer définitivement', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/examens/${e.id}/terminer`);
      $q.notify({ type: 'positive', message: 'Examen terminé' });
      if (onglet.value === 'TERMINE') await charger();
      else onglet.value = 'TERMINE';
    } catch (err: any) {
      $q.notify({ type: 'negative', message: err?.response?.data?.message ?? 'Opération impossible' });
    }
  });
}

watch(onglet, () => {
  filtres.value.page = 1;
  charger();
});
watch(
  () => [
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
// La plaque est déjà cernée d'un filet entier : un bandeau latéral en plus
// ferait de la carte une languette, ce que le monde refuse.
.carte-examen {
  cursor: pointer;
  transition: background var(--up-transition);
  &:hover {
    background: var(--up-craie);
  }
}
</style>
