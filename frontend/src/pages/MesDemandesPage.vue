<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Mes demandes de documents</div>
        <div class="page-sous-titre">
          Demandez vos attestations et relevés en ligne : payez les frais au
          tarif paramétré, suivez l'avancement, retirez au guichet lorsque le
          statut passe à « Prête ».
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle demande"
          @click="creationOuverte = true"
        />
      </div>
    </div>

    <q-banner v-if="rolePasBon" class="note--info q-mb-md">
      Cette page est réservée aux comptes étudiants. Vous êtes connecté en
      {{ auth.utilisateur?.role }} — utilisez la page « Demandes de documents »
      du tableau de bord.
    </q-banner>

    <div v-if="!rolePasBon" class="row q-col-gutter-md q-mb-md">
      <div v-for="s in plaques" :key="s.cle" class="col-6 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres" :class="{ 'text-warning': s.alerte }">
              {{ stats?.[s.cle] ?? 0 }}
            </div>
            <div class="pochoir text-grey-7">{{ s.libelle }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <filter-bar
      v-if="!rolePasBon"
      v-model="filtres"
      placeholder="Rechercher (N°, motif…)"
      :recherche="true"
      @reinitialiser="filtres = { recherche: '' }; pagination.page = 1; requeter()"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUTS"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPES"
          dense
          outlined
          clearable
          emit-value
          map-options
          label="Type"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="documents-demande.moi"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <pagination-bar
      v-if="!rolePasBon"
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; requeter()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; requeter()"
      @tous="chargerTout"
    />

    <q-table
      v-if="!rolePasBon && modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="demandes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="demande-statut" :class="`statut-${p.row.statut}`">
            <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-frais="p">
        <q-td :props="p" class="text-right chiffres">
          {{ montantLisible(p.row.frais) }} {{ p.row.devise }}
          <q-icon
            v-if="p.row.paiement?.statut === 'REUSSI'"
            name="check_circle"
            color="positive"
            size="14px"
            class="q-ml-xs"
          >
            <q-tooltip>Paiement confirmé</q-tooltip>
          </q-icon>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.statut === 'EN_ATTENTE_PAIEMENT' && p.row.frais > 0"
            unelevated
            color="primary"
            dense
            no-caps
            icon="payments"
            label="Payer"
            @click="ouvrirPaiement(p.row)"
          />
        </q-td>
      </template>
    </q-table>

    <div v-else-if="!rolePasBon" class="row q-col-gutter-md">
      <div v-for="d in demandes" :key="d.id" class="col-12 col-md-6">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-start">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ d.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ libelleType(d.type) }}</div>
              <div class="text-caption text-grey-7">
                Créée le {{ dateHeureLisible(d.creeLe) }}
              </div>
            </div>
            <span class="demande-statut" :class="`statut-${d.statut}`">
              <span class="pochoir">{{ libelleStatut(d.statut) }}</span>
            </span>
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="payments" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption chiffres">
                {{ montantLisible(d.frais) }} {{ d.devise }}
                <q-icon
                  v-if="d.paiement?.statut === 'REUSSI'"
                  name="check_circle"
                  color="positive"
                  size="14px"
                  class="q-ml-xs"
                />
              </span>
            </div>
            <div v-if="d.notification" class="row items-center text-positive">
              <q-icon name="sms" size="16px" class="q-mr-sm" />
              <span class="text-caption" style="white-space: pre-wrap">{{ d.notification }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              v-if="d.statut === 'EN_ATTENTE_PAIEMENT' && d.frais > 0"
              unelevated
              color="primary"
              no-caps
              icon="payments"
              label="Payer maintenant"
              @click="ouvrirPaiement(d)"
            />
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!chargement && !demandes.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="description" size="42px" color="grey-5" />
        <div class="q-mt-sm">Aucune demande</div>
      </div>
    </div>

    <demande-document-dialog v-model="creationOuverte" @creee="onCreee" />

    <!-- Dialogue de paiement -->
    <q-dialog v-model="paiementOuvert">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">Payer la demande</q-card-section>
        <q-card-section v-if="demandeAPayer">
          <div class="row q-col-gutter-md items-center q-mb-md">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ demandeAPayer.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ libelleType(demandeAPayer.type) }}</div>
            </div>
            <div class="col-auto text-h5 chiffres">
              {{ montantLisible(demandeAPayer.frais) }} {{ demandeAPayer.devise }}
            </div>
          </div>
          <q-select
            v-model="formPaiement.mode"
            :options="OPTIONS_PAIEMENT"
            outlined
            dense
            emit-value
            map-options
            label="Mode de paiement"
            class="q-mb-md"
          />
          <template v-if="formPaiement.mode === 'MOBILE_MONEY'">
            <q-select
              v-model="formPaiement.operateur"
              :options="OPTIONS_OPERATEUR"
              outlined
              dense
              emit-value
              map-options
              label="Opérateur"
              class="q-mb-sm"
            />
            <q-input
              v-model="formPaiement.telephone"
              outlined
              dense
              label="Numéro Mobile Money"
              hint="Le numéro qui sera débité"
            />
          </template>
          <q-banner class="note--info q-mt-md">
            Mode pilote : aucune passerelle Mobile Money n'est connectée. Le
            paiement passe directement à « Réussi » pour test.
          </q-banner>
        </q-card-section>
        <q-banner v-if="erreurPaiement" dense class="note--erreur q-mx-md q-mb-sm">
          <template #avatar><q-icon name="warning" /></template>
          {{ erreurPaiement }}
        </q-banner>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            icon="payments"
            label="Payer"
            :loading="enregistrementPaiement"
            @click="payer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import DemandeDocumentDialog from '../components/DemandeDocumentDialog.vue';
