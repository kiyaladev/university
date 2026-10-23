<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
/**
 * Catalogue VOD. Deux publics, un seul écran :
 *
 *  - le personnel (ADMIN, ENSEIGNANT, SCOLARITE, DIRECTION) gère le fonds :
 *    il voit tous les statuts, crée, modifie, publie et archive ;
 *  - l'étudiant consulte sa collecte (`/vod/ma-collecte` : le public + ce que
 *    ses inscriptions lui ouvrent, uniquement EN_LIGNE). Toutes les actions
 *    d'écriture disparaissent — le backend les réserve à ADMIN/ENSEIGNANT.
 */
import { computed, reactive, ref } from 'vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import VodDialog from '../components/VodDialog.vue';
import {
  LIBELLE_STATUT_VOD,
  LIBELLE_TYPE_RESSOURCE_VOD,
  optionsDepuis,
} from '../utils/libelles';
import type { CoursVOD, StatutVOD, TypeRessourceVOD, ChipFiltre } from '../types';

/**
 * Une entrée du catalogue. `/vod/ma-collecte` renvoie un sous-ensemble des
 * champs, enrichi de la reprise de lecture : le type l'assume.
 */
interface RessourceCatalogue {
  id: string;
  titre: string;
  description?: string | null;
  type: TypeRessourceVOD;
  url: string;
  thumbnailUrl?: string | null;
  dureeSecondes?: number | null;
  statut?: StatutVOD;
  creeParId?: string | null;
  nbVues?: number;
  matiere?: { id: string; code: string; intitule: string } | null;
  enseignant?: { id: string; nom: string; prenom: string } | null;
  /** Collecte étudiante uniquement : reprise de lecture. */
  dernierePosition?: number;
  termine?: boolean;
}

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const filtres = ref<Record<string, any>>({ recherche: '', type: null, statut: null });

const modeVue = usePresentationListe();

/** Écriture : les mêmes rôles que le backend (POST/PUT/publier/archiver). */
const peutEditer = computed(() => auth.peut('vod.editer'));
function peutGererRessource(v: RessourceCatalogue) {
  return peutEditer.value && (auth.peut('vod.gererToutes') || v.creeParId === auth.utilisateur?.id);
}
/** Un étudiant ne voit que sa collecte : ni statuts, ni actions. */
const estEtudiant = computed(() => auth.aRole(['ETUDIANT']));

/**
 * Personnel : `/vod` paginé, filtré par le serveur. Étudiant : sa collecte
 * (`/vod/ma-collecte`) arrive d'un bloc et se filtre ici.
 */
const liste = reactive(
  useListePaginee<RessourceCatalogue>({
    filtres,
    syncUrl: true,
    pageSize: estEtudiant.value ? 0 : 20,
    clesLocales: estEtudiant.value ? true : [],
    charger: async ({ filtres: f, ...p }) => {
      if (estEtudiant.value) {
        const { data } = await api.get<RessourceCatalogue[]>('/vod/ma-collecte');
        return { data: Array.isArray(data) ? data : [] };
      }
      const params: Record<string, unknown> = {
        ...pageApi(p),
        search: texteApi(f.recherche),
        type: f.type || undefined,
        statut: f.statut || undefined,
      };
      // Un compte sans droit d'écriture ne consulte que ce qui est en ligne.
      if (!peutEditer.value) params.statut = 'EN_LIGNE';
      const { data } = await api.get('/vod', { params });
      return data;
    },
  }),
);

/** Collecte étudiante filtrée côté client ; le personnel reçoit la page du serveur. */
const ressources = computed<RessourceCatalogue[]>(() => {
  if (!estEtudiant.value) return liste.lignes;
  const terme = (filtres.value.recherche ?? '').toString().trim().toLowerCase();
  let lignes = liste.lignes;
  if (filtres.value.type) lignes = lignes.filter((v) => v.type === filtres.value.type);
  if (terme) {
    lignes = lignes.filter(
      (v) => v.titre.toLowerCase().includes(terme) || (v.description ?? '').toLowerCase().includes(terme),
    );
  }
  return lignes;
});

