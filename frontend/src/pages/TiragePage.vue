<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tirage des épreuves</div>
        <div class="page-sous-titre">
          Entre l'examen planifié et la salle : l'empreinte SHA-256 du sujet est
          revérifiée à l'impression pour bloquer toute substitution de fichier.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Programmer un tirage"
          @click="dialogCreationOuvert = true"
        />
      </div>
      <div class="col-auto">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="quiz"
          label="Examens"
          @click="router.push({ name: 'examens' })"
        />
      </div>
    </div>

    <q-banner v-if="examenFiltre" dense class="carte q-mb-md">
      <template #avatar><q-icon name="filter_alt" color="primary" /></template>
      Tirages de l'examen <strong>{{ examenFiltre.codeExamen }}</strong> —
      {{ examenFiltre.intitule }}.
      <template #action>
        <q-btn flat dense no-caps label="Voir tous les tirages" @click="retirerFiltreExamen" />
      </template>
    </q-banner>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (code examen, intitulé…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle
          cle="tirage"
          :modes="['kanban', 'tableau']"
          defaut="kanban"
          @update:mode="(m) => (modeVue = m as 'kanban' | 'tableau')"
        />
      </template>
      <template #avances>
        <autocomplete-async
          v-model="filtres.examenId"
          endpoint="/examens"
          label="Examen"
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
          label="Stade"
        />
      </template>
    </filter-bar>

    <div v-if="modeVue === 'kanban'" class="q-mt-md">
      <kanban-board :colonnes="colonnesKanban" />
    </div>

    <q-table
      v-else
      flat
      bordered
      class="carte q-mt-md"
      :rows="tiragesFiltres"
      :columns="colonnesTableau"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="local_printshop" size="32px" color="grey-5" />
          <div class="q-mt-sm">Aucun tirage pour ces critères.</div>
          <q-btn
            v-if="peutCreer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Programmer un tirage"
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
          <code class="empreinte-courte">{{ (p.row.empreinteSource ?? '').slice(0, 16) }}…</code>
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
          <q-btn
            flat
            dense
            round
            icon="print"
            aria-label="Imprimer le bordereau du tirage"
            @click.stop="voirBordereau(p.row)"
          >
            <q-tooltip>Bordereau</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="quiz"
            aria-label="Voir l'examen de ce tirage"
            @click.stop="allerExamen(p.row)"
          >
            <q-tooltip>Voir l'examen</q-tooltip>
          </q-btn>
          <q-btn
            v-if="transitionSuivante(p.row.stade) && peutCreer"
            flat
            dense
            no-caps
            color="primary"
            :label="labelSuivant(p.row.stade)"
            @click.stop="avancer(p.row)"
          />
          <q-btn
            v-if="p.row.stade === 'PROGRAMME' && peutCreer"
            flat
            dense
            round
            color="negative"
            icon="block"
            aria-label="Annuler le tirage"
            @click.stop="annuler(p.row)"
          >
            <q-tooltip>Annuler le tirage</q-tooltip>
          </q-btn>
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
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import KanbanBoard from '../components/KanbanBoard.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import TirageDialog from '../components/TirageDialog.vue';
import { LIBELLE_STADE_TIRAGE, dateHeureLisible } from '../utils/libelles';
import type { Examen, StadeTirage, Tirage, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const modeVue = ref<'kanban' | 'tableau'>('kanban');
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
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, icone: 'search', defaut: true });
  }
  if (filtres.value.stade) {
    chips.push({
      label: `Stade : ${LIBELLE_STADE_TIRAGE[filtres.value.stade] ?? filtres.value.stade}`,
      value: filtres.value.stade,
      icone: 'flag',
    });
  }
  if (examenFiltre.value) {
    chips.push({ label: `Examen : ${examenFiltre.value.codeExamen}`, value: examenFiltre.value.id, icone: 'quiz' });
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
  { name: 'examen', label: 'Examen', field: 'examen', align: 'left' },
  { name: 'date', label: 'Date du tirage', field: (r: Tirage) => dateHeureLisible(r.dateTirage), align: 'left' },
  { name: 'exemplaires', label: 'Exemplaires', field: 'nbExemplaires', align: 'right' },
  { name: 'empreinte', label: 'Empreinte SHA-256', field: 'empreinteSource', align: 'left' },
  { name: 'imprimeur', label: 'Imprimeur', field: (r: Tirage) => (r.imprimeur ? `${r.imprimeur.prenom} ${r.imprimeur.nom}` : '—'), align: 'left' },
  { name: 'stade', label: 'Stade', field: 'stade', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesKanban = computed(() =>
  ORDRES.map((stade) => {
    const cartes = tiragesFiltres.value
      .filter((t) => t.stade === stade)
      .map((t) => ({
        id: t.id,
        titre: t.examen?.codeExamen ?? '—',
        sousTitre: t.examen?.intitule ?? '',
        meta: `${t.nbExemplaires} ex. · ${dateHeureLisible(t.dateTirage)} · ${(t.empreinteSource ?? '').slice(0, 12)}…`,
        badge: LIBELLE_STADE_TIRAGE[stade],
        couleur: couleurStade(stade),
        actions: actionsPourCarte(t),
        onClick: () => allerExamen(t),
      }));
    return {
      identifiant: stade,
      titre: LIBELLE_STADE_TIRAGE[stade],
      couleur: couleurStade(stade),
      cartes,
    };
  }),
);

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

function actionsPourCarte(t: Tirage) {
  const acts: Array<{ label: string; icone: string; couleur: string; onClick: () => void }> = [
    { label: 'Bordereau', icone: 'print', couleur: 'primary', onClick: () => voirBordereau(t) },
  ];
  if (transitionSuivante(t.stade) && peutCreer.value) {
    acts.push({
      label: labelSuivant(t.stade),
      icone: 'arrow_forward',
      couleur: 'primary',
      onClick: () => avancer(t),
    });
  }
  if (t.stade === 'PROGRAMME' && peutCreer.value) {
    acts.push({ label: 'Annuler', icone: 'block', couleur: 'negative', onClick: () => annuler(t) });
  }
  return acts;
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
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Chargement des tirages impossible' });
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
  window.open(`${API_URL}/tirage/${t.id}/imprimer-bordereau?token=${auth.token}`, '_blank');
}

/** Libellés des étapes : chaque passage est tracé et ne se rejoue pas. */
const MESSAGES_TRANSITION: Record<string, string> = {
  IMPRIME:
    "Confirmez l'empreinte SHA-256 du fichier source. Si elle ne correspond pas à celle enregistrée à la programmation, l'impression sera refusée.",
  MIS_SOUS_PLI:
    'Les exemplaires sont déclarés mis sous pli et scellés. Cette étape est enregistrée au journal et ne peut pas être annulée.',
  DISTRIBUE:
    'Les plis sont déclarés remis au centre d’examen. Cette étape est enregistrée au journal et ne peut pas être annulée.',
  RECUPERE:
    'Les copies sont déclarées récupérées : le tirage est clos. Cette étape est définitive.',
};

async function avancer(t: Tirage) {
  const stade = transitionSuivante(t.stade);
  if (!stade) return;

  const routeSuivant =
    stade === 'IMPRIME' ? 'imprimer' :
    stade === 'MIS_SOUS_PLI' ? 'mettre-sous-pli' :
    stade === 'DISTRIBUE' ? 'distribuer' :
    'recuperer';

  const validerEtAvancer = async (empreinteSaisie?: string) => {
    let payload: Record<string, unknown> = {};
    if (stade === 'IMPRIME') {
      if (!empreinteSaisie) {
        $q.notify({ type: 'negative', message: 'Empreinte requise pour imprimer' });
        return;
      }
      payload = {
        empreinteSource: empreinteSaisie,
        empreinteExemplaires: t.empreinteExemplaires ?? undefined,
      };
    }
    try {
      await api.post(`/tirage/${t.id}/${routeSuivant}`, payload);
      $q.notify({ type: 'positive', message: `Stade → ${libelleStade(stade)}` });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Transition impossible' });
    }
  };

  if (stade === 'IMPRIME') {
    $q.dialog({
      title: "Confirmer l'impression",
      message: MESSAGES_TRANSITION.IMPRIME,
      prompt: { model: t.empreinteSource, type: 'text' },
      cancel: true,
      ok: { color: 'primary', label: 'Imprimer', unelevated: true, noCaps: true },
    }).onOk((value: string) => validerEtAvancer(value));
    return;
  }

  $q.dialog({
    title: `Passer au stade « ${libelleStade(stade)} »`,
    message: MESSAGES_TRANSITION[stade] ?? '',
    cancel: true,
    ok: { color: 'primary', label: libelleStade(stade), unelevated: true, noCaps: true },
  }).onOk(() => validerEtAvancer());
}

function annuler(t: Tirage) {
  $q.dialog({
    title: 'Annuler le tirage',
    message: `Annuler définitivement le tirage de ${t.examen?.codeExamen ?? 'cet examen'} ? Les exemplaires programmés ne seront pas imprimés.`,
    cancel: { flat: true, label: 'Revenir', noCaps: true },
    ok: { color: 'negative', label: 'Annuler le tirage', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/tirage/${t.id}/annuler`);
      $q.notify({ type: 'positive', message: 'Tirage annulé' });
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Annulation impossible' });
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
