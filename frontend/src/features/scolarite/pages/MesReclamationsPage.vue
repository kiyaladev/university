<template>
  <q-page class="q-pa-md">
    <section-navigation section="procedures" />
    <en-tete-page :title="$t('mesReclamations.title')" :subtitle="$t('mesReclamations.subtitle')">
      <template #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('mesReclamations.actions.new')"
          @click="creationOuverte = true"
        />
      </template>
    </en-tete-page>

    <q-banner v-if="rolePasBon" class="note--info q-mb-md">
      {{
        $t('mesReclamations.banner.wrongRole', {
          role: auth.utilisateur?.role,
          registry: $t('mesReclamations.banner.goToRegistry'),
        })
      }}
      <template #action>
        <q-btn
          flat
          no-caps
          icon="support_agent"
          :label="$t('mesReclamations.banner.goToRegistry')"
          :to="{ name: 'reclamations' }"
        />
      </template>
    </q-banner>

    <div v-if="!rolePasBon" class="resume-liste" role="status">
      <span v-for="s in plaques" :key="s.cle"
        >{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span
      >
    </div>

    <barre-filtres
      v-if="!rolePasBon"
      v-model="filtres"
      :placeholder="$t('mesReclamations.filters.searchPlaceholder')"
      :recherche="true"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #principaux>
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUTS"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.type')"
        />
        <q-select
          v-model="filtres.priorite"
          :options="OPTIONS_PRIORITES"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.priority')"
        />
      </template>
    </barre-filtres>

    <barre-pagination
      v-if="!rolePasBon"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <q-table
      v-if="!rolePasBon && modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
      @row-click="(_, row) => ouvrir(row)"
    >
      <template #no-data>
        <etat-vide icone="forum" :titre="$t('mesReclamations.emptyState.description')" />
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="reclamation" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-priorite="p">
        <q-td :props="p">
          <span class="reclamation-prio" :class="`prio-${p.row.priorite}`">
            <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('mesReclamations.table.openTracking')"
            @click.stop="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('mesReclamations.table.trackingTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else-if="!rolePasBon" class="row q-col-gutter-md">
      <div v-for="r in liste.lignes" :key="r.id" class="col-12 col-md-6">
        <q-card flat bordered class="carte reclamation-carte">
          <q-card-section class="row items-start">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ r.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ r.sujet }}</div>
              <div class="text-caption text-grey-7">{{ libelleType(r.type) }}</div>
            </div>
            <div class="column items-end q-gutter-xs">
              <PastilleStatut domaine="reclamation" :statut="r.statut" />
              <span class="reclamation-prio" :class="`prio-${r.priorite}`">
                <span class="pochoir">{{ libellePriorite(r.priorite) }}</span>
              </span>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(r.createdAt) }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="chat" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{
                $t('mesReclamations.cards.messagesCount', { count: r._count?.messages ?? 0 })
              }}</span>
            </div>
            <div v-if="r.escaladeLe" class="row items-center text-warning">
              <q-icon name="priority_high" size="16px" class="q-mr-sm" />
              <span class="text-caption">{{
                $t('mesReclamations.cards.escalatedOn', { date: dateHeureLisible(r.escaladeLe) })
              }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="visibility" :label="$t('common.actions.detail')" @click="ouvrir(r)" />
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!liste.chargement && !liste.lignes.length"
        class="col-12"
        icone="forum"
        :titre="$t('mesReclamations.emptyState.description')"
      >
        <template #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('mesReclamations.actions.new')"
            @click="creationOuverte = true"
          />
        </template>
      </etat-vide>
    </div>

    <dialogue-reclamation v-model="creationOuverte" @enregistre="liste.recharger()" />
    <dialogue-detail-reclamation
      v-model="detailOuvert"
      :reclamation="reclamationSelectionnee"
      @change="liste.recharger()"
    />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, reactive, ref } from 'vue';
