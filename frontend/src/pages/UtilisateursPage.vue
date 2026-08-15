<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Utilisateurs</div>
        <div class="page-sous-titre">
          Comptes de connexion et rôles : contrôleurs, scolarité, direction, enseignants
        </div>
      </div>
      <div class="col-auto">
        <q-btn unelevated color="primary" no-caps icon="person_add" label="Nouvel utilisateur" @click="ouvrir(null)" />
      </div>
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="utilisateurs"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :filter="recherche"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #top-left>
        <q-input v-model="recherche" dense outlined clearable placeholder="Rechercher…">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </template>

      <template #body-cell-role="p">
        <q-td :props="p">
          <q-chip dense color="primary" text-color="white">{{ LIBELLE_ROLE[p.row.role] }}</q-chip>
        </q-td>
      </template>

      <template #body-cell-actif="p">
        <q-td :props="p">
          <q-icon
            :name="p.row.actif ? 'check_circle' : 'block'"
            :color="p.row.actif ? 'positive' : 'grey-7'"
          />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="edit" @click="ouvrir(p.row)" />
          <q-btn flat dense round color="negative" icon="delete" @click="supprimer(p.row)" />
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ utilisateurEdite ? 'Modifier l’utilisateur' : 'Nouvel utilisateur' }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">Identité et accès</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input v-model="form.nom" outlined dense label="Nom *" />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.prenom" outlined dense label="Prénom *" />
            </div>
          </div>
          <q-input v-model="form.email" outlined dense type="email" label="E-mail *" />
          <q-input
            v-model="form.password"
            outlined
            dense
            type="password"
            :label="utilisateurEdite ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe *'"
          />
          <span class="section-titre">Rôle et périmètre</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.role"
                :options="optionsRoles"
                outlined
                dense
                emit-value
                map-options
                label="Rôle *"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.telephone" outlined dense label="Téléphone" />
            </div>
          </div>
          <q-select
            v-model="form.departementId"
            :options="optionsDepartements"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Département de rattachement"
          />
          <q-select
            v-if="form.role === 'ENSEIGNANT'"
            v-model="form.enseignantId"
            :options="optionsEnseignants"
            outlined
            dense
            emit-value
            map-options
            use-input
            label="Fiche enseignant associée"
            hint="Nécessaire pour que l’enseignant voie ses séances"
            @filter="filtrerEnseignants"
          />
          <q-toggle v-model="form.actif" label="Compte actif" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { LIBELLE_ROLE } from '../utils/libelles';
import type { Departement, Enseignant, Role, Utilisateur } from '../types';

const $q = useQuasar();

const utilisateurs = ref<Utilisateur[]>([]);
const departements = ref<Departement[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const recherche = ref('');
const dialogOuvert = ref(false);
const utilisateurEdite = ref<Utilisateur | null>(null);
const enregistrement = ref(false);

const form = ref({
  nom: '',
  prenom: '',
  email: '',
  password: '',
  role: 'CONTROLEUR' as Role,
  telephone: '',
  departementId: null as string | null,
  enseignantId: null as string | null,
  actif: true,
});

const optionsRoles = Object.entries(LIBELLE_ROLE).map(([value, label]) => ({ label, value }));
const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const colonnes: QTableColumn[] = [
  {
    name: 'nom',
    label: 'Nom & prénom',
    field: (r: Utilisateur) => `${r.nom} ${r.prenom}`,
    align: 'left',
    sortable: true,
  },
  { name: 'email', label: 'E-mail', field: 'email', align: 'left', sortable: true },
  { name: 'role', label: 'Rôle', field: 'role', align: 'left', sortable: true },
  { name: 'telephone', label: 'Téléphone', field: 'telephone', align: 'left' },
  { name: 'actif', label: 'Actif', field: 'actif', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(u: Utilisateur | null) {
  utilisateurEdite.value = u;
  form.value = {
    nom: u?.nom ?? '',
    prenom: u?.prenom ?? '',
    email: u?.email ?? '',
    password: '',
    role: u?.role ?? 'CONTROLEUR',
    telephone: u?.telephone ?? '',
    departementId: u?.departementId ?? null,
    enseignantId: null,
    actif: u?.actif ?? true,
  };
  dialogOuvert.value = true;
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      ...form.value,
      telephone: form.value.telephone || undefined,
      departementId: form.value.departementId || undefined,
      enseignantId: form.value.enseignantId || undefined,
    };
    if (!payload.password) delete payload.password;

    if (utilisateurEdite.value) await api.put(`/utilisateurs/${utilisateurEdite.value.id}`, payload);
    else await api.post('/utilisateurs', payload);

    $q.notify({ type: 'positive', message: 'Utilisateur enregistré' });
    dialogOuvert.value = false;
    await charger();
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(u: Utilisateur) {
  $q.dialog({
    title: 'Supprimer',
    message: `Supprimer le compte de ${u.prenom} ${u.nom} ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/utilisateurs/${u.id}`);
    await charger();
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/utilisateurs', { params: { all: '1' } });
    utilisateurs.value = data.data;
  } finally {
    chargement.value = false;
  }
}

watch(
  () => form.value.role,
  (role) => {
    if (role !== 'ENSEIGNANT') form.value.enseignantId = null;
  },
);

onMounted(async () => {
  const [d, e] = await Promise.all([
    api.get('/departements', { params: { all: '1' } }),
    api.get('/enseignants', { params: { all: '1' } }),
  ]);
  departements.value = d.data.data;
  enseignants.value = e.data.data;
  await charger();
});
</script>
