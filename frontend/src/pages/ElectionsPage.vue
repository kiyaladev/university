<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ElectionDialog from '../components/ElectionDialog.vue';
import CandidatDialog from '../components/CandidatDialog.vue';
import {
  CLASSE_STATUT_ELECTION,
  LIBELLE_STATUT_ELECTION,
  LIBELLE_TYPE_ELECTION,
  OPTIONS_TYPE_ELECTION,
  dateHeureElection,
  electionsService,
  messageErreurElection,
} from '../services/elections';
import type { CandidatElection, Election, ResultatElection, StatutElection, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<StatutElection>('BROUILLON');

const elections = ref<Election[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEditer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
/** L'administrateur est aussi un électeur : il retrouve l'urne depuis ici. */
const peutVoter = computed(() => auth.aRole(['ADMIN']));

const ONGLETS: Array<{ statut: StatutElection; label: string; icone: string }> = [
  { statut: 'BROUILLON', label: 'Brouillons', icone: 'edit_note' },
  { statut: 'OUVERTE', label: 'Ouvertes', icone: 'how_to_vote' },
  { statut: 'CLOSE', label: 'Closes', icone: 'lock' },
  { statut: 'PROCLAMEE', label: 'Proclamées', icone: 'emoji_events' },
  { statut: 'ANNULEE', label: 'Annulées', icone: 'block' },
];

const colonnes: QTableColumn[] = [
  { name: 'titre', label: 'Titre', field: 'titre', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'periode', label: 'Période', field: 'dateOuverture', align: 'left' },
  { name: 'sieges', label: 'Sièges', field: 'nbSieges', align: 'center' },
  { name: 'candidats', label: 'Candidats', field: '_count', align: 'center' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
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
const chargementResultats = ref(false);
const electionResultats = ref<Election | null>(null);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.type) {
    cs.push({
      label: `Type : ${LIBELLE_TYPE_ELECTION[filtres.value.type] ?? filtres.value.type}`,
      value: filtres.value.type,
      icone: 'category',
    });
  }
  return cs;
});

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

function supprimerCandidat(c: CandidatElection) {
  const election = electionCandidats.value;
  if (!election) return;
  $q.dialog({
    title: 'Retirer ce candidat',
    message: `Retirer ${c.prenom} ${c.nom} de la liste des candidats ?`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { label: 'Retirer', color: 'negative', unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await electionsService.supprimerCandidat(election.id, c.id);
      candidatsListe.value = candidatsListe.value.filter((x) => x.id !== c.id);
      $q.notify({ type: 'positive', message: 'Candidat retiré.' });
    } catch (e) {
      $q.notify({ type: 'negative', message: messageErreurElection(e, 'Suppression impossible.') });
    }
  });
}

async function ouvrirResultats(e: Election) {
  electionResultats.value = e;
  resultats.value = null;
  chargementResultats.value = true;
  dialogResultats.value = true;
  try {
    const { data } = await electionsService.resultats(e.id);
    resultats.value = data;
  } catch (err) {
    $q.notify({ type: 'negative', message: messageErreurElection(err, 'Résultats indisponibles.') });
  } finally {
    chargementResultats.value = false;
  }
}

type ActionTransition = 'ouvrir' | 'clore' | 'proclamer';

const TRANSITIONS: Record<
  ActionTransition,
  { titre: string; message: string; bouton: string; couleur: string; succes: string }
> = {
  ouvrir: {
    titre: 'Ouvrir le scrutin',
    message:
      'Le scrutin devient accessible aux électeurs et la liste des candidats se fige. Continuer ?',
    bouton: 'Ouvrir',
    couleur: 'primary',
    succes: 'Scrutin ouvert.',
  },
  clore: {
    titre: 'Clore le scrutin',
    message: 'Plus aucun bulletin ne sera accepté après la clôture. Continuer ?',
    bouton: 'Clore',
    couleur: 'primary',
    succes: 'Scrutin clos.',
  },
  proclamer: {
    titre: 'Proclamer les résultats',
    message:
      'Cette action est irréversible : les résultats deviennent officiels, figés et visibles des électeurs. Continuer ?',
    bouton: 'Proclamer',
    couleur: 'amber-8',
    succes: 'Résultats proclamés.',
  },
};

function transition(id: string, action: ActionTransition) {
  const t = TRANSITIONS[action];
  $q.dialog({
    title: t.titre,
    message: t.message,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { label: t.bouton, color: t.couleur, unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await electionsService.transition(id, action);
      $q.notify({ type: 'positive', message: t.succes });
      await charger();
    } catch (e) {
      $q.notify({ type: 'negative', message: messageErreurElection(e, 'Transition impossible.') });
    }
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await electionsService.liste({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      statut: onglet.value,
      ...(filtres.value.type ? { type: filtres.value.type } : {}),
      ...(filtres.value.recherche ? { search: filtres.value.recherche } : {}),
    });
    elections.value = data.data;
    pagination.value.total = data.total;
  } catch (e) {
    $q.notify({ type: 'negative', message: messageErreurElection(e, 'Chargement impossible.') });
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function reinitialiser() {
  filtres.value = { recherche: '' };
  recharger();
}

/** Bulletin papier A4 : le jeton passe en URL, l'onglet neuf n'a pas d'en-tête. */
function imprimerBulletin(e: Election) {
  const url = `${API_URL}/elections/${e.id}/imprimer-bulletin?token=${auth.token}`;
  if (!window.open(url, '_blank')) {
    $q.notify({
      type: 'warning',
      message: 'Autorisez les fenêtres contextuelles pour ouvrir le bulletin.',
    });
  }
}

function nbCandidats(e: Election): number {
  return e._count?.candidats ?? e.candidats?.length ?? 0;
}

watch(onglet, () => recharger());
watch(() => [filtres.value.recherche, filtres.value.type], () => recharger());
onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Élections</div>
        <div class="page-sous-titre">
          Scrutins des délégués et représentants : déclaration des candidats, ouverture du vote,
          clôture puis proclamation officielle des résultats.
        </div>
      </div>
      <div class="col-auto row q-gutter-sm items-center">
        <q-btn
          v-if="peutVoter"
          flat
          no-caps
          icon="how_to_vote"
          label="Voter"
          to="/elections/vote"
        >
          <q-tooltip>Accéder à l’urne en tant qu’électeur</q-tooltip>
        </q-btn>
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

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau q-mb-md">
      <q-tab
        v-for="o in ONGLETS"
        :key="o.statut"
        :name="o.statut"
        :label="o.label"
        :icon="o.icone"
        no-caps
      />
    </q-tabs>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (titre, description)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE_ELECTION"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Type de scrutin"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="elections"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m: string) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

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
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="how_to_vote" size="36px" color="grey-7" />
          <span class="pochoir">
            Aucune élection {{ LIBELLE_STATUT_ELECTION[onglet].toLowerCase() }} pour ces critères.
          </span>
        </div>
      </template>

      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE_ELECTION[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-periode="p">
        <q-td :props="p">
          {{ dateHeureElection(p.row.dateOuverture) }} → {{ dateHeureElection(p.row.dateCloture) }}
        </q-td>
      </template>
      <template #body-cell-candidats="p">
        <q-td :props="p" class="chiffres">{{ nbCandidats(p.row) }}</q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-statut" :class="CLASSE_STATUT_ELECTION[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT_ELECTION[p.row.statut] }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            round
            dense
            icon="print"
            aria-label="Imprimer un bulletin"
            @click="imprimerBulletin(p.row)"
          >
            <q-tooltip>Imprimer un bulletin</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="edit"
            aria-label="Modifier l’élection"
            @click="ouvrirEdition(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'BROUILLON'"
            flat
            round
            dense
            icon="how_to_vote"
            color="positive"
            aria-label="Ouvrir le scrutin"
            @click="transition(p.row.id, 'ouvrir')"
          >
            <q-tooltip>Ouvrir le scrutin</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'OUVERTE'"
            flat
            round
            dense
            icon="lock"
            aria-label="Clore le scrutin"
            @click="transition(p.row.id, 'clore')"
          >
            <q-tooltip>Clore le scrutin</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutEditer && p.row.statut === 'CLOSE'"
            flat
            round
            dense
            icon="emoji_events"
            color="amber-8"
            aria-label="Proclamer les résultats"
            @click="transition(p.row.id, 'proclamer')"
          >
            <q-tooltip>Proclamer les résultats</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="groups"
            aria-label="Voir les candidats"
            @click="ouvrirCandidats(p.row)"
          >
            <q-tooltip>Candidats</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="bar_chart"
            aria-label="Voir les résultats"
            @click="ouvrirResultats(p.row)"
          >
            <q-tooltip>Résultats</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <template v-else>
      <div v-if="chargement && !elections.length" class="etat-vide">
        <q-spinner color="primary" size="28px" />
        <span class="pochoir">Chargement des élections…</span>
      </div>
      <div v-else-if="elections.length" class="row q-col-gutter-md">
        <div v-for="e in elections" :key="e.id" class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered class="carte election-carte">
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <span class="champ champ-statut" :class="CLASSE_STATUT_ELECTION[e.statut]">
                  <span class="pochoir">{{ LIBELLE_STATUT_ELECTION[e.statut] }}</span>
                </span>
                <q-chip dense square outline color="primary">
                  {{ LIBELLE_TYPE_ELECTION[e.type] ?? e.type }}
                </q-chip>
              </div>
              <div class="text-h6 q-mt-sm">{{ e.titre }}</div>
              <div class="text-caption text-grey-7">
                Du {{ dateHeureElection(e.dateOuverture) }}<br>
                au {{ dateHeureElection(e.dateCloture) }}
              </div>
              <div class="row q-mt-sm items-center">
                <q-icon name="how_to_vote" size="16px" class="q-mr-xs" />
                <span class="text-caption">
                  {{ e.nbSieges }} siège{{ e.nbSieges > 1 ? 's' : '' }}
                </span>
                <q-space />
                <q-icon name="groups" size="16px" class="q-mr-xs" />
                <span class="text-caption">
                  {{ nbCandidats(e) }} candidat{{ nbCandidats(e) > 1 ? 's' : '' }}
                </span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right" class="q-gutter-x-xs">
              <q-btn flat dense no-caps icon="print" label="Bulletin" @click="imprimerBulletin(e)" />
              <q-btn
                v-if="peutEditer && e.statut === 'BROUILLON'"
                flat
                dense
                no-caps
                icon="edit"
                label="Modifier"
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
      <div v-else-if="!chargement" class="etat-vide">
        <q-icon name="how_to_vote" size="36px" color="grey-7" />
        <span class="pochoir">
          Aucune élection {{ LIBELLE_STATUT_ELECTION[onglet].toLowerCase() }} pour ces critères.
        </span>
      </div>
    </template>

    <pagination-bar
      v-if="elections.length"
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="(v) => { pagination.page = v; charger(); }"
      @update:page-size="(v) => { pagination.pageSize = v; pagination.page = 1; charger(); }"
    />

    <election-dialog v-model="dialogEdition" :election="electionEnEdition" @enregistre="charger" />

    <q-dialog v-model="dialogCandidats">
      <q-card style="min-width: 640px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Candidats — {{ electionCandidats?.titre }}</div>
          <q-space />
          <q-btn flat round dense icon="close" aria-label="Fermer" @click="dialogCandidats = false" />
        </q-card-section>
        <q-card-section>
          <q-banner v-if="electionCandidats?.statut !== 'BROUILLON'" class="note--alerte q-mb-md">
            <template #avatar><q-icon name="lock" /></template>
            Le scrutin est
            {{ LIBELLE_STATUT_ELECTION[electionCandidats?.statut ?? 'BROUILLON'].toLowerCase() }} :
            la liste des candidats n’est plus modifiable.
          </q-banner>

          <div v-if="!candidatsListe.length" class="etat-vide">
            <q-icon name="groups" size="36px" color="grey-7" />
            <span class="pochoir">
              Aucun candidat déclaré. Un scrutin sans candidat ne peut pas être ouvert.
            </span>
          </div>

          <q-list v-else bordered separator>
            <q-item v-for="c in candidatsListe" :key="c.id">
              <q-item-section avatar>
                <q-avatar>
                  <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.prenom} ${c.nom}`">
                  <q-icon v-else name="person" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label><strong>{{ c.prenom }} {{ c.nom }}</strong></q-item-label>
                <q-item-label caption>
                  N° {{ c.ordre }} sur le bulletin
                  <span v-if="c.etudiant"> · étudiant {{ c.etudiant.matricule }}</span>
                  <span v-if="c.enseignant"> · enseignant {{ c.enseignant.matricule }}</span>
                </q-item-label>
              </q-item-section>
              <q-item-section v-if="electionCandidats?.statut === 'BROUILLON' && peutEditer" side>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="negative"
                  :aria-label="`Retirer ${c.prenom} ${c.nom}`"
                  @click="supprimerCandidat(c)"
                >
                  <q-tooltip>Retirer ce candidat</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Fermer" @click="dialogCandidats = false" />
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
      @enregistre="(c) => {
        const idx = candidatsListe.findIndex((x) => x.id === c.id);
        if (idx >= 0) candidatsListe.splice(idx, 1, c);
        else candidatsListe.push(c);
      }"
    />

    <q-dialog v-model="dialogResultats">
      <q-card style="min-width: 560px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Résultats — {{ electionResultats?.titre }}</div>
          <q-space />
          <q-btn flat round dense icon="close" aria-label="Fermer" @click="dialogResultats = false" />
        </q-card-section>

        <q-card-section v-if="chargementResultats" class="etat-vide">
          <q-spinner color="primary" size="28px" />
          <span class="pochoir">Dépouillement en cours…</span>
        </q-card-section>

        <q-card-section v-else-if="!resultats" class="etat-vide">
          <q-icon name="bar_chart" size="36px" color="grey-7" />
          <span class="pochoir">Résultats indisponibles pour ce scrutin.</span>
        </q-card-section>

        <q-card-section v-else>
          <q-banner v-if="electionResultats?.statut !== 'PROCLAMEE'" class="note--alerte q-mb-md">
            <template #avatar><q-icon name="visibility_off" /></template>
            Résultats provisoires : ils ne deviennent officiels qu’à la proclamation.
          </q-banner>
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-4">
              <div class="text-caption text-grey-7">Bulletins</div>
              <div class="text-h6 chiffres">{{ resultats.participation.nbBulletins }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">Voix exprimées</div>
              <div class="text-h6 chiffres">{{ resultats.participation.voixTotales }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">Sièges à pourvoir</div>
              <div class="text-h6 chiffres">{{ resultats.participation.siegesPourvoir }}</div>
            </div>
          </div>
          <q-list bordered separator>
            <q-item v-for="c in resultats.candidats" :key="c.id">
              <q-item-section avatar>
                <q-avatar :color="c.elu ? 'amber-8' : 'grey-4'" text-color="white">
                  <q-icon v-if="c.elu" name="emoji_events" />
                  <span v-else class="chiffres">{{ c.ordre }}</span>
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <strong>{{ c.prenom }} {{ c.nom }}</strong>
                  <q-chip v-if="c.elu" dense square color="amber-8" text-color="white" class="q-ml-sm">
                    Élu
                  </q-chip>
                </q-item-label>
                <q-item-label caption class="chiffres">{{ c.voix }} voix</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped lang="scss">
// Pas d'arrondi : une élection est une plaque du panneau comme les autres.
.election-carte { height: 100%; }

.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }
.badge--neutre { background: #eef0f4; color: #455a64; }
.badge--attention { background: #fff4e0; color: #8a5300; }
.badge--primaire { background: #e8eef5; color: #0d47a1; }

</style>