const OPTIONS_TYPE = optionsDepuis(LIBELLE_TYPE_RESSOURCE_VOD);
const OPTIONS_STATUT = optionsDepuis(LIBELLE_STATUT_VOD);
const CLASSE_STATUT: Record<string, string> = {
  BROUILLON: 'badge--neutre',
  EN_LIGNE: 'badge--ok',
  HORS_LIGNE: 'badge--attention',
  ARCHIVE: 'badge--ko',
};

/** La colonne « Statut » n'a pas de sens dans la collecte étudiante. */
const colonnes = computed<QTableColumn[]>(() => [
  { name: 'titre', label: t('vodPage.table.columns.title'), field: 'titre', align: 'left' },
  { name: 'type', label: t('vodPage.table.columns.type'), field: 'type', align: 'left' },
  { name: 'matiere', label: t('vodPage.table.columns.subject'), field: 'matiere', align: 'left' },
  { name: 'enseignant', label: t('vodPage.table.columns.teacher'), field: 'enseignant', align: 'left' },
  { name: 'duree', label: t('vodPage.table.columns.duration'), field: 'dureeSecondes', align: 'center' },
  ...(estEtudiant.value
    ? ([
        {
          name: 'avancement',
          label: t('vodPage.table.columns.progress'),
          field: 'dernierePosition',
          align: 'center',
        },
      ] as QTableColumn[])
    : ([
        { name: 'vues', label: t('vodPage.table.columns.views'), field: 'nbVues', align: 'center' },
        { name: 'statut', label: t('vodPage.table.columns.status'), field: 'statut', align: 'center' },
      ] as QTableColumn[])),
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const chips = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.type) cs.push({ label: LIBELLE_TYPE_RESSOURCE_VOD[f.type] ?? f.type, value: f.type, icone: 'movie', cle: 'type'});
  if (f.statut) {
    cs.push({ label: LIBELLE_STATUT_VOD[f.statut] ?? f.statut, value: f.statut, icone: 'flag', cle: 'statut'});
  }
  return cs;
});

/** Un état vide se raconte : pourquoi c'est vide, et quoi faire ensuite. */
const messageVide = computed(() => {
  if (filtres.value.recherche || filtres.value.type || filtres.value.statut) {
    return t('vodPage.emptyState.filtered');
  }
  if (estEtudiant.value) {
    return t('vodPage.emptyState.student');
  }
  return t('vodPage.emptyState.staff');
});

const dialogEdition = ref(false);
const vodEnEdition = ref<CoursVOD | null>(null);

function ouvrirEdition(v?: RessourceCatalogue) {
  // Le personnel reçoit la ressource complète : le formulaire peut la relire.
  vodEnEdition.value = (v as CoursVOD | undefined) ?? null;
  dialogEdition.value = true;
}

function lecteur(v: RessourceCatalogue) {
  void router.push({ name: 'vod-lecteur', params: { id: v.id } });
}

