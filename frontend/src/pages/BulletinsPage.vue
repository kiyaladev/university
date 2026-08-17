<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Bulletins</div>
        <div class="page-sous-titre">
          Relevés individuels après délibération : moyennes par UE pondérées par
          les crédits, rang dans la promotion, décision du jury.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="lignes.length"
          unelevated
          color="primary"
          no-caps
          icon="print"
          :label="`Imprimer toute la promotion (${lignes.length})`"
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
        <q-select
          v-model="filtres.session"
          :options="optionsSession"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Session"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="!bulletinSelectionne"
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="inscriptionId"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="(_, row) => selectionner(row)"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          Aucun étudiant trouvé pour ces critères.
        </div>
      </template>

      <template #body-cell-moyenne="p">
        <q-td :props="p" class="text-center chiffres">
          <span
            :class="{
              'text-negative': p.row.moyenne !== null && p.row.moyenne < 10,
            }"
          >
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
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>

      <template #body-cell-rang="p">
        <q-td :props="p" class="text-center chiffres">
          {{ p.row.rang ?? '—' }}
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            no-caps
            icon="picture_as_pdf"
            :color="p.row.deliberationId ? 'primary' : 'grey-5'"
            :label="p.row.deliberationId ? 'Imprimer' : 'Pas de jury'"
            :disable="!p.row.deliberationId"
            @click.stop="imprimerUn(p.row)"
          >
            <q-tooltip v-if="!p.row.deliberationId">
              Cet étudiant n'a pas de délibération validée.
            </q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="visibility"
            @click.stop="selectionner(p.row)"
          >
            <q-tooltip>Voir le bulletin</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="bulletins-apercu">
      <q-btn
        outline
        no-caps
        icon="arrow_back"
        label="Retour à la liste"
        class="q-mb-md"
        @click="bulletinSelectionne = null"
      />
      <bulletin-card
        :bulletin="bulletinSelectionne"
        :url-impression="urlBulletinCourant"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import BulletinCard from '../components/BulletinCard.vue';
import FilterBar from '../components/FilterBar.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_SESSION_DELIBERATION,
} from '../utils/libelles';
import type {
  AnneeAcademique,
  DeliberationLigne,
  Inscription,
  Promotion,
  SessionDeliberation,
} from '../types';

interface LigneBulletin {
  inscriptionId: string;
  matricule: string;
  nom: string;
  prenom: string;
  moyenne: number | null;
  decision: string | null;
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
  decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT';
  mention?: string;
  rang?: number;
  effectif?: number;
}

const $q = useQuasar();
const route = useRoute();
const auth = useAuthStore();

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const deliberations = ref<Array<{ id: string; promotionId: string; anneeId: string; session: SessionDeliberation; lignes?: DeliberationLigne[] }>>([]);

const filtres = ref<Record<string, any>>({});
const chargement = ref(false);

const lignes = ref<LigneBulletin[]>([]);
const bulletinSelectionne = ref<BulletinView | null>(null);

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsSession = [
  { label: 'Session normale', value: 'NORMALE' },
  { label: 'Rattrapage', value: 'RATTRAPAGE' },
];

const chips = computed(() => {
  const cs: Array<{ label: string; value: any; icone?: string; defaut?: boolean }> = [];
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
  return cs;
});

const colonnes: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left' },
  { name: 'etudiant', label: 'Étudiant', field: (r) => `${r.nom} ${r.prenom}`, align: 'left', sortable: true },
  { name: 'moyenne', label: 'Moyenne', field: 'moyenne', align: 'center' },
  { name: 'decision', label: 'Décision', field: 'decision', align: 'center' },
  { name: 'rang', label: 'Rang', field: 'rang', align: 'center' },
  { name: 'actions', label: '', field: 'inscriptionId', align: 'right' },
];

const urlBulletinCourant = computed(() => {
  if (!bulletinSelectionne.value) return undefined;
  const ligne = lignes.value.find(
    (l) => l.inscriptionId === (bulletinSelectionne.value as any).inscriptionIdCle,
  );
  if (!ligne?.deliberationId) return undefined;
  return urlToken(`/deliberations/${ligne.deliberationId}/releve/${ligne.inscriptionId}`);
});

function couleurDecision(d: string): string {
  return d === 'ADMIS' ? 'positive' : d === 'AJOURNE' ? 'warning' : 'negative';
}

function urlToken(chemin: string) {
  return `${API_URL}${chemin}${chemin.includes('?') ? '&' : '?'}token=${auth.token}`;
}

async function chargerDeliberations() {
  if (!filtres.value.anneeId) {
    deliberations.value = [];
    return;
  }
  const params: Record<string, any> = {
    all: '1',
    pageSize: 100,
    anneeId: filtres.value.anneeId,
  };
  if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
  if (filtres.value.session) params.session = filtres.value.session;

  const { data } = await api.get('/deliberations', { params });
  deliberations.value = data.data ?? [];
}

