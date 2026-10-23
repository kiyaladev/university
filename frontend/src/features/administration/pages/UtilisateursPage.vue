<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('utilisateurs.title')" :subtitle="$t('utilisateurs.subtitle')">
      <template #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="person_add"
          :label="$t('utilisateurs.actions.new')"
          @click="ouvrir(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
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
          :label="$t('common.fields.role')"
        />
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
    </barre-filtres>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="manage_accounts" :titre="messageVide">
          <template #action>
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
              :label="$t('common.actions.reset_filters')"
              @click="reinitialiser"
            />
          </template>
        </etat-vide>
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
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
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
                  : $t('common.actions.delete')
              }}
            </q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="u in liste.lignes" :key="u.id" flat bordered class="carte grille-cartes__carte">
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
            :label="$t('common.actions.edit')"
            @click="ouvrir(u)"
          />
          <q-btn
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            :label="$t('common.actions.delete')"
            :disable="estMoi(u)"
            @click="supprimer(u)"
          />
        </q-card-actions>
      </q-card>
      <etat-vide v-if="!liste.lignes.length && !liste.chargement" icone="manage_accounts" :titre="messageVide">
        <template #action>
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
            :label="$t('common.actions.reset_filters')"
            @click="reinitialiser"
          />
        </template>
      </etat-vide>
    </div>

    <barre-pagination
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-formulaire
      v-model="dialogOuvert"
      :titre="utilisateurEdite ? $t('utilisateurs.dialog.editTitle') : $t('utilisateurs.dialog.newTitle')"
      taille="s"
      :envoi="enregistrement"
      :libelle-valider="$t('common.actions.save')"
      @valider="enregistrer"
    >
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
          <q-input v-model="form.telephone" outlined dense :label="$t('common.fields.phone')" />
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
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import { LIBELLE_ROLE } from '@/shared/utils/libelles';
import type { Departement, Enseignant, Role, Utilisateur, ChipFiltre } from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();
const { supprimerAvecConfirmation } = useConfirmation();

const departements = ref<Departement[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const utilisateurEdite = ref<Utilisateur | null>(null);
const enregistrement = ref(false);

const filtres = ref<Record<string, any>>({ recherche: '', role: null, departementId: null });
const liste = reactive(
  useListePaginee<Utilisateur>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/utilisateurs', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            role: f.role || undefined,
            departementId: f.departementId || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

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
  { name: 'role', label: t('common.fields.role'), field: 'role', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: Utilisateur) => nomDepartement(r),
    align: 'left',
  },
  {
    name: 'telephone',
    label: t('common.fields.phone'),
    field: (r: Utilisateur) => r.telephone || '—',
    align: 'left',
  },
  { name: 'actif', label: t('common.fields.active'), field: 'actif', align: 'center' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
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
    await rechargerTout();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

/** Le compte lié à un enseignant a pu changer : la liste partagée est périmée. */
function rechargerTout() {
  return Promise.all([liste.recharger(), chargerEnseignants(true)]);
}

function supprimer(u: Utilisateur) {
  if (estMoi(u)) return;
  void supprimerAvecConfirmation(`/utilisateurs/${u.id}`, u.email, rechargerTout, {
    titre: t('utilisateurs.confirmDelete.title'),
    message: t('utilisateurs.confirmDelete.message', { name: `${u.prenom} ${u.nom}`, email: u.email }),
    ok: t('common.actions.delete'),
    succes: t('utilisateurs.messages.deleted'),
  });
}

async function chargerEnseignants(force = false) {
  enseignants.value = await referentiels.enseignants(force);
  optionsEnseignants.value = enseignants.value.map((e) => ({
    label: `${e.nom} ${e.prenom} (${e.matricule})`,
    value: e.id,
  }));
}

function reinitialiser() {
  liste.reinitialiser([]);
}

watch(
  () => form.value.role,
  (role) => {
    if (role !== 'ENSEIGNANT') form.value.enseignantId = null;
  },
);

onMounted(async () => {
  departements.value = await referentiels.departements();
  await chargerEnseignants();
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
