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

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (enseignant, matière, promotion)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.enseignantId"
          :options="optionsEnseignants"
          outlined
          dense
          clearable
          emit-value
          map-options
          use-input
          input-debounce="0"
          label="Enseignant"
          @filter="filtrerEnseignants"
        />
        <q-select
          v-model="filtres.matiereId"
          :options="optionsMatieres"
          outlined
          dense
          clearable
          emit-value
          map-options
          use-input
          input-debounce="0"
          label="Matière"
          @filter="filtrerMatieres"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Promotion"
        />
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Année académique"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="affectations"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="affectations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="assignment_ind" size="34px" />
          <div class="pochoir">{{ messageVide }}</div>
          <q-btn
            v-if="auth.peutPlanifier && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Créer la première affectation"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            label="Réinitialiser les filtres"
            @click="reinitialiser"
          />
        </div>
      </template>

      <template #body-cell-enseignant="p">
        <q-td :props="p">
          <div>{{ p.row.enseignant?.nom }} {{ p.row.enseignant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.enseignant?.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-matiere="p">
        <q-td :props="p">
          <div>{{ p.row.matiere?.intitule }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matiere?.code }}</div>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            round
            icon="edit"
            aria-label="Modifier l’affectation"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            color="negative"
            icon="delete"
            aria-label="Supprimer l’affectation"
            @click="supprimer(p.row)"
          >
            <q-tooltip>Supprimer</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="a in affectations" :key="a.id" flat bordered class="carte grille-cartes__carte">
        <q-card-section>
          <div class="text-subtitle1 text-weight-medium">{{ a.matiere?.intitule }}</div>
          <div class="text-caption text-grey-7">{{ a.matiere?.code }}</div>
          <div class="q-mt-sm">
            <q-chip dense outline color="primary" icon="person">
              {{ a.enseignant?.nom }} {{ a.enseignant?.prenom }}
            </q-chip>
            <q-chip dense outline color="secondary" icon="groups">
              {{ a.promotion?.nom ?? '—' }}
            </q-chip>
          </div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ a.annee?.libelle ?? '—' }} — volume contractuel
            <span class="chiffres">{{ a.volumeHorairePrevu }} h</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            label="Modifier"
            @click="ouvrir(a)"
          />
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            label="Supprimer"
            @click="supprimer(a)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!affectations.length && !chargement" class="etat-vide">
        <q-icon name="assignment_ind" size="34px" />
        <div class="pochoir">{{ messageVide }}</div>
        <q-btn
          v-if="auth.peutPlanifier && !filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Créer la première affectation"
          @click="ouvrir(null)"
        />
        <q-btn
          v-else-if="filtresActifs"
          flat
          no-caps
          icon="refresh"
          label="Réinitialiser les filtres"
          @click="reinitialiser"
        />
      </div>
    </div>

    <pagination-bar
      v-if="affectations.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ affectationEditee ? 'Modifier l’affectation' : 'Nouvelle affectation' }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">Qui enseigne quoi</span>
          <q-select
            v-model="form.enseignantId"
            :options="optionsEnseignants"
            outlined
            dense
            emit-value
            map-options
            use-input
            input-debounce="0"
            label="Enseignant *"
            :error="erreurs.enseignantId"
            error-message="Choisissez l’enseignant"
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
            input-debounce="0"
            label="Matière *"
            :error="erreurs.matiereId"
            error-message="Choisissez la matière"
            @filter="filtrerMatieres"
          />

          <span class="section-titre">Pour qui, et quand</span>
          <q-select
            v-model="form.promotionId"
            :options="optionsPromotions"
            outlined
            dense
            emit-value
            map-options
            label="Promotion *"
            :error="erreurs.promotionId"
            error-message="Choisissez la promotion"
          />
          <q-select
            v-model="form.anneeId"
            :options="optionsAnnees"
            outlined
            dense
            emit-value
            map-options
            label="Année académique *"
            :error="erreurs.anneeId"
            error-message="Choisissez l’année académique"
          />
          <q-input
            v-model.number="form.volumeHorairePrevu"
            type="number"
            min="0"
            outlined
            dense
            label="Volume horaire contractuel (h)"
            hint="Sert au suivi « heures réalisées / heures dues »"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            label="Enregistrer"
            :loading="enregistrement"
            @click="enregistrer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import type { Affectation, AnneeAcademique, Enseignant, Matiere, Promotion, ChipFiltre } from '../types';

/** Le backend joint l'année académique ; le type partagé ne la déclare pas. */
interface Charge extends Affectation {
  annee?: AnneeAcademique | null;
}

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();