async function chargerLignes() {
  chargement.value = true;
  try {
    await chargerDeliberations();

    // On récupère ensuite la liste des inscriptions de la promotion filtrée.
    const params: Record<string, any> = { all: '1', pageSize: 500 };
    if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
    if (filtres.value.anneeId) params.anneeId = filtres.value.anneeId;

    const { data } = await api.get('/inscriptions', { params });
    const inscriptions: Inscription[] = data.data ?? [];

    const parDeliberation = new Map<string, DeliberationLigne[]>();
    for (const d of deliberations.value) {
      if (d.lignes) parDeliberation.set(d.id, d.lignes);
    }

    const mapLignes = new Map<string, { deliberationId: string; ligne: DeliberationLigne }>();
    for (const [delId, lignesDel] of parDeliberation.entries()) {
      for (const l of lignesDel) {
        mapLignes.set(l.inscriptionId, { deliberationId: delId, ligne: l });
      }
    }

    const recherche = String(filtres.value.recherche ?? '').toLowerCase().trim();

    lignes.value = inscriptions
      .map((ins) => {
        const res = mapLignes.get(ins.id);
        const etu = ins.etudiant;
        return {
          inscriptionId: ins.id,
          matricule: etu?.matricule ?? '—',
          nom: etu?.nom ?? '',
          prenom: etu?.prenom ?? '',
          moyenne: res?.ligne.moyenne ?? null,
          decision: res?.ligne.decision ?? null,
          rang: res?.ligne.rang ?? null,
          deliberationId: res?.deliberationId ?? null,
        };
      })
      .filter((l) => {
        if (!recherche) return true;
        return (
          l.nom.toLowerCase().includes(recherche) ||
          l.prenom.toLowerCase().includes(recherche) ||
          l.matricule.toLowerCase().includes(recherche)
        );
      });
  } catch {
    lignes.value = [];
  } finally {
    chargement.value = false;
  }
}

function selectionner(row: LigneBulletin) {
  const deliberationId = row.deliberationId;
  const deliberation = deliberations.value.find((d) => d.id === deliberationId);
  const promo = promotions.value.find((p) => p.id === filtres.value.promotionId);
  const annee = annees.value.find((a) => a.id === filtres.value.anneeId);

  bulletinSelectionne.value = {
    etudiant: {
      matricule: row.matricule,
      nom: row.nom,
      prenom: row.prenom,
    },
    promotion: promo?.nom ?? '—',
    annee: annee?.libelle ?? '—',
    session: deliberation
      ? LIBELLE_SESSION_DELIBERATION[deliberation.session]
      : (filtres.value.session
          ? LIBELLE_SESSION_DELIBERATION[filtres.value.session as SessionDeliberation]
          : 'Session 1'),
    dateDeliberation: deliberation ? undefined : undefined,
    lignes: deliberation?.lignes?.map((l) => ({
      matiere: (l as any).matiere?.intitule ?? '—',
      code: (l as any).matiere?.code,
      credits: (l as any).matiere?.credits ?? 0,
      moyenne: l.moyenne,
      decision: l.decision,
    })) ?? [],
    moyenneGenerale: row.moyenne ?? 0,
    decision: (row.decision as 'ADMIS' | 'AJOURNE' | 'DEFAILLANT') ?? 'AJOURNE',
    rang: row.rang ?? undefined,
    effectif: undefined,
  } as BulletinView & { inscriptionIdCle: string };
  (bulletinSelectionne.value as any).inscriptionIdCle = row.inscriptionId;
}

function imprimerUn(row: LigneBulletin) {
  if (!row.deliberationId) {
    $q.notify({
      type: 'warning',
      message: 'Aucun jury validé pour cet étudiant.',
    });
    return;
  }
  window.open(
    urlToken(`/deliberations/${row.deliberationId}/releve/${row.inscriptionId}`),
    '_blank',
  );
}

function imprimerTous() {
  const imprimables = lignes.value.filter((l) => l.deliberationId);
  if (!imprimables.length) {
    $q.notify({
      type: 'warning',
      message: 'Aucun bulletin disponible : aucune délibération validée trouvée.',
    });
    return;
  }
  for (const l of imprimables) {
    window.open(
      urlToken(`/deliberations/${l.deliberationId}/releve/${l.inscriptionId}`),
      '_blank',
    );
  }
  $q.notify({
    type: 'positive',
    message: `${imprimables.length} bulletin${imprimables.length > 1 ? 's' : ''} ouvert${imprimables.length > 1 ? 's' : ''} dans des onglets distincts.`,
  });
}

function reinitialiser() {
  filtres.value = {};
  chargerLignes();
}

watch(
  () => [filtres.value.anneeId, filtres.value.promotionId, filtres.value.session, filtres.value.recherche],
  () => chargerLignes(),
);

onMounted(async () => {
  const [a, p] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = a.data.data;
  promotions.value = p.data.data;

  // Pré-remplir avec les query params si l’orchestrateur en a passé.
  if (route.query.anneeId) filtres.value.anneeId = String(route.query.anneeId);
  if (route.query.promotionId) filtres.value.promotionId = String(route.query.promotionId);

  await chargerLignes();
});
</script>

<style scoped lang="scss">
.bulletins-apercu {
  max-width: 900px;
  margin: 0 auto;
}
</style>