<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Justificatifs d’absence</div>
        <div class="page-sous-titre">
          Une absence justifiée et validée devient une « absence excusée » dans les statistiques
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutDeposer"
          unelevated
          color="primary"
          no-caps
          icon="post_add"
          label="Enregistrer un justificatif"
          @click="ouvrirDepot"
        />
      </div>
    </div>

    <!-- Un enseignant ne dépose pas lui-même : il doit savoir par où passer. -->
    <q-banner v-if="!peutDeposer" class="note--info q-mb-md">
      <template #avatar><q-icon name="info" /></template>
      Un justificatif s’enregistre auprès de la scolarité, sur présentation de la pièce.
      Vous retrouvez ici l’état de vos demandes.
    </q-banner>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm">
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Statut"
          />
        </div>
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.type"
            :options="TYPES_JUSTIFICATIF"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Motif"
          />
        </div>
        <div class="col-6 col-md-3">
          <champ-date v-model="filtres.dateDebut" label="Séances du" />
        </div>
        <div class="col-6 col-md-3">
          <champ-date v-model="filtres.dateFin" label="au" />
        </div>
      </q-card-section>
    </q-card>

    <q-table
      flat
      bordered
      class="carte"
      :rows="justificatifs"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20, sortBy: 'date', descending: true }"
      loading-label="Chargement des justificatifs…"
      :no-data-label="messageVide"
    >
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-justificatif" :class="`champ--${champStatut(p.row.statut)}`">
            <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
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
            aria-label="Voir le justificatif"
            @click="detail = p.row"
          >
            <q-tooltip>Détail</q-tooltip>
          </q-btn>
          <template v-if="p.row.statut === 'EN_ATTENTE' && peutArbitrer">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="check"
              aria-label="Valider ce justificatif"
              @click="traiter(p.row, 'VALIDE')"
            >
              <q-tooltip>Valider — la séance passera en absence excusée</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="close"
              aria-label="Rejeter ce justificatif"
              @click="traiter(p.row, 'REJETE')"
            >
              <q-tooltip>Rejeter — l’absence reste constatée</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
    </q-table>

    <!-- Dépôt d'un justificatif (enseignant) -->
    <q-dialog v-model="dialogDepot">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Enregistrer un justificatif</div>
          <div class="page-sous-titre">
            Saisi par l’administration, sur présentation de la pièce par l’enseignant.
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="enseignantChoisi"
            :options="optionsEnseignants"
            outlined
            dense
            emit-value
            map-options
            use-input
            label="Enseignant *"
            @filter="filtrerEnseignants"
            @update:model-value="chargerSeancesJustifiables"
          />
          <q-select
            v-model="form.seanceId"
            :options="optionsSeances"
            outlined
            dense
            emit-value
            map-options
            label="Séance concernée *"
            :disable="!enseignantChoisi"
            hint="Séances non assurées des 90 derniers jours"
          />
          <q-select
            v-model="form.type"
            :options="TYPES_JUSTIFICATIF"
            outlined
            dense
            emit-value
            map-options
            label="Motif *"
          />
          <q-input
            v-model="form.motif"
            outlined
            dense
            type="textarea"
            rows="3"
            label="Explication *"
          />
          <q-file
            v-model="fichier"
            outlined
            dense
            label="Pièce justificative (image ou PDF)"
            accept="image/*,.pdf"
            @update:model-value="lireFichier"
          >
            <template #prepend><q-icon name="attach_file" /></template>
          </q-file>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            icon="post_add"
            label="Déposer le justificatif"
            :loading="enregistrement"
            @click="deposer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Détail -->
    <q-dialog :model-value="!!detail" @update:model-value="detail = null">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">Justificatif</q-card-section>
        <q-card-section v-if="detail">
          <q-list dense>
            <q-item>
              <q-item-section>Enseignant</q-item-section>
              <q-item-section side>
                {{ detail.enseignant?.nom }} {{ detail.enseignant?.prenom }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Séance</q-item-section>
              <q-item-section side>
                {{ dateLisible(detail.seance?.date) }} · {{ detail.seance?.heureDebut }}–{{ detail.seance?.heureFin }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Motif</q-item-section>
              <q-item-section side>{{ libelleMotif(detail.type) }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Explication</q-item-section>
              <q-item-section side class="text-right">{{ detail.motif }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Statut</q-item-section>
              <q-item-section side>
                <span class="champ champ-justificatif" :class="`champ--${champStatut(detail.statut)}`">
                  <span class="pochoir">{{ libelleStatut(detail.statut) }}</span>
                </span>
              </q-item-section>
            </q-item>
            <q-item v-if="detail.commentaire">
              <q-item-section>Commentaire de décision</q-item-section>
              <q-item-section side class="text-right">{{ detail.commentaire }}</q-item-section>
            </q-item>
            <q-item v-if="detail.traitePar">
              <q-item-section>Arbitré par</q-item-section>
              <q-item-section side>
                {{ detail.traitePar.prenom }} {{ detail.traitePar.nom }}
                <span v-if="detail.traiteLe" class="chiffres">
                  · {{ dateLisible(detail.traiteLe) }}
                </span>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="detail.piece" class="q-mt-md">
            <img
              v-if="detail.piece.startsWith('data:image')"
              :src="detail.piece"
              class="full-width"
              alt="Pièce justificative fournie par l’enseignant"
            />
            <q-btn v-else flat icon="download" no-caps label="Ouvrir la pièce jointe" :href="detail.piece" target="_blank" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="detail?.seance"
            flat
            no-caps
            icon="event_note"
            label="Voir la séance au registre"
            :to="lienSeance(detail)"
          />
          <q-btn flat no-caps label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import {
  LIBELLE_STATUT_JUSTIFICATIF,
  TYPES_JUSTIFICATIF,
  aujourdhui,
  dateLisible,
  decalerJours,
} from '../utils/libelles';
import type { Enseignant, Justificatif, Seance } from '../types';

const $q = useQuasar();
const route = useRoute();
const auth = useAuthStore();

const justificatifs = ref<Justificatif[]>([]);
const seancesJustifiables = ref<Seance[]>([]);
const chargement = ref(false);
const detail = ref<Justificatif | null>(null);
const dialogDepot = ref(false);
const enregistrement = ref(false);
const fichier = ref<File | null>(null);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const enseignantChoisi = ref<string | null>(null);

const filtres = ref({
  statut: null as string | null,
  type: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -90),
  dateFin: aujourdhui(),
});

const form = ref({ seanceId: '', type: 'MALADIE', motif: '', piece: undefined as string | undefined });

/** Le champ peint d'un justificatif reprend la grammaire des constats. */
const CHAMP_STATUT_JUSTIFICATIF: Record<string, string> = {
  EN_ATTENTE: 'retard',
  VALIDE: 'present',
  REJETE: 'absent',
};

const optionsStatuts = Object.entries(LIBELLE_STATUT_JUSTIFICATIF).map(([value, label]) => ({
  label,
  value,
}));

const peutArbitrer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT']));
const peutDeposer = computed(() =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT']),
);

const messageVide = computed(() =>
  filtres.value.statut || filtres.value.type
    ? 'Aucun justificatif ne correspond à ces filtres sur la période.'
    : 'Aucun justificatif déposé sur cette période.',
);

/** Un justificatif se lit avec sa séance : le registre s'ouvre sur son jour. */
const lienSeance = (j: Justificatif | null) => {
  const jour = String(j?.seance?.date ?? '').slice(0, 10);
  return {
    name: 'seances',
    query: { dateDebut: jour, dateFin: jour, enseignantId: j?.enseignantId },
  };
};

const optionsSeances = computed(() =>
  seancesJustifiables.value.map((s) => ({
    label: `${dateLisible(s.date)} · ${s.heureDebut}–${s.heureFin} · ${s.affectation?.matiere?.intitule}`,
    value: s.id,
  })),
);

const colonnes: QTableColumn[] = [
  {
    name: 'date',
    label: 'Séance',
    field: (r: Justificatif) =>
      `${dateLisible(r.seance?.date)} ${r.seance?.heureDebut ?? ''}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'enseignant',
    label: 'Enseignant',
    field: (r: Justificatif) => `${r.enseignant?.nom ?? ''} ${r.enseignant?.prenom ?? ''}`,
    align: 'left',
  },
  {
    name: 'matiere',
    label: 'Matière',
    field: (r: Justificatif) => r.seance?.affectation?.matiere?.intitule ?? '—',
    align: 'left',
  },
  {
    name: 'type',
    label: 'Motif',
    field: (r: Justificatif) => libelleMotif(r.type),
    align: 'left',
    sortable: true,
  },
  { name: 'explication', label: 'Explication', field: 'motif', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const champStatut = (s: string) => CHAMP_STATUT_JUSTIFICATIF[s] ?? 'attente';
const libelleStatut = (s: string) => LIBELLE_STATUT_JUSTIFICATIF[s] ?? s;
const libelleMotif = (t?: string | null) =>
  TYPES_JUSTIFICATIF.find((x) => x.value === t)?.label ?? t ?? '—';

/** Le message dit la conséquence : valider excuse l'absence dans les relevés. */
function traiter(j: Justificatif, statut: 'VALIDE' | 'REJETE') {
  const valide = statut === 'VALIDE';
  $q.dialog({
    title: valide ? 'Valider le justificatif' : 'Rejeter le justificatif',
    message: valide
      ? 'La séance passera en « absence excusée » dans les statistiques. Commentaire (facultatif) :'
      : 'L’absence restera constatée telle quelle. Motif du rejet (facultatif) :',
    prompt: { model: '', type: 'text' },
    ok: {
      label: valide ? 'Valider le justificatif' : 'Rejeter le justificatif',
      color: valide ? 'positive' : 'negative',
      unelevated: true,
      noCaps: true,
    },
    cancel: { label: 'Ne rien faire', flat: true, noCaps: true },
  }).onOk(async (commentaire: string) => {
    await api.put(`/justificatifs/${j.id}/traiter`, { statut, commentaire });
    $q.notify({
      type: 'positive',
      message: valide ? 'Justificatif validé — absence excusée' : 'Justificatif rejeté',
    });
    await charger();
  });
}

function lireFichier(f: File | null) {
  if (!f) {
    form.value.piece = undefined;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => (form.value.piece = String(reader.result));
  reader.readAsDataURL(f);
}

async function ouvrirDepot() {
  form.value = { seanceId: '', type: 'MALADIE', motif: '', piece: undefined };
  fichier.value = null;
  enseignantChoisi.value = null;
  seancesJustifiables.value = [];
  if (!enseignants.value.length) {
    const { data } = await api.get('/enseignants', { params: { all: '1' } });
    enseignants.value = data.data;
  }
  dialogDepot.value = true;
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

/** Seules les séances non assurées de cet enseignant peuvent être justifiées. */
async function chargerSeancesJustifiables() {
  form.value.seanceId = '';
  if (!enseignantChoisi.value) return;
  const { data } = await api.get('/seances', {
    params: {
      enseignantId: enseignantChoisi.value,
      dateDebut: decalerJours(aujourdhui(), -90),
      dateFin: aujourdhui(),
      pageSize: 200,
    },
  });
  seancesJustifiables.value = data.data.filter(
    (s: Seance) => !s.justificatif && (s.statut === 'NON_TENUE' || s.controle?.statut === 'ABSENT'),
  );
}

async function deposer() {
  if (!enseignantChoisi.value || !form.value.seanceId || !form.value.motif.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Enseignant, séance concernée et explication sont obligatoires.',
    });
    return;
  }
  enregistrement.value = true;
  try {
    await api.post('/justificatifs', { ...form.value, enseignantId: enseignantChoisi.value });
    $q.notify({ type: 'positive', message: 'Justificatif déposé' });
    dialogDepot.value = false;
    await charger();
  } finally {
    enregistrement.value = false;
  }
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/justificatifs', {
      params: {
        all: '1',
        statut: filtres.value.statut || undefined,
        type: filtres.value.type || undefined,
        dateDebut: filtres.value.dateDebut,
        dateFin: filtres.value.dateFin,
      },
    });
    justificatifs.value = data.data;
  } finally {
    chargement.value = false;
  }
}

/** Arrivée par lien (« justificatifs à arbitrer » du tableau de bord). */
if (route.query.statut) filtres.value.statut = String(route.query.statut);
if (route.query.type) filtres.value.type = String(route.query.type);

watch(filtres, charger, { deep: true });
onMounted(charger);
</script>

<style scoped lang="scss">
.champ-justificatif {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  border: 2px solid var(--up-encre);
}
</style>
