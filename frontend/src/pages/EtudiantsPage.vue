<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Étudiants</div>
        <div class="page-sous-titre">
          La base centrale du registre : matricule INE, QR de la carte resto et
          compteur de dossiers — les autres modules en dépendent.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvel étudiant"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="etudiants"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #top-left>
        <div class="row q-gutter-sm items-center">
          <q-input
            v-model="recherche"
            dense
            outlined
            clearable
            debounce="300"
            placeholder="Matricule, nom, téléphone…"
            @update:model-value="recharger"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="filtreActif"
            :options="[
              { label: 'Tous les statuts', value: null },
              { label: 'Actifs', value: 'true' },
              { label: 'Inactifs', value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            label="Statut"
            style="min-width: 150px"
            @update:model-value="recharger"
          />
        </div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip v-if="p.row.inscriptions?.[0]?.promotion" dense outline color="primary">
            {{ p.row.inscriptions[0].promotion.nom }}
          </q-chip>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>

      <template #body-cell-comptes="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{ p.row.user ? `Compte : ${p.row.user.email}` : 'Aucun compte portail' }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-inscriptions="p">
        <q-td :props="p" class="text-right">
          <span class="chiffres">{{ p.row._count?.inscriptions ?? 0 }}</span>
        </q-td>
      </template>

      <template #body-cell-actif="p">
        <q-td :props="p">
          <q-toggle
            :model-value="p.row.actif"
            color="secondary"
            :disable="!peutGererCompte(p.row)"
            @update:model-value="(v) => basculerActif(p.row, v)"
          />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            round
            :color="p.row.actif ? 'negative' : 'positive'"
            :icon="p.row.actif ? 'person_off' : 'person'"
            @click="desactiver(p.row)"
          >
            <q-tooltip>{{ p.row.actif ? 'Désactiver la fiche' : 'Fiche inactive' }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <etudiant-dialog
      v-model="dialogOuvert"
      :etudiant="etudiantEdite"
      @enregistre="charger"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EtudiantDialog from '../components/EtudiantDialog.vue';
import type { Etudiant, Promotion } from '../types';

interface EtudiantRegistre extends Etudiant {
  inscriptions?: { id: string; promotion?: Promotion | null }[];
}

const $q = useQuasar();
const auth = useAuthStore();

const etudiants = ref<EtudiantRegistre[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtreActif = ref<string | null>(null);
const dialogOuvert = ref(false);
const etudiantEdite = ref<EtudiantRegistre | null>(null);

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutGererCompte = (e: EtudiantRegistre) => auth.estAdmin || !e.user;

const colonnes: QTableColumn[] = [
  { name: 'nom', label: 'Nom & prénom', field: 'nom', align: 'left', sortable: true },
  { name: 'prenom', label: 'Prénom', field: 'prenom', align: 'left', sortable: true },
  { name: 'promotion', label: 'Promotion', field: 'promotion', align: 'left' },
  { name: 'telephone', label: 'Téléphone', field: 'telephone', align: 'left' },
  { name: 'comptes', label: 'Compte', field: 'comptes', align: 'center' },
  { name: 'inscriptions', label: 'Dossiers', field: 'inscriptions', align: 'right', sortable: true },
  { name: 'actif', label: 'Actif', field: 'actif', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(e: EtudiantRegistre | null) {
  etudiantEdite.value = e;
  dialogOuvert.value = true;
}

async function basculerActif(e: EtudiantRegistre, v: unknown) {
  await api.put(`/etudiants/${e.id}`, { actif: v === true });
  e.actif = v === true;
  $q.notify({ type: 'positive', message: v ? 'Étudiant réactivé' : 'Étudiant désactivé' });
}

function desactiver(e: EtudiantRegistre) {
  $q.dialog({
    title: 'Désactiver la fiche',
    message: `Désactiver ${e.prenom} ${e.nom} ? La fiche reste dans le registre (paiements, notes, attestations) mais n'est plus active.`,
    cancel: true,
    ok: { color: 'negative', label: 'Désactiver' },
  }).onOk(async () => {
    await api.delete(`/etudiants/${e.id}`);
    $q.notify({ type: 'positive', message: 'Fiche désactivée' });
    await charger();
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: {
        all: '1',
        search: recherche.value || undefined,
        actif: filtreActif.value || undefined,
      },
    });
    etudiants.value = data.data;
  } finally {
    chargement.value = false;
  }
}

async function recharger() {
  await charger();
}

onMounted(charger);
</script>