import { type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import DialogueReclamation from '../components/DialogueReclamation.vue';
import DialogueDetailReclamation from '../components/DialogueDetailReclamation.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { reclamationsService } from '../services/reclamations';
import {
  LIBELLE_PRIORITE_RECLAMATION,
  LIBELLE_STATUT_RECLAMATION,
  LIBELLE_TYPE_RECLAMATION,
  dateHeureLisible,
  optionsDepuis,
} from '@/shared/utils/libelles';
import type { PrioriteReclamation, Reclamation, TypeReclamation } from '../types';

const auth = useAuthStore();
const { t } = useI18n();

const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ETUDIANT');

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_RECLAMATION);
const OPTIONS_TYPES = optionsDepuis(LIBELLE_TYPE_RECLAMATION);
const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);

const filtres = ref<Record<string, any>>({ recherche: '', statut: null, type: null, priorite: null });
const liste = reactive(
  useListePaginee<Reclamation>({
    filtres,
    actif: () => auth.utilisateur?.role === 'ETUDIANT',
    // La vue étudiante est `/reclamations/me`, exposée par le service de domaine.
    charger: ({ filtres: f, ...p }) =>
      reclamationsService.mesReclamations({
        ...pageApi(p),
        statut: f.statut || undefined,
        type: f.type || undefined,
        priorite: f.priorite || undefined,
        search: texteApi(f.recherche),
      }),
  }),
);
const modeVue = usePresentationListe();

// Compteurs calculés sur les réclamations affichées (l'API étudiante ne
// fournit pas de tableau de bord dédié).
const stats = computed(() => {
  const counts: Record<string, number> = { OUVERT: 0, EN_COURS: 0, EN_ATTENTE_REPONSE: 0, RESOLU: 0 };
  for (const r of liste.lignes) {
    if (counts[r.statut] != null) counts[r.statut]++;
  }
  return counts;
});
const creationOuverte = ref(false);
const detailOuvert = ref(false);
const reclamationSelectionnee = ref<Reclamation | null>(null);

// Mêmes intitulés de statut que le registre de la scolarité.
const plaques = computed(() => [
  { cle: 'OUVERT', libelle: t('mesReclamations.stats.labels.open') },
  { cle: 'EN_COURS', libelle: t('mesReclamations.stats.labels.inProgress') },
  { cle: 'EN_ATTENTE_REPONSE', libelle: t('mesReclamations.stats.labels.awaitingReply') },
  { cle: 'RESOLU', libelle: t('mesReclamations.stats.labels.resolved') },
]);

function libelleType(t: string) {
  return LIBELLE_TYPE_RECLAMATION[t as TypeReclamation] ?? t;
}
function libellePriorite(p: string) {
  return LIBELLE_PRIORITE_RECLAMATION[p as PrioriteReclamation] ?? p;
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  { name: 'sujet', label: t('mesReclamations.table.columns.subject'), field: 'sujet', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'priorite', label: t('common.fields.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('common.fields.createdOn'),
    field: 'createdAt',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ouvrir(r: Reclamation) {
  reclamationSelectionnee.value = r;
  detailOuvert.value = true;
}
</script>

<style scoped lang="scss">
$encre: #1d1d1f;
$chaux-claire: #ffffff;
$vert: #007a4d;
$jaune-fonce: #8a6300;
$rouge: #ce1126;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}

.reclamation-prio {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  border-radius: var(--up-rayon-sm);
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;

  &.prio-BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
  }
  &.prio-NORMALE {
    background: $jaune-fond;
    color: $jaune-texte;
  }
  &.prio-HAUTE {
    background: $rouge-fond;
    color: #{$rouge};
  }
  &.prio-URGENTE {
    background: $rouge-fond;
    color: #{$rouge};
    color: var(--up-encre);
    animation: clignote 1.4s ease-in-out infinite;
  }
}

.reclamation-carte {
  background: var(--up-plaque);
}

@keyframes clignote {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
