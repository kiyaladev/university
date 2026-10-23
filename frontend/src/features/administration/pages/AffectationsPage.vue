<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('affectations.title')" :subtitle="$t('affectations.subtitle')">
      <template v-if="auth.peutPlanifier" #actions>
        <q-btn unelevated color="primary" no-caps icon="add" :label="$t('affectations.actions.new')" @click="ouvrir(null)" />
      </template>
    </page-header>

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
          :label="$t('common.fields.teacher')"
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
          :label="$t('common.fields.subject')"
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
          :label="$t('common.fields.promotion')"
        />
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.academicYear')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="aff.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="aff.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="assignment_ind" :titre="messageVide">
          <template #action>
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
              :label="$t('common.actions.reset_filters')"
              @click="reinitialiser"
            />
          </template>
        </etat-vide>
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
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
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
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="a in aff.lignes" :key="a.id" flat bordered class="carte grille-cartes__carte">
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
            {{ a.annee?.libelle ?? '—' }} {{ $t('common.format.emptyValue') }} {{ $t('affectations.cardView.contractualVolume') }}
            <span class="chiffres">{{ $t('common.units.hours', { n: a.volumeHorairePrevu }) }}</span>
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
            :label="$t('common.actions.edit')"
            @click="ouvrir(a)"
          />
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            :label="$t('common.actions.delete')"
            @click="supprimer(a)"
          />
        </q-card-actions>
      </q-card>
      <etat-vide v-if="!aff.lignes.length && !aff.chargement" icone="assignment_ind" :titre="messageVide">
        <template #action>
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
            :label="$t('common.actions.reset_filters')"
            @click="reinitialiser"
          />
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-if="aff.lignes.length"
      v-model:page="aff.page"
      v-model:page-size="aff.pageSize"
      :total="aff.total"
      @tous="aff.toutAfficher()"
    />

    <dialogue-formulaire
      v-model="dialogOuvert"
      :titre="affectationEditee ? $t('affectations.dialog.editTitle') : $t('affectations.dialog.newTitle')"
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrer"
    >
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
        :label="$t('common.fields.teacherRequired')"
        :rules="[(v: string) => !!v || $t('affectations.dialog.fields.teacherError')]"
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
        :label="$t('common.fields.subjectRequired')"
        :rules="[(v: string) => !!v || $t('affectations.dialog.fields.subjectError')]"
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
        :label="$t('common.fields.promotionRequired')"
        :rules="[(v: string) => !!v || $t('affectations.dialog.fields.promotionError')]"
      />
      <q-select
        v-model="form.anneeId"
        :options="optionsAnnees"
        outlined
        dense
        emit-value
        map-options
        :label="$t('common.fields.academicYearRequired')"
        :rules="[(v: string) => !!v || $t('affectations.dialog.fields.yearError')]"
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
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/presentationListe';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import FilterBar from '@/shared/components/FilterBar.vue';
import PaginationBar from '@/shared/components/PaginationBar.vue';
import PageHeader from '@/shared/components/PageHeader.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import type { Affectation, AnneeAcademique, Enseignant, Matiere, Promotion, ChipFiltre } from '@/types';

/** Le backend joint l'année académique ; le type partagé ne la déclare pas. */
interface Charge extends Affectation {
  annee?: AnneeAcademique | null;
}

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const { supprimerAvecConfirmation } = useConfirmation();

const enseignants = ref<Enseignant[]>([]);
const matieres = ref<Matiere[]>([]);
const promotions = ref<Promotion[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const optionsMatieres = ref<{ label: string; value: string }[]>([]);

const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const affectationEditee = ref<Charge | null>(null);
const enregistrement = ref(false);

// Filtres gardés dans l'URL : l'arrivée depuis « Enseignants », « Matières »
// ou « Structure académique » pré-filtre la liste des charges.
const filtres = ref<Record<string, any>>({
  recherche: '',
  enseignantId: null,
  matiereId: null,
  promotionId: null,
  anneeId: null,
});
const aff = reactive(
  useListePaginee<Charge>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/affectations', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            enseignantId: f.enseignantId || undefined,
            matiereId: f.matiereId || undefined,
            promotionId: f.promotionId || undefined,
            anneeId: f.anneeId || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

const form = ref({
  enseignantId: '',
  matiereId: '',
  promotionId: '',
  anneeId: '',
  volumeHorairePrevu: 0,
});

/** Supprimer une charge est réservé à l'administration et à la scolarité. */
const peutSupprimer = computed(() => auth.peut('affectations.supprimer'));

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
  { name: 'enseignant', label: t('common.fields.teacher'), field: 'enseignantId', align: 'left' },
  { name: 'matiere', label: t('common.fields.subject'), field: 'matiereId', align: 'left' },
  {
    name: 'promotion',
    label: t('affectations.table.columns.promotion'),
    field: (r: Charge) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'annee',
    label: t('common.fields.year'),
    field: (r: Charge) => r.annee?.libelle ?? '—',
    align: 'left',
  },
  {
    name: 'volume',
    label: t('affectations.table.columns.volume'),
    field: (r: Charge) => `${r.volumeHorairePrevu} h`,
    align: 'right',
  },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);

function ouvrir(a: Charge | null) {
  affectationEditee.value = a;
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
  enregistrement.value = true;
  try {
    if (affectationEditee.value) {
      await api.put(`/affectations/${affectationEditee.value.id}`, form.value);
    } else {
      await api.post('/affectations', form.value);
    }
    $q.notify({ type: 'positive', message: t('affectations.messages.saved') });
    dialogOuvert.value = false;
    await aff.recharger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(a: Charge) {
  const teacher = `${a.enseignant?.nom ?? ''} ${a.enseignant?.prenom ?? ''}`.trim();
  void supprimerAvecConfirmation(`/affectations/${a.id}`, a.matiere?.intitule ?? '?', aff.recharger, {
    titre: t('affectations.deleteDialog.title'),
    message: t('affectations.deleteDialog.message', { subject: a.matiere?.intitule ?? '?', teacher }),
    ok: t('common.actions.delete'),
    succes: t('affectations.messages.deleted'),
  });
}

function reinitialiser() {
  aff.reinitialiser([]);
}

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
