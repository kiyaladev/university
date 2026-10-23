<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('tirage.title')" :subtitle="$t('tirage.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('tirage.actions.schedule')"
          @click="dialogCreationOuvert = true"
        />
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="quiz"
          :label="$t('tirage.actions.exams')"
          @click="router.push({ name: 'examens' })"
        />
      </template>
    </en-tete-page>

    <q-banner v-if="examenFiltre" dense class="carte q-mb-md">
      <template #avatar><q-icon name="filter_alt" color="primary" /></template>
      {{ $t('tirage.banner.prefix') }} <strong>{{ examenFiltre.codeExamen }}</strong>
      {{ $t('common.format.emptyValue') }} {{ examenFiltre.intitule }}.
      <template #action>
        <q-btn flat dense no-caps :label="$t('tirage.actions.viewAll')" @click="retirerFiltreExamen" />
      </template>
    </q-banner>

    <barre-filtres
      v-model="filtres"
      :placeholder="$t('tirage.search.placeholder')"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <champ-recherche
          v-model="filtres.examenId"
          endpoint="/examens"
          :label="$t('tirage.filters.examen')"
          :label-fn="(e) => `${e.codeExamen} — ${e.intitule}`"
          clearable
        />
        <q-select
          v-model="filtres.stade"
          :options="optionsStades"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('tirage.filters.stade')"
        />
      </template>
    </barre-filtres>

    <q-table
      :grid="$q.screen.lt.md"
      flat
      bordered
      class="carte q-mt-md"
      :rows="tiragesFiltres"
      :columns="colonnesTableau"
      row-key="id"
      :loading="liste.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #item="p">
        <div class="col-12 q-pb-sm">
          <q-card flat bordered class="carte">
            <q-card-section>
              <div v-for="c in p.cols.filter((c) => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
                <div class="text-caption text-grey-7">{{ c.label }}</div>
                <template v-if="c.name === 'examen'"
                  >{{ p.row.examen?.codeExamen }} · {{ p.row.examen?.intitule }}</template
                >
                <template v-else-if="c.name === 'empreinte'"
                  >{{ (p.row.empreinteSource ?? '').slice(0, 16) }}…</template
                >
                <template v-else-if="c.name === 'stade'">{{ libelleStade(p.row.stade) }}</template>
                <span v-else>{{ c.value }}</span>
              </div>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn
                v-if="transitionSuivante(p.row.stade) && peutCreer"
                flat
                dense
                no-caps
                color="primary"
                :label="labelSuivant(p.row.stade)"
                @click.stop="avancer(p.row)"
              />
              <actions-secondaires>
                <q-btn
                  v-close-popup
                  flat
                  dense
                  no-caps
                  icon="print"
                  :label="$t('tirage.tooltips.bordereau')"
                  @click.stop="voirBordereau(p.row)"
                />
                <q-btn
                  v-close-popup
                  flat
                  dense
                  no-caps
                  icon="quiz"
                  :label="$t('tirage.tooltips.voirExamen')"
                  @click.stop="allerExamen(p.row)"
                />
                <q-btn
                  v-close-popup
                  v-if="p.row.stade === 'PROGRAMME' && peutCreer"
                  flat
                  dense
                  no-caps
                  color="negative"
                  icon="block"
                  :label="$t('tirage.tooltips.annulerTirage')"
                  @click.stop="annuler(p.row)"
                />
              </actions-secondaires>
            </q-card-actions>
          </q-card>
        </div>
      </template>
      <template #no-data>
        <etat-vide icone="local_printshop" :titre="$t('tirage.emptyState.message')">
          <template v-if="peutCreer" #action>
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('tirage.actions.schedule')"
              class="q-mt-sm"
              @click="dialogCreationOuvert = true"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-examen="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.examen?.codeExamen ?? '—' }}</div>
          <div class="text-caption text-grey-7">{{ p.row.examen?.intitule ?? '—' }}</div>
        </q-td>
      </template>
      <template #body-cell-empreinte="p">
        <q-td :props="p">
          <code class="empreinte-courte">{{ (p.row.empreinteSource ?? '').slice(0, 16) }}…</code>
          <q-tooltip>{{ p.row.empreinteSource }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-stade="p">
        <q-td :props="p">
          <PastilleStatut domaine="tirage" :statut="p.row.stade" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="transitionSuivante(p.row.stade) && peutCreer"
            flat
            dense
            no-caps
            color="primary"
            :label="labelSuivant(p.row.stade)"
            @click.stop="avancer(p.row)"
          />
          <actions-secondaires>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="print"
              :label="$t('tirage.tooltips.bordereau')"
              @click.stop="voirBordereau(p.row)"
            />
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="quiz"
              :label="$t('tirage.tooltips.voirExamen')"
              @click.stop="allerExamen(p.row)"
            />
            <q-btn
              v-close-popup
              v-if="p.row.stade === 'PROGRAMME' && peutCreer"
              flat
              dense
              no-caps
              color="negative"
              icon="block"
              :label="$t('tirage.tooltips.annulerTirage')"
              @click.stop="annuler(p.row)"
            />
          </actions-secondaires>
        </q-td>
      </template>
    </q-table>

    <barre-pagination
      v-if="liste.total"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-tirage v-model="dialogCreationOuvert" @enregistre="liste.recharger()" />
    <dialogue-impression-tirage
      v-model="dialogImpressionOuvert"
      :tirage-id="tirageAImprimer"
      @enregistre="apresImpression"
    />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '@/boot/axios';

import { useAuthStore } from '@/stores/auth';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueTirage from '../components/DialogueTirage.vue';
import DialogueImpressionTirage from '../components/DialogueImpressionTirage.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { pageApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { LIBELLE_STADE_TIRAGE, dateHeureLisible } from '@/shared/utils/libelles';
import type { Examen, StadeTirage, Tirage, ChipFiltre } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
// Alias `translate` (not `t`) because several handlers below already use `t`
// as the local parameter name for a Tirage row.
const { t: translate } = useI18n();
const { confirmer } = useConfirmation();
const dialogCreationOuvert = ref(false);
const dialogImpressionOuvert = ref(false);
const tirageAImprimer = ref<string | null>(null);
/** Examen sur lequel la page a été ouverte depuis la fiche d'un examen. */
const examenFiltre = ref<Examen | null>(null);

const filtres = ref<Record<string, any>>({
  recherche: '',
  examenId: null as string | null,
  stade: null as StadeTirage | null,
});

/** `examenId` vient aussi de l'URL : la fiche d'un examen ouvre ses tirages. */
const liste = reactive(
  useListePaginee<Tirage>({
    filtres,
    pageSize: 50,
    syncUrl: true,
    // `/tirage` ne filtre pas sur le texte : voir `tiragesFiltres`.
    clesLocales: ['recherche'],
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/tirage', {
          params: {
            ...pageApi(p),
            examenId: f.examenId || undefined,
            stade: f.stade || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

const peutCreer = computed(() => auth.peut('tirage.gerer'));

const ORDRES: StadeTirage[] = ['PROGRAMME', 'IMPRIME', 'MIS_SOUS_PLI', 'DISTRIBUE', 'RECUPERE', 'ANNULE'];

const optionsStades = ORDRES.map((value) => ({ value, label: LIBELLE_STADE_TIRAGE[value] }));

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({
      label: translate('tirage.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.stade) {
    chips.push({
      label: translate('tirage.chips.stade', {
        value: LIBELLE_STADE_TIRAGE[filtres.value.stade] ?? filtres.value.stade,
      }),
      value: filtres.value.stade,
      icone: 'flag',
    });
  }
  if (examenFiltre.value) {
    chips.push({
      label: translate('tirage.chips.examen', { value: examenFiltre.value.codeExamen }),
      value: examenFiltre.value.id,
      icone: 'quiz',
    });
  }
  return chips;
});

/**
 * `/tirage` ne sait pas filtrer sur le texte : la recherche s'applique donc
 * aux lignes chargées, pour que le champ ne soit pas décoratif.
 */
const tiragesFiltres = computed(() => {
  const q = String(filtres.value.recherche ?? '')
    .toLowerCase()
    .trim();
  if (!q) return liste.lignes;
  return liste.lignes.filter((t) =>
    [t.examen?.codeExamen, t.examen?.intitule, t.circuitImpression]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

const colonnesTableau = computed<QTableColumn[]>(() => [
  { name: 'examen', label: translate('tirage.table.columns.examen'), field: 'examen', align: 'left' },
  {
    name: 'date',
    label: translate('tirage.table.columns.date'),
    field: (r: Tirage) => dateHeureLisible(r.dateTirage),
    align: 'left',
  },
  { name: 'exemplaires', label: translate('tirage.table.columns.exemplaires'), field: 'nbExemplaires', align: 'right' },
  { name: 'empreinte', label: translate('tirage.table.columns.empreinte'), field: 'empreinteSource', align: 'left' },
  {
    name: 'imprimeur',
    label: translate('tirage.table.columns.imprimeur'),
    field: (r: Tirage) => (r.imprimeur ? `${r.imprimeur.prenom} ${r.imprimeur.nom}` : '—'),
    align: 'left',
  },
  { name: 'stade', label: translate('tirage.table.columns.stade'), field: 'stade', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function libelleStade(s: string) {
  return LIBELLE_STADE_TIRAGE[s] ?? s;
}

function transitionSuivante(stade: string): StadeTirage | null {
  switch (stade) {
    case 'PROGRAMME':
      return 'IMPRIME';
    case 'IMPRIME':
      return 'MIS_SOUS_PLI';
    case 'MIS_SOUS_PLI':
      return 'DISTRIBUE';
    case 'DISTRIBUE':
      return 'RECUPERE';
    default:
      return null;
  }
}

function labelSuivant(stade: string) {
  const suiv = transitionSuivante(stade);
  return suiv ? `→ ${LIBELLE_STADE_TIRAGE[suiv]}` : '';
}

function reinitialiser() {
  liste.reinitialiser([]);
  examenFiltre.value = null;
}

function retirerFiltreExamen() {
  examenFiltre.value = null;
  filtres.value.examenId = null;
}

/** Tirage → examen : la page Examens se positionne sur le code de l'épreuve. */
function allerExamen(t: Tirage) {
  if (!t.examen) return;
  void router.push({ name: 'examens', query: { recherche: t.examen.codeExamen } });
}

function voirBordereau(t: Tirage | null) {
  if (!t) return;
  void ouvrirImpression(`/tirage/${t.id}/imprimer-bordereau`);
}

/** Libellés des étapes : chaque passage est tracé et ne se rejoue pas. */
const MESSAGES_TRANSITION = computed<Record<string, string>>(() => ({
  IMPRIME: translate('tirage.transitions.IMPRIME'),
  MIS_SOUS_PLI: translate('tirage.transitions.MIS_SOUS_PLI'),
  DISTRIBUE: translate('tirage.transitions.DISTRIBUE'),
  RECUPERE: translate('tirage.transitions.RECUPERE'),
}));

async function avancer(t: Tirage) {
  const stade = transitionSuivante(t.stade);
  if (!stade) return;

  const routeSuivant =
    stade === 'IMPRIME'
      ? 'imprimer'
      : stade === 'MIS_SOUS_PLI'
        ? 'mettre-sous-pli'
        : stade === 'DISTRIBUE'
          ? 'distribuer'
          : 'recuperer';

  // PROGRAMME → IMPRIME : dialogue dédié, champ d'empreinte vide (le serveur
  // compare, l'empreinte attendue n'est pas exposée avant impression).
  if (stade === 'IMPRIME') {
    tirageAImprimer.value = t.id;
    dialogImpressionOuvert.value = true;
    return;
  }

  const ok = await confirmer({
    titre: translate('tirage.dialogs.advance.title', { stade: libelleStade(stade) }),
    message: MESSAGES_TRANSITION.value[stade] ?? '',
    ok: libelleStade(stade),
  });
  if (!ok) return;
  try {
    await api.post(`/tirage/${t.id}/${routeSuivant}`, { stade });
    notifierStade(stade);
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

function notifierStade(stade: StadeTirage) {
  $q.notify({ type: 'positive', message: translate('tirage.messages.stageChanged', { stade: libelleStade(stade) }) });
}

async function apresImpression() {
  notifierStade('IMPRIME');
  await liste.recharger();
}

async function annuler(t: Tirage) {
  const ok = await confirmer({
    titre: translate('tirage.dialogs.cancel.title'),
    message: translate('tirage.dialogs.cancel.message', {
      examen: t.examen?.codeExamen ?? translate('tirage.dialogs.cancel.thisExam'),
    }),
    ok: translate('tirage.actions.cancelDraw'),
    danger: true,
  });
  if (!ok) return;
  try {
    await api.post(`/tirage/${t.id}/annuler`);
    $q.notify({ type: 'positive', message: translate('tirage.messages.cancelled') });
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

onMounted(async () => {
  // Chaîne : un examen ouvre directement ses tirages (l'`examenId` de l'URL
  // est déjà dans les filtres) ; on charge sa fiche pour le bandeau.
  const examenId = filtres.value.examenId;
  if (examenId) {
    try {
      const { data } = await api.get(`/examens/${examenId}`);
      examenFiltre.value = data;
    } catch {
      examenFiltre.value = null;
    }
  }
});
</script>

<style scoped lang="scss">
/**
 * Une empreinte SHA-256 se relit caractère par caractère : chasse fixe
 * obligatoire. On s'en tient à la pile générique — aucune fonte à chasse fixe
 * n'est chargée par l'application, nommer « JetBrains Mono » ne faisait que
 * promettre une fonte absente.
 */
.empreinte-courte {
  font-family: monospace;
  font-size: 11px;
  background: var(--up-craie);
  border: var(--up-filet-fin);
  padding: 2px 6px;
}
/* `.etat-vide` est désormais porté par app.scss. */
</style>
