<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import BadgeListe from '../components/BadgeListe.vue';
import BadgeDialogueAnnulation from '../components/BadgeDialogueAnnulation.vue';
import BadgeDialogueProlongation from '../components/BadgeDialogueProlongation.vue';
import DialogueBadge from '../components/DialogueBadge.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { badgesService, type ParametresBadges } from '../services/badges';
import { LIBELLE_STATUT_BADGE, LIBELLE_TYPE_BADGE, optionsDepuis } from '@/shared/utils/libelles';
import { ouvrirImpression } from '@/shared/services/impression';
import type { BadgeAcces } from '@/types';

const auth = useAuthStore();

const filtres = ref<Record<string, any>>({ recherche: '', type: null, statut: null });
const liste = reactive(
  useListePaginee<BadgeAcces>({
    filtres,
    syncUrl: true,
    charger: async ({ filtres: f, ...p }) => {
      const params = {
        ...pageApi(p),
        search: texteApi(f.recherche),
        type: f.type || undefined,
        statut: f.statut || undefined,
      } as ParametresBadges;
      return badgesService.liste(params);
    },
  }),
);

const peutEditer = computed(() => auth.peut('badges.editer'));

const OPTIONS_TYPE = optionsDepuis(LIBELLE_TYPE_BADGE);
const OPTIONS_STATUT = optionsDepuis(LIBELLE_STATUT_BADGE);

const dialogEdition = ref(false);
const badgeEnEdition = ref<BadgeAcces | null>(null);

const dialogAnnulation = ref(false);
const badgeAnnulation = ref<BadgeAcces | null>(null);

const dialogRallonge = ref(false);
const badgeRallonge = ref<BadgeAcces | null>(null);

function ouvrirEdition(b?: BadgeAcces) {
  badgeEnEdition.value = b ?? null;
  dialogEdition.value = true;
}

function imprimer(b: BadgeAcces) {
  void ouvrirImpression(`/badges/${b.id}/imprimer`);
}

function ouvrirAnnulation(b: BadgeAcces) {
  badgeAnnulation.value = b;
  dialogAnnulation.value = true;
}

function ouvrirRallonge(b: BadgeAcces) {
  badgeRallonge.value = b;
  dialogRallonge.value = true;
}
</script>

<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('badges.title')" :subtitle="$t('badges.subtitle')">
      <template v-if="peutEditer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('badges.actions.issueBadge')"
          @click="ouvrirEdition()"
        />
      </template>
    </en-tete-page>

    <barre-filtres v-model="filtres" :placeholder="$t('badges.filters.searchPlaceholder')">
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          :label="$t('common.fields.type')"
          outlined
          dense
          clearable
        />
        <q-select
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

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <badge-liste
      :badges="liste.lignes"
      :chargement="liste.chargement"
      :peut-editer="peutEditer"
      @imprimer="imprimer"
      @ouvrir-edition="ouvrirEdition"
      @ouvrir-rallonge="ouvrirRallonge"
      @ouvrir-annulation="ouvrirAnnulation"
    />

    <dialogue-badge v-model="dialogEdition" :badge="badgeEnEdition" @enregistre="liste.recharger()" />

    <badge-dialogue-annulation
      v-model="dialogAnnulation"
      :badge="badgeAnnulation"
      @enregistre="liste.recharger()"
    />

    <badge-dialogue-prolongation
      v-model="dialogRallonge"
      :badge="badgeRallonge"
      @enregistre="liste.recharger()"
    />
  </q-page>
</template>