import { dateHeureLisible, montantLisible } from '../utils/libelles';
import type { DemandeDocument, ModePaiement, StatutDemande, TypeDemandeDocument } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ETUDIANT');

const LIBELLE_STATUT: Record<StatutDemande, string> = {
  EN_ATTENTE_PAIEMENT: 'Attente paiement',
  PAYEE: 'Payée',
  EN_TRAITEMENT: 'En traitement',
  PRETE: 'Prête',
  REMISE: 'Remise',
  REJETEE: 'Rejetée',
};

const LIBELLE_TYPE: Record<TypeDemandeDocument, string> = {
  ATTESTATION_SCOLARITE: 'Attestation de scolarité',
  ATTESTATION_FREQUENTATION: 'Attestation de fréquentation',
  RELEVE_NOTES: 'Relevé de notes',
  DUPLICATA_CARTE: 'Duplicata de carte',
  ATTESTATION_REUSSITE: 'Attestation de réussite',
  CERTIFICAT_SCOLARITE: 'Certificat de scolarité',
  AUTRE: 'Autre',
};

const OPTIONS_STATUTS = (Object.keys(LIBELLE_STATUT) as StatutDemande[]).map((v) => ({
  label: LIBELLE_STATUT[v],
  value: v,
}));
const OPTIONS_TYPES = (Object.keys(LIBELLE_TYPE) as TypeDemandeDocument[]).map((v) => ({
  label: LIBELLE_TYPE[v],
  value: v,
}));
const OPTIONS_PAIEMENT = [
  { label: 'Mobile Money', value: 'MOBILE_MONEY' as const },
  { label: 'Espèces (au guichet)', value: 'ESPECES' as const },
  { label: 'Virement bancaire', value: 'VIREMENT' as const },
];
const OPTIONS_OPERATEUR = [
  { label: 'Orange Money', value: 'ORANGE_MONEY' },
  { label: 'MTN MoMo', value: 'MTN_MOMO' },
  { label: 'Telecel', value: 'TELECEL' },
];

const demandes = ref<DemandeDocument[]>([]);
const stats = ref<Record<string, number> | null>(null);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });
const modeVue = ref<'tableau' | 'cartes'>('cartes');
const chargement = ref(false);

