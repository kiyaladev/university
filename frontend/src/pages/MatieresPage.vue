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

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (code, intitulé)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Département"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="matieres"
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
      :rows="matieres"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="menu_book" size="34px" />
          <div class="pochoir">{{ messageVide }}</div>
          <q-btn
            v-if="auth.peutPlanifier && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Créer la première matière"
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

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="assignment_ind"
            aria-label="Voir les charges d’enseignement de la matière"
            @click="voirCharges(p.row)"
          >
            <q-tooltip>Qui l’enseigne</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            round
            icon="edit"
            aria-label="Modifier la matière"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            aria-label="Supprimer la matière"
            @click="supprimer(p.row)"
          >
            <q-tooltip>Supprimer</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="m in matieres" :key="m.id" flat bordered class="carte grille-cartes__carte">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip dense outline color="primary">{{ m.code }}</q-chip>
            <q-space />
            <div class="text-caption text-grey-7">{{ m.credits }} crédits</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ m.intitule }}</div>
          <div class="text-caption text-grey-7">{{ m.departement?.nom ?? 'Sans département' }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            Volume horaire <span class="chiffres">{{ m.volumeHoraireTotal }} h</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            flat
            dense
            no-caps
            icon="assignment_ind"
            label="Qui l’enseigne"
            @click="voirCharges(m)"
          />
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            label="Modifier"
            @click="ouvrir(m)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!matieres.length && !chargement" class="etat-vide">
        <q-icon name="menu_book" size="34px" />
        <div class="pochoir">{{ messageVide }}</div>
        <q-btn
          v-if="auth.peutPlanifier && !filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Créer la première matière"
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
      v-if="matieres.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

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
              <q-input
                v-model="form.code"
                outlined
                dense
                label="Code *"
                hint="ex. INF-201"
                :error="erreurs.code"
                error-message="Le code est obligatoire"
              />
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
          <q-input
            v-model="form.intitule"
            outlined
            dense
            label="Intitulé *"
            :error="erreurs.intitule"
            error-message="L’intitulé est obligatoire"
          />
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-input
                v-model.number="form.volumeHoraireTotal"
                type="number"
                min="0"
                outlined
                dense
                label="Volume horaire (h)"
                hint="Pré-remplit les charges d’enseignement"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model.number="form.credits"
                type="number"
                min="0"
                outlined
                dense
                label="Crédits"
              />
            </div>
          </div>
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
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import type { Departement, Matiere, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const matieres = ref<Matiere[]>([]);
const departements = ref<Departement[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const dialogOuvert = ref(false);
const matiereEditee = ref<Matiere | null>(null);
const enregistrement = ref(false);

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filtres = ref<Record<string, any>>({});

const form = ref({
  code: '',
  intitule: '',
  volumeHoraireTotal: 0,
  credits: 0,
  departementId: null as string | null,
});
const erreurs = ref({ code: false, intitule: false });

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.departementId),
);
const messageVide = computed(() =>
  filtresActifs.value ? 'Aucune matière pour ces critères.' : 'Aucune matière enregistrée.',
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
  if (filtres.value.departementId) {
    const d = departements.value.find((x) => x.id === filtres.value.departementId);
    cs.push({
      label: `Département : ${d?.nom ?? '?'}`,
      value: filtres.value.departementId,
      icone: 'apartment',
    });
  }
  return cs;
});

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
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
];

function ouvrir(m: Matiere | null) {
  matiereEditee.value = m;
  dialogOuvert.value = true;
}

/** Une matière se comprend par ceux qui la portent : on ouvre ses charges. */
function voirCharges(m: Matiere) {
  void router.push({ path: '/affectations', query: { matiereId: m.id } });
}

watch(dialogOuvert, (ouvert) => {
  if (!ouvert) return;
  const m = matiereEditee.value;
  erreurs.value = { code: false, intitule: false };
  form.value = {
    code: m?.code ?? '',
    intitule: m?.intitule ?? '',
    volumeHoraireTotal: m?.volumeHoraireTotal ?? 0,
    credits: m?.credits ?? 0,
    departementId: m?.departementId ?? filtres.value.departementId ?? null,
  };
});

async function enregistrer() {
  erreurs.value = {
    code: !form.value.code.trim(),
    intitule: !form.value.intitule.trim(),
  };
  if (erreurs.value.code || erreurs.value.intitule) {
    $q.notify({ type: 'warning', message: 'Complétez les champs obligatoires' });
    return;
  }

  enregistrement.value = true;
  try {
    const payload = { ...form.value, departementId: form.value.departementId || undefined };
    if (matiereEditee.value) await api.put(`/matieres/${matiereEditee.value.id}`, payload);
    else await api.post('/matieres', payload);
    $q.notify({ type: 'positive', message: 'Matière enregistrée' });
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

function supprimer(m: Matiere) {
  $q.dialog({
    title: 'Supprimer la matière',
    message: `Supprimer « ${m.intitule} » ? Les charges d’enseignement qui la portent seront également supprimées.`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'negative', label: 'Supprimer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/matieres/${m.id}`);
      $q.notify({ type: 'positive', message: 'Matière supprimée' });
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
  if (filtres.value.departementId) params.departementId = filtres.value.departementId;
  return params;
}

async function charger(tout = false) {
  chargement.value = true;
  try {
    const { data } = await api.get('/matieres', { params: parametres(tout) });
    matieres.value = data.data ?? [];
    total.value = data.total ?? matieres.value.length;
  } catch (e: any) {
    matieres.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des matières impossible',
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
  () => [filtres.value.recherche, filtres.value.departementId],
  () => {
    page.value = 1;
    void charger();
  },
);

onMounted(async () => {
  const { data } = await api.get('/departements', { params: { all: '1' } });
  departements.value = data.data;
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
