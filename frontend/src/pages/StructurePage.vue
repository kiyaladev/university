<template>
  <q-page class="q-pa-md">
    <div class="page-titre">Structure académique</div>
    <div class="page-sous-titre q-mb-md">
      Années, départements, filières et promotions — socle de l’emploi du temps
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="annees" icon="event" label="Années académiques" no-caps />
      <q-tab name="departements" icon="apartment" label="Départements" no-caps />
      <q-tab name="filieres" icon="account_tree" label="Filières" no-caps />
      <q-tab name="promotions" icon="groups" label="Promotions" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------- Années -->
      <q-tab-panel name="annees" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="annees"
          :columns="colonnesAnnees"
          row-key="id"
          :pagination="{ rowsPerPage: 10 }"
        >
          <template #top-right>
            <q-btn unelevated color="primary" no-caps icon="add" label="Année" @click="ouvrirAnnee(null)" />
          </template>
          <template #body-cell-active="p">
            <q-td :props="p">
              <q-chip v-if="p.row.active" dense color="positive" text-color="white">en cours</q-chip>
              <span v-else class="text-grey-6">—</span>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="edit" @click="ouvrirAnnee(p.row)" />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- -------------------------------------------------- Départements -->
      <q-tab-panel name="departements" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="departements"
          :columns="colonnesDepartements"
          row-key="id"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #top-right>
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="add"
              label="Département"
              @click="ouvrirDepartement(null)"
            />
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="edit" @click="ouvrirDepartement(p.row)" />
              <q-btn flat dense round color="negative" icon="delete" @click="supprimer('departements', p.row.nom, p.row.id)" />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ------------------------------------------------------ Filières -->
      <q-tab-panel name="filieres" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="filieres"
          :columns="colonnesFilieres"
          row-key="id"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #top-right>
            <q-btn unelevated color="primary" no-caps icon="add" label="Filière" @click="ouvrirFiliere(null)" />
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="edit" @click="ouvrirFiliere(p.row)" />
              <q-btn flat dense round color="negative" icon="delete" @click="supprimer('filieres', p.row.nom, p.row.id)" />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ---------------------------------------------------- Promotions -->
      <q-tab-panel name="promotions" class="q-pa-none">
        <q-table
          flat
          bordered
          class="carte"
          :rows="promotions"
          :columns="colonnesPromotions"
          row-key="id"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #top-right>
            <q-btn unelevated color="primary" no-caps icon="add" label="Promotion" @click="ouvrirPromotion(null)" />
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="edit" @click="ouvrirPromotion(p.row)" />
              <q-btn flat dense round color="negative" icon="delete" @click="supprimer('promotions', p.row.nom, p.row.id)" />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Formulaire année -->
    <q-dialog v-model="dialogAnnee">
      <q-card style="width: 420px; max-width: 95vw">
        <q-card-section class="text-h6">Année académique</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="formAnnee.libelle" outlined dense label="Libellé *" hint="ex. 2025-2026" />
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <champ-date v-model="formAnnee.dateDebut" label="Début" />
            </div>
            <div class="col-6">
              <champ-date v-model="formAnnee.dateFin" label="Fin" />
            </div>
          </div>
          <q-toggle v-model="formAnnee.active" label="Année en cours" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Enregistrer" @click="enregistrerAnnee" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Formulaire département -->
    <q-dialog v-model="dialogDepartement">
      <q-card style="width: 420px; max-width: 95vw">
        <q-card-section class="text-h6">Département</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="formDepartement.code" outlined dense label="Code *" />
          <q-input v-model="formDepartement.nom" outlined dense label="Nom *" />
          <q-input v-model="formDepartement.faculte" outlined dense label="Faculté / UFR" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Enregistrer" @click="enregistrerDepartement" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Formulaire filière -->
    <q-dialog v-model="dialogFiliere">
      <q-card style="width: 420px; max-width: 95vw">
        <q-card-section class="text-h6">Filière</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="formFiliere.code" outlined dense label="Code *" />
          <q-input v-model="formFiliere.nom" outlined dense label="Nom *" />
          <q-select
            v-model="formFiliere.departementId"
            :options="optionsDepartements"
            outlined
            dense
            emit-value
            map-options
            label="Département *"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Enregistrer" @click="enregistrerFiliere" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Formulaire promotion -->
    <q-dialog v-model="dialogPromotion">
      <q-card style="width: 440px; max-width: 95vw">
        <q-card-section class="text-h6">Promotion</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="formPromotion.nom" outlined dense label="Nom *" hint="ex. L1 Génie Logiciel" />
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-select v-model="formPromotion.niveau" :options="NIVEAUX" outlined dense label="Niveau *" />
            </div>
            <div class="col-6">
              <q-input v-model.number="formPromotion.effectif" type="number" outlined dense label="Effectif" />
            </div>
          </div>
          <q-select
            v-model="formPromotion.filiereId"
            :options="optionsFilieres"
            outlined
            dense
            emit-value
            map-options
            label="Filière *"
          />
          <q-select
            v-model="formPromotion.anneeId"
            :options="optionsAnnees"
            outlined
            dense
            emit-value
            map-options
            label="Année académique *"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Enregistrer" @click="enregistrerPromotion" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { NIVEAUX, dateLisible } from '../utils/libelles';
import type { AnneeAcademique, Departement, Filiere, Promotion } from '../types';

const $q = useQuasar();

const onglet = ref('departements');
const annees = ref<AnneeAcademique[]>([]);
const departements = ref<Departement[]>([]);
const filieres = ref<Filiere[]>([]);
const promotions = ref<Promotion[]>([]);

const dialogAnnee = ref(false);
const dialogDepartement = ref(false);
const dialogFiliere = ref(false);
const dialogPromotion = ref(false);

