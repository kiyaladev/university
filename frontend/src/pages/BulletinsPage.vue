<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Bulletins</div>
        <div class="page-sous-titre">
          Relevés individuels après délibération : moyenne générale pondérée par
          les crédits, rang dans la promotion, décision et mention du jury.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="gavel"
          label="Délibérations"
          @click="router.push({ name: 'deliberations' })"
        />
      </div>
      <div class="col-auto">
        <q-btn
          v-if="nbImprimables"
          unelevated
          color="primary"
          no-caps
          icon="print"
          :label="`Imprimer les ${nbImprimables} bulletins`"
          @click="imprimerTous"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher par nom ou matricule…"
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
          v-model="filtres.decision"
          :options="optionsDecisions"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Décision du jury"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="bulletins"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <!-- Aperçu d'un bulletin : on quitte la liste le temps de la lecture -->
    <div v-if="bulletinSelectionne" class="bulletins-apercu">
      <div class="row items-center q-col-gutter-sm q-mb-md">
        <div class="col-auto">
          <q-btn outline no-caps icon="arrow_back" label="Retour à la liste" @click="fermerApercu" />
        </div>
        <q-space />
        <div class="col-auto">
          <q-btn
            v-if="ligneSelectionnee?.decision === 'ADMIS'"
            outline
            color="secondary"
            no-caps
            icon="verified_user"
            label="Émettre l'attestation de réussite"
            @click="allerAttestation(ligneSelectionnee)"
          />
        </div>
      </div>
      <bulletin-card :bulletin="bulletinSelectionne" :url-impression="urlBulletinCourant" />
    </div>

    <template v-else>
      <!-- Guidage : sans promotion, la liste n'a pas de sens -->
      <div v-if="!filtres.promotionId" class="plaque q-pa-lg text-center text-grey-7">
        <q-icon name="school" size="38px" color="grey-5" />
        <div class="q-mt-sm text-weight-medium">Choisissez une promotion</div>
        <div class="text-caption q-mt-xs">
          Les bulletins se lisent promotion par promotion. Ouvrez « Filtres avancés »
          pour sélectionner l'année et la promotion, ou partez d'une délibération.
        </div>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="gavel"
          label="Voir les délibérations"
          class="q-mt-md"
          @click="router.push({ name: 'deliberations' })"
        />
      </div>

      <template v-else>
        <q-banner v-if="!chargement && !aucuneDeliberation" dense class="carte q-mb-md">
          <template #avatar><q-icon name="info" color="primary" /></template>
          {{ nbImprimables }} étudiant(s) délibéré(s) sur {{ lignesFiltrees.length }} inscrit(s)
          affiché(s). Seuls les étudiants portés à une délibération ont un bulletin.
        </q-banner>

        <q-banner v-if="!chargement && aucuneDeliberation" dense class="carte q-mb-md">
          <template #avatar><q-icon name="warning" color="warning" /></template>
          Aucune délibération pour ce filtre : les bulletins ne pourront pas être édités.
          <template #action>
            <q-btn flat dense no-caps label="Créer la délibération" @click="router.push({ name: 'deliberations' })" />
          </template>
        </q-banner>

        <q-table
          v-if="modeVue === 'tableau'"
          flat
          bordered
          class="carte"
          :rows="lignesPage"
          :columns="colonnes"
          row-key="inscriptionId"
          :loading="chargement"
          :pagination="{ rowsPerPage: 0 }"
          @row-click="(_, row) => selectionner(row)"
        >
          <template #no-data>
            <div class="etat-vide">
              <q-icon name="school" size="32px" color="grey-5" />
              <div class="q-mt-sm">Aucun étudiant pour ces critères.</div>
            </div>
          </template>

          <template #body-cell-moyenne="p">
            <q-td :props="p" class="text-center chiffres">
              <span :class="{ 'text-negative': p.row.moyenne !== null && p.row.moyenne < 10 }">
                {{ p.row.moyenne !== null ? p.row.moyenne.toFixed(2) : '—' }}
              </span>
            </q-td>
          </template>

          <template #body-cell-decision="p">
            <q-td :props="p" class="text-center">
              <q-badge
                v-if="p.row.decision"
                :color="couleurDecision(p.row.decision)"
                :label="LIBELLE_DECISION_JURY[p.row.decision] ?? p.row.decision"
              />
              <span v-else class="text-grey-7">Non délibéré</span>
            </q-td>
          </template>

          <template #body-cell-rang="p">
            <q-td :props="p" class="text-center chiffres">{{ p.row.rang ?? '—' }}</q-td>
          </template>

          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="visibility"
                aria-label="Voir le bulletin"
                @click.stop="selectionner(p.row)"
              >
                <q-tooltip>Voir le bulletin</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="picture_as_pdf"
                :color="p.row.deliberationId ? 'primary' : 'grey-5'"
                :disable="!p.row.deliberationId"
                aria-label="Imprimer le bulletin"
                @click.stop="imprimerUn(p.row)"
              >
                <q-tooltip>
                  {{ p.row.deliberationId ? 'Imprimer le bulletin officiel' : 'Aucune délibération pour cet étudiant' }}
                </q-tooltip>
              </q-btn>
              <q-btn
                v-if="p.row.decision === 'ADMIS'"
                flat
                dense
                round
                icon="verified_user"
                color="secondary"
                aria-label="Émettre une attestation de réussite"
                @click.stop="allerAttestation(p.row)"
              >
                <q-tooltip>Émettre l'attestation de réussite</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>

        <div v-else class="bulletins-cartes">
          <q-card
            v-for="l in lignesPage"
            :key="l.inscriptionId"
            flat
            bordered
            class="carte bulletins-cartes__carte"
            @click="selectionner(l)"
          >
            <q-card-section>
              <div class="row items-center q-mb-xs">
                <q-badge
                  v-if="l.decision"
                  :color="couleurDecision(l.decision)"
                  :label="LIBELLE_DECISION_JURY[l.decision] ?? l.decision"
                />
                <q-badge v-else color="grey-6" label="Non délibéré" />
                <q-space />
                <div class="text-caption text-grey-7">{{ l.matricule }}</div>
              </div>
              <div class="text-subtitle1 text-weight-medium">{{ l.nom }} {{ l.prenom }}</div>
              <div class="row items-baseline q-gutter-md q-mt-sm">
                <div class="chiffres text-h6">
                  {{ l.moyenne !== null ? l.moyenne.toFixed(2) : '—' }}<span class="text-caption">/20</span>
                </div>
                <div class="text-caption text-grey-7">
                  Rang {{ l.rang ?? '—' }}{{ l.mention ? ` · ${l.mention}` : '' }}
                </div>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right">
              <q-btn flat dense no-caps icon="visibility" label="Bulletin" @click.stop="selectionner(l)" />
              <q-btn
                flat
                dense
                no-caps
                icon="picture_as_pdf"
                label="Imprimer"
                :disable="!l.deliberationId"
                @click.stop="imprimerUn(l)"
              />
              <q-btn
                v-if="l.decision === 'ADMIS'"
                flat
                dense
                no-caps
                color="secondary"
                icon="verified_user"
                label="Attestation"
                @click.stop="allerAttestation(l)"
              />
            </q-card-actions>
          </q-card>
          <div v-if="!lignesPage.length" class="etat-vide plaque">
            <q-icon name="school" size="32px" color="grey-5" />
            <div class="q-mt-sm">Aucun étudiant pour ces critères.</div>
          </div>
        </div>

        <pagination-bar
          v-if="lignesFiltrees.length"
          :page="page"
          :page-size="pageSize"
          :total="lignesFiltrees.length"
          :show-all="false"
          @update:page="(v) => (page = v)"
          @update:page-size="(v) => { pageSize = v; page = 1; }"
        />
      </template>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import BulletinCard from '../components/BulletinCard.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import SemestreSelect from '../components/SemestreSelect.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
} from '../utils/libelles';
import type {
  AnneeAcademique,
  Deliberation,
  DeliberationLigne,
  Inscription,
  Promotion,
  SessionDeliberation, ChipFiltre } from '../types';

/** Une ligne du listing : l'inscrit, enrichi de sa décision de jury s'il en a une. */
interface LigneBulletin {
  inscriptionId: string;
  etudiantId: string | null;
  matricule: string;
  nom: string;
  prenom: string;
  moyenne: number | null;
  decision: string | null;
  mention: string | null;
  rang: number | null;
  deliberationId: string | null;
}

interface BulletinView {
  etudiant: { matricule: string; nom: string; prenom: string };
  promotion: string;
  annee: string;
  session: string;
  dateDeliberation?: string;
  lignes: Array<{ matiere: string; code?: string; credits: number; moyenne: number; decision?: string }>;
  moyenneGenerale: number;
  decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT' | null;
  mention?: string;
  rang?: number;
  effectif?: number;
}

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
/** Délibérations du filtre, rechargées en détail pour disposer de leurs lignes. */
const deliberations = ref<Deliberation[]>([]);

const filtres = ref<Record<string, any>>({});
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const page = ref(1);
const pageSize = ref(20);

const lignes = ref<LigneBulletin[]>([]);
const bulletinSelectionne = ref<BulletinView | null>(null);
const ligneSelectionnee = ref<LigneBulletin | null>(null);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsDecisions = Object.entries(LIBELLE_DECISION_JURY).map(([value, label]) => ({ value, label }));

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, icone: 'search', defaut: true });
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
  if (filtres.value.decision) {
    cs.push({
      label: `Décision : ${LIBELLE_DECISION_JURY[filtres.value.decision] ?? filtres.value.decision}`,
      value: filtres.value.decision,
      icone: 'gavel',
    });
  }
  return cs;
});

