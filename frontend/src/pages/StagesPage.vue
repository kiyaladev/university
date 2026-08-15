<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Stages &amp; mémoires</div>
        <div class="page-sous-titre">
          Sujet proposé → validé → encadré → rapport rendu → soutenu. Suivi tenu par la
          scolarité et la direction ; l'enseignant pilote ses encadrements, l'étudiant
          ses travaux (via le portail).
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouveau travail"
          @click="ouvrirCreation"
        />
      </div>
    </div>

    <!-- Compteurs par statut -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div
        v-for="c in compteurs"
        :key="c.statut"
        class="col-6 col-sm-4 col-lg-2"
      >
        <q-card
          flat
          bordered
          class="carte carte-compteur"
          :class="{ 'carte-compteur--actif': filtres.statut === c.statut }"
          @click="basculerStatut(c.statut)"
        >
          <q-card-section class="text-center q-py-sm">
            <div class="text-h5 q-mb-none">{{ c.nb }}</div>
            <div class="text-caption text-grey-7">{{ c.label }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm">
        <div class="col-12 col-md-4">
          <q-input
            v-model="recherche"
            dense
            outlined
            clearable
            debounce="300"
            placeholder="Intitulé, entreprise, lieu…"
            @update:model-value="charger"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </div>
        <div class="col-6 col-md-2">
          <q-select
            v-model="filtres.type"
            :options="optionsTypes"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Type"
            @update:model-value="charger"
          />
        </div>
        <div class="col-6 col-md-2">
          <q-select
            v-model="filtres.encadrantId"
            :options="optionsEncadrants"
            outlined
            dense
            clearable
            emit-value
            map-options
            use-input
            input-debounce="300"
            label="Encadrant"
            :disable="auth.role === 'ENSEIGNANT'"
            @filter="filtrerEncadrants"
          />
        </div>
        <div class="col-12 col-md-4 text-right">
          <q-btn
            v-if="peutCreer"
            flat
            dense
            no-caps
            :label="`Soutenances à venir (${soutenancesAVenir.length})`"
            icon="event"
            @click="dialogCalendrier = true"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-table
      flat
      bordered
      class="carte"
      :rows="lignesVisibles"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #body-cell-intitule="p">
        <q-td :props="p">
          <div class="text-weight-medium">
            {{ LIBELLE_TYPE_ENCADREMENT[p.row.type] }} — {{ p.row.intitule }}
          </div>
          <div v-if="p.row.entreprise" class="text-caption text-grey-7">
            {{ p.row.entreprise }}
          </div>
        </q-td>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule ?? '' }}</div>
        </q-td>
      </template>

      <template #body-cell-encadrant="p">
        <q-td :props="p">
          <span v-if="p.row.encadrant">{{ p.row.encadrant.nom }} {{ p.row.encadrant.prenom }}</span>
          <span v-else class="text-grey-6">À désigner</span>
        </q-td>
      </template>

      <template #body-cell-periode="p">
        <q-td :props="p">
          <span v-if="p.row.dateDebut || p.row.dateFin">
            {{ dateLisible(p.row.dateDebut) }} → {{ dateLisible(p.row.dateFin) }}
          </span>
          <span v-else class="text-grey-6">—</span>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-chip :color="couleurStatut(p.row.statut)" text-color="white" dense square>
            {{ LIBELLE_STATUT_ENCADREMENT[p.row.statut] ?? p.row.statut }}
          </q-chip>
        </q-td>
      </template>

      <template #body-cell-rapport="p">
        <q-td :props="p" class="text-center">
          <q-toggle
            :model-value="p.row.rapportRendu"
            color="positive"
            :disable="
              ['SOUTENU', 'ABANDONNE'].includes(p.row.statut) || !peutModifierRapport(p.row)
            "
            @update:model-value="(v: boolean) => basculerRapport(p.row, v)"
          />
          <div class="text-caption text-grey-7">
            {{ p.row.rapportRendu ? 'Rendu' : 'En attente' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-soutenance="p">
        <q-td :props="p">
          <template v-if="p.row.soutenance">
            <div>{{ dateHeureLisible(p.row.soutenance.date) }}</div>
            <div class="text-caption text-grey-7">
              <template v-if="p.row.soutenance.note !== null">
                {{ p.row.soutenance.note }}/20<template v-if="p.row.soutenance.mention"> · {{ p.row.soutenance.mention }}</template>
              </template>
              <span v-else>Constat en attente</span>
            </div>
          </template>
          <span v-else class="text-grey-6">—</span>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" @click="detail = p.row">
            <q-tooltip>Voir la fiche</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
            flat
            dense
            round
            icon="edit"
            @click="ouvrirEdition(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="print" @click="imprimer(p.row)">
            <q-tooltip>Imprimer la fiche récapitulative</q-tooltip>
          </q-btn>

          <template v-if="boutonsTransition(p.row).length">
            <q-btn
              v-for="b in boutonsTransition(p.row)"
              :key="b.statut"
              flat
              dense
              round
              :color="b.couleur"
              :icon="b.icone"
              @click="transition(p.row, b.statut)"
            >
              <q-tooltip>{{ b.libelle }}</q-tooltip>
            </q-btn>
          </template>

          <q-btn
            v-if="peutPlanifierSoutenance(p.row)"
            flat
            dense
            round
            color="primary"
            icon="groups"
            @click="ouvrirSoutenance(p.row)"
          >
            <q-tooltip>Planifier la soutenance</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutConstatJury(p.row)"
            flat
            dense
            round
            color="deep-purple"
            icon="fact_check"
            @click="ouvrirJury(p.row)"
          >
            <q-tooltip>Constat du jury</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
            flat
            dense
            round
            color="negative"
            icon="delete"
            @click="supprimer(p.row)"
          >
            <q-tooltip>Supprimer le dossier (PROPOSE / VALIDE)</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Dialog création / édition -->
    <travail-dialog v-model="dialogTravail" :travail="travailEdite" @enregistre="charger" />

    <!-- Dialog soutenance (planification ou constat du jury) -->
    <soutenance-dialog
      v-if="travailSoutenance"
      v-model="dialogSoutenance"
      :travail="travailSoutenance"
      :mode="modeSoutenance"
      @enregistre="charger"
    />

    <!-- Calendrier des soutenances à venir -->
    <q-dialog v-model="dialogCalendrier">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">Soutenances des 7 prochains jours</q-card-section>
        <q-card-section v-if="!soutenancesAVenir.length" class="text-grey-7">
          Aucune soutenance planifiée sur la semaine.
        </q-card-section>
        <q-list dense v-else>
          <q-item v-for="s in soutenancesAVenir" :key="s.id">
            <q-item-section>
              <q-item-label>
                {{ dateHeureLisible(s.date) }}
                <span class="text-grey-7">
                  · {{ s.salle ? `${s.salle.nom} (${s.salle.code})` : 'salle à fixer' }}
                </span>
              </q-item-label>
              <q-item-label caption>
                {{ s.travailEncadre?.intitule }} — {{ s.travailEncadre?.etudiant?.nom }}
                {{ s.travailEncadre?.etudiant?.prenom }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip v-if="s.president" size="sm" color="secondary" text-color="white" square>
                {{ s.president.nom }} {{ s.president.prenom }}
              </q-chip>
            </q-item-section>
          </q-item>
        </q-list>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Détail -->
    <q-dialog :model-value="!!detail" @update:model-value="detail = null">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">Travail encadré</q-card-section>
        <q-card-section v-if="detail">
          <q-list dense>
            <q-item>
              <q-item-section>Type</q-item-section>
              <q-item-section side>{{ LIBELLE_TYPE_ENCADREMENT[detail.type] }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <span class="text-weight-medium">{{ detail.intitule }}</span>
                <span v-if="detail.description" class="text-caption text-grey-7">
                  {{ detail.description }}
                </span>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Étudiant</q-item-section>
              <q-item-section side>
                {{ detail.etudiant?.nom }} {{ detail.etudiant?.prenom }}
                ({{ detail.etudiant?.matricule }})
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Encadrant</q-item-section>
              <q-item-section side>
                {{ detail.encadrant ? `${detail.encadrant.nom} ${detail.encadrant.prenom}` : 'À désigner' }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Entreprise</q-item-section>
              <q-item-section side>{{ detail.entreprise ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Tuteur entreprise</q-item-section>
              <q-item-section side>{{ detail.tuteurEntreprise ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Lieu</q-item-section>
              <q-item-section side>{{ detail.lieu ?? '—' }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Période</q-item-section>
              <q-item-section side>
                {{ dateLisible(detail.dateDebut) }} → {{ dateLisible(detail.dateFin) }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Rapport rendu</q-item-section>
              <q-item-section side>{{ detail.rapportRendu ? 'Oui' : 'Non' }}</q-item-section>
            </q-item>
            <q-item v-if="detail.soutenance">
              <q-item-section>Soutenance</q-item-section>
              <q-item-section side>
                {{ dateHeureLisible(detail.soutenance.date) }}
                <template v-if="detail.soutenance.note !== null">
                  · {{ detail.soutenance.note }}/20
                  <template v-if="detail.soutenance.mention"> · {{ detail.soutenance.mention }}</template>
                </template>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Statut</q-item-section>
              <q-item-section side>
                <q-chip :color="couleurStatut(detail.statut)" text-color="white" dense square>
                  {{ LIBELLE_STATUT_ENCADREMENT[detail.statut] }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import SoutenanceDialog from '../components/SoutenanceDialog.vue';
import TravailDialog from '../components/TravailDialog.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { API_URL, api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import {
  LIBELLE_STATUT_ENCADREMENT,
  LIBELLE_TYPE_ENCADREMENT,
  dateHeureLisible,
  dateLisible,
} from '../utils/libelles';
import type {
  Enseignant,
  Soutenance,
  StatutEncadrement,
  TravailEncadre,
  TypeEncadrement,
} from '../types';

const $q = useQuasar();
const auth = useAuthStore();

/** Le calendrier embarque le travail complet ; le type partagé ne le porte pas. */
type SoutenanceCalendrier = Soutenance & { travailEncadre?: TravailEncadre };

const travaux = ref<TravailEncadre[]>([]);
const soutenancesAVenir = ref<SoutenanceCalendrier[]>([]);
const chargement = ref(false);
const recherche = ref('');
const detail = ref<TravailEncadre | null>(null);
const filtres = ref({
  type: null as TypeEncadrement | null,
  statut: null as StatutEncadrement | null,
  encadrantId: null as string | null,
});

const dialogTravail = ref(false);
const travailEdite = ref<TravailEncadre | null>(null);
const dialogSoutenance = ref(false);
const travailSoutenance = ref<TravailEncadre | null>(null);
const modeSoutenance = ref<'planifier' | 'jury'>('planifier');
const dialogCalendrier = ref(false);

const encadrantsTous = ref<Enseignant[]>([]);
const optionsEncadrants = ref<{ label: string; value: string }[]>([]);

const optionsTypes = [
  { label: 'Mémoire', value: 'MEMOIRE' },
  { label: 'Stage', value: 'STAGE' },
  { label: 'Rapport', value: 'RAPPORT' },
];

interface BoutonTransition {
  statut: StatutEncadrement;
  libelle: string;
  icone: string;
  couleur: string;
  role?: string[];
}

/** Boutons proposés depuis l'état courant — réplique front de la machine à états. */
const BOUTONS_PAR_STATUT: Record<StatutEncadrement, BoutonTransition[]> = {
  PROPOSE: [
    { statut: 'VALIDE', libelle: 'Valider (un encadrant doit être désigné)', icone: 'check', couleur: 'positive' },
    { statut: 'ABANDONNE', libelle: 'Abandonner le travail', icone: 'flag', couleur: 'negative' },
  ],
  VALIDE: [
    { statut: 'EN_COURS', libelle: "Démarrer l'encadrement", icone: 'play_arrow', couleur: 'primary' },
    { statut: 'ABANDONNE', libelle: 'Abandonner le travail', icone: 'flag', couleur: 'negative' },
  ],
  EN_COURS: [
    {
      statut: 'SOUTENU',
      libelle: 'Passer en SOUTENU (rapport rendu + soutenance enregistrée requis)',
      icone: 'workspace_premium',
      couleur: 'positive',
    },
    { statut: 'ABANDONNE', libelle: 'Abandonner le travail', icone: 'flag', couleur: 'negative' },
  ],
  SOUTENU: [],
  ABANDONNE: [
    {
      statut: 'PROPOSE',
      libelle: 'Réactiver le dossier (réservé à l’administration)',
      icone: 'restart_alt',
      couleur: 'primary',
      role: ['ADMIN'],
    },
  ],
};

const compteurs = computed(() => {
  const statuts: StatutEncadrement[] = ['PROPOSE', 'VALIDE', 'EN_COURS', 'SOUTENU', 'ABANDONNE'];
  return statuts.map((statut) => ({
    statut,
    label: LIBELLE_STATUT_ENCADREMENT[statut] ?? statut,
    nb: travaux.value.filter((t) => t.statut === statut).length,
  }));
});

const lignesVisibles = computed(() => {
  if (!filtres.value.statut) return travaux.value;
  return travaux.value.filter((t) => t.statut === filtres.value.statut);
});

const peutCreer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));

/** Rôles qui font vivre la machine à états (le service refuse les autres). */
const peutTransitionner = computed(() =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT']),
);

const colonnes: QTableColumn[] = [
  { name: 'intitule', label: 'Travail', field: 'intitule', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiantId', align: 'left' },
  { name: 'encadrant', label: 'Encadrant', field: 'encadrantId', align: 'left' },
  { name: 'periode', label: 'Période', field: 'dateDebut', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'rapport', label: 'Rapport', field: 'rapportRendu', align: 'center' },
  { name: 'soutenance', label: 'Soutenance', field: 'soutenance', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const couleurStatut = (s: string) =>
  s === 'SOUTENU'
    ? 'positive'
    : s === 'ABANDONNE'
      ? 'negative'
      : s === 'EN_COURS'
        ? 'primary'
        : s === 'VALIDE'
          ? 'secondary'
          : 'grey-7';

function basculerStatut(statut: StatutEncadrement) {
  filtres.value.statut = filtres.value.statut === statut ? null : statut;
}

/** Boutons de transition visibles pour ce travail, selon le statut et le rôle. */
function boutonsTransition(t: TravailEncadre) {
  if (!peutTransitionner.value) return [];
  if (auth.role === 'ENSEIGNANT' && t.encadrantId !== auth.utilisateur?.enseignantId) return [];
  return (BOUTONS_PAR_STATUT[t.statut] ?? []).filter(
    (b) => !b.role || auth.aRole(b.role as never),
  );
}

function peutModifierRapport(t: TravailEncadre) {
  return (
    auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) ||
    (auth.role === 'ENSEIGNANT' && t.encadrantId === auth.utilisateur?.enseignantId)
  );
}

function peutPlanifierSoutenance(t: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) && t.statut === 'EN_COURS' && !t.soutenance;
}

function peutConstatJury(t: TravailEncadre) {
  return auth.aRole(['ADMIN', 'DIRECTION']) && !!t.soutenance;
}

function ouvrirCreation() {
  travailEdite.value = null;
  dialogTravail.value = true;
}

function ouvrirEdition(t: TravailEncadre) {
  if (!peutCreer.value) return;
  travailEdite.value = t;
  dialogTravail.value = true;
}

function ouvrirSoutenance(t: TravailEncadre) {
  travailSoutenance.value = t;
  modeSoutenance.value = 'planifier';
  dialogSoutenance.value = true;
}

function ouvrirJury(t: TravailEncadre) {
  travailSoutenance.value = t;
  modeSoutenance.value = 'jury';
  dialogSoutenance.value = true;
}

function transition(t: TravailEncadre, cible: StatutEncadrement) {
  const libelle = LIBELLE_STATUT_ENCADREMENT[cible] ?? cible;
  $q.dialog({
    title: `Passer en « ${libelle} »`,
    message:
      cible === 'ABANDONNE'
        ? 'Le dossier reste consultable mais sort du parcours ; il faudra une intervention de l’administration pour le réactiver. Confirmer l’abandon ?'
        : cible === 'SOUTENU'
          ? 'Rapport rendu et soutenance enregistrée sont requis avant le passage en SOUTENU.'
          : 'Confirmer cette transition ?',
    cancel: true,
  }).onOk(async () => {
    await api.post(`/travaux-encadres/${t.id}/transition`, { statut: cible });
    $q.notify({ type: 'positive', message: `Travail passé en « ${libelle} »` });
    await charger();
  });
}

async function basculerRapport(t: TravailEncadre, rendu: boolean) {
  await api.put(`/travaux-encadres/${t.id}`, { rapportRendu: rendu });
  $q.notify({
    type: 'positive',
    message: rendu ? 'Rapport marqué rendu' : 'Rapport marqué non rendu',
  });
  await charger();
}

function imprimer(t: TravailEncadre) {
  const token = localStorage.getItem('unipresence_token');
  if (!token) return;
  window.open(
    `${API_URL}/travaux-encadres/${t.id}/fiche?token=${encodeURIComponent(token)}`,
    '_blank',
  );
}

function supprimer(t: TravailEncadre) {
  $q.dialog({
    title: 'Supprimer ce travail ?',
    message: `${t.intitule} — casse du dossier réservée à l’administration, états PROPOSE / VALIDE uniquement.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/travaux-encadres/${t.id}`);
    $q.notify({ type: 'positive', message: 'Travail supprimé' });
    await charger();
  });
}

function filtrerEncadrants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEncadrants.value = encadrantsTous.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom}`, value: e.id }));
  });
}

async function charger() {
  chargement.value = true;
  try {
    const [travauxRes, calendrierRes] = await Promise.all([
      api.get('/travaux-encadres', {
        params: {
          all: '1',
          search: recherche.value || undefined,
          type: filtres.value.type || undefined,
          encadrantId: filtres.value.encadrantId || undefined,
        },
      }),
      peutCreer.value
        ? api.get('/soutenances').catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ]);
    travaux.value = travauxRes.data.data;
    soutenancesAVenir.value = calendrierRes.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/enseignants', { params: { all: '1' } });
  encadrantsTous.value = data.data;
  optionsEncadrants.value = data.data.map((e: Enseignant) => ({
    label: `${e.nom} ${e.prenom}`,
    value: e.id,
  }));
  await charger();
});
</script>

<style scoped lang="scss">
.carte-compteur {
  cursor: pointer;
  transition: background 0.15s ease;
}
.carte-compteur--actif {
  background: #e3f2fd;
  border-color: #1565c0;
}
</style>