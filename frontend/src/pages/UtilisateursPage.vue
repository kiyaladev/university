<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('utilisateurs.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('utilisateurs.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="person_add"
          :label="$t('utilisateurs.actions.new')"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('utilisateurs.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.role"
          :options="optionsRoles"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('utilisateurs.filters.role')"
        />
        <q-select
          v-model="filtres.departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('utilisateurs.filters.department')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="utilisateurs"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="manage_accounts" size="34px" />
          <div class="pochoir">{{ messageVide }}</div>
          <q-btn
            v-if="!filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="person_add"
            :label="$t('utilisateurs.actions.createFirst')"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else
            flat
            no-caps
            icon="refresh"
            :label="$t('utilisateurs.actions.resetFilters')"
            @click="reinitialiser"
          />
        </div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>
            {{ p.row.nom }} {{ p.row.prenom }}
            <q-badge v-if="estMoi(p.row)" color="secondary" class="q-ml-xs">{{
              $t('utilisateurs.table.you')
            }}</q-badge>
          </div>
          <div class="text-caption text-grey-7">{{ p.row.email }}</div>
        </q-td>
      </template>

      <template #body-cell-role="p">
        <q-td :props="p">
          <q-chip dense color="primary" text-color="white">{{ LIBELLE_ROLE[p.row.role] }}</q-chip>
        </q-td>
      </template>

      <template #body-cell-actif="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.actif ? 'check_circle' : 'block'"
            :color="p.row.actif ? 'positive' : 'grey-7'"
          />
          <q-tooltip>{{
            p.row.actif
              ? $t('utilisateurs.table.activeAccount')
              : $t('utilisateurs.table.disabledAccount')
          }}</q-tooltip>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.role === 'ENSEIGNANT' && ficheEnseignant(p.row)"
            flat
            dense
            round
            icon="person"
            :aria-label="$t('utilisateurs.actions.openTeacherRecordAria')"
            @click="voirFicheEnseignant(p.row)"
          >
            <q-tooltip>{{ $t('utilisateurs.table.teacherRecordTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('utilisateurs.actions.editAria')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('utilisateurs.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            color="negative"
            icon="delete"
            :disable="estMoi(p.row)"
            :aria-label="$t('utilisateurs.actions.deleteAria')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>
              {{
                estMoi(p.row)
                  ? $t('utilisateurs.table.cannotDeleteSelf')
                  : $t('utilisateurs.actions.delete')
              }}
            </q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="u in utilisateurs" :key="u.id" flat bordered class="carte grille-cartes__carte">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip dense color="primary" text-color="white">{{ LIBELLE_ROLE[u.role] }}</q-chip>
            <q-space />
            <q-icon
              :name="u.actif ? 'check_circle' : 'block'"
              :color="u.actif ? 'positive' : 'grey-7'"
            />
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ u.nom }} {{ u.prenom }}
            <q-badge v-if="estMoi(u)" color="secondary" class="q-ml-xs">{{
              $t('utilisateurs.table.you')
            }}</q-badge>
          </div>
          <div class="text-caption text-grey-7">{{ u.email }}</div>
          <div class="text-caption text-grey-7">{{ u.telephone || '—' }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ u.departementId ? nomDepartement(u) : $t('utilisateurs.table.noDepartment') }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            v-if="u.role === 'ENSEIGNANT' && ficheEnseignant(u)"
            flat
            dense
            no-caps
            icon="person"
            :label="$t('utilisateurs.actions.teacherRecord')"
            @click="voirFicheEnseignant(u)"
          />
          <q-btn
            flat
            dense
            no-caps
            icon="edit"
            :label="$t('utilisateurs.actions.edit')"
            @click="ouvrir(u)"
          />
          <q-btn
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            :label="$t('utilisateurs.actions.delete')"
            :disable="estMoi(u)"
            @click="supprimer(u)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!utilisateurs.length && !chargement" class="etat-vide">
        <q-icon name="manage_accounts" size="34px" />
        <div class="pochoir">{{ messageVide }}</div>
        <q-btn
          v-if="!filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="person_add"
          :label="$t('utilisateurs.actions.createFirst')"
          @click="ouvrir(null)"
        />
        <q-btn
          v-else
          flat
          no-caps
          icon="refresh"
          :label="$t('utilisateurs.actions.resetFilters')"
          @click="reinitialiser"
        />
      </div>
    </div>

    <pagination-bar
      v-if="utilisateurs.length"
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
          {{ utilisateurEdite ? $t('utilisateurs.dialog.editTitle') : $t('utilisateurs.dialog.newTitle') }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">{{ $t('utilisateurs.dialog.sectionIdentity') }}</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.nom"
                outlined
                dense
                :label="$t('utilisateurs.dialog.lastName')"
                :error="erreurs.nom"
                :error-message="$t('utilisateurs.dialog.lastNameRequired')"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.prenom"
                outlined
                dense
                :label="$t('utilisateurs.dialog.firstName')"
                :error="erreurs.prenom"
                :error-message="$t('utilisateurs.dialog.firstNameRequired')"
              />
            </div>
          </div>
          <q-input
            v-model="form.email"
            outlined
            dense
            type="email"
            :label="$t('utilisateurs.dialog.email')"
            :hint="$t('utilisateurs.dialog.emailHint')"
            :error="erreurs.email"
            :error-message="$t('utilisateurs.dialog.emailInvalid')"
          />
          <q-input
            v-model="form.password"
            outlined
            dense
            type="password"
            autocomplete="new-password"
            :label="
              utilisateurEdite
                ? $t('utilisateurs.dialog.passwordNew')
                : $t('utilisateurs.dialog.passwordNewAccount')
            "
            :hint="$t('utilisateurs.dialog.passwordHint')"
            :error="erreurs.password"
            :error-message="$t('utilisateurs.dialog.passwordInvalid')"
          />

          <span class="section-titre">{{ $t('utilisateurs.dialog.sectionRole') }}</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.role"
                :options="optionsRoles"
                outlined
                dense
                emit-value
                map-options
                :label="$t('utilisateurs.dialog.role')"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.telephone" outlined dense :label="$t('utilisateurs.dialog.phone')" />
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
            :label="$t('utilisateurs.dialog.department')"
          />
          <q-select
            v-if="form.role === 'ENSEIGNANT'"
            v-model="form.enseignantId"
            :options="optionsEnseignants"
            outlined
            dense
            clearable
            emit-value
            map-options
            use-input
            input-debounce="0"
            :label="$t('utilisateurs.dialog.teacherRecord')"
            :hint="$t('utilisateurs.dialog.teacherRecordHint')"
            @filter="filtrerEnseignants"
          />
          <q-toggle
            v-model="form.actif"
            :label="$t('utilisateurs.dialog.active')"
            :disable="!!utilisateurEdite && estMoi(utilisateurEdite)"
          />
          <div v-if="!!utilisateurEdite && estMoi(utilisateurEdite)" class="text-caption text-grey-7">
            {{ $t('utilisateurs.dialog.cannotDisableSelf') }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('utilisateurs.actions.cancel')" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            :label="$t('utilisateurs.actions.save')"
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
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import { LIBELLE_ROLE } from '../utils/libelles';
import type { Departement, Enseignant, Role, Utilisateur, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();

const utilisateurs = ref<Utilisateur[]>([]);
const departements = ref<Departement[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const utilisateurEdite = ref<Utilisateur | null>(null);
const enregistrement = ref(false);

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filtres = ref<Record<string, any>>({});

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
const erreurs = ref({ nom: false, prenom: false, email: false, password: false });

const optionsRoles = Object.entries(LIBELLE_ROLE).map(([value, label]) => ({ label, value }));
const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const estMoi = (u: Utilisateur) => u.id === auth.utilisateur?.id;

/** La fiche enseignant rattachée à un compte, si elle existe. */
const ficheEnseignant = (u: Utilisateur) => enseignants.value.find((e) => e.user?.id === u.id);

/** L'API des comptes ne joint pas le département : on le résout localement. */
const nomDepartement = (u: Utilisateur) =>
  departements.value.find((d) => d.id === u.departementId)?.nom ?? '—';

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.role || filtres.value.departementId),
);
const messageVide = computed(() =>
  filtresActifs.value ? t('utilisateurs.emptyState.filtered') : t('utilisateurs.emptyState.none'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('utilisateurs.chips.search', { search: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.role) {
    cs.push({
      label: t('utilisateurs.chips.role', { role: LIBELLE_ROLE[filtres.value.role as Role] }),
      value: filtres.value.role,
      icone: 'badge',
    });
  }
  if (filtres.value.departementId) {
    const d = departements.value.find((x) => x.id === filtres.value.departementId);
    cs.push({
      label: t('utilisateurs.chips.department', { department: d?.nom ?? '?' }),
      value: filtres.value.departementId,
      icone: 'apartment',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('utilisateurs.table.columns.name'), field: 'nom', align: 'left', sortable: true },
  { name: 'role', label: t('utilisateurs.table.columns.role'), field: 'role', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('utilisateurs.table.columns.department'),
    field: (r: Utilisateur) => nomDepartement(r),
    align: 'left',
  },
  {
    name: 'telephone',
    label: t('utilisateurs.table.columns.phone'),
    field: (r: Utilisateur) => r.telephone || '—',
    align: 'left',
  },
  { name: 'actif', label: t('utilisateurs.table.columns.active'), field: 'actif', align: 'center' },
  { name: 'actions', label: t('utilisateurs.table.columns.actions'), field: 'id', align: 'right' },
]);

function ouvrir(u: Utilisateur | null) {
  utilisateurEdite.value = u;
  erreurs.value = { nom: false, prenom: false, email: false, password: false };
  form.value = {
    nom: u?.nom ?? '',
    prenom: u?.prenom ?? '',
    email: u?.email ?? '',
    password: '',
    role: u?.role ?? 'CONTROLEUR',
    telephone: u?.telephone ?? '',
    departementId: u?.departementId ?? null,
    // Le rattachement se lit depuis la fiche enseignant, seule à le porter.
    enseignantId: u ? (ficheEnseignant(u)?.id ?? null) : null,
    actif: u?.actif ?? true,
  };
  dialogOuvert.value = true;
}

/** Le compte d'un enseignant renvoie à sa fiche, où vivent charges et moyens. */
function voirFicheEnseignant(u: Utilisateur) {
  const fiche = ficheEnseignant(u);
  if (!fiche) return;
  void router.push({ path: '/enseignants', query: { recherche: fiche.matricule } });
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

async function enregistrer() {
  const email = form.value.email.trim();
  erreurs.value = {
    nom: !form.value.nom.trim(),
    prenom: !form.value.prenom.trim(),
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    password: !utilisateurEdite.value
      ? form.value.password.length < 6
      : form.value.password.length > 0 && form.value.password.length < 6,
  };
  if (Object.values(erreurs.value).some(Boolean)) {
    $q.notify({ type: 'warning', message: t('utilisateurs.messages.fillRequired') });
    return;
  }

  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      ...form.value,
      email,
      telephone: form.value.telephone || undefined,
      departementId: form.value.departementId || undefined,
      enseignantId: form.value.enseignantId || undefined,
    };
    if (!payload.password) delete payload.password;

    if (utilisateurEdite.value) await api.put(`/utilisateurs/${utilisateurEdite.value.id}`, payload);
    else await api.post('/utilisateurs', payload);

    $q.notify({ type: 'positive', message: t('utilisateurs.messages.saved') });
    dialogOuvert.value = false;
    // Le compte lié à un enseignant a pu changer : la liste partagée est périmée.
    await Promise.all([charger(), chargerEnseignants(true)]);
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(u: Utilisateur) {
  if (estMoi(u)) return;
  $q.dialog({
    title: t('utilisateurs.confirmDelete.title'),
    message: t('utilisateurs.confirmDelete.message', { name: `${u.prenom} ${u.nom}`, email: u.email }),
    cancel: { label: t('utilisateurs.actions.cancel'), flat: true, noCaps: true },
    ok: { color: 'negative', label: t('utilisateurs.actions.delete'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/utilisateurs/${u.id}`);
      $q.notify({ type: 'positive', message: t('utilisateurs.messages.deleted') });
      await Promise.all([charger(), chargerEnseignants(true)]);
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
  if (filtres.value.role) params.role = filtres.value.role;
  if (filtres.value.departementId) params.departementId = filtres.value.departementId;
  return params;
}

async function charger(tout = false) {
  chargement.value = true;
  try {
    const { data } = await api.get('/utilisateurs', { params: parametres(tout) });
    utilisateurs.value = data.data ?? [];
    total.value = data.total ?? utilisateurs.value.length;
  } catch {
    utilisateurs.value = [];
  } finally {
    chargement.value = false;
  }
}

function chargerTout() {
  page.value = 1;
  return charger(true);
}

async function chargerEnseignants(force = false) {
  enseignants.value = await referentiels.enseignants(force);
  optionsEnseignants.value = enseignants.value.map((e) => ({
    label: `${e.nom} ${e.prenom} (${e.matricule})`,
    value: e.id,
  }));
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  void charger();
}

watch(
  () => form.value.role,
  (role) => {
    if (role !== 'ENSEIGNANT') form.value.enseignantId = null;
  },
);

watch(
  () => [filtres.value.recherche, filtres.value.role, filtres.value.departementId],
  () => {
    page.value = 1;
    void charger();
  },
);

onMounted(async () => {
  departements.value = await referentiels.departements();
  await chargerEnseignants();
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
