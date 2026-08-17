<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import VodDialog from '../components/VodDialog.vue';
import type { CoursVOD, TypeRessourceVOD } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const onglet = ref<'public' | 'promotion' | 'enseignant'>('public');

const ressources = ref<CoursVOD[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '', type: null });

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEditer = computed(() => auth.aRole(['ADMIN', 'ENSEIGNANT']));

const OPTIONS_TYPE: Array<{ value: TypeRessourceVOD; label: string }> = [
  { value: 'AUDIO', label: 'Audio' },
  { value: 'VIDEO', label: 'Vidéo' },
  { value: 'NOTES', label: 'Notes' },
  { value: 'TRANSCRIPTION', label: 'Transcription' },
];
const LIBELLE_TYPE: Record<string, string> = Object.fromEntries(OPTIONS_TYPE.map((o) => [o.value, o.label]));

const LIBELLE_STATUT: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_LIGNE: 'En ligne',
  HORS_LIGNE: 'Hors ligne',
  ARCHIVE: 'Archivée',
};
const CLASSE_STATUT: Record<string, string> = {
  BROUILLON: 'badge--neutre',
  EN_LIGNE: 'badge--ok',
  HORS_LIGNE: 'badge--attention',
  ARCHIVE: 'badge--ko',
};

const colonnes: QTableColumn[] = [
  { name: 'titre', label: 'Titre', field: 'titre', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'matiere', label: 'Matière', field: 'matiere', align: 'left' },
  { name: 'enseignant', label: 'Enseignant', field: 'enseignant', align: 'left' },
  { name: 'duree', label: 'Durée', field: 'dureeSecondes', align: 'center' },
  { name: 'vues', label: 'Vues', field: 'nbVues', align: 'center' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const dialogEdition = ref(false);
const vodEnEdition = ref<CoursVOD | null>(null);

function ouvrirEdition(v?: CoursVOD) {
  vodEnEdition.value = v ?? null;
  dialogEdition.value = true;
}

function lecteur(v: CoursVOD) {
  void router.push({ name: 'vod-lecteur', params: { id: v.id } });
}

async function publier(v: CoursVOD) {
  try {
    await api.post(`/vod/${v.id}/publier`);
    $q.notify({ type: 'positive', message: 'Ressource mise en ligne.' });
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Publication impossible.' });
  }
}

async function archiver(v: CoursVOD) {
  try {
    await api.post(`/vod/${v.id}/archiver`, {});
    $q.notify({ type: 'warning', message: 'Ressource archivée.' });
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Archivage impossible.' });
  }
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    if (filtres.value.recherche) params.search = filtres.value.recherche;
    if (filtres.value.type) params.type = filtres.value.type;
    if (onglet.value === 'public') params.public = 'true';
    if (onglet.value === 'public') params.statut = 'EN_LIGNE';
    const { data } = await api.get('/vod', { params });
    ressources.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function changerOnglet(o: 'public' | 'promotion' | 'enseignant') {
  onglet.value = o;
  recharger();
}

function formatDuree(s?: number | null): string {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

watch(onglet, () => recharger());
onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Cours en ligne (VOD)</div>
        <div class="page-sous-titre">
          Replays, podcasts, notes, transcriptions — l'accès aux cours en différé.
        </div>
      </div>
      <div class="col-auto">
        <view-toggle
          cle="vod"
          :modes="['tableau', 'cartes']"
          :defaut="modeVue"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
        <q-btn
          v-if="peutEditer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle ressource"
          @click="ouvrirEdition()"
        />
      </div>
    </div>

    <q-tabs
      v-model="onglet"
      dense
      align="left"
      class="q-mb-md"
      @update:model-value="changerOnglet"
    >
      <q-tab name="public" label="Public" icon="public" />
      <q-tab name="promotion" label="Par promotion" icon="school" />
      <q-tab name="enseignant" label="Par enseignant" icon="person" />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      placeholder="Titre, description…"
      @update:model-value="recharger"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          label="Type"
          outlined
          dense
          clearable
          @update:model-value="recharger"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; charger()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; charger()"
    />

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="ressources"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-matiere="p">
        <q-td :props="p">{{ p.row.matiere?.code ?? '—' }}</q-td>
      </template>
      <template #body-cell-enseignant="p">
        <q-td :props="p">
          {{ p.row.enseignant ? `${p.row.enseignant.prenom} ${p.row.enseignant.nom}` : '—' }}
        </q-td>
      </template>
      <template #body-cell-duree="p">
        <q-td :props="p">{{ formatDuree(p.row.dureeSecondes) }}</q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-statut" :class="CLASSE_STATUT[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT[p.row.statut] }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat round dense icon="play_arrow" @click="lecteur(p.row)" />
          <q-btn
            v-if="peutEditer && p.row.statut !== 'EN_LIGNE'"
            flat
            round
            dense
            icon="publish"
            @click="publier(p.row)"
          />
          <q-btn
            v-if="peutEditer"
            flat
            round
            dense
            icon="edit"
            @click="ouvrirEdition(p.row)"
          />
          <q-btn
            v-if="peutEditer && p.row.statut !== 'ARCHIVE'"
            flat
            round
            dense
            icon="archive"
            color="negative"
            @click="archiver(p.row)"
          />
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
          />
          <div v-else class="vod-placeholder">
            <q-icon name="play_circle_outline" size="56px" />
          </div>
          <q-card-section>
            <div class="row items-center q-gutter-sm">
              <span class="champ champ-statut" :class="CLASSE_STATUT[v.statut]">
                <span class="pochoir">{{ LIBELLE_STATUT[v.statut] }}</span>
              </span>
              <q-chip dense outline color="primary">
                {{ LIBELLE_TYPE[v.type] ?? v.type }}
              </q-chip>
            </div>
            <div class="text-weight-bold q-mt-sm">{{ v.titre }}</div>
            <div class="text-caption text-grey-7">
              {{ v.enseignant ? `${v.enseignant.prenom} ${v.enseignant.nom}` : 'Sans enseignant' }}
            </div>
            <div class="row q-mt-sm items-center">
              <q-icon name="schedule" size="16px" class="q-mr-xs" />
              <span class="text-caption">{{ formatDuree(v.dureeSecondes) }}</span>
              <q-space />
              <q-icon name="visibility" size="16px" class="q-mr-xs" />
              <span class="text-caption">{{ v.nbVues ?? 0 }} vue(s)</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn unelevated color="primary" icon="play_arrow" label="Lecteur" no-caps @click="lecteur(v)" />
            <q-btn
              v-if="peutEditer"
              flat
              icon="edit"
              no-caps
              @click="ouvrirEdition(v)"
            />
            <q-btn
              v-if="peutEditer && v.statut !== 'EN_LIGNE'"
              flat
              icon="publish"
              no-caps
              @click="publier(v)"
            />
            <q-btn
              v-if="peutEditer && v.statut !== 'ARCHIVE'"
              flat
              icon="archive"
              color="negative"
              no-caps
              @click="archiver(v)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <vod-dialog v-model="dialogEdition" :vod="vodEnEdition" @enregistre="charger" />
  </q-page>
</template>

<style scoped>
.vod-carte {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  height: 100%;
}
.vod-placeholder {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }
.badge--neutre { background: #eef0f4; color: #455a64; }
.badge--attention { background: #fff4e0; color: #8a5300; }
</style>