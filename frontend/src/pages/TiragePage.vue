<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tirage des épreuves</div>
        <div class="page-sous-titre">
          Suivi sécurisé d'un tirage : l'empreinte source est vérifiée au moment de l'impression
          pour bloquer toute substitution de fichier.
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
          @click="ouvrirCreation"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Rechercher (code examen, intitulé…)"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <q-btn outline color="secondary" no-caps icon="view_kanban" label="Tableau" :flat="mode === 'kanban'" @click="mode = 'kanban'" />
        <q-btn outline color="secondary" no-caps icon="view_list" label="Liste" :flat="mode === 'liste'" @click="mode = 'liste'" />
      </template>
      <template #avances>
        <autocomplete-async
          v-model="filtres.examenId"
          endpoint="/examens"
          label="Examen"
          :label-fn="(e) => `${e.codeExamen} — ${e.intitule}`"
        />
        <champ-date v-model="filtres.dateDebut" label="Tirage du" />
        <champ-date v-model="filtres.dateFin" label="au" />
      </template>
    </filter-bar>

    <div v-if="mode === 'kanban'" class="q-mt-md">
      <kanban-board :colonnes="colonnesKanban" />
    </div>

    <q-table
      v-else
      flat
      bordered
      class="carte q-mt-md"
      :rows="tirages"
      :columns="colonnesTableau"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="(_, row) => voirBordereau(row)"
    >
      <template #body-cell-examen="p">
        <q-td :props="p">
          <div class="text-weight-medium">{{ p.row.examen?.codeExamen ?? '—' }}</div>
          <div class="text-caption text-grey-7">{{ p.row.examen?.intitule ?? '—' }}</div>
        </q-td>
      </template>
      <template #body-cell-empreinte="p">
        <q-td :props="p">
          <code class="empreinte-courte">{{ p.row.empreinteSource.slice(0, 16) }}…</code>
        </q-td>
      </template>
      <template #body-cell-stade="p">
        <q-td :props="p">
          <q-badge :color="couleurStade(p.row.stade)" :label="libelleStade(p.row.stade)" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="print" @click.stop="voirBordereau(p.row)">
            <q-tooltip>Bordereau</q-tooltip>
          </q-btn>
          <q-btn v-if="transitionSuivante(p.row.stade)" flat dense no-caps color="primary" :label="labelSuivant(p.row.stade)" @click.stop="avancer(p.row)" />
          <q-btn v-if="p.row.stade === 'PROGRAMME' && peutCreer" flat dense round color="negative" icon="block" @click.stop="annuler(p.row)">
            <q-tooltip>Annuler</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <pagination-bar
      :page.sync="filtres.page"
      :page-size.sync="filtres.pageSize"
      :total="total"
      @tous="chargerTout"
    />

    <tirage-dialog v-model="dialogCreationOuvert" @cree="charger" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import KanbanBoard from '../components/KanbanBoard.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ChampDate from '../components/ChampDate.vue';
import TirageDialog from '../components/TirageDialog.vue';
import {
  LIBELLE_STADE_TIRAGE,
  aujourdhui,
  dateHeureLisible,
  decalerJours,
} from '../utils/libelles';
import type { StadeTirage, Tirage } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const mode = ref<'kanban' | 'liste'>('kanban');
const tirages = ref<Tirage[]>([]);
const total = ref(0);
const chargement = ref(false);
const dialogCreationOuvert = ref(false);

