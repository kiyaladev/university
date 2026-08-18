<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Délibérations</div>
        <div class="page-sous-titre">
          Sessions du jury : moyennes pondérées par les crédits, décisions ADMIS /
          AJOURNÉ / DÉFAILLANT, puis édition des bulletins.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutSaisir"
          unelevated
          color="primary"
          no-caps
          icon="gavel"
          label="Nouvelle délibération"
          @click="dialogOuvert = true"
        />
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="school"
          label="Bulletins"
          @click="allerBulletins(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher une promotion…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Année académique"
        />
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
        <semestre-select
          v-model="filtres.session"
          type="session"
          label="Session"
          clearable
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="deliberations"
          :modes="['tableau', 'kanban']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'kanban')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="deliberationsPage"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
      @row-click="(_, row) => ouvrirDetail(row)"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="gavel" size="32px" color="grey-5" />
          <div class="q-mt-sm">Aucune délibération pour ces critères.</div>
          <q-btn
            v-if="peutSaisir"
            unelevated
            color="primary"
            no-caps
            icon="gavel"
            label="Nouvelle délibération"
            class="q-mt-sm"
            @click="dialogOuvert = true"
          />
        </div>
      </template>

      <template #body-cell-session="p">
        <q-td :props="p">{{ LIBELLE_SESSION_DELIBERATION[p.row.session] ?? p.row.session }}</q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="p.row.statut === 'VALIDEE' ? 'positive' : 'warning'">
            {{ LIBELLE_STATUT_DELIBERATION[p.row.statut] ?? p.row.statut }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-taux="p">
        <q-td :props="p" class="text-center">
          <template v-if="p.row.tauxReussite !== null && p.row.tauxReussite !== undefined">
            {{ pourcentLisible(p.row.tauxReussite) }}
          </template>
          <template v-else>—</template>
        </q-td>
      </template>

      <template #body-cell-effectif="p">
        <q-td :props="p" class="text-center chiffres">{{ p.row._count?.lignes ?? 0 }}</q-td>
      </template>

      <template #body-cell-creeLe="p">
        <q-td :props="p">{{ dateLisible(p.row.creeLe) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            aria-label="Voir le détail de la délibération"
            @click.stop="ouvrirDetail(p.row)"
          >
            <q-tooltip>Détail des lignes</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON' && peutSaisir"
            flat
            dense
            round
            icon="replay"
            color="primary"
            aria-label="Recalculer moyennes et décisions"
            @click.stop="calculer(p.row)"
          >
            <q-tooltip>Recalculer moyennes et décisions</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'BROUILLON' && estJury"
            flat
            dense
            no-caps
            icon="verified_user"
            color="positive"
            label="Valider le jury"
            @click.stop="valider(p.row)"
          />
          <q-btn
            flat
            dense
            round
            icon="school"
            color="primary"
            aria-label="Voir les bulletins de cette délibération"
            @click.stop="allerBulletins(p.row)"
          >
            <q-tooltip>Bulletins de cette promotion</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            aria-label="Imprimer le procès-verbal"
            @click.stop="imprimerPv(p.row)"
          >
            <q-tooltip>Imprimer le PV</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <kanban-board v-else :colonnes="colonnesKanban" />

    <pagination-bar
      v-if="modeVue === 'tableau' && totalFiltre"
      :page="page"
      :page-size="pageSize"
      :total="totalFiltre"
      :show-all="false"
      @update:page="(v) => (page = v)"
      @update:page-size="(v) => { pageSize = v; page = 1; }"
    />

    <deliberation-dialog
      v-model="dialogOuvert"
      :annees="annees"
      :promotions="promotions"
      :matieres="matieres"
      @enregistre="charger"
    />

    <!-- Détail des lignes : les décisions individuelles du jury -->
    <q-dialog v-model="dialogDetail" :maximized="$q.screen.lt.md">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section class="row items-center q-col-gutter-md">
          <div class="col">
            <div class="text-h6">Délibération — {{ detail?.promotion?.nom ?? '—' }}</div>
            <div class="text-caption text-grey-7">
              {{ LIBELLE_SESSION_DELIBERATION[detail?.session ?? 'NORMALE'] }} ·
              {{ detail?.annee?.libelle ?? '—' }} ·
              {{ LIBELLE_STATUT_DELIBERATION[detail?.statut ?? 'BROUILLON'] }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn outline no-caps icon="school" label="Bulletins" @click="allerBulletins(detail)" />
          </div>
          <div class="col-auto">
            <q-btn outline no-caps icon="print" label="PV" @click="imprimerPv(detail)" />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="close" aria-label="Fermer le détail" v-close-popup />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-linear-progress v-if="chargementDetail" indeterminate color="primary" class="q-mb-sm" />
          <q-table
            v-else
            flat
            bordered
            :rows="detailLignes"
            :columns="colonnesDetail"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #no-data>
              <div class="etat-vide">
                <q-icon name="how_to_reg" size="28px" color="grey-5" />
                <div class="q-mt-sm">
                  Aucune ligne : lancez le recalcul pour produire les moyennes et les décisions.
                </div>
              </div>
            </template>
            <template #body-cell-moyenne="p">
              <q-td :props="p" class="text-center chiffres">
                {{ p.row.moyenne !== null && p.row.moyenne !== undefined ? p.row.moyenne.toFixed(2) : '—' }}
              </q-td>
            </template>
            <template #body-cell-decision="p">
              <q-td :props="p">
                <q-badge :color="couleurDecision(p.row.decision)">
                  {{ LIBELLE_DECISION_JURY[p.row.decision] ?? p.row.decision }}
                </q-badge>
              </q-td>
            </template>
            <template #body-cell-actions="p">
              <q-td :props="p" class="text-right">
                <q-btn
                  flat
                  dense
                  round
                  icon="print"
                  aria-label="Imprimer le bulletin individuel"
                  @click="imprimerBulletin(p.row)"
                >
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import DeliberationDialog from '../components/DeliberationDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import SemestreSelect from '../components/SemestreSelect.vue';
import KanbanBoard from '../components/KanbanBoard.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_STATUT_DELIBERATION,
  dateLisible,
  pourcentLisible,
} from '../utils/libelles';
import type { AnneeAcademique, Deliberation, DeliberationLigne, Matiere, Promotion, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

/** La liste renvoie l'effectif agrégé, absent du modèle partagé. */
interface DeliberationListe extends Deliberation {
  _count?: { lignes: number };
}

const peutSaisir = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
/** Le jury : direction et administrateur figent les résultats. */
const estJury = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

const deliberations = ref<DeliberationListe[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const matieres = ref<Matiere[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'kanban'>('tableau');

const page = ref(1);
const pageSize = ref(15);

const filtres = ref<Record<string, any>>({});

const dialogOuvert = ref(false);
const dialogDetail = ref(false);
const detail = ref<DeliberationListe | null>(null);
const chargementDetail = ref(false);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsStatuts = [
  { label: LIBELLE_STATUT_DELIBERATION.BROUILLON, value: 'BROUILLON' },
  { label: LIBELLE_STATUT_DELIBERATION.VALIDEE, value: 'VALIDEE' },
];

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: `Année : ${a?.libelle ?? '?'}`, value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.session) {
    cs.push({
      label: `Session : ${LIBELLE_SESSION_DELIBERATION[filtres.value.session] ?? filtres.value.session}`,
      value: filtres.value.session,
      icone: 'flag',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: `Statut : ${LIBELLE_STATUT_DELIBERATION[filtres.value.statut] ?? filtres.value.statut}`,
      value: filtres.value.statut,
      icone: 'verified',
    });
  }
  return cs;
});

/**
 * `/deliberations` ne filtre que sur l'année : promotion, session, statut et
 * recherche sont appliqués ici, sur la liste complète déjà chargée (`all=1`).
 */
const deliberationsFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
  return deliberations.value.filter((d) => {
    if (filtres.value.promotionId && d.promotionId !== filtres.value.promotionId) return false;
    if (filtres.value.session && d.session !== filtres.value.session) return false;
    if (filtres.value.statut && d.statut !== filtres.value.statut) return false;
    if (q && !`${d.promotion?.nom ?? ''} ${d.annee?.libelle ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
});

const totalFiltre = computed(() => deliberationsFiltrees.value.length);
const deliberationsPage = computed(() =>
  deliberationsFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

const colonnes: QTableColumn[] = [
  { name: 'promotion', label: 'Promotion', field: (r) => r.promotion?.nom ?? '—', align: 'left', sortable: true },
  { name: 'annee', label: 'Année', field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'session', label: 'Session', field: 'session', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'taux', label: 'Taux de réussite', field: 'tauxReussite', align: 'center', sortable: true },
  { name: 'effectif', label: 'Étudiants', field: (r) => r._count?.lignes ?? 0, align: 'center' },
  { name: 'creeLe', label: 'Créée le', field: 'creeLe', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesDetail: QTableColumn[] = [
  { name: 'rang', label: 'Rang', field: 'rang', align: 'center' },
  { name: 'matricule', label: 'Matricule', field: (r) => r.inscription?.etudiant?.matricule ?? '—', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.inscription?.etudiant?.nom ?? ''} ${r.inscription?.etudiant?.prenom ?? ''}`.trim() || '—', align: 'left' },
  { name: 'moyenne', label: 'Moyenne', field: 'moyenne', align: 'center' },
  { name: 'decision', label: 'Décision', field: 'decision', align: 'center' },
  { name: 'mention', label: 'Mention', field: (r) => r.mention ?? '—', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const detailLignes = computed<DeliberationLigne[]>(() => detail.value?.lignes ?? []);

const colonnesKanban = computed(() => {
  const parColonne: Record<string, DeliberationListe[]> = {
    PROPOSE: [],
    VALIDE: [],
    SOUTENU: [],
    ABANDONNE: [],
  };
  for (const d of deliberationsFiltrees.value) {
    (parColonne[bucketDeliberation(d)] ||= []).push(d);
  }

  const carte = (d: DeliberationListe) => ({
    id: d.id,
    titre: d.promotion?.nom ?? '—',
    sousTitre: `${LIBELLE_SESSION_DELIBERATION[d.session]} · ${d.annee?.libelle ?? ''}`,
    meta: `${d._count?.lignes ?? 0} étudiant(s) · créée le ${dateLisible(d.creeLe)}`,
    badge: LIBELLE_STATUT_DELIBERATION[d.statut] ?? d.statut,
    couleur: d.statut === 'VALIDEE' ? 'positive' : 'warning',
    actions: [
      ...(d.statut === 'BROUILLON' && peutSaisir.value
        ? [{ label: 'Recalculer', icone: 'replay', couleur: 'primary', onClick: () => calculer(d) }]
        : []),
      ...(d.statut === 'BROUILLON' && estJury.value
        ? [{ label: 'Valider', icone: 'verified_user', couleur: 'positive', onClick: () => valider(d) }]
        : []),
      { label: 'Bulletins', icone: 'school', couleur: 'primary', onClick: () => allerBulletins(d) },
      { label: 'PV', icone: 'print', couleur: 'primary', onClick: () => imprimerPv(d) },
    ],
    onClick: () => ouvrirDetail(d),
  });

  return [
    { identifiant: 'PROPOSE', titre: 'Proposées (brouillon)', couleur: '#EFB700', cartes: parColonne.PROPOSE.map(carte) },
    { identifiant: 'VALIDE', titre: 'Validées (jury)', couleur: '#0F7A45', cartes: parColonne.VALIDE.map(carte) },
    { identifiant: 'SOUTENU', titre: 'Rattrapages validés', couleur: '#3E9E6C', cartes: parColonne.SOUTENU.map(carte) },
    { identifiant: 'ABANDONNE', titre: 'Rattrapages en attente', couleur: '#C4122E', cartes: parColonne.ABANDONNE.map(carte) },
  ];
});

function bucketDeliberation(d: DeliberationListe): string {
  if (d.session === 'RATTRAPAGE') return d.statut === 'VALIDEE' ? 'SOUTENU' : 'ABANDONNE';
  return d.statut === 'VALIDEE' ? 'VALIDE' : 'PROPOSE';
}

function couleurDecision(d: string): string {
  return d === 'ADMIS' ? 'positive' : d === 'AJOURNE' ? 'warning' : 'negative';
}

function urlToken(chemin: string) {
  return `${API_URL}${chemin}${chemin.includes('?') ? '&' : '?'}token=${auth.token}`;
}

function imprimerPv(d: DeliberationListe | null) {
  if (!d) return;
  window.open(urlToken(`/deliberations/${d.id}/imprimer`), '_blank');
}

function imprimerBulletin(l: DeliberationLigne) {
  if (!detail.value) return;
  window.open(urlToken(`/deliberations/${detail.value.id}/releve/${l.inscriptionId}`), '_blank');
}

/**
 * La liste ne renvoie pas les lignes : le détail est rechargé sur l'identifiant
 * pour afficher les décisions individuelles réelles.
 */
async function ouvrirDetail(d: DeliberationListe) {
  detail.value = d;
  dialogDetail.value = true;
  chargementDetail.value = true;
  try {
    const { data } = await api.get(`/deliberations/${d.id}`);
    detail.value = data;
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Détail indisponible' });
  } finally {
    chargementDetail.value = false;
  }
}

function calculer(d: DeliberationListe) {
  $q.dialog({
    title: 'Recalculer la délibération',
    message:
      'Les moyennes d’UE (pondérées par les coefficients), la moyenne générale (pondérée par les crédits), les décisions, rangs et taux de réussite seront recalculés sur les notes actuelles.',
    cancel: true,
    ok: { color: 'primary', label: 'Recalculer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/deliberations/${d.id}/calculer`);
      $q.notify({ type: 'positive', message: 'Délibération recalculée' });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Recalcul impossible' });
    }
  });
}

function valider(d: DeliberationListe) {
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
      <p><strong>Après validation, tout recalcul sera bloqué et les bulletins deviendront officiels.</strong> Continuer ?</p>`,
    cancel: { flat: true, label: 'Revenir', noCaps: true },
    ok: { color: 'positive', label: 'Valider le jury', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/deliberations/${d.id}/valider`);
      $q.notify({ type: 'positive', message: 'Délibération validée par le jury' });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Validation impossible' });
    }
  });
}

/** Délibération → bulletins : la page Bulletins s'ouvre sur la même promotion. */
function allerBulletins(d: DeliberationListe | null) {
  void router.push({
    name: 'bulletins',
    query: d
      ? { anneeId: d.anneeId, promotionId: d.promotionId, session: d.session }
      : {},
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/deliberations', {
      params: { all: '1', anneeId: filtres.value.anneeId || undefined },
    });
    deliberations.value = data.data ?? [];
  } catch (e: any) {
    deliberations.value = [];
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Chargement des délibérations impossible' });
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  charger();
}

watch(() => filtres.value.anneeId, () => {
  page.value = 1;
  charger();
});
watch(
  () => [filtres.value.promotionId, filtres.value.session, filtres.value.statut, filtres.value.recherche],
  () => {
    page.value = 1;
  },
);

onMounted(async () => {
  const [a, p, m] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
    api.get('/matieres', { params: { all: '1' } }).catch(() => ({ data: { data: [] } })),
  ]);
  annees.value = a.data.data;
  promotions.value = p.data.data;
  matieres.value = m.data.data ?? [];
  await charger();
});
</script>

<style scoped lang="scss">
</style>
