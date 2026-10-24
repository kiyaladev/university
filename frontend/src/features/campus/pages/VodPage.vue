<script setup lang="ts">
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
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import DialogueVod from '../components/DialogueVod.vue';
import DialogueStatsVod from '../components/DialogueStatsVod.vue';
import VodListe from '../components/VodListe.vue';
import { vodService, type ParametresVod } from '../services/vod';
import { LIBELLE_STATUT_VOD, LIBELLE_TYPE_RESSOURCE_VOD, libelleDepuis, optionsDepuis } from '@/shared/utils/libelles';
import type { CoursVOD, ChipFiltre } from '@/types';
import type { RessourceCatalogue } from '../types';

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { confirmer } = useConfirmation();
const $q = useQuasar();

/** Filtres de la liste VOD : recherche, type de ressource et statut de publication. */
interface FiltresVod {
  recherche: string;
  type: string | null;
  statut: string | null;
}

const filtres = ref<FiltresVod>({ recherche: '', type: null, statut: null });

/** Écriture : les mêmes rôles que le backend (POST/PUT/publier/archiver). */
const peutEditer = computed(() => auth.peut('vod.editer'));
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
        const data = await vodService.maCollecte();
        return { data: Array.isArray(data) ? data : [] };
      }
      const params = {
        ...pageApi(p),
        search: texteApi(f.recherche),
        type: f.type || undefined,
        statut: f.statut || undefined,
      } as ParametresVod;
      // Un compte sans droit d'écriture ne consulte que ce qui est en ligne.
      if (!peutEditer.value) params.statut = 'EN_LIGNE';
      return vodService.liste(params);
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

const chips = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.type)
    cs.push({ label: libelleDepuis(LIBELLE_TYPE_RESSOURCE_VOD, f.type), value: f.type, icone: 'movie', cle: 'type' });
  if (f.statut) {
    cs.push({ label: libelleDepuis(LIBELLE_STATUT_VOD, f.statut), value: f.statut, icone: 'flag', cle: 'statut' });
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

const dialogStats = ref(false);
const vodObserve = ref<RessourceCatalogue | null>(null);

/** Ouvre le panneau de consultation : vues, complétion, dernières vues. */
function statistiques(v: RessourceCatalogue) {
  vodObserve.value = v;
  dialogStats.value = true;
}

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
    await vodService.publier(v.id);
    $q.notify({ type: 'positive', message: t('vodPage.messages.published') });
    await liste.recharger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

async function archiver(v: RessourceCatalogue) {
  const ok = await confirmer({
    titre: t('vodPage.dialogs.archive.title'),
    message: t('vodPage.dialogs.archive.message', { title: v.titre }),
    ok: t('common.actions.archive'),
    danger: true,
  });
  if (!ok) return;
  try {
    await vodService.archiver(v.id);
    $q.notify({ type: 'warning', message: t('vodPage.messages.archived') });
    await liste.recharger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}
</script>

<template>
  <q-page class="q-pa-md">
    <en-tete-page
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
    </en-tete-page>

    <barre-filtres
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
          :label="$t('common.fields.status')"
          outlined
          dense
          clearable
        />
      </template>
    </barre-filtres>

    <vod-liste
      :ressources="ressources"
      :chargement="liste.chargement"
      :est-etudiant="estEtudiant"
      :message-vide="messageVide"
      @nouvelle="ouvrirEdition()"
      @lire="lecteur"
      @ouvrir-edition="ouvrirEdition"
      @publier="publier"
      @archiver="archiver"
      @statistiques="statistiques"
    />

    <!-- La collecte étudiante arrive d'un bloc : rien à paginer. -->
    <barre-pagination
      v-if="!estEtudiant && ressources.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <dialogue-vod v-if="peutEditer" v-model="dialogEdition" :vod="vodEnEdition" @enregistre="liste.recharger()" />

    <dialogue-stats-vod v-model="dialogStats" :vod-id="vodObserve?.id ?? null" :titre="vodObserve?.titre" />
  </q-page>
</template>