async function publier(v: RessourceCatalogue) {
  try {
    await api.post(`/vod/${v.id}/publier`);
    $q.notify({ type: 'positive', message: t('vodPage.messages.published') });
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

async function archiver(v: RessourceCatalogue) {
  const ok = await confirmer({
    titre: t('vodPage.dialogs.archive.title'),
    message: t('vodPage.dialogs.archive.message', { title: v.titre }),
    ok: t('vodPage.dialogs.archive.confirm'),
    danger: true,
  });
  if (!ok) return;
  try {
    await api.post(`/vod/${v.id}/archiver`, {});
    $q.notify({ type: 'warning', message: t('vodPage.messages.archived') });
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

function formatDuree(s?: number | null): string {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** « 42 % » de la ressource déjà vue, pour la collecte étudiante. */
function avancement(v: RessourceCatalogue): number {
  if (v.termine) return 100;
  if (!v.dureeSecondes || !v.dernierePosition) return 0;
  return Math.min(100, Math.round((v.dernierePosition / v.dureeSecondes) * 100));
}

</script>

<template>
  <q-page class="q-pa-md">
    <page-header
      :title="$t('vodPage.title')"
      :subtitle="estEtudiant ? $t('vodPage.subtitle.student') : $t('vodPage.subtitle.staff')"
    >
      <template v-if="peutEditer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('vodPage.actions.newResource')"
          @click="ouvrirEdition()"
        />
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('vodPage.filters.searchPlaceholder')"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          :label="$t('vodPage.filters.resourceType')"
          outlined
          dense
          clearable
        />
        <q-select
          v-if="peutEditer"
          v-model="filtres.statut"
          :options="OPTIONS_STATUT"
          emit-value
          map-options
          :label="$t('vodPage.filters.status')"
          outlined
          dense
          clearable
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="ressources"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || ressources.length > 0"
    >
      <template #no-data>
        <etat-vide icone="play_circle_outline" :titre="messageVide">
          <template v-if="peutEditer" #action>
            <q-btn flat no-caps color="primary" icon="add" :label="$t('vodPage.actions.newResource')" @click="ouvrirEdition()" />
          </template>
        </etat-vide>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_RESSOURCE_VOD[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-matiere="p">
        <q-td :props="p">
          <span v-if="p.row.matiere">
            {{ p.row.matiere.code }}
            <q-tooltip>{{ p.row.matiere.intitule }}</q-tooltip>
          </span>
          <span v-else class="text-grey-7">{{ $t('rectoratPage.subtitleFallback') }}</span>
        </q-td>
      </template>
      <template #body-cell-enseignant="p">
        <q-td :props="p">
          {{ p.row.enseignant ? `${p.row.enseignant.prenom} ${p.row.enseignant.nom}` : '—' }}
        </q-td>
      </template>
      <template #body-cell-duree="p">
        <q-td :props="p">{{ formatDuree(p.row.dureeSecondes) }}</q-td>
      </template>
      <template #body-cell-avancement="p">
        <q-td :props="p">
          <q-chip v-if="p.row.termine" dense color="positive" text-color="white" :label="$t('vodPage.card.done')" />
          <span v-else-if="avancement(p.row) > 0">{{ avancement(p.row) }} %</span>
          <span v-else class="text-grey-7">{{ $t('vodPage.card.neverOpened') }}</span>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-statut" :class="CLASSE_STATUT[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT_VOD[p.row.statut] ?? p.row.statut }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            round
            dense
            icon="play_arrow"
            :aria-label="$t('vodPage.aria.play', { title: p.row.titre })"
            @click="lecteur(p.row)"
          >
            <q-tooltip>{{ $t('vodPage.tooltips.openPlayer') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGererRessource(p.row) && ['BROUILLON', 'HORS_LIGNE'].includes(p.row.statut)"
            flat
            round
            dense
            icon="publish"
            :aria-label="$t('vodPage.aria.publish')"
            @click="publier(p.row)"
          >
            <q-tooltip>{{ $t('vodPage.tooltips.publish') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGererRessource(p.row) && p.row.statut !== 'ARCHIVE'"
            flat
            round
            dense
            icon="edit"
            :aria-label="$t('vodPage.aria.edit')"
            @click="ouvrirEdition(p.row)"
          >
            <q-tooltip>{{ $t('vodPage.tooltips.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGererRessource(p.row) && p.row.statut !== 'ARCHIVE'"
            flat
            round
            dense
            icon="archive"
            color="negative"
            :aria-label="$t('vodPage.aria.archive')"
            @click="archiver(p.row)"
          >
            <q-tooltip>{{ $t('vodPage.tooltips.archive') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="v in ressources" :key="v.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="vod-carte">
          <q-img
            v-if="v.thumbnailUrl"
            :src="v.thumbnailUrl"
            :ratio="16 / 9"
            no-spinner
            :alt="$t('vodPage.card.previewAlt', { title: v.titre })"
          />
          <div v-else class="vod-placeholder" aria-hidden="true">
            <q-icon name="play_circle_outline" size="56px" />
          </div>
          <q-card-section>
            <div class="row items-center q-gutter-sm">
              <span v-if="!estEtudiant && v.statut" class="champ champ-statut" :class="CLASSE_STATUT[v.statut]">
                <span class="pochoir">{{ LIBELLE_STATUT_VOD[v.statut] ?? v.statut }}</span>
              </span>
              <q-chip dense outline color="primary">
                {{ LIBELLE_TYPE_RESSOURCE_VOD[v.type] ?? v.type }}
              </q-chip>
              <q-chip v-if="v.termine" dense color="positive" text-color="white" :label="$t('vodPage.card.done')" />
            </div>
            <div class="text-weight-bold q-mt-sm">{{ v.titre }}</div>
            <div class="text-caption text-grey-7">
              {{ v.enseignant ? `${v.enseignant.prenom} ${v.enseignant.nom}` : $t('vodPage.card.noTeacher') }}
              <span v-if="v.matiere"> · {{ v.matiere.code }}</span>
            </div>
            <q-linear-progress
              v-if="estEtudiant && avancement(v) > 0"
              :value="avancement(v) / 100"
              color="primary"
              class="q-mt-sm"
            />
            <div class="row q-mt-sm items-center">
              <q-icon name="schedule" size="16px" class="q-mr-xs" />
              <span class="text-caption">{{ formatDuree(v.dureeSecondes) }}</span>
              <q-space />
              <template v-if="!estEtudiant">
                <q-icon name="visibility" size="16px" class="q-mr-xs" />
                <span class="text-caption">{{ $t('vodPage.card.views', { count: v.nbVues ?? 0 }) }}</span>
              </template>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              unelevated
              color="primary"
              icon="play_arrow"
              :label="estEtudiant && avancement(v) > 0 && !v.termine ? $t('vodPage.actions.resume') : $t('vodPage.actions.player')"
              no-caps
              @click="lecteur(v)"
            />
            <q-btn
              v-if="peutGererRessource(v) && v.statut !== 'ARCHIVE'"
              flat
              icon="edit"
              no-caps
              :aria-label="$t('vodPage.aria.edit')"
              @click="ouvrirEdition(v)"
            >
              <q-tooltip>{{ $t('vodPage.tooltips.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGererRessource(v) && ['BROUILLON', 'HORS_LIGNE'].includes(v.statut ?? '')"
              flat
              icon="publish"
              no-caps
              :aria-label="$t('vodPage.aria.publish')"
              @click="publier(v)"
            >
              <q-tooltip>{{ $t('vodPage.tooltips.publish') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGererRessource(v) && v.statut !== 'ARCHIVE'"
              flat
              icon="archive"
              color="negative"
              no-caps
              :aria-label="$t('vodPage.aria.archive')"
              @click="archiver(v)"
            >
              <q-tooltip>{{ $t('vodPage.tooltips.archive') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide v-if="!liste.chargement && !ressources.length" class="col-12" icone="play_circle_outline" :titre="messageVide">
        <template v-if="peutEditer" #action>
          <q-btn flat no-caps color="primary" icon="add" :label="$t('vodPage.actions.newResource')" @click="ouvrirEdition()" />
        </template>
      </etat-vide>
    </div>

    <!-- La collecte étudiante arrive d'un bloc : rien à paginer. -->
    <pagination-bar
      v-if="!estEtudiant && ressources.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <vod-dialog v-if="peutEditer" v-model="dialogEdition" :vod="vodEnEdition" @enregistre="liste.recharger()" />
  </q-page>
</template>

<style scoped>
.vod-carte {
  border: var(--up-filet-fin);
  height: 100%;
}
.vod-placeholder {
  aspect-ratio: 16 / 9;
  /* Aplat d'encre : ni dégradé, ni bleu Material — aucun des deux
     n'appartient au panneau. */
  background: var(--up-encre);
  color: var(--up-craie-fixe);
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge--ok { background: #f1fbf2; color: #027a0b; }
.badge--ko { background: #fff1f2; color: #c10000; }
.badge--neutre { background: #f5f5f7; color: #6e6e73; }
.badge--attention { background: #fff6ef; color: #b64400; }
</style>