const creationOuverte = ref(false);
const paiementOuvert = ref(false);
const demandeAPayer = ref<DemandeDocument | null>(null);
const enregistrementPaiement = ref(false);
const erreurPaiement = ref('');
const formPaiement = ref({
  mode: 'MOBILE_MONEY' as ModePaiement,
  operateur: 'ORANGE_MONEY',
  telephone: '',
  simuler: true,
});

const plaques = computed(() => [
  { cle: 'EN_ATTENTE_PAIEMENT', libelle: 'À payer', alerte: true },
  { cle: 'EN_TRAITEMENT', libelle: 'En traitement' },
  { cle: 'PRETE', libelle: 'Prêtes' },
  { cle: 'REMISE', libelle: 'Remises' },
]);

function libelleStatut(s: string) {
  return LIBELLE_STATUT[s as StatutDemande] ?? s;
}
function libelleType(t: string) {
  return LIBELLE_TYPE[t as TypeDemandeDocument] ?? t;
}

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'frais', label: 'Frais', field: 'frais', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'creeLe', label: 'Créée le', field: 'creeLe', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrirPaiement(d: DemandeDocument) {
  demandeAPayer.value = d;
  paiementOuvert.value = true;
  erreurPaiement.value = '';
  formPaiement.value = {
    mode: 'MOBILE_MONEY',
    operateur: 'ORANGE_MONEY',
    telephone: '',
    simuler: true,
  };
}

async function payer() {
  if (!demandeAPayer.value) return;
  enregistrementPaiement.value = true;
  erreurPaiement.value = '';
  try {
    const body: Record<string, unknown> = {
      mode: formPaiement.value.mode,
      simuler: formPaiement.value.simuler,
    };
    if (formPaiement.value.mode === 'MOBILE_MONEY') {
      body.operateur = formPaiement.value.operateur;
      if (formPaiement.value.telephone) body.telephone = formPaiement.value.telephone;
    }
    await api.post(`/documents-demande/${demandeAPayer.value.id}/payer`, body);
    $q.notify({
      type: 'positive',
      message: formPaiement.value.simuler
        ? 'Paiement simulé : la demande est passée en traitement'
        : 'Paiement initié : la scolarité confirmera au guichet',
    });
    paiementOuvert.value = false;
    void requeter();
  } catch (e: any) {
    erreurPaiement.value = e.response?.data?.message ?? 'Paiement impossible';
  } finally {
    enregistrementPaiement.value = false;
  }
}

async function requeter() {
  if (auth.utilisateur?.role !== 'ETUDIANT') return;
  chargement.value = true;
  try {
    const f = filtres.value;
    const { data } = await api.get('/documents-demande/mes', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        statut: f.statut || undefined,
        type: f.type || undefined,
        search: (f.recherche ?? '').toString().trim() || undefined,
      },
    });
    demandes.value = data.data;
    pagination.value.total = data.total;

    const counts: Record<string, number> = {
      EN_ATTENTE_PAIEMENT: 0,
      EN_TRAITEMENT: 0,
      PRETE: 0,
      REMISE: 0,
    };
    for (const d of demandes.value) {
      if (counts[d.statut] != null) counts[d.statut]++;
    }
    stats.value = counts;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await requeter();
}

function onCreee() {
  void requeter();
}

watch(
  () => [filtres.value.recherche, filtres.value.statut, filtres.value.type],
  () => {
    pagination.value.page = 1;
    void requeter();
  },
);

onMounted(() => {
  void requeter();
});
</script>

<style scoped lang="scss">
$encre: #10251E;
$chaux-claire: #F2F3EE;
$vert: #0F7A45;
$jaune-fonce: #C98A00;
$rouge: #C4122E;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

.demande-statut {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: #fff;
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &.statut-EN_ATTENTE_PAIEMENT { background: $jaune-fonce; }
  &.statut-PAYEE { background: #1e7a4c; }
  &.statut-EN_TRAITEMENT { background: $encre; }
  &.statut-PRETE { background: $vert; }
  &.statut-REMISE { background: #1565c0; }
  &.statut-REJETEE { background: $rouge; }
}
</style>