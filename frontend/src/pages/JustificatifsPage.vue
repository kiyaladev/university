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
      :pagination="{ rowsPerPage: 20 }"
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
          <q-btn flat dense round icon="visibility" @click="detail = p.row" />
          <template v-if="p.row.statut === 'EN_ATTENTE' && peutArbitrer">
            <q-btn flat dense round color="positive" icon="check" @click="traiter(p.row, 'VALIDE')">
              <q-tooltip>Valider</q-tooltip>
            </q-btn>
            <q-btn flat dense round color="negative" icon="close" @click="traiter(p.row, 'REJETE')">
              <q-tooltip>Rejeter</q-tooltip>
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
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Déposer" :loading="enregistrement" @click="deposer" />
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
              <q-item-section side>{{ detail.type }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Explication</q-item-section>
              <q-item-section side class="text-right">{{ detail.motif }}</q-item-section>
            </q-item>
            <q-item v-if="detail.commentaire">
              <q-item-section>Décision</q-item-section>
              <q-item-section side>{{ detail.commentaire }}</q-item-section>
            </q-item>
          </q-list>
          <div v-if="detail.piece" class="q-mt-md">
            <img v-if="detail.piece.startsWith('data:image')" :src="detail.piece" class="full-width" />
            <q-btn v-else flat icon="download" no-caps label="Ouvrir la pièce jointe" :href="detail.piece" target="_blank" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import {
  TYPES_JUSTIFICATIF,
  aujourdhui,
  dateLisible,
  decalerJours,
} from '../utils/libelles';
import type { Enseignant, Justificatif, Seance } from '../types';

const $q = useQuasar();
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

const optionsStatuts = [
  { label: 'En attente', value: 'EN_ATTENTE' },
  { label: 'Validé', value: 'VALIDE' },
  { label: 'Rejeté', value: 'REJETE' },
];

const peutArbitrer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT']));
const peutDeposer = computed(() =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT']),
);

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
  { name: 'type', label: 'Motif', field: 'type', align: 'left' },
  { name: 'explication', label: 'Explication', field: 'motif', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const champStatut = (s: string) =>
  s === 'VALIDE' ? 'present' : s === 'REJETE' ? 'absent' : 'retard';
const libelleStatut = (s: string) =>
  s === 'VALIDE' ? 'Validé' : s === 'REJETE' ? 'Rejeté' : 'En attente';

function traiter(j: Justificatif, statut: 'VALIDE' | 'REJETE') {
  $q.dialog({
    title: statut === 'VALIDE' ? 'Valider le justificatif' : 'Rejeter le justificatif',
    message: 'Commentaire (facultatif)',
    prompt: { model: '', type: 'text' },
    cancel: true,
  }).onOk(async (commentaire: string) => {
    await api.put(`/justificatifs/${j.id}/traiter`, { statut, commentaire });
    $q.notify({ type: 'positive', message: 'Justificatif traité' });
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
