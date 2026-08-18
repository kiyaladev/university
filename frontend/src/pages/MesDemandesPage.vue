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
      {{ auth.utilisateur?.role }} — le registre complet se trouve sur
      « Demandes de documents ».
      <template #action>
        <q-btn
          flat
          no-caps
          icon="description"
          label="Demandes de documents"
          :to="{ name: 'demandes-docs' }"
        />
      </template>
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
      <div class="col-12 text-caption text-grey-7">
        Compteurs calculés sur les demandes affichées ci-dessous.
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
      @row-click="(_, row) => ouvrirSuivi(row)"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          Aucune demande pour ces critères. Demandez une attestation, un relevé
          de notes ou un duplicata : les frais et le délai s'affichent avant
          d'envoyer.
        </div>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
      </template>
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
            @click.stop="ouvrirPaiement(p.row)"
          />
          <q-btn
            flat
            dense
            round
            icon="visibility"
            aria-label="Suivre la demande"
            @click.stop="ouvrirSuivi(p.row)"
          >
            <q-tooltip>Suivre la demande</q-tooltip>
          </q-btn>
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
            <div class="row items-center text-grey-8">
              <q-icon name="timeline" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ EXPLICATION_STATUT[d.statut] }}</span>
            </div>
            <div v-if="d.notification" class="row items-center text-positive">
              <q-icon name="sms" size="16px" class="q-mr-sm" />
              <span class="text-caption" style="white-space: pre-wrap">{{ d.notification }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense no-caps icon="visibility" label="Suivre" @click="ouvrirSuivi(d)" />
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
        <div class="q-mt-sm">
          Aucune demande pour ces critères. Demandez une attestation, un relevé
          de notes ou un duplicata : les frais et le délai s'affichent avant
          d'envoyer.
        </div>
        <q-btn
          class="q-mt-md"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle demande"
          @click="creationOuverte = true"
        />
      </div>
    </div>

    <demande-document-dialog v-model="creationOuverte" @creee="onCreee" />

    <!-- Suivi d'une demande : mêmes étapes que côté scolarité -->
    <q-dialog v-model="suiviOuvert">
      <q-card style="width: 620px; max-width: 96vw">
        <q-card-section v-if="demandeSuivie" class="row items-center no-wrap">
          <div class="col">
            <div class="text-h6">{{ demandeSuivie.numero }}</div>
            <div class="text-caption text-grey-7">{{ libelleType(demandeSuivie.type) }}</div>
          </div>
          <span class="demande-statut" :class="`statut-${demandeSuivie.statut}`">
            <span class="pochoir">{{ libelleStatut(demandeSuivie.statut) }}</span>
          </span>
        </q-card-section>
        <q-card-section v-if="demandeSuivie" class="q-pt-none">
          <workflow-stepper
            :etapes="ETAPES_DEMANDE"
            :actuel="demandeSuivie.statut"
            :readonly="true"
          />
          <q-banner class="note--info q-mt-md">
            {{ EXPLICATION_STATUT[demandeSuivie.statut] }}
          </q-banner>

          <div class="demande-meta q-mt-md">
            <div>
              <span class="pochoir">Frais</span>
              <span class="chiffres">
                {{ montantLisible(demandeSuivie.frais) }} {{ demandeSuivie.devise }}
              </span>
            </div>
            <div>
              <span class="pochoir">Paiement</span>
              <span v-if="demandeSuivie.paiement">
                {{ demandeSuivie.paiement.reference }} ·
                {{ LIBELLE_STATUT_PAIEMENT[demandeSuivie.paiement.statut] ?? demandeSuivie.paiement.statut }}
              </span>
              <span v-else class="text-grey-7">Non initié</span>
            </div>
            <div>
              <span class="pochoir">Créée le</span>
              <span>{{ dateHeureLisible(demandeSuivie.creeLe) }}</span>
            </div>
            <div v-if="demandeSuivie.remiseLe">
              <span class="pochoir">Remise le</span>
              <span>{{ dateHeureLisible(demandeSuivie.remiseLe) }}</span>
            </div>
          </div>

          <div v-if="demandeSuivie.motif" class="q-mt-md">
            <span class="section-titre">Motif de votre demande</span>
            <div class="demande-bloc" style="white-space: pre-wrap">{{ demandeSuivie.motif }}</div>
          </div>
          <div v-if="demandeSuivie.notification" class="q-mt-md">
            <span class="section-titre">Message de la scolarité</span>
            <div class="demande-bloc" style="white-space: pre-wrap">{{ demandeSuivie.notification }}</div>
          </div>
          <div v-if="demandeSuivie.statut === 'REJETEE' && demandeSuivie.notes" class="q-mt-md">
            <span class="section-titre">Motif du rejet</span>
            <div class="demande-bloc" style="white-space: pre-wrap">{{ demandeSuivie.notes }}</div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" no-caps v-close-popup />
          <q-btn
            v-if="demandeSuivie && demandeSuivie.statut === 'EN_ATTENTE_PAIEMENT' && demandeSuivie.frais > 0"
            unelevated
            color="primary"
            no-caps
            icon="payments"
            label="Payer maintenant"
            @click="ouvrirPaiement(demandeSuivie)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

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
            <template v-if="formPaiement.mode === 'MOBILE_MONEY'">
              Mode pilote : aucune passerelle Mobile Money n'est connectée. Le
              paiement est enregistré comme réussi et la demande passe en
              traitement.
            </template>
            <template v-else>
              Le paiement sera enregistré en attente : réglez au guichet de la
              scolarité, qui confirmera pour lancer le traitement.
            </template>
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
import WorkflowStepper from '../components/WorkflowStepper.vue';
import {
  LIBELLE_STATUT_DEMANDE,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_DEMANDE,
  dateHeureLisible,
  montantLisible,
  optionsDepuis,
} from '../utils/libelles';
import type { DemandeDocument, ModePaiement, StatutDemande, TypeDemandeDocument } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ETUDIANT');

/** Le même statut, dit sans jargon administratif. */
const EXPLICATION_STATUT: Record<StatutDemande, string> = {
  EN_ATTENTE_PAIEMENT:
    'Réglez les frais pour lancer le traitement. Sans paiement, la demande reste en attente.',
  PAYEE: 'Frais reçus. La scolarité va prendre votre demande en charge.',
  EN_TRAITEMENT: 'La scolarité prépare votre document.',
  PRETE: 'Votre document est prêt : présentez-vous au guichet de la scolarité avec votre carte.',
  REMISE: 'Document remis. Rien de plus à faire.',
  REJETEE: 'Demande rejetée. Le motif est indiqué ci-dessous ; vous pouvez en déposer une nouvelle.',
};

const ETAPES_DEMANDE = [
  { identifiant: 'EN_ATTENTE_PAIEMENT', libelle: 'Paiement', icone: 'payments' },
  { identifiant: 'PAYEE', libelle: 'Payée', icone: 'verified' },
  { identifiant: 'EN_TRAITEMENT', libelle: 'Traitement', icone: 'build' },
  { identifiant: 'PRETE', libelle: 'Prête', icone: 'check_circle' },
  { identifiant: 'REMISE', libelle: 'Remise', icone: 'task_alt' },
];

const OPTIONS_STATUTS = optionsDepuis(LIBELLE_STATUT_DEMANDE);
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
const suiviOuvert = ref(false);
const demandeSuivie = ref<DemandeDocument | null>(null);
const paiementOuvert = ref(false);
const demandeAPayer = ref<DemandeDocument | null>(null);
const enregistrementPaiement = ref(false);
const erreurPaiement = ref('');
const formPaiement = ref({
  mode: 'MOBILE_MONEY' as ModePaiement,
  operateur: 'ORANGE_MONEY',
  telephone: '',
});

const plaques = [
  { cle: 'EN_ATTENTE_PAIEMENT', libelle: 'À payer', alerte: true },
  { cle: 'EN_TRAITEMENT', libelle: 'En traitement', alerte: false },
  { cle: 'PRETE', libelle: 'Prêtes', alerte: false },
  { cle: 'REMISE', libelle: 'Remises', alerte: false },
];

function libelleStatut(s: string) {
  return LIBELLE_STATUT_DEMANDE[s as StatutDemande] ?? s;
}
function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'frais', label: 'Frais', field: 'frais', align: 'right' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  {
    name: 'creeLe',
    label: 'Créée le',
    field: 'creeLe',
    align: 'left',
    format: (v: string) => dateHeureLisible(v),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrirSuivi(d: DemandeDocument) {
  demandeSuivie.value = d;
  suiviOuvert.value = true;
}

function ouvrirPaiement(d: DemandeDocument) {
  suiviOuvert.value = false;
  demandeAPayer.value = d;
  paiementOuvert.value = true;
  erreurPaiement.value = '';
  formPaiement.value = {
    mode: 'MOBILE_MONEY',
    operateur: 'ORANGE_MONEY',
    telephone: '',
  };
}

async function payer() {
  if (!demandeAPayer.value) return;
  enregistrementPaiement.value = true;
  erreurPaiement.value = '';
  try {
    // Mode pilote : seul le Mobile Money est confirmé automatiquement. Les
    // espèces et le virement sont encaissés puis confirmés par la scolarité.
    const simuler = formPaiement.value.mode === 'MOBILE_MONEY';
    const body: Record<string, unknown> = {
      mode: formPaiement.value.mode,
      simuler,
    };
    if (formPaiement.value.mode === 'MOBILE_MONEY') {
      body.operateur = formPaiement.value.operateur;
      if (formPaiement.value.telephone) body.telephone = formPaiement.value.telephone;
    }
    await api.post(`/documents-demande/${demandeAPayer.value.id}/payer`, body);
    $q.notify({
      type: 'positive',
      message: simuler
        ? 'Paiement enregistré : votre demande passe en traitement.'
        : 'Paiement initié : présentez-vous au guichet, la scolarité confirmera.',
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
        search: (f.recherche ?? '').toString().trim() || undefined,
      },
    });
    demandes.value = data.data;
    pagination.value.total = data.total;

    // Compteurs calculés sur les demandes affichées (l'API étudiante ne
    // fournit pas de tableau de bord dédié).
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
  () => [filtres.value.recherche, filtres.value.statut],
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
$vert: #0F7A45;
$jaune-fonce: #C98A00;
$rouge: #C4122E;

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

/* Mêmes blocs de détail que le registre de la scolarité. */
.demande-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--up-2);
  background: rgba(16, 37, 30, 0.04);
  padding: var(--up-2);
  border-left: var(--up-filet);

  .pochoir {
    display: block;
    color: var(--up-encre-douce);
    margin-bottom: 2px;
  }
}

.demande-bloc {
  background: var(--up-craie);
  border: var(--up-filet-fin);
  padding: var(--up-2);
  border-radius: 0;
  font-size: 0.95rem;
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