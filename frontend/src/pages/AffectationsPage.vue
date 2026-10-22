<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('affectations.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('affectations.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('affectations.actions.new')"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('affectations.filters.searchPlaceholder')"
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
          :label="$t('affectations.filters.teacher')"
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
          :label="$t('affectations.filters.subject')"
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
          :label="$t('affectations.filters.promotion')"
        />
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('affectations.filters.year')"
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
            :label="$t('affectations.actions.createFirst')"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            :label="$t('affectations.actions.resetFilters')"
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
            :aria-label="$t('affectations.actions.editAria')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('affectations.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('affectations.actions.deleteAria')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('affectations.actions.delete') }}</q-tooltip>
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
            {{ a.annee?.libelle ?? '—' }} {{ $t('rectoratPage.subtitleFallback') }} {{ $t('affectations.cardView.contractualVolume') }}
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
            :label="$t('affectations.actions.edit')"
            @click="ouvrir(a)"
          />
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            :label="$t('affectations.actions.delete')"
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
          :label="$t('affectations.actions.createFirst')"
          @click="ouvrir(null)"
        />
        <q-btn
          v-else-if="filtresActifs"
          flat
          no-caps
          icon="refresh"
          :label="$t('affectations.actions.resetFilters')"
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
          {{ affectationEditee ? $t('affectations.dialog.editTitle') : $t('affectations.dialog.newTitle') }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">{{ $t('affectations.dialog.sections.who') }}</span>
          <q-select
            v-model="form.enseignantId"
            :options="optionsEnseignants"
            outlined
            dense
            emit-value
            map-options
            use-input
            input-debounce="0"
            :label="$t('affectations.dialog.fields.teacher')"
            :error="erreurs.enseignantId"
            :error-message="$t('affectations.dialog.fields.teacherError')"
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
            :label="$t('affectations.dialog.fields.subject')"
            :error="erreurs.matiereId"
            :error-message="$t('affectations.dialog.fields.subjectError')"
            @filter="filtrerMatieres"
          />

          <span class="section-titre">{{ $t('affectations.dialog.sections.when') }}</span>
          <q-select
            v-model="form.promotionId"
            :options="optionsPromotions"
            outlined
            dense
            emit-value
            map-options
            :label="$t('affectations.dialog.fields.promotion')"
            :error="erreurs.promotionId"
            :error-message="$t('affectations.dialog.fields.promotionError')"
          />
          <q-select
            v-model="form.anneeId"
            :options="optionsAnnees"
            outlined
            dense
            emit-value
            map-options
            :label="$t('affectations.dialog.fields.year')"
            :error="erreurs.anneeId"
            :error-message="$t('affectations.dialog.fields.yearError')"
          />
          <q-input
            v-model.number="form.volumeHorairePrevu"
            type="number"
            min="0"
            outlined
            dense
            :label="$t('affectations.dialog.fields.volume')"
            :hint="$t('affectations.dialog.fields.volumeHint')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('affectations.dialog.cancel')" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            :label="$t('affectations.dialog.save')"
            :loading="enregistrement"
            @click="enregistrer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import type { Affectation, AnneeAcademique, Enseignant, Matiere, Promotion, ChipFiltre } from '../types';

/** Le backend joint l'année académique ; le type partagé ne la déclare pas. */
interface Charge extends Affectation {
  annee?: AnneeAcademique | null;
}

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const route = useRoute();
const { t } = useI18n();

const affectations = ref<Charge[]>([]);
const enseignants = ref<Enseignant[]>([]);
const matieres = ref<Matiere[]>([]);
const promotions = ref<Promotion[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const optionsMatieres = ref<{ label: string; value: string }[]>([]);

const chargement = ref(false);
const modeVue = usePresentationListe();
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
  filtresActifs.value ? t('affectations.emptyState.filtered') : t('affectations.emptyState.none'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('affectations.chips.search', { query: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.enseignantId) {
    const e = enseignants.value.find((x) => x.id === filtres.value.enseignantId);
    cs.push({
      label: t('affectations.chips.teacher', { name: e ? `${e.nom} ${e.prenom}` : '?' }),
      value: filtres.value.enseignantId,
      icone: 'person',
    });
  }
  if (filtres.value.matiereId) {
    const m = matieres.value.find((x) => x.id === filtres.value.matiereId);
    cs.push({
      label: t('affectations.chips.subject', { name: m?.intitule ?? '?' }),
      value: filtres.value.matiereId,
      icone: 'menu_book',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('affectations.chips.promotion', { name: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'groups',
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({
      label: t('affectations.chips.year', { name: a?.libelle ?? '?' }),
      value: filtres.value.anneeId,
      icone: 'event',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'enseignant', label: t('affectations.table.columns.teacher'), field: 'enseignantId', align: 'left' },
  { name: 'matiere', label: t('affectations.table.columns.subject'), field: 'matiereId', align: 'left' },
  {
    name: 'promotion',
    label: t('affectations.table.columns.promotion'),
    field: (r: Charge) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'annee',
    label: t('affectations.table.columns.year'),
    field: (r: Charge) => r.annee?.libelle ?? '—',
    align: 'left',
  },
  {
    name: 'volume',
    label: t('affectations.table.columns.volume'),
    field: (r: Charge) => `${r.volumeHorairePrevu} h`,
    align: 'right',
  },
  { name: 'actions', label: t('affectations.table.columns.actions'), field: 'id', align: 'right' },
]);

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
    anneeId: a?.anneeId ?? referentiels.anneeCourante?.id ?? '',
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
    $q.notify({ type: 'warning', message: t('affectations.messages.fillRequired') });
    return;
  }

  enregistrement.value = true;
  try {
    if (affectationEditee.value) {
      await api.put(`/affectations/${affectationEditee.value.id}`, form.value);
    } else {
      await api.post('/affectations', form.value);
    }
    $q.notify({ type: 'positive', message: t('affectations.messages.saved') });
    dialogOuvert.value = false;
    await charger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(a: Charge) {
  $q.dialog({
    title: t('affectations.deleteDialog.title'),
    message: t('affectations.deleteDialog.message', {
      subject: a.matiere?.intitule ?? '?',
      teacher: `${a.enseignant?.nom ?? ''} ${a.enseignant?.prenom ?? ''}`.trim(),
    }),
    cancel: { label: t('affectations.deleteDialog.cancel'), flat: true, noCaps: true },
    ok: { color: 'negative', label: t('affectations.deleteDialog.confirm'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/affectations/${a.id}`);
      $q.notify({ type: 'positive', message: t('affectations.messages.deleted') });
      await charger();
    } catch {
      /* notifié par l'intercepteur */
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
  } catch {
    affectations.value = [];
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
  [enseignants.value, matieres.value, promotions.value, annees.value] = await Promise.all([
    referentiels.enseignants(),
    referentiels.matieres(),
    referentiels.promotions(),
    referentiels.annees(),
  ]);
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
