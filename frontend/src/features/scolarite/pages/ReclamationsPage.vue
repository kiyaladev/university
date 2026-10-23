<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('reclamations.title')" :subtitle="$t('reclamations.subtitle')">
      <template #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('reclamations.actions.newReclamation')"
          @click="creationOuverte = true"
        />
      </template>
    </en-tete-page>

    <reclamations-stats-panel :stats="stats" />

    <reclamations-filtres v-model="filtres" :membres-staff="membresStaff" @reinitialiser="liste.reinitialiser([])" />

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <reclamations-liste
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :mode="modeVue"
      :peut-escalader="peutEscalader"
      @ouvrir="ouvrir"
      @escalader="escalader"
    />

    <dialogue-reclamation v-model="creationOuverte" @enregistre="onChange" />
    <dialogue-detail-reclamation
      v-model="detailOuvert"
      :reclamation="reclamationSelectionnee"
      :membres-staff="membresStaff"
      @change="onChange"
      @assigne="onChange"
      @escalade="onChange"
      @cloture="onChange"
    />
  </q-page>
</template>

<script setup lang="ts">
/**
 * Registre des réclamations, côté scolarité.
 *
 * La page détient la liste, les compteurs et les agents ; le rendu est réparti
 * dans les composants `Reclamations…`.
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useAuthStore } from '@/stores/auth';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import DialogueReclamation from '../components/DialogueReclamation.vue';
import DialogueDetailReclamation from '../components/DialogueDetailReclamation.vue';
import ReclamationsFiltres from '../components/ReclamationsFiltres.vue';
import ReclamationsListe from '../components/ReclamationsListe.vue';
import ReclamationsStatsPanel from '../components/ReclamationsStatsPanel.vue';
import { reclamationsService } from '../services/reclamations';
import type { Reclamation } from '../types';
import type { Utilisateur } from '@/types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();

const stats = ref<Record<string, number | undefined> | null>(null);
const membresStaff = ref<Utilisateur[]>([]);
const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null,
  type: null,
  priorite: null,
  departementId: null,
  assigneAId: null,
  escalade: null,
});
const liste = reactive(
  useListePaginee<Reclamation>({
    filtres,
    actif: () => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']),
    charger: ({ filtres: f, ...p }) =>
      reclamationsService.liste({
        ...pageApi(p),
        statut: f.statut || undefined,
        type: f.type || undefined,
        priorite: f.priorite || undefined,
        departementId: f.departementId || undefined,
        assigneAId: f.assigneAId || undefined,
        escalade: f.escalade || undefined,
        search: texteApi(f.recherche),
      }),
  }),
);
const modeVue = usePresentationListe();
const creationOuverte = ref(false);
const detailOuvert = ref(false);
const reclamationSelectionnee = ref<Reclamation | null>(null);

/** Seuls l'administration et la direction peuvent escalader une réclamation. */
const peutEscalader = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));

function ouvrir(r: Reclamation) {
  reclamationSelectionnee.value = r;
  detailOuvert.value = true;
}

async function chargerStats() {
  // Même périmètre que /reclamations/dashboard côté API.
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return;
  try {
    stats.value = await reclamationsService.tableauBord();
  } catch {
    /* silencieux */
  }
}

async function chargerStaff() {
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return;
  try {
    const agents = await reclamationsService.agents();
    membresStaff.value = agents.filter((u) => ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'].includes(u.role));
  } catch {
    membresStaff.value = [];
  }
}

function onChange() {
  void liste.recharger();
  void chargerStats();
}

async function escalader(r: Reclamation) {
  try {
    await reclamationsService.escalader(r.id);
    $q.notify({ type: 'warning', message: t('reclamations.messages.escalated', { numero: r.numero }) });
    await liste.recharger();
    await chargerStats();
  } catch {
    /* notifié par l'intercepteur */
  }
}

onMounted(() => {
  void chargerStats();
  void chargerStaff();
});
</script>
