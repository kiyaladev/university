<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('tirage.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('tirage.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('tirage.actions.schedule')"
          @click="dialogCreationOuvert = true"
        />
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="quiz"
          :label="$t('tirage.actions.exams')"
          @click="router.push({ name: 'examens' })"
        />
      </div>
    </div>

    <q-banner v-if="examenFiltre" dense class="carte q-mb-md">
      <template #avatar><q-icon name="filter_alt" color="primary" /></template>
      {{ $t('tirage.banner.prefix') }} <strong>{{ examenFiltre.codeExamen }}</strong> {{ $t('rectoratPage.subtitleFallback') }}
      {{ examenFiltre.intitule }}.
      <template #action>
        <q-btn flat dense no-caps :label="$t('tirage.actions.viewAll')" @click="retirerFiltreExamen" />
      </template>
    </q-banner>

    <filter-bar
      v-model="filtres"
      :placeholder="$t('tirage.search.placeholder')"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <autocomplete-async
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
    </filter-bar>

    <q-table :grid="$q.screen.lt.md"
      flat
      bordered
      class="carte q-mt-md"
      :rows="tiragesFiltres"
      :columns="colonnesTableau"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >

        <template #item="p">
    <div class="col-12 q-pb-sm"><q-card flat bordered class="carte">
      <q-card-section>
        <div v-for="c in p.cols.filter(c => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
          <div class="text-caption text-grey-7">{{ c.label }}</div>
          <template v-if="c.name === 'examen'">{{ p.row.examen?.codeExamen }} · {{ p.row.examen?.intitule }}</template>
  <template v-else-if="c.name === 'empreinte'">{{ (p.row.empreinteSource ?? '').slice(0, 16) }}…</template>
  <template v-else-if="c.name === 'stade'">{{ libelleStade(p.row.stade) }}</template>
  <span v-else>{{ c.value }}</span>
        </div>
      </q-card-section>
      <q-card-actions align="right">
          <q-btn v-if="transitionSuivante(p.row.stade) && peutCreer" flat dense no-caps color="primary"
            :label="labelSuivant(p.row.stade)" @click.stop="avancer(p.row)" />
          <actions-secondaires>
            <q-btn v-close-popup flat dense no-caps icon="print" :label="$t('tirage.tooltips.bordereau')" @click.stop="voirBordereau(p.row)" />
            <q-btn v-close-popup flat dense no-caps icon="quiz" :label="$t('tirage.tooltips.voirExamen')" @click.stop="allerExamen(p.row)" />
            <q-btn v-close-popup v-if="p.row.stade === 'PROGRAMME' && peutCreer" flat dense no-caps color="negative" icon="block"
              :label="$t('tirage.tooltips.annulerTirage')" @click.stop="annuler(p.row)" />
          </actions-secondaires>
        </q-card-actions>
    </q-card></div>
  </template>
<template #no-data>
        <div class="etat-vide">
          <q-icon name="local_printshop" size="32px" color="grey-5" />
          <div class="q-mt-sm">{{ $t('tirage.emptyState.message') }}</div>
          <q-btn
            v-if="peutCreer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('tirage.actions.schedule')"
            class="q-mt-sm"
            @click="dialogCreationOuvert = true"
          />
        </div>
      </template>

      <template #body-cell-examen="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.examen?.codeExamen ?? '—' }}</div>
          <div class="text-caption text-grey-7">{{ p.row.examen?.intitule ?? '—' }}</div>
        </q-td>
      </template>
      <template #body-cell-empreinte="p">
        <q-td :props="p">
          <code class="empreinte-courte">{{ (p.row.empreinteSource ?? '').slice(0, 16) }}{{ $t('reservations.chips.roomFallback') }}</code>
          <q-tooltip>{{ p.row.empreinteSource }}</q-tooltip>
        </q-td>
      </template>
      <template #body-cell-stade="p">
        <q-td :props="p">
          <q-badge :color="couleurStade(p.row.stade)" :label="libelleStade(p.row.stade)" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn v-if="transitionSuivante(p.row.stade) && peutCreer" flat dense no-caps color="primary"
            :label="labelSuivant(p.row.stade)" @click.stop="avancer(p.row)" />
          <actions-secondaires>
            <q-btn v-close-popup flat dense no-caps icon="print" :label="$t('tirage.tooltips.bordereau')" @click.stop="voirBordereau(p.row)" />
            <q-btn v-close-popup flat dense no-caps icon="quiz" :label="$t('tirage.tooltips.voirExamen')" @click.stop="allerExamen(p.row)" />
            <q-btn v-close-popup v-if="p.row.stade === 'PROGRAMME' && peutCreer" flat dense no-caps color="negative" icon="block"
              :label="$t('tirage.tooltips.annulerTirage')" @click.stop="annuler(p.row)" />
          </actions-secondaires>
        </q-td>
      </template>
    </q-table>

    <pagination-bar
      v-if="total"
      :page="filtres.page"
      :page-size="filtres.pageSize"
      :total="total"
      @update:page="(v) => { filtres.page = v; charger(); }"
      @update:page-size="(v) => { filtres.pageSize = v; filtres.page = 1; charger(); }"
      @tous="chargerTout"
    />

    <tirage-dialog v-model="dialogCreationOuvert" @cree="charger" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import TirageDialog from '../components/TirageDialog.vue';
import { LIBELLE_STADE_TIRAGE, dateHeureLisible } from '../utils/libelles';
import type { Examen, StadeTirage, Tirage, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
// Alias `translate` (not `t`) because several handlers below already use `t`
// as the local parameter name for a Tirage row.
const { t: translate } = useI18n();
const tirages = ref<Tirage[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogCreationOuvert = ref(false);
/** Examen sur lequel la page a été ouverte depuis la fiche d'un examen. */
const examenFiltre = ref<Examen | null>(null);

function filtresParDefaut() {
  return {
    recherche: '',
    examenId: null as string | null,
    stade: null as StadeTirage | null,
    page: 1,
    pageSize: 50,
  };
}

const filtres = ref<Record<string, any>>(filtresParDefaut());

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

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
      label: translate('tirage.chips.stade', { value: LIBELLE_STADE_TIRAGE[filtres.value.stade] ?? filtres.value.stade }),
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
  const q = String(filtres.value.recherche ?? '').toLowerCase().trim();
  if (!q) return tirages.value;
  return tirages.value.filter((t) =>
    [t.examen?.codeExamen, t.examen?.intitule, t.circuitImpression]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

const colonnesTableau = computed<QTableColumn[]>(() => [
  { name: 'examen', label: translate('tirage.table.columns.examen'), field: 'examen', align: 'left' },
  { name: 'date', label: translate('tirage.table.columns.date'), field: (r: Tirage) => dateHeureLisible(r.dateTirage), align: 'left' },
  { name: 'exemplaires', label: translate('tirage.table.columns.exemplaires'), field: 'nbExemplaires', align: 'right' },
  { name: 'empreinte', label: translate('tirage.table.columns.empreinte'), field: 'empreinteSource', align: 'left' },
  { name: 'imprimeur', label: translate('tirage.table.columns.imprimeur'), field: (r: Tirage) => (r.imprimeur ? `${r.imprimeur.prenom} ${r.imprimeur.nom}` : '—'), align: 'left' },
  { name: 'stade', label: translate('tirage.table.columns.stade'), field: 'stade', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function couleurStade(s: string) {
  switch (s) {
    case 'PROGRAMME':
      return 'grey-7';
    case 'IMPRIME':
      return 'orange';
    case 'MIS_SOUS_PLI':
      return 'blue';
    case 'DISTRIBUE':
      return 'green';
    case 'RECUPERE':
      return 'teal';
    case 'ANNULE':
      return 'red';
    default:
      return 'grey-5';
  }
}

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

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/tirage', {
      params: {
        examenId: filtres.value.examenId || undefined,
        stade: filtres.value.stade || undefined,
        page: filtres.value.page,
        pageSize: filtres.value.pageSize,
      },
    });
    tirages.value = data.data ?? [];
    total.value = data.total ?? tirages.value.length;
  } catch (e: any) {
    tirages.value = [];
    total.value = 0;
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? translate('tirage.messages.loadError') });
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  filtres.value.page = 1;
  filtres.value.pageSize = Math.max(total.value, 200);
  await charger();
}

function reinitialiser() {
  filtres.value = filtresParDefaut();
  examenFiltre.value = null;
  charger();
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
    stade === 'IMPRIME' ? 'imprimer' :
    stade === 'MIS_SOUS_PLI' ? 'mettre-sous-pli' :
    stade === 'DISTRIBUE' ? 'distribuer' :
    'recuperer';

  const validerEtAvancer = async (empreinteSaisie?: string) => {
    let payload: Record<string, unknown> = { stade };
    if (stade === 'IMPRIME') {
      if (!empreinteSaisie) {
        $q.notify({ type: 'negative', message: translate('tirage.messages.fingerprintRequired') });
        return;
      }
      payload = {
        empreinteSource: empreinteSaisie.trim().toLowerCase(),
        empreinteExemplaires: t.empreinteExemplaires ?? undefined,
      };
    }
    try {
      await api.post(`/tirage/${t.id}/${routeSuivant}`, payload);
      $q.notify({ type: 'positive', message: translate('tirage.messages.stageChanged', { stade: libelleStade(stade) }) });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? translate('tirage.messages.transitionError') });
    }
  };

  if (stade === 'IMPRIME') {
    $q.dialog({
      title: translate('tirage.actions.confirmPrint'),
      message: MESSAGES_TRANSITION.value.IMPRIME,
      prompt: { model: t.empreinteSource, type: 'text' },
      cancel: true,
      ok: { color: 'primary', label: translate('tirage.actions.print'), unelevated: true, noCaps: true },
    }).onOk((value: string) => validerEtAvancer(value));
    return;
  }

  $q.dialog({
    title: translate('tirage.dialogs.advance.title', { stade: libelleStade(stade) }),
    message: MESSAGES_TRANSITION.value[stade] ?? '',
    cancel: true,
    ok: { color: 'primary', label: libelleStade(stade), unelevated: true, noCaps: true },
  }).onOk(() => validerEtAvancer());
}

function annuler(t: Tirage) {
  $q.dialog({
    title: translate('tirage.dialogs.cancel.title'),
    message: translate('tirage.dialogs.cancel.message', {
      examen: t.examen?.codeExamen ?? translate('tirage.dialogs.cancel.thisExam'),
    }),
    cancel: { flat: true, label: translate('tirage.actions.back'), noCaps: true },
    ok: { color: 'negative', label: translate('tirage.actions.cancelDraw'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/tirage/${t.id}/annuler`);
      $q.notify({ type: 'positive', message: translate('tirage.messages.cancelled') });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? translate('tirage.messages.cancelError') });
    }
  });
}

watch(
  () => [filtres.value.examenId, filtres.value.stade],
  () => {
    filtres.value.page = 1;
    charger();
  },
);

onMounted(async () => {
  // Chaîne : un examen ouvre directement ses tirages.
  const examenId = String(route.query.examenId ?? '');
  if (examenId) {
    filtres.value.examenId = examenId;
    try {
      const { data } = await api.get(`/examens/${examenId}`);
      examenFiltre.value = data;
    } catch {
      examenFiltre.value = null;
    }
  }
  await charger();
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