const affectations = ref<Charge[]>([]);
const enseignants = ref<Enseignant[]>([]);
const matieres = ref<Matiere[]>([]);
const promotions = ref<Promotion[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const optionsMatieres = ref<{ label: string; value: string }[]>([]);

const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const dialogOuvert = ref(false);
const affectationEditee = ref<Charge | null>(null);
const enregistrement = ref(false);

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filtres = ref<Record<string, any>>({});

const form = ref({
  enseignantId: '',
  matiereId: '',
  promotionId: '',
  anneeId: '',
  volumeHorairePrevu: 0,
});
const erreurs = ref({
  enseignantId: false,
  matiereId: false,
  promotionId: false,
  anneeId: false,
});

/** Supprimer une charge est réservé à l'administration et à la scolarité. */
const peutSupprimer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const optionsPromotions = computed(() =>
  promotions.value.map((p) => ({ label: p.nom, value: p.id })),
);
const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

const filtresActifs = computed(() =>
  Boolean(
    filtres.value.recherche ||
      filtres.value.enseignantId ||
      filtres.value.matiereId ||
      filtres.value.promotionId ||
      filtres.value.anneeId,
  ),
);
const messageVide = computed(() =>
  filtresActifs.value
    ? 'Aucune charge d’enseignement pour ces critères.'
    : 'Aucune charge d’enseignement enregistrée.',
);

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
  if (filtres.value.enseignantId) {
    const e = enseignants.value.find((x) => x.id === filtres.value.enseignantId);
    cs.push({
      label: `Enseignant : ${e ? `${e.nom} ${e.prenom}` : '?'}`,
      value: filtres.value.enseignantId,
      icone: 'person',
    });
  }
  if (filtres.value.matiereId) {
    const m = matieres.value.find((x) => x.id === filtres.value.matiereId);
    cs.push({
      label: `Matière : ${m?.intitule ?? '?'}`,
      value: filtres.value.matiereId,
      icone: 'menu_book',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: `Promotion : ${p?.nom ?? '?'}`,
      value: filtres.value.promotionId,
      icone: 'groups',
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({
      label: `Année : ${a?.libelle ?? '?'}`,
      value: filtres.value.anneeId,
      icone: 'event',
    });
  }
  return cs;
});

const colonnes: QTableColumn[] = [
  { name: 'enseignant', label: 'Enseignant', field: 'enseignantId', align: 'left' },
  { name: 'matiere', label: 'Matière', field: 'matiereId', align: 'left' },
  {
    name: 'promotion',
    label: 'Promotion',
    field: (r: Charge) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'annee',
    label: 'Année',
    field: (r: Charge) => r.annee?.libelle ?? '—',
    align: 'left',
  },
  {
    name: 'volume',
    label: 'Volume prévu',
    field: (r: Charge) => `${r.volumeHorairePrevu} h`,
    align: 'right',
  },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
];

function ouvrir(a: Charge | null) {
  affectationEditee.value = a;
  erreurs.value = {
    enseignantId: false,
    matiereId: false,
    promotionId: false,
    anneeId: false,
  };
  form.value = {
    enseignantId: a?.enseignantId ?? filtres.value.enseignantId ?? '',
    matiereId: a?.matiereId ?? filtres.value.matiereId ?? '',
    promotionId: a?.promotionId ?? filtres.value.promotionId ?? '',
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
  erreurs.value = {
    enseignantId: !form.value.enseignantId,
    matiereId: !form.value.matiereId,
    promotionId: !form.value.promotionId,
    anneeId: !form.value.anneeId,
  };
  if (Object.values(erreurs.value).some(Boolean)) {
    $q.notify({ type: 'warning', message: 'Complétez les champs obligatoires' });
    return;
  }

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
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Enregistrement impossible',
    });
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(a: Charge) {
  $q.dialog({
    title: 'Supprimer l’affectation',
    message: `« ${a.matiere?.intitule ?? 'Matière'} » confiée à ${a.enseignant?.nom ?? ''} ${
      a.enseignant?.prenom ?? ''
    } : les séances liées seront également supprimées. Continuer ?`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'negative', label: 'Supprimer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/affectations/${a.id}`);
      $q.notify({ type: 'positive', message: 'Affectation supprimée' });
      await charger();
    } catch (e: any) {
      $q.notify({
        type: 'negative',
        message: e?.response?.data?.message ?? 'Suppression impossible',
      });
    }
  });
}

function parametres(tout = false) {
  const params: Record<string, any> = tout
    ? { all: '1' }
    : { page: page.value, pageSize: pageSize.value };
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.enseignantId) params.enseignantId = filtres.value.enseignantId;
  if (filtres.value.matiereId) params.matiereId = filtres.value.matiereId;
  if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
  if (filtres.value.anneeId) params.anneeId = filtres.value.anneeId;
  return params;
}

async function charger(tout = false) {
  chargement.value = true;
  try {
    const { data } = await api.get('/affectations', { params: parametres(tout) });
    affectations.value = data.data ?? [];
    total.value = data.total ?? affectations.value.length;
  } catch (e: any) {
    affectations.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des charges impossible',
    });
  } finally {
    chargement.value = false;
  }
}

function chargerTout() {
  page.value = 1;
  return charger(true);
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  void charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.enseignantId,
    filtres.value.matiereId,
    filtres.value.promotionId,
    filtres.value.anneeId,
  ],
  () => {
    page.value = 1;
    void charger();
  },
);

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
  optionsEnseignants.value = enseignants.value.map((x) => ({
    label: `${x.nom} ${x.prenom} (${x.matricule})`,
    value: x.id,
  }));
  optionsMatieres.value = matieres.value.map((x) => ({
    label: `${x.code} — ${x.intitule}`,
    value: x.id,
  }));

  // Arrivée depuis « Enseignants », « Matières » ou « Structure académique » :
  // la fiche d'origine pré-filtre la liste des charges.
  const depuis: Record<string, any> = {};
  for (const cle of ['enseignantId', 'matiereId', 'promotionId', 'anneeId']) {
    const v = route.query[cle];
    if (typeof v === 'string' && v) depuis[cle] = v;
  }
  if (Object.keys(depuis).length) {
    filtres.value = depuis;
    return; // le watcher déclenche le chargement
  }
  await charger();
});
</script>

<style scoped lang="scss">
.grille-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.grille-cartes__carte {
  background: var(--up-plaque);
}
</style>
