<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Utilisateurs</div>
        <div class="page-sous-titre">
          Comptes de connexion et rôles : contrôleurs, scolarité, direction, enseignants
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="person_add"
          label="Nouvel utilisateur"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (nom, prénom, e-mail)…"
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
          label="Rôle"
        />
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
          cle="utilisateurs"
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
            label="Créer le premier compte"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else
            flat
            no-caps
            icon="refresh"
            label="Réinitialiser les filtres"
            @click="reinitialiser"
          />
        </div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>
            {{ p.row.nom }} {{ p.row.prenom }}
            <q-badge v-if="estMoi(p.row)" color="secondary" class="q-ml-xs">vous</q-badge>
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
          <q-tooltip>{{ p.row.actif ? 'Compte actif' : 'Compte désactivé' }}</q-tooltip>
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
            aria-label="Ouvrir la fiche enseignant"
            @click="voirFicheEnseignant(p.row)"
          >
            <q-tooltip>Sa fiche enseignant</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="edit"
            aria-label="Modifier l’utilisateur"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            color="negative"
            icon="delete"
            :disable="estMoi(p.row)"
            aria-label="Supprimer l’utilisateur"
            @click="supprimer(p.row)"
          >
            <q-tooltip>
              {{ estMoi(p.row) ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer' }}
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
            <q-badge v-if="estMoi(u)" color="secondary" class="q-ml-xs">vous</q-badge>
          </div>
          <div class="text-caption text-grey-7">{{ u.email }}</div>
          <div class="text-caption text-grey-7">{{ u.telephone || '—' }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ u.departementId ? nomDepartement(u) : 'Sans département de rattachement' }}
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
            label="Sa fiche"
            @click="voirFicheEnseignant(u)"
          />
          <q-btn flat dense no-caps icon="edit" label="Modifier" @click="ouvrir(u)" />
          <q-btn
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            label="Supprimer"
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
          label="Créer le premier compte"
          @click="ouvrir(null)"
        />
        <q-btn
          v-else
          flat
          no-caps
          icon="refresh"
          label="Réinitialiser les filtres"
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
          {{ utilisateurEdite ? 'Modifier l’utilisateur' : 'Nouvel utilisateur' }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">Identité et accès</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.nom"
                outlined
                dense
                label="Nom *"
                :error="erreurs.nom"
                error-message="Le nom est obligatoire"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model="form.prenom"
                outlined
                dense
                label="Prénom *"
                :error="erreurs.prenom"
                error-message="Le prénom est obligatoire"
              />
            </div>
          </div>
          <q-input
            v-model="form.email"
            outlined
            dense
            type="email"
            label="E-mail *"
            hint="Sert d’identifiant de connexion"
            :error="erreurs.email"
            error-message="Saisissez une adresse e-mail valide"
          />
          <q-input
            v-model="form.password"
            outlined
            dense
            type="password"
            autocomplete="new-password"
            :label="utilisateurEdite ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe *'"
            hint="6 caractères minimum"
            :error="erreurs.password"
            error-message="Le mot de passe doit faire au moins 6 caractères"
          />

          <span class="section-titre">Rôle et périmètre</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-select
                v-model="form.role"
                :options="optionsRoles"
                outlined
                dense
                emit-value
                map-options
                label="Rôle *"
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="form.telephone" outlined dense label="Téléphone" />
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
            label="Département de rattachement"
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
            label="Fiche enseignant associée"
            hint="Nécessaire pour que l’enseignant voie ses séances"
            @filter="filtrerEnseignants"
          />
          <q-toggle
            v-model="form.actif"
            label="Compte actif"
            :disable="!!utilisateurEdite && estMoi(utilisateurEdite)"
          />
          <div v-if="!!utilisateurEdite && estMoi(utilisateurEdite)" class="text-caption text-grey-7">
            Vous ne pouvez pas désactiver votre propre compte.
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
import { LIBELLE_ROLE } from '../utils/libelles';
import type { Departement, Enseignant, Role, Utilisateur, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const utilisateurs = ref<Utilisateur[]>([]);
const departements = ref<Departement[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');
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
  filtresActifs.value ? 'Aucun compte pour ces critères.' : 'Aucun compte enregistré.',
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
  if (filtres.value.role) {
    cs.push({
      label: `Rôle : ${LIBELLE_ROLE[filtres.value.role as Role]}`,
      value: filtres.value.role,
      icone: 'badge',
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
  { name: 'nom', label: 'Nom & prénom', field: 'nom', align: 'left', sortable: true },
  { name: 'role', label: 'Rôle', field: 'role', align: 'left', sortable: true },
  {
    name: 'departement',
    label: 'Département',
    field: (r: Utilisateur) => nomDepartement(r),
    align: 'left',
  },
  { name: 'telephone', label: 'Téléphone', field: (r: Utilisateur) => r.telephone || '—', align: 'left' },
  { name: 'actif', label: 'Actif', field: 'actif', align: 'center' },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
];

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
    $q.notify({ type: 'warning', message: 'Complétez les champs obligatoires' });
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

    $q.notify({ type: 'positive', message: 'Utilisateur enregistré' });
    dialogOuvert.value = false;
    await Promise.all([charger(), chargerEnseignants()]);
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Enregistrement impossible',
    });
  } finally {
    enregistrement.value = false;
  }
}

function supprimer(u: Utilisateur) {
  if (estMoi(u)) return;
  $q.dialog({
    title: 'Supprimer le compte',
    message: `Supprimer le compte de ${u.prenom} ${u.nom} (${u.email}) ? Il ne pourra plus se connecter.`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'negative', label: 'Supprimer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/utilisateurs/${u.id}`);
      $q.notify({ type: 'positive', message: 'Compte supprimé' });
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
  } catch (e: any) {
    utilisateurs.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des comptes impossible',
    });
  } finally {
    chargement.value = false;
  }
}

function chargerTout() {
  page.value = 1;
  return charger(true);
}

async function chargerEnseignants() {
  const { data } = await api.get('/enseignants', { params: { all: '1' } });
  enseignants.value = data.data ?? [];
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
  const { data } = await api.get('/departements', { params: { all: '1' } });
  departements.value = data.data;
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
