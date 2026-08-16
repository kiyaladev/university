<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Étudiants</div>
        <div class="page-sous-titre">
          La base centrale du registre : matricule INE, QR de la carte resto et
          compteur de dossiers — les autres modules en dépendent.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvel étudiant"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (matricule, nom, email)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <autocomplete-async
          v-model="filtres.promotionId"
          endpoint="/promotions"
          :label-fn="(p) => p.nom"
          label="Promotion"
          clearable
        />
        <q-select
          v-model="filtres.actif"
          :options="optionsActif"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.sexe"
          :options="optionsSexe"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Genre"
        />
        <champ-date v-model="filtres.dateDebut" label="Inscrit entre (début)" />
        <champ-date v-model="filtres.dateFin" label="et (fin)" />
      </template>
      <template #actions>
        <view-toggle
          cle="etudiants"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = (m as 'tableau' | 'cartes'))"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="etudiants"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">Aucun étudiant pour ces critères.</div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-sexe="p">
        <q-td :props="p">
          <q-chip v-if="p.row.sexe" dense outline :color="p.row.sexe === 'F' ? 'pink' : 'primary'">
            {{ p.row.sexe === 'F' ? 'F' : 'M' }}
          </q-chip>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip v-if="dernierePromo(p.row)" dense outline color="primary">
            {{ dernierePromo(p.row) }}
          </q-chip>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>

      <template #body-cell-comptes="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{ p.row.user ? `Compte : ${p.row.user.email}` : 'Aucun compte portail' }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-inscriptions="p">
        <q-td :props="p" class="text-right">
          <span class="chiffres">{{ p.row._count?.inscriptions ?? 0 }}</span>
        </q-td>
      </template>

      <template #body-cell-actif="p">
        <q-td :props="p">
          <q-toggle
            :model-value="p.row.actif"
            color="secondary"
            :disable="!peutGererCompte(p.row)"
            @update:model-value="(v) => basculerActif(p.row, v)"
          />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutValiderVoir"
            flat
            dense
            round
            color="primary"
            icon="folder_open"
            @click="voirInscriptions(p.row)"
          >
            <q-tooltip>Voir les inscriptions</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            color="primary"
            icon="print"
            @click="imprimerFiche(p.row)"
          >
            <q-tooltip>Imprimer la fiche</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="etudiants-cartes">
      <q-card
        v-for="e in etudiants"
        :key="e.id"
        flat
        bordered
        class="carte etudiants-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip
              :outline="e.actif"
              :color="e.actif ? 'positive' : 'grey-7'"
              :icon="e.actif ? 'check_circle' : 'remove_circle'"
              dense
              :label="e.actif ? 'Actif' : 'Inactif'"
            />
            <q-chip v-if="e.sexe" dense outline :color="e.sexe === 'F' ? 'pink' : 'primary'">
              {{ e.sexe === 'F' ? 'Féminin' : 'Masculin' }}
            </q-chip>
            <q-space />
            <div class="text-caption text-grey-7">{{ e.matricule }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ e.nom }} {{ e.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            <span v-if="e.telephone">{{ e.telephone }}</span>
            <span v-else>—</span>
          </div>
          <div class="q-mt-sm">
            <q-chip
              v-if="dernierePromo(e)"
              outline
              color="primary"
              dense
              :label="dernierePromo(e)"
              icon="school"
            />
            <span v-else class="text-caption text-grey-7">Aucune inscription</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
          <q-btn
            v-if="peutGerer"
            flat
            dense
            icon="edit"
            no-caps
            label="Modifier"
            @click="ouvrir(e)"
          />
          <q-btn
            v-if="peutValiderVoir"
            flat
            dense
            icon="folder_open"
            no-caps
            label="Dossiers"
            @click="voirInscriptions(e)"
          />
          <q-btn
            v-if="peutGerer"
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            label="Imprimer"
            @click="imprimerFiche(e)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!etudiants.length" class="text-center q-pa-md text-grey-7">
        Aucun étudiant pour ces critères.
      </div>
    </div>

    <pagination-bar
      v-if="etudiants.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <etudiant-dialog
      v-model="dialogOuvert"
      :etudiant="etudiantEdite"
      @enregistre="charger"
    />

    <!-- Dialog : inscriptions de l'étudiant -->
    <q-dialog v-model="dialogInscriptions">
      <q-card style="width: 720px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              Dossiers — {{ etudiantInscriptions?.nom }} {{ etudiantInscriptions?.prenom }}
            </div>
            <div class="text-caption text-grey-7">
              {{ etudiantInscriptions?.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress v-if="chargementInscriptions" indeterminate color="primary" class="q-mb-sm" />
          <q-table
            v-else
            flat
            bordered
            :rows="listeInscriptions"
            :columns="colonnesInscriptions"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
            dense
          >
            <template #body-cell-statut="p">
              <q-td :props="p">
                <span class="champ badge-statut" :class="classeStatutInscription(p.row.statut)">
                  {{ LIBELLE_STATUT_INSCRIPTION[p.row.statut] ?? p.row.statut }}
                </span>
              </q-td>
            </template>
            <template #body-cell-montant="p">
              <q-td :props="p" class="text-right text-weight-medium">
                {{ montantLisible(p.row.montantFrais) }}
              </q-td>
            </template>
          </q-table>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EtudiantDialog from '../components/EtudiantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  LIBELLE_STATUT_INSCRIPTION,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type {
  Etudiant,
  Inscription,
  Promotion,
  StatutInscription,
} from '../types';

interface EtudiantRegistre extends Etudiant {
  inscriptions?: { id: string; promotion?: Promotion | null; createdAt?: string }[];
}

const $q = useQuasar();
const auth = useAuthStore();

const etudiants = ref<EtudiantRegistre[]>([]);
const promotions = ref<Promotion[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const etudiantEdite = ref<EtudiantRegistre | null>(null);
const modeVue = ref<'tableau' | 'cartes'>('tableau');

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const tousLesElements = ref(false);

const filtres = ref<Record<string, any>>({});

const dialogInscriptions = ref(false);
const listeInscriptions = ref<Inscription[]>([]);
const etudiantInscriptions = ref<EtudiantRegistre | null>(null);
const chargementInscriptions = ref(false);

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutValiderVoir = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT']));
const peutGererCompte = (e: EtudiantRegistre) => auth.estAdmin || !e.user;

const optionsActif = [
  { label: 'Actifs', value: 'true' },
  { label: 'Inactifs', value: 'false' },
];
const optionsSexe = [
  { label: 'Masculin', value: 'M' },
  { label: 'Féminin', value: 'F' },
];

const colonnes: QTableColumn[] = [
  { name: 'nom', label: 'Nom & prénom', field: 'nom', align: 'left', sortable: true },
  { name: 'sexe', label: 'Genre', field: 'sexe', align: 'left' },
  { name: 'promotion', label: 'Dernière promotion', field: 'promotion', align: 'left' },
  { name: 'telephone', label: 'Téléphone', field: 'telephone', align: 'left' },
  { name: 'email', label: 'E-mail', field: 'email', align: 'left' },
  { name: 'comptes', label: 'Compte', field: 'comptes', align: 'center' },
  { name: 'inscriptions', label: 'Dossiers', field: 'inscriptions', align: 'right', sortable: true },
  { name: 'actif', label: 'Actif', field: 'actif', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesInscriptions: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: (r) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'annee', label: 'Année', field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'montant', label: 'Frais', field: 'montantFrais', align: 'right' },
  { name: 'date', label: 'Créé le', field: (r) => dateLisible(r.createdAt), align: 'left' },
];

const classeStatutInscription = (s: string) =>
  ({
    BROUILLON: 'champ--brouillon',
    EN_ATTENTE_PAIEMENT: 'champ--attente-paiement',
    PAYEE: 'champ--payee',
    VALIDEE: 'champ--validee',
    ANNULEE: 'champ--annulee',
  })[s] ?? 'champ--brouillon';

const dernierePromo = (e: EtudiantRegistre) => e.inscriptions?.[0]?.promotion?.nom ?? null;

const chips = computed(() => {
  const cs: Array<{ label: string; value: any; icone?: string; defaut?: boolean }> = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.actif) {
    cs.push({
      label: filtres.value.actif === 'true' ? 'Actifs' : 'Inactifs',
      value: filtres.value.actif,
      icone: 'toggle_on',
    });
  }
  if (filtres.value.sexe) {
    cs.push({
      label: `Genre : ${filtres.value.sexe === 'F' ? 'Féminin' : 'Masculin'}`,
      value: filtres.value.sexe,
      icone: 'wc',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: `Depuis : ${dateLisible(filtres.value.dateDebut)}`,
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: `Jusqu'à : ${dateLisible(filtres.value.dateFin)}`,
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

function ouvrir(e: EtudiantRegistre | null) {
  etudiantEdite.value = e;
  dialogOuvert.value = true;
}

async function basculerActif(e: EtudiantRegistre, v: unknown) {
  await api.put(`/etudiants/${e.id}`, { actif: v === true });
  e.actif = v === true;
  $q.notify({ type: 'positive', message: v ? 'Étudiant réactivé' : 'Étudiant désactivé' });
}

async function voirInscriptions(e: EtudiantRegistre) {
  etudiantInscriptions.value = e;
  dialogInscriptions.value = true;
  chargementInscriptions.value = true;
  try {
    const { data } = await api.get('/inscriptions', {
      params: { all: '1', etudiantId: e.id },
    });
    listeInscriptions.value = Array.isArray(data) ? data : data.data ?? [];
  } catch {
    listeInscriptions.value = [];
  } finally {
    chargementInscriptions.value = false;
  }
}

function imprimerFiche(e: EtudiantRegistre) {
  const token = auth.token;
  const url = `${API_URL}/etudiants/${e.id}/attestation-inscription?token=${encodeURIComponent(token)}`;
  window.open(url, '_blank');
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, any> = {
      all: '1',
      page: page.value,
      pageSize: pageSize.value,
    };
    if (filtres.value.recherche) params.search = filtres.value.recherche;
    if (filtres.value.actif) params.actif = filtres.value.actif;
    if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
    const { data } = await api.get('/etudiants', { params });
    let liste: EtudiantRegistre[] = data.data ?? [];
    if (filtres.value.sexe) liste = liste.filter((e) => e.sexe === filtres.value.sexe);
    if (filtres.value.dateDebut) {
      const d = new Date(filtres.value.dateDebut).getTime();
      liste = liste.filter((e) => {
        const c = e.inscriptions?.[0]?.createdAt ?? null;
        if (!c) return true;
        return new Date(c).getTime() >= d;
      });
    }
    if (filtres.value.dateFin) {
      const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
      liste = liste.filter((e) => {
        const c = e.inscriptions?.[0]?.createdAt ?? null;
        if (!c) return true;
        return new Date(c).getTime() <= d;
      });
    }
    etudiants.value = liste;
    total.value = data.total ?? liste.length;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const params: Record<string, any> = { all: '1', pageSize: 1000 };
    if (filtres.value.recherche) params.search = filtres.value.recherche;
    if (filtres.value.actif) params.actif = filtres.value.actif;
    if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
    const { data } = await api.get('/etudiants', { params });
    etudiants.value = data.data ?? [];
    total.value = etudiants.value.length;
    tousLesElements.value = true;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  tousLesElements.value = false;
  charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.promotionId,
    filtres.value.actif,
    filtres.value.sexe,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    page.value = 1;
    tousLesElements.value = false;
    charger();
  },
);

onMounted(async () => {
  const { data } = await api.get('/promotions', { params: { all: '1' } });
  promotions.value = data.data;
  await charger();
});
</script>

<style scoped lang="scss">
.etudiants-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.etudiants-cartes__carte {
  background: var(--up-plaque);
}

.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.champ--brouillon { background: #cfd4d9; color: #33463f; }
.champ--attente-paiement { background: #e8a317; color: #10251e; }
.champ--payee { background: #1e7a4c; }
.champ--validee { background: #1565c0; }
.champ--annulee { background: #c2321e; }
</style>
