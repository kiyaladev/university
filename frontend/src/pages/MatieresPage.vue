<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('matieres.title')" :subtitle="$t('matieres.subtitle')">
      <template v-if="auth.peutPlanifier" #actions>
        <q-btn unelevated color="primary" no-caps icon="add" :label="$t('matieres.actions.new')" @click="ouvrir(null)" />
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('matieres.filters.searchPlaceholder')"
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
          :label="$t('common.fields.department')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="mat.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="mat.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="menu_book" :titre="messageVide">
          <template #action>
            <q-btn
              v-if="auth.peutPlanifier && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('matieres.emptyState.create')"
              @click="ouvrir(null)"
            />
            <q-btn
              v-else-if="filtresActifs"
              flat
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
              @click="reinitialiser"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
<q-btn
            v-if="auth.peutPlanifier"
            flat
            dense no-caps
            icon="edit"
            :aria-label="$t('matieres.actionsColumn.editAria')" :label="$t('matieres.actionsColumn.editAria')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="assignment_ind"
            :aria-label="$t('matieres.actionsColumn.whoTeachesAria')" :label="$t('matieres.actionsColumn.whoTeachesAria')"
            @click="voirCharges(p.row)"
          >
            <q-tooltip>{{ $t('matieres.actionsColumn.whoTeachesTooltip') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="auth.estAdmin"
            flat
            dense no-caps
            color="negative"
            icon="delete"
            :aria-label="$t('matieres.actionsColumn.deleteAria')" :label="$t('matieres.actionsColumn.deleteAria')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="m in mat.lignes" :key="m.id" flat bordered class="carte grille-cartes__carte">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip dense outline color="primary">{{ m.code }}</q-chip>
            <q-space />
            <div class="text-caption text-grey-7">{{ $t('matieres.card.credits', { count: m.credits }) }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ m.intitule }}</div>
          <div class="text-caption text-grey-7">{{ m.departement?.nom ?? $t('matieres.card.noDepartment') }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ $t('matieres.table.columns.volume') }} <span class="chiffres">{{ $t('common.units.hours', { n: m.volumeHoraireTotal }) }}</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            flat
            dense
            no-caps
            icon="assignment_ind"
            :label="$t('matieres.actionsColumn.whoTeachesTooltip')"
            @click="voirCharges(m)"
          />
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            :label="$t('common.actions.edit')"
            @click="ouvrir(m)"
          />
        </q-card-actions>
      </q-card>
      <etat-vide v-if="!mat.lignes.length && !mat.chargement" icone="menu_book" :titre="messageVide">
        <template #action>
          <q-btn
            v-if="auth.peutPlanifier && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('matieres.emptyState.create')"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            :label="$t('common.actions.reset_filters')"
            @click="reinitialiser"
          />
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-if="mat.lignes.length"
      v-model:page="mat.page"
      v-model:page-size="mat.pageSize"
      :total="mat.total"
      @tous="mat.toutAfficher()"
    />

    <!-- Formulaire dédié matière -->
    <dialogue-formulaire
      v-model="dialogOuvert"
      :titre="matiereEditee ? $t('matieres.dialog.editTitle') : $t('matieres.dialog.newTitle')"
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrer"
    >
      <span class="section-titre">{{ $t('matieres.dialog.sectionTitle') }}</span>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-5">
          <q-input
            v-model="form.code"
            outlined
            dense
            :label="$t('common.fields.codeRequired')"
            :hint="$t('matieres.dialog.codeHint')"
            :rules="[(v: string) => !!(v ?? '').trim() || $t('matieres.dialog.codeError')]"
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
            :label="$t('common.fields.department')"
          />
        </div>
      </div>
      <q-input
        v-model="form.intitule"
        outlined
        dense
        :label="$t('matieres.dialog.intituleLabel')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('matieres.dialog.intituleError')]"
      />
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <q-input
            v-model.number="form.volumeHoraireTotal"
            type="number"
            min="0"
            outlined
            dense
            :label="$t('matieres.dialog.volumeLabel')"
            :hint="$t('matieres.dialog.volumeHint')"
          />
        </div>
        <div class="col-6">
          <q-input
            v-model.number="form.credits"
            type="number"
            min="0"
            outlined
            dense
            :label="$t('common.fields.credits')"
          />
        </div>
      </div>
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import type { Departement, Matiere, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();
const { supprimerAvecConfirmation } = useConfirmation();

const departements = ref<Departement[]>([]);
const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const matiereEditee = ref<Matiere | null>(null);
const enregistrement = ref(false);

const filtres = ref<Record<string, any>>({ recherche: '', departementId: null });
const mat = reactive(
  useListePaginee<Matiere>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/matieres', {
          params: { ...pageApi(p), search: texteApi(f.recherche), departementId: f.departementId || undefined },
        })
        .then((r) => r.data),
  }),
);

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

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.departementId),
);
const messageVide = computed(() =>
  filtresActifs.value ? t('matieres.emptyState.filtered') : t('matieres.emptyState.empty'),
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
      label: t('matieres.filters.departmentChip', { value: d?.nom ?? '?' }),
      value: filtres.value.departementId,
      icone: 'apartment',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'intitule', label: t('common.fields.intitule'), field: 'intitule', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: Matiere) => r.departement?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'volume',
    label: t('matieres.table.columns.volume'),
    field: (r: Matiere) => `${r.volumeHoraireTotal} h`,
    align: 'right',
    sortable: true,
  },
  { name: 'credits', label: t('common.fields.credits'), field: 'credits', align: 'right' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);

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
  form.value = {
    code: m?.code ?? '',
    intitule: m?.intitule ?? '',
    volumeHoraireTotal: m?.volumeHoraireTotal ?? 0,
    credits: m?.credits ?? 0,
    departementId: m?.departementId ?? filtres.value.departementId ?? null,
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = { ...form.value, departementId: form.value.departementId || undefined };
    if (matiereEditee.value) await api.put(`/matieres/${matiereEditee.value.id}`, payload);
    else await api.post('/matieres', payload);
    $q.notify({ type: 'positive', message: t('matieres.messages.saved') });
    dialogOuvert.value = false;
    await Promise.all([mat.recharger(), referentiels.rafraichir('matieres')]);
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(m: Matiere) {
  void supprimerAvecConfirmation(
    `/matieres/${m.id}`,
    m.intitule,
    () => Promise.all([mat.recharger(), referentiels.rafraichir('matieres')]),
    {
      titre: t('matieres.deleteDialog.title'),
      message: t('matieres.deleteDialog.message', { intitule: m.intitule }),
      ok: t('common.actions.delete'),
      succes: t('matieres.messages.deleted'),
    },
  );
}

function reinitialiser() {
  mat.reinitialiser([]);
}

onMounted(async () => {
  departements.value = await referentiels.departements();
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