const filtres = ref<Record<string, any>>({
  recherche: '',
  examenId: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -30),
  dateFin: aujourdhui(),
  page: 1,
  pageSize: 50,
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const chipsFiltres = computed(() => {
  const chips: any[] = [];
  if (filtres.value.recherche) {
    chips.push({ label: `« ${filtres.value.recherche} »`, value: filtres.value.recherche, defaut: true });
  }
  return chips;
});

const ORDRES: StadeTirage[] = ['PROGRAMME', 'IMPRIME', 'MIS_SOUS_PLI', 'DISTRIBUE', 'RECUPERE', 'ANNULE'];

const colonnesTableau = computed<QTableColumn[]>(() => [
  { name: 'examen', label: 'Examen', field: 'examen', align: 'left' },
  { name: 'date', label: 'Date tirage', field: (r: Tirage) => dateHeureLisible(r.dateTirage), align: 'left' },
  { name: 'exemplaires', label: 'Exemplaires', field: 'nbExemplaires', align: 'right' },
  { name: 'empreinte', label: 'Empreinte SHA-256', field: 'empreinteSource', align: 'left' },
  { name: 'imprimeur', label: 'Imprimeur', field: (r: Tirage) => r.imprimeur ? `${r.imprimeur.prenom} ${r.imprimeur.nom}` : '—', align: 'left' },
  { name: 'stade', label: 'Stade', field: 'stade', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesKanban = computed(() => {
  return ORDRES.map((stade) => {
    const cartes = tirages.value
      .filter((t) => t.stade === stade)
      .map((t) => ({
        id: t.id,
        titre: t.examen?.codeExamen ?? '—',
        sousTitre: t.examen?.intitule ?? '',
        meta: `${t.nbExemplaires} ex. · ${dateHeureLisible(t.dateTirage)} · ${t.empreinteSource.slice(0, 12)}…`,
        badge: LIBELLE_STADE_TIRAGE[stade],
        couleur: couleurStade(stade),
        actions: actionsPourCarte(t),
      }));
    return {
      identifiant: stade,
      titre: LIBELLE_STADE_TIRAGE[stade],
      couleur: couleurStade(stade),
      cartes,
    };
  });
});

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
    {
      label: 'Bordereau',
      icone: 'print',
      couleur: 'primary',
      onClick: () => voirBordereau(t),
    },
  ];
  const suiv = transitionSuivante(t.stade);
  if (suiv) {
    acts.push({
      label: labelSuivant(t.stade),
      icone: 'arrow_forward',
      couleur: 'primary',
      onClick: () => avancer(t),
    });
  }
  return acts;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/tirage', {
      params: {
        all: '1',
        search: filtres.value.recherche || undefined,
        examenId: filtres.value.examenId || undefined,
        page: filtres.value.page,
        pageSize: filtres.value.pageSize,
      },
    });
    tirages.value = data.data;
    total.value = data.total;
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
  filtres.value = {
    recherche: '',
    examenId: null,
    dateDebut: decalerJours(aujourdhui(), -30),
    dateFin: aujourdhui(),
    page: 1,
    pageSize: 50,
  };
  charger();
}

function ouvrirCreation() {
  dialogCreationOuvert.value = true;
}

function voirBordereau(t: Tirage | null) {
  if (!t) return;
  window.open(`${API_URL}/tirage/${t.id}/imprimer-bordereau?token=${auth.token}`, '_blank');
}

async function avancer(t: Tirage) {
  const stade = transitionSuivante(t.stade);
  if (!stade) return;

  const routeSuivant =
    stade === 'IMPRIME' ? 'imprimer' :
    stade === 'MIS_SOUS_PLI' ? 'mettre-sous-pli' :
    stade === 'DISTRIBUE' ? 'distribuer' :
    'recuperer';

  const validerEtAvancer = async (empreinteSaisie?: string) => {
    let payload: any = { stade };
    if (stade === 'IMPRIME') {
      if (!empreinteSaisie) {
        $q.notify({ type: 'negative', message: 'Empreinte requise pour imprimer' });
        return;
      }
      payload = {
        ...payload,
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
      message: `Confirmer l'empreinte source avant impression (SHA-256).`,
      prompt: { model: t.empreinteSource, type: 'text' },
      cancel: true,
    }).onOk((value: string) => validerEtAvancer(value));
    return;
  }
  await validerEtAvancer();
}

function annuler(t: Tirage) {
  $q.dialog({
    title: 'Annuler le tirage',
    message: `Annuler le tirage ${t.examen?.codeExamen ?? ''} ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Annuler', unelevated: true },
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
  () => [filtres.value.recherche, filtres.value.examenId],
  () => {
    filtres.value.page = 1;
    charger();
  },
);
onMounted(charger);
</script>

<style scoped lang="scss">
.empreinte-courte {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
