<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Charges d’enseignement</div>
        <div class="page-sous-titre">
          Qui enseigne quoi, à quelle promotion, pour quel volume horaire contractuel
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle affectation"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="affectations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :filter="recherche"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #top-left>
        <div class="row q-gutter-sm">
          <q-input v-model="recherche" dense outlined clearable placeholder="Rechercher…">
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="promotionId"
            :options="optionsPromotions"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Promotion"
            style="min-width: 200px"
            @update:model-value="charger"
          />
        </div>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn v-if="auth.peutPlanifier" flat dense round icon="edit" @click="ouvrir(p.row)" />
          <q-btn
            v-if="auth.peutPlanifier"
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

    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ affectationEditee ? 'Modifier l’affectation' : 'Nouvelle affectation' }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="form.enseignantId"
            :options="optionsEnseignants"
            outlined
            dense
            emit-value
            map-options
            use-input
            label="Enseignant *"
            @filter="filtrerEnseignants"
          />
          <q-select
            v-model="form.matiereId"
            :options="optionsMatieres"
            outlined
            dense
            emit-value
            map-options
            use-input
            label="Matière *"
            @filter="filtrerMatieres"
          />
          <q-select
            v-model="form.promotionId"
            :options="optionsPromotions"
            outlined
            dense
            emit-value
            map-options
            label="Promotion *"
          />
          <q-select
            v-model="form.anneeId"
            :options="optionsAnnees"
            outlined
            dense
            emit-value
            map-options
            label="Année académique *"
          />
          <q-input
            v-model.number="form.volumeHorairePrevu"
            type="number"
            outlined
            dense
            label="Volume horaire contractuel (h)"
            hint="Sert au suivi « heures réalisées / heures dues »"
          />
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
import type { Affectation, AnneeAcademique, Enseignant, Matiere, Promotion } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const affectations = ref<Affectation[]>([]);
const enseignants = ref<Enseignant[]>([]);
const matieres = ref<Matiere[]>([]);
const promotions = ref<Promotion[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const optionsMatieres = ref<{ label: string; value: string }[]>([]);

const chargement = ref(false);
const recherche = ref('');
const promotionId = ref<string | null>(null);
const dialogOuvert = ref(false);
const affectationEditee = ref<Affectation | null>(null);
const enregistrement = ref(false);

const form = ref({
  enseignantId: '',
  matiereId: '',
  promotionId: '',
  anneeId: '',
  volumeHorairePrevu: 0,
});

const optionsPromotions = computed(() =>
  promotions.value.map((p) => ({ label: p.nom, value: p.id })),
);
const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

const colonnes: QTableColumn[] = [
  {
    name: 'enseignant',
    label: 'Enseignant',
    field: (r: Affectation) => `${r.enseignant?.nom} ${r.enseignant?.prenom}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'matiere',
    label: 'Matière',
    field: (r: Affectation) => `${r.matiere?.code} — ${r.matiere?.intitule}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'promotion',
    label: 'Promotion',
    field: (r: Affectation) => r.promotion?.nom ?? '',
    align: 'left',
    sortable: true,
  },
  {
    name: 'volume',
    label: 'Volume prévu',
    field: (r: Affectation) => `${r.volumeHorairePrevu} h`,
    align: 'right',
    sortable: true,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(a: Affectation | null) {
  affectationEditee.value = a;
  form.value = {
    enseignantId: a?.enseignantId ?? '',
    matiereId: a?.matiereId ?? '',
    promotionId: a?.promotionId ?? '',
    anneeId: a?.anneeId ?? annees.value.find((x) => x.active)?.id ?? '',
    volumeHorairePrevu: a?.volumeHorairePrevu ?? 0,
  };
  dialogOuvert.value = true;
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

function filtrerMatieres(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsMatieres.value = matieres.value
      .filter((m) => `${m.code} ${m.intitule}`.toLowerCase().includes(q))
      .map((m) => ({ label: `${m.code} — ${m.intitule}`, value: m.id }));
  });
}

/** Le volume contractuel est pré-rempli avec celui de la matière. */
watch(
  () => form.value.matiereId,
  (id) => {
    if (!affectationEditee.value && id) {
      form.value.volumeHorairePrevu =
        matieres.value.find((m) => m.id === id)?.volumeHoraireTotal ?? 0;
    }
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    if (affectationEditee.value) {
      await api.put(`/affectations/${affectationEditee.value.id}`, form.value);
    } else {
      await api.post('/affectations', form.value);
    }
    $q.notify({ type: 'positive', message: 'Affectation enregistrée' });
    dialogOuvert.value = false;
    await charger();
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(a: Affectation) {
  $q.dialog({
    title: 'Supprimer',
    message: 'Les séances liées à cette affectation seront également supprimées. Continuer ?',
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/affectations/${a.id}`);
    await charger();
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/affectations', {
      params: { all: '1', promotionId: promotionId.value || undefined },
    });
    affectations.value = data.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const [e, m, p, a] = await Promise.all([
    api.get('/enseignants', { params: { all: '1' } }),
    api.get('/matieres', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
    api.get('/annees', { params: { all: '1' } }),
  ]);
  enseignants.value = e.data.data;
  matieres.value = m.data.data;
  promotions.value = p.data.data;
  annees.value = a.data.data;
  await charger();
});
</script>
