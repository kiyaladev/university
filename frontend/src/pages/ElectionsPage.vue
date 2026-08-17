<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ElectionDialog from '../components/ElectionDialog.vue';
import CandidatDialog from '../components/CandidatDialog.vue';
import type { CandidatElection, Election, ResultatElection, StatutElection, TypeElection } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<StatutElection>('BROUILLON');

const elections = ref<Election[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEditer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const OPTIONS_TYPE: Array<{ value: TypeElection; label: string }> = [
  { value: 'DELEGUE_PROMOTION', label: 'Délégué de promotion' },
  { value: 'DELEGUE_DEPARTEMENT', label: 'Délégué de département' },
  { value: 'PRESIDENT_UNIVERSITE', label: 'Président d\'université' },
  { value: 'SYNDICAT', label: 'Syndicat' },
  { value: 'CLUB', label: 'Club' },
];
const LIBELLE_TYPE: Record<string, string> = Object.fromEntries(OPTIONS_TYPE.map((o) => [o.value, o.label]));

const LIBELLE_STATUT: Record<StatutElection, string> = {
  BROUILLON: 'Brouillon',
  OUVERTE: 'Ouverte',
  CLOSE: 'Close',
  PROCLAMEE: 'Proclamée',
  ANNULEE: 'Annulée',
};
const CLASSE_STATUT: Record<StatutElection, string> = {
  BROUILLON: 'badge--neutre',
  OUVERTE: 'badge--ok',
  CLOSE: 'badge--attention',
  PROCLAMEE: 'badge--primaire',
  ANNULEE: 'badge--ko',
};

const colonnes: QTableColumn[] = [
  { name: 'titre', label: 'Titre', field: 'titre', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'periode', label: 'Période', field: 'dateOuverture', align: 'left' },
  { name: 'sieges', label: 'Sièges', field: 'nbSieges', align: 'center' },
  { name: 'candidats', label: 'Candidats', field: '_count', align: 'center' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const dialogEdition = ref(false);
const electionEnEdition = ref<Election | null>(null);

const dialogCandidats = ref(false);
const electionCandidats = ref<Election | null>(null);
const candidatsListe = ref<CandidatElection[]>([]);
const dialogCandidat = ref(false);
const candidatEnEdition = ref<CandidatElection | null>(null);

const dialogResultats = ref(false);
const resultats = ref<ResultatElection | null>(null);
const electionResultats = ref<Election | null>(null);

function ouvrirEdition(e?: Election) {
  electionEnEdition.value = e ?? null;
  dialogEdition.value = true;
}

function ouvrirCandidats(e: Election) {
  electionCandidats.value = e;
  candidatsListe.value = e.candidats ?? [];
  dialogCandidats.value = true;
}

function ouvrirCandidat(c?: CandidatElection) {
  if (!electionCandidats.value) return;
  candidatEnEdition.value = c ?? null;
  dialogCandidat.value = true;
}

async function supprimerCandidat(c: CandidatElection) {
  if (!electionCandidats.value) return;
  $q.dialog({
    title: 'Retirer ce candidat',
    message: `Retirer ${c.prenom} ${c.nom} de la liste ?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/elections/${electionCandidats.value!.id}/candidats/${c.id}`);
      candidatsListe.value = candidatsListe.value.filter((x) => x.id !== c.id);
      $q.notify({ type: 'positive', message: 'Candidat retiré.' });
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Suppression impossible.' });
    }
  });
}

async function ouvrirResultats(e: Election) {
  electionResultats.value = e;
  resultats.value = null;
  dialogResultats.value = true;
  try {
    const { data } = await api.get(`/elections/${e.id}/resultats`);
    resultats.value = data;
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Résultats indisponibles.' });
  }
}

async function transition(id: string, action: 'ouvrir' | 'clore' | 'proclamer') {
  try {
    await api.post(`/elections/${id}/${action}`);
    $q.notify({ type: 'positive', message: `Élection ${action === 'ouvrir' ? 'ouverte' : action === 'clore' ? 'close' : 'proclamée'}.` });
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Transition impossible.' });
  }
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      statut: onglet.value,
    };
    if (filtres.value.recherche) params.search = filtres.value.recherche;
    const { data } = await api.get('/elections', { params });
    elections.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function changerOnglet(o: StatutElection) {
  onglet.value = o;
  recharger();
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR');
}

function dateHeureFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function imprimerBulletin(e: Election) {
  window.open(`${API_URL}/elections/${e.id}/imprimer-bulletin?token=${auth.token}`, '_blank');
}

watch(onglet, () => recharger());
onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Élections & délégués</div>
        <div class="page-sous-titre">
          Plateforme des élections universitaires : déclaration, scrutin, proclamation.
        </div>
      </div>
      <div class="col-auto">
        <view-toggle
          cle="elections"
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
          label="Nouvelle élection"
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
      <q-tab name="BROUILLON" label="Brouillon" icon="edit_note" />
      <q-tab name="OUVERTE" label="Ouvertes" icon="how_to_vote" />
      <q-tab name="CLOSE" label="Closes" icon="lock" />
      <q-tab name="PROCLAMEE" label="Proclamées" icon="emoji_events" />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      placeholder="Titre, description…"
      @update:model-value="recharger"
    />

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
      :rows="elections"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-periode="p">
        <q-td :props="p">
          {{ dateHeureFr(p.row.dateOuverture) }} → {{ dateHeureFr(p.row.dateCloture) }}
        </q-td>
      </template>
      <template #body-cell-candidats="p">
        <q-td :props="p">{{ p.row._count?.candidats ?? (p.row.candidats?.length ?? 0) }}</q-td>
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
          <q-btn flat round dense icon="print" @click="imprimerBulletin(p.row)" />
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="edit"
            @click="ouvrirEdition(p.row)"
          />
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="how_to_vote"
            color="positive"
            @click="transition(p.row.id, 'ouvrir')"
          />
          <q-btn
            v-if="peutEditer && p.row.statut === 'OUVERTE'"
            flat
            round
            dense
            icon="lock"
            @click="transition(p.row.id, 'clore')"
          />
          <q-btn
            v-if="peutEditer && p.row.statut === 'CLOSE'"
            flat
            round
            dense
            icon="emoji_events"
            color="amber-8"
            @click="transition(p.row.id, 'proclamer')"
          />
          <q-btn flat round dense icon="groups" @click="ouvrirCandidats(p.row)" />
          <q-btn flat round dense icon="bar_chart" @click="ouvrirResultats(p.row)" />
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="e in elections" :key="e.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="election-carte">
          <q-card-section>
            <div class="row items-center q-gutter-sm">
              <span class="champ champ-statut" :class="CLASSE_STATUT[e.statut]">
                <span class="pochoir">{{ LIBELLE_STATUT[e.statut] }}</span>
              </span>
              <q-chip dense outline color="primary">
                {{ LIBELLE_TYPE[e.type] ?? e.type }}
              </q-chip>
            </div>
            <div class="text-weight-bold text-h6 q-mt-sm">{{ e.titre }}</div>
            <div class="text-caption text-grey-7">
              Du {{ dateHeureFr(e.dateOuverture) }}<br>
              au {{ dateHeureFr(e.dateCloture) }}
            </div>
            <div class="row q-mt-sm items-center">
              <q-icon name="how_to_vote" size="16px" class="q-mr-xs" />
              <span class="text-caption">{{ e.nbSieges }} siège(s)</span>
              <q-space />
              <q-icon name="groups" size="16px" class="q-mr-xs" />
              <span class="text-caption">
                {{ e._count?.candidats ?? (e.candidats?.length ?? 0) }} candidat(s)
              </span>
            </div>
          </q-card-section>
          <q-card-actions align="right" class="q-gutter-x-xs">
            <q-btn flat dense icon="print" no-caps @click="imprimerBulletin(e)" />
            <q-btn
              v-if="peutEditer && e.statut === 'BROUILLON'"
              flat
              dense
              icon="edit"
              no-caps
              @click="ouvrirEdition(e)"
            />
            <q-btn
              v-if="peutEditer && e.statut === 'BROUILLON'"
              flat
              dense
              color="positive"
              icon="how_to_vote"
              no-caps
              label="Ouvrir"
              @click="transition(e.id, 'ouvrir')"
            />
            <q-btn
              v-if="peutEditer && e.statut === 'OUVERTE'"
              flat
              dense
              icon="lock"
              no-caps
              label="Clore"
              @click="transition(e.id, 'clore')"
            />
            <q-btn
              v-if="peutEditer && e.statut === 'CLOSE'"
              flat
              dense
              color="amber-8"
              icon="emoji_events"
              no-caps
              label="Proclamer"
              @click="transition(e.id, 'proclamer')"
            />
            <q-btn flat dense icon="groups" no-caps label="Candidats" @click="ouvrirCandidats(e)" />
            <q-btn flat dense icon="bar_chart" no-caps label="Résultats" @click="ouvrirResultats(e)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <election-dialog v-model="dialogEdition" :election="electionEnEdition" @enregistre="charger" />

    <q-dialog v-model="dialogCandidats">
      <q-card style="min-width: 640px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Candidats — {{ electionCandidats?.titre }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogCandidats = false" />
        </q-card-section>
        <q-card-section>
          <q-banner v-if="electionCandidats?.statut !== 'BROUILLON'" class="bg-orange-1 text-orange-10 q-mb-md">
            Le scrutin est {{ LIBELLE_STATUT[electionCandidats?.statut ?? 'BROUILLON'] }} : la liste
            des candidats n'est plus modifiable.
          </q-banner>
          <q-list bordered separator>
            <q-item v-for="c in candidatsListe" :key="c.id">
              <q-item-section avatar>
                <q-avatar>
                  <img v-if="c.photoUrl" :src="c.photoUrl" />
                  <q-icon v-else name="person" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label><strong>{{ c.prenom }} {{ c.nom }}</strong></q-item-label>
                <q-item-label caption>
                  Ordre {{ c.ordre }}
                  <span v-if="c.etudiant"> · Étudiant {{ c.etudiant.matricule }}</span>
                  <span v-if="c.enseignant"> · Enseignant {{ c.enseignant.matricule }}</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side v-if="electionCandidats?.statut === 'BROUILLON' && peutEditer">
                <q-btn flat round dense icon="delete" color="negative" @click="supprimerCandidat(c)" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-space />
          <q-btn
            v-if="electionCandidats?.statut === 'BROUILLON' && peutEditer"
            unelevated
            color="primary"
            icon="add"
            label="Ajouter un candidat"
            no-caps
            @click="ouvrirCandidat()"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <candidat-dialog
      v-if="electionCandidats"
      v-model="dialogCandidat"
      :election="electionCandidats"
      :candidat="candidatEnEdition"
      @enregistre="(c) => candidatsListe = [...candidatsListe, c]"
    />

    <q-dialog v-model="dialogResultats">
      <q-card style="min-width: 560px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Résultats — {{ electionResultats?.titre }}</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogResultats = false" />
        </q-card-section>
        <q-card-section v-if="resultats">
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-4">
              <div class="text-caption text-grey-7">Bulletins</div>
              <div class="text-h6">{{ resultats.participation.nbBulletins }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">Voix exprimées</div>
              <div class="text-h6">{{ resultats.participation.voixTotales }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">Sièges à pourvoir</div>
              <div class="text-h6">{{ resultats.participation.siegesPourvoir }}</div>
            </div>
          </div>
          <q-list bordered separator>
            <q-item v-for="c in resultats.candidats" :key="c.id">
              <q-item-section avatar>
                <q-avatar :color="c.elu ? 'amber-7' : 'grey-3'" text-color="white">
                  <q-icon v-if="c.elu" name="emoji_events" />
                  <span v-else>{{ c.ordre }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <strong>{{ c.prenom }} {{ c.nom }}</strong>
                  <q-chip v-if="c.elu" dense color="amber-7" text-color="white" class="q-ml-sm">Élu</q-chip>
                </q-item-label>
                <q-item-label caption>{{ c.voix }} voix</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.election-carte {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  height: 100%;
}
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }
.badge--neutre { background: #eef0f4; color: #455a64; }
.badge--attention { background: #fff4e0; color: #8a5300; }
.badge--primaire { background: #e8eef5; color: #0d47a1; }
</style>