const anneeEditee = ref<AnneeAcademique | null>(null);
const departementEdite = ref<Departement | null>(null);
const filiereEditee = ref<Filiere | null>(null);
const promotionEditee = ref<Promotion | null>(null);

const formAnnee = ref({ libelle: '', dateDebut: '', dateFin: '', active: false });
const formDepartement = ref({ code: '', nom: '', faculte: '' });
const formFiliere = ref({ code: '', nom: '', departementId: '' });
const formPromotion = ref({ nom: '', niveau: 'L1', effectif: 0, filiereId: '', anneeId: '' });

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);
const optionsFilieres = computed(() =>
  filieres.value.map((f) => ({ label: `${f.nom} (${f.departement?.code ?? ''})`, value: f.id })),
);
const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

const colonnesAnnees: QTableColumn[] = [
  { name: 'libelle', label: 'Année', field: 'libelle', align: 'left', sortable: true },
  { name: 'debut', label: 'Début', field: (r: AnneeAcademique) => dateLisible(r.dateDebut), align: 'left' },
  { name: 'fin', label: 'Fin', field: (r: AnneeAcademique) => dateLisible(r.dateFin), align: 'left' },
  { name: 'active', label: 'Statut', field: 'active', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesDepartements: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: 'Nom', field: 'nom', align: 'left', sortable: true },
  { name: 'faculte', label: 'Faculté', field: 'faculte', align: 'left' },
  {
    name: 'enseignants',
    label: 'Enseignants',
    field: (r: Departement) => r._count?.enseignants ?? 0,
    align: 'right',
  },
  {
    name: 'filieres',
    label: 'Filières',
    field: (r: Departement) => r._count?.filieres ?? 0,
    align: 'right',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesFilieres: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: 'Nom', field: 'nom', align: 'left', sortable: true },
  {
    name: 'departement',
    label: 'Département',
    field: (r: Filiere) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesPromotions: QTableColumn[] = [
  { name: 'nom', label: 'Promotion', field: 'nom', align: 'left', sortable: true },
  { name: 'niveau', label: 'Niveau', field: 'niveau', align: 'left', sortable: true },
  {
    name: 'filiere',
    label: 'Filière',
    field: (r: Promotion) => r.filiere?.nom ?? '—',
    align: 'left',
  },
  { name: 'effectif', label: 'Effectif', field: 'effectif', align: 'right', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrirAnnee(a: AnneeAcademique | null) {
  anneeEditee.value = a;
  formAnnee.value = {
    libelle: a?.libelle ?? '',
    dateDebut: a?.dateDebut?.slice(0, 10) ?? '',
    dateFin: a?.dateFin?.slice(0, 10) ?? '',
    active: a?.active ?? false,
  };
  dialogAnnee.value = true;
}

function ouvrirDepartement(d: Departement | null) {
  departementEdite.value = d;
  formDepartement.value = { code: d?.code ?? '', nom: d?.nom ?? '', faculte: d?.faculte ?? '' };
  dialogDepartement.value = true;
}

function ouvrirFiliere(f: Filiere | null) {
  filiereEditee.value = f;
  formFiliere.value = {
    code: f?.code ?? '',
    nom: f?.nom ?? '',
    departementId: f?.departementId ?? '',
  };
  dialogFiliere.value = true;
}

function ouvrirPromotion(p: Promotion | null) {
  promotionEditee.value = p;
  formPromotion.value = {
    nom: p?.nom ?? '',
    niveau: p?.niveau ?? 'L1',
    effectif: p?.effectif ?? 0,
    filiereId: p?.filiereId ?? '',
    anneeId: p?.anneeId ?? annees.value.find((a) => a.active)?.id ?? '',
  };
  dialogPromotion.value = true;
}

async function enregistrerAnnee() {
  const url = anneeEditee.value ? `/annees/${anneeEditee.value.id}` : '/annees';
  await (anneeEditee.value ? api.put(url, formAnnee.value) : api.post(url, formAnnee.value));
  dialogAnnee.value = false;
  await charger();
}

async function enregistrerDepartement() {
  const payload = { ...formDepartement.value, faculte: formDepartement.value.faculte || undefined };
  const url = departementEdite.value ? `/departements/${departementEdite.value.id}` : '/departements';
  await (departementEdite.value ? api.put(url, payload) : api.post(url, payload));
  dialogDepartement.value = false;
  await charger();
}

async function enregistrerFiliere() {
  const url = filiereEditee.value ? `/filieres/${filiereEditee.value.id}` : '/filieres';
  await (filiereEditee.value ? api.put(url, formFiliere.value) : api.post(url, formFiliere.value));
  dialogFiliere.value = false;
  await charger();
}

async function enregistrerPromotion() {
  const url = promotionEditee.value ? `/promotions/${promotionEditee.value.id}` : '/promotions';
  await (promotionEditee.value
    ? api.put(url, formPromotion.value)
    : api.post(url, formPromotion.value));
  dialogPromotion.value = false;
  await charger();
}

function supprimer(ressource: string, libelle: string, id: string) {
  $q.dialog({
    title: 'Supprimer',
    message: `Supprimer « ${libelle} » ? Les données rattachées seront également supprimées.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/${ressource}/${id}`);
    await charger();
  });
}

async function charger() {
  const [a, d, f, p] = await Promise.all([
    api.get('/annees', { params: { all: '1' } }),
    api.get('/departements', { params: { all: '1' } }),
    api.get('/filieres', { params: { all: '1' } }),
    api.get('/promotions', { params: { all: '1' } }),
  ]);
  annees.value = a.data.data;
  departements.value = d.data.data;
  filieres.value = f.data.data;
  promotions.value = p.data.data;
}

onMounted(charger);
</script>