const colonnes: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.nom} ${r.prenom}`, align: 'left', sortable: true },
  { name: 'moyenne', label: 'Moyenne', field: 'moyenne', align: 'center', sortable: true },
  { name: 'decision', label: 'Décision', field: 'decision', align: 'center' },
  { name: 'mention', label: 'Mention', field: (r) => r.mention ?? '—', align: 'left' },
  { name: 'rang', label: 'Rang', field: 'rang', align: 'center', sortable: true },
  { name: 'actions', label: '', field: 'inscriptionId', align: 'right' },
];

/** Recherche texte + décision : filtrés ici, la source ne sait pas le faire. */
const lignesFiltrees = computed(() => {
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
  return lignes.value.filter((l) => {
    if (filtres.value.decision && l.decision !== filtres.value.decision) return false;
    if (!q) return true;
    return `${l.nom} ${l.prenom} ${l.matricule}`.toLowerCase().includes(q);
  });
});

const lignesPage = computed(() =>
  lignesFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

const nbImprimables = computed(() => lignesFiltrees.value.filter((l) => l.deliberationId).length);
const aucuneDeliberation = computed(() => deliberations.value.length === 0);

const urlBulletinCourant = computed(() => {
  const l = ligneSelectionnee.value;
  if (!l?.deliberationId) return undefined;
  return urlToken(`/deliberations/${l.deliberationId}/releve/${l.inscriptionId}`);
});

function couleurDecision(d: string): string {
  return d === 'ADMIS' ? 'positive' : d === 'AJOURNE' ? 'warning' : 'negative';
}

function urlToken(chemin: string) {
  return `${API_URL}${chemin}${chemin.includes('?') ? '&' : '?'}token=${auth.token}`;
}

/**
 * Le listing des délibérations ne porte pas ses lignes : chaque délibération
 * retenue est donc rechargée en détail, sinon aucun bulletin ne serait édité.
 */
async function chargerDeliberations() {
  deliberations.value = [];
  if (!filtres.value.anneeId && !filtres.value.promotionId) return;

  const { data } = await api.get('/deliberations', {
    params: { all: '1', anneeId: filtres.value.anneeId || undefined },
  });
  const candidates: Deliberation[] = (data.data ?? []).filter((d: Deliberation) => {
    if (filtres.value.promotionId && d.promotionId !== filtres.value.promotionId) return false;
    if (filtres.value.session && d.session !== filtres.value.session) return false;
    return true;
  });

  const details = await Promise.all(
    candidates.slice(0, 20).map((d) =>
      api
        .get(`/deliberations/${d.id}`)
        .then((r) => r.data as Deliberation)
        .catch(() => ({ ...d, lignes: [] as DeliberationLigne[] })),
    ),
  );
  deliberations.value = details;
}

async function chargerLignes() {
  if (!filtres.value.promotionId) {
    lignes.value = [];
    deliberations.value = [];
    return;
  }
  chargement.value = true;
  try {
    await chargerDeliberations();

    const params: Record<string, any> = { all: '1', pageSize: 500, promotionId: filtres.value.promotionId };
    if (filtres.value.anneeId) params.anneeId = filtres.value.anneeId;
    const { data } = await api.get('/inscriptions', { params });
    const inscriptions: Inscription[] = data.data ?? [];

    // La session la plus récente prime : le rattrapage écrase la session normale.
    const parInscription = new Map<string, { deliberationId: string; ligne: DeliberationLigne }>();
    for (const d of deliberations.value) {
      for (const l of d.lignes ?? []) {
        parInscription.set(l.inscriptionId, { deliberationId: d.id, ligne: l });
      }
    }

    lignes.value = inscriptions.map((ins) => {
      const res = parInscription.get(ins.id);
      const etu = ins.etudiant;
      return {
        inscriptionId: ins.id,
        etudiantId: etu?.id ?? null,
        matricule: etu?.matricule ?? '—',
        nom: etu?.nom ?? '',
        prenom: etu?.prenom ?? '',
        moyenne: res?.ligne.moyenne ?? null,
        decision: res?.ligne.decision ?? null,
        mention: res?.ligne.mention ?? null,
        rang: res?.ligne.rang ?? null,
        deliberationId: res?.deliberationId ?? null,
      };
    });
    page.value = 1;
  } catch (e: any) {
    lignes.value = [];
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Chargement des bulletins impossible' });
  } finally {
    chargement.value = false;
  }
}

/**
 * Aperçu à l'écran : le détail par UE n'existe que dans le document officiel
 * (route d'impression). On n'affiche donc ici que ce que l'on sait vrai.
 */
function selectionner(row: LigneBulletin) {
  const deliberation = deliberations.value.find((d) => d.id === row.deliberationId) ?? null;
  const promo = promotions.value.find((p) => p.id === filtres.value.promotionId);
  const annee = annees.value.find((a) => a.id === filtres.value.anneeId);

  ligneSelectionnee.value = row;
  bulletinSelectionne.value = {
    etudiant: { matricule: row.matricule, nom: row.nom, prenom: row.prenom },
    promotion: promo?.nom ?? '—',
    annee: annee?.libelle ?? '—',
    session: deliberation
      ? (LIBELLE_SESSION_DELIBERATION[deliberation.session] ?? deliberation.session)
      : (filtres.value.session
          ? LIBELLE_SESSION_DELIBERATION[filtres.value.session as SessionDeliberation]
          : LIBELLE_SESSION_DELIBERATION.NORMALE),
    dateDeliberation: deliberation?.valideeLe ?? deliberation?.creeLe,
    lignes: [],
    moyenneGenerale: row.moyenne ?? 0,
    decision: (row.decision as BulletinView['decision']) ?? null,
    mention: row.mention ?? undefined,
    rang: row.rang ?? undefined,
    effectif: deliberation?.lignes?.length ?? 0,
  };
}

function fermerApercu() {
  bulletinSelectionne.value = null;
  ligneSelectionnee.value = null;
}

function imprimerUn(row: LigneBulletin) {
  if (!row.deliberationId) {
    $q.notify({ type: 'warning', message: 'Aucune délibération pour cet étudiant.' });
    return;
  }
  window.open(urlToken(`/deliberations/${row.deliberationId}/releve/${row.inscriptionId}`), '_blank');
}

function imprimerTous() {
  const imprimables = lignesFiltrees.value.filter((l) => l.deliberationId);
  if (!imprimables.length) {
    $q.notify({ type: 'warning', message: 'Aucun bulletin disponible : aucune délibération trouvée.' });
    return;
  }
  $q.dialog({
    title: 'Imprimer toute la promotion',
    message: `${imprimables.length} bulletin(s) vont s'ouvrir dans autant d'onglets. Autorisez les fenêtres surgissantes si votre navigateur les bloque.`,
    cancel: true,
    ok: { color: 'primary', label: 'Ouvrir les bulletins', unelevated: true, noCaps: true },
  }).onOk(() => {
    for (const l of imprimables) {
      window.open(urlToken(`/deliberations/${l.deliberationId}/releve/${l.inscriptionId}`), '_blank');
    }
    $q.notify({ type: 'positive', message: `${imprimables.length} bulletin(s) ouvert(s).` });
  });
}

/** Bulletin → attestation : la page Attestations ouvre l'émission préremplie. */
function allerAttestation(l: LigneBulletin | null) {
  if (!l?.etudiantId) {
    $q.notify({ type: 'warning', message: 'Étudiant non identifié pour cette inscription.' });
    return;
  }
  void router.push({
    name: 'attestations',
    query: {
      emettre: '1',
      etudiantId: l.etudiantId,
      type: 'REUSSITE',
      ...(filtres.value.anneeId ? { anneeId: filtres.value.anneeId } : {}),
      ...(filtres.value.promotionId ? { promotionId: filtres.value.promotionId } : {}),
    },
  });
}

function reinitialiser() {
  filtres.value = {};
  fermerApercu();
  chargerLignes();
}

watch(
  () => [filtres.value.anneeId, filtres.value.promotionId, filtres.value.session],
  () => {
    fermerApercu();
    chargerLignes();
  },
);
watch(
  () => [filtres.value.recherche, filtres.value.decision],
  () => {
    page.value = 1;
  },
);

onMounted(async () => {
  const [a, p] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = a.data.data;
  promotions.value = p.data.data;

  // Préremplissage depuis la délibération d'origine.
  if (route.query.anneeId) filtres.value.anneeId = String(route.query.anneeId);
  if (route.query.promotionId) filtres.value.promotionId = String(route.query.promotionId);
  if (route.query.session) filtres.value.session = String(route.query.session);

  await chargerLignes();
});
</script>

<style scoped lang="scss">
.bulletins-apercu {
  max-width: 900px;
  margin: 0 auto;
}
.bulletins-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.bulletins-cartes__carte {
  cursor: pointer;
}
</style>
