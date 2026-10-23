<script setup lang="ts">
/**
 * Présentation du catalogue VOD : le tableau pour les grands écrans, la grille
 * de cartes pour les écrans étroits. Les deux vues montrent les mêmes
 * ressources et déclenchent les mêmes actions — la page ne fait que passer
 * les données et recevoir les clics.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { LIBELLE_TYPE_RESSOURCE_VOD } from '@/shared/utils/libelles';
import { useAuthStore } from '@/stores/auth';
import type { RessourceCatalogue } from '../types';

const props = defineProps<{
  /** Ressources à afficher (page du serveur ou collecte étudiante filtrée). */
  ressources: RessourceCatalogue[];
  /** Chargement en cours : l'état vide ne s'affiche qu'une fois la liste vide. */
  chargement: boolean;
  /** L'utilisateur est étudiant : ni statut, ni action d'écriture. */
  estEtudiant: boolean;
  /** Phrase d'état vide, calculée par la page (elle seule connaît les filtres). */
  messageVide: string;
}>();

const emit = defineEmits<{
  nouvelle: [];
  lire: [v: RessourceCatalogue];
  'ouvrir-edition': [v: RessourceCatalogue];
  publier: [v: RessourceCatalogue];
  archiver: [v: RessourceCatalogue];
}>();

const auth = useAuthStore();
const { t } = useI18n();
const modeVue = usePresentationListe();

const peutEditer = computed(() => auth.peut('vod.editer'));

/** Seul le créateur (ou un compte « gère tout ») agit sur la ressource. */
function peutGererRessource(v: RessourceCatalogue) {
  return peutEditer.value && (auth.peut('vod.gererToutes') || v.creeParId === auth.utilisateur?.id);
}

/** La colonne « Statut » n'a pas de sens dans la collecte étudiante. */
const colonnes = computed<QTableColumn[]>(() => [
  { name: 'titre', label: t('common.fields.title'), field: 'titre', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'matiere', label: t('common.fields.subject'), field: 'matiere', align: 'left' },
  { name: 'enseignant', label: t('common.fields.teacher'), field: 'enseignant', align: 'left' },
  { name: 'duree', label: t('common.fields.duration'), field: 'dureeSecondes', align: 'center' },
  ...(props.estEtudiant
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
        { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'center' },
      ] as QTableColumn[])),
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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
    :hide-bottom="chargement || ressources.length > 0"
  >
    <template #no-data>
      <etat-vide icone="play_circle_outline" :titre="messageVide">
        <template v-if="peutEditer" #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="add"
            :label="$t('vodPage.actions.newResource')"
            @click="emit('nouvelle')"
          />
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
        <span v-else class="text-grey-7">{{ $t('vodPage.table.noSubject') }}</span>
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
        <PastilleStatut domaine="vod" :statut="p.row.statut" />
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
          @click="emit('lire', p.row)"
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
          @click="emit('publier', p.row)"
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
          @click="emit('ouvrir-edition', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGererRessource(p.row) && p.row.statut !== 'ARCHIVE'"
          flat
          round
          dense
          icon="archive"
          color="negative"
          :aria-label="$t('vodPage.aria.archive')"
          @click="emit('archiver', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.archive') }}</q-tooltip>
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
            <PastilleStatut v-if="!estEtudiant && v.statut" domaine="vod" :statut="v.statut" />
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
            :label="
              estEtudiant && avancement(v) > 0 && !v.termine
                ? $t('common.actions.resume')
                : $t('vodPage.actions.player')
            "
            no-caps
            @click="emit('lire', v)"
          />
          <q-btn
            v-if="peutGererRessource(v) && v.statut !== 'ARCHIVE'"
            flat
            icon="edit"
            no-caps
            :aria-label="$t('vodPage.aria.edit')"
            @click="emit('ouvrir-edition', v)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGererRessource(v) && ['BROUILLON', 'HORS_LIGNE'].includes(v.statut ?? '')"
            flat
            icon="publish"
            no-caps
            :aria-label="$t('vodPage.aria.publish')"
            @click="emit('publier', v)"
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
            @click="emit('archiver', v)"
          >
            <q-tooltip>{{ $t('common.actions.archive') }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide v-if="!chargement && !ressources.length" class="col-12" icone="play_circle_outline" :titre="messageVide">
      <template v-if="peutEditer" #action>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="add"
          :label="$t('vodPage.actions.newResource')"
          @click="emit('nouvelle')"
        />
      </template>
    </etat-vide>
  </div>
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
</style>
