<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Matières</div>
        <div class="page-sous-titre">
          Programme d’enseignement et volumes horaires de référence
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle matière"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="matieres"
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

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn v-if="auth.peutPlanifier" flat dense round icon="edit" @click="ouvrir(p.row)" />
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            @click="supprimer(p.row)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- Formulaire dédié matière -->
    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ matiereEditee ? 'Modifier la matière' : 'Nouvelle matière' }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">Programme</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-5">
              <q-input v-model="form.code" outlined dense label="Code *" />
            </div>
            <div class="col-12 col-sm-7">
              <q-select
                v-model="form.departementId"
                :options="optionsDepartements"
                outlined
                dense
                clearable
                emit-value
                map-options
                label="Département"
              />
            </div>
          </div>
          <q-input v-model="form.intitule" outlined dense label="Intitulé *" />
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-input
                v-model.number="form.volumeHoraireTotal"
                type="number"
                outlined
                dense
                label="Volume horaire (h)"
              />
            </div>
            <div class="col-6">
              <q-input v-model.number="form.credits" type="number" outlined dense label="Crédits" />
            </div>
          </div>
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
import { useAuthStore } from '../stores/auth';
import type { Departement, Matiere } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const matieres = ref<Matiere[]>([]);
const departements = ref<Departement[]>([]);
const chargement = ref(false);
const recherche = ref('');
const dialogOuvert = ref(false);
const matiereEditee = ref<Matiere | null>(null);
const enregistrement = ref(false);

const form = ref({
  code: '',
  intitule: '',
  volumeHoraireTotal: 0,
  credits: 0,
  departementId: null as string | null,
});

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const colonnes: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'intitule', label: 'Intitulé', field: 'intitule', align: 'left', sortable: true },
  {
    name: 'departement',
    label: 'Département',
    field: (r: Matiere) => r.departement?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'volume',
    label: 'Volume horaire',
    field: (r: Matiere) => `${r.volumeHoraireTotal} h`,
    align: 'right',
    sortable: true,
  },
  { name: 'credits', label: 'Crédits', field: 'credits', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(m: Matiere | null) {
  matiereEditee.value = m;
  dialogOuvert.value = true;
}

watch(dialogOuvert, (ouvert) => {
  if (!ouvert) return;
  const m = matiereEditee.value;
  form.value = {
    code: m?.code ?? '',
    intitule: m?.intitule ?? '',
    volumeHoraireTotal: m?.volumeHoraireTotal ?? 0,
    credits: m?.credits ?? 0,
    departementId: m?.departementId ?? null,
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = { ...form.value, departementId: form.value.departementId || undefined };
    if (matiereEditee.value) await api.put(`/matieres/${matiereEditee.value.id}`, payload);
    else await api.post('/matieres', payload);
    $q.notify({ type: 'positive', message: 'Matière enregistrée' });
    dialogOuvert.value = false;
    await charger();
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(m: Matiere) {
  $q.dialog({
    title: 'Supprimer',
    message: `Supprimer la matière « ${m.intitule} » ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/matieres/${m.id}`);
    await charger();
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/matieres', { params: { all: '1' } });
    matieres.value = data.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/departements', { params: { all: '1' } });
  departements.value = data.data;
  await charger();
});
</script>
