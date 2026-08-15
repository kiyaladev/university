<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Paiements</div>
        <div class="page-sous-titre">
          Encaissements Mobile Money, espèces et virements : l'agent comptable
          confirme les transactions de l'opérateur, chaque opération est tracée.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouveau paiement"
          @click="dialogPaiement = true"
        />
      </div>
    </div>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm items-center">
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Statut"
            @update:model-value="charger"
          />
        </div>
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.mode"
            :options="optionsModes"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Mode"
            @update:model-value="charger"
          />
        </div>
        <div class="col-6 col-md-3">
          <q-input
            v-model="recherche"
            dense
            outlined
            clearable
            debounce="300"
            placeholder="Référence, étudiant…"
            @update:model-value="charger"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </div>
        <div class="col-6 col-md-auto text-right text-caption text-grey-7">
          {{ paiements.length }} paiement(s)
        </div>
      </q-card-section>
    </q-card>

    <q-table
      flat
      bordered
      class="carte"
      :rows="paiements"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #header-cell-reference>
        <q-th>Référence</q-th>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.inscription?.numero ?? 'paiement libre' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>

      <template #body-cell-modep="p">
        <q-td :props="p">
          <div>{{ LIBELLE_MODE_PAIEMENT[p.row.mode] ?? p.row.mode }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.operateur ? LIBELLE_OPERATEUR_MM[p.row.operateur] ?? p.row.operateur : '—' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_PAIEMENT[p.row.statut] ?? p.row.statut }}
          </span>
        </q-td>
      </template>

      <template #body-cell-horodatage="p">
        <q-td :props="p">{{ dateHeureLisible(p.row.horodatage) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="info" color="primary" @click="ouvrirDetail(p.row)">
            <q-tooltip>Détails de la transaction</q-tooltip>
          </q-btn>
          <template v-if="peutSimuler(p.row)">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="check"
              @click="simuler(p.row, 'REUSSI')"
            >
              <q-tooltip>Confirmer le paiement (réussi)</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="close"
              @click="simuler(p.row, 'ECHOUE')"
            >
              <q-tooltip>Marquer échoué</q-tooltip>
            </q-btn>
          </template>
          <q-btn
            v-if="peutAnnuler(p.row)"
            flat
            dense
            round
            color="negative"
            icon="block"
            @click="ouvrirAnnulation(p.row)"
          >
            <q-tooltip>Annuler le paiement</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <paiement-dialog v-model="dialogPaiement" @paye="charger" />

    <!-- Détail d'une transaction -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ detail?.reference }}</div>
          <div class="text-caption text-grey-7">
            {{ detail ? `${LIBELLE_MODE_PAIEMENT[detail.mode] ?? detail.mode} · ${LIBELLE_STATUT_PAIEMENT[detail.statut] ?? detail.statut}` : '' }}
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-list separator dense>
            <q-item>
              <q-item-section>
                <q-item-label caption>Étudiant / dossier</q-item-label>
                <q-item-label>
                  {{ detail?.etudiant ? `${detail.etudiant.nom} ${detail.etudiant.prenom}` : '—' }}
                  {{ detail?.inscription?.numero ? ` · ${detail.inscription.numero}` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Montant</q-item-label>
                <q-item-label>{{ montantLisible(detail?.montant) }} {{ detail?.devise }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Transaction (opérateur)</q-item-label>
                <q-item-label>{{ detail?.transactionId ?? 'aucune — simulation pilote' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Opérateur / téléphone</q-item-label>
                <q-item-label>
                  {{ detail?.operateur ? LIBELLE_OPERATEUR_MM[detail.operateur] ?? detail.operateur : '—' }}
                  · {{ detail?.telephone ?? '—' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Motif</q-item-label>
                <q-item-label>{{ detail?.motif ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Horodatage</q-item-label>
                <q-item-label>{{ detail ? dateHeureLisible(detail.horodatage) : '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Causerie</q-item-label>
                <q-item-label>
                  {{ detail?.creePar ? `${detail.creePar.prenom} ${detail.creePar.nom}` : 'registre' }}
                  {{ detail?.completeLe ? ` · complété le ${dateHeureLisible(detail.completeLe)}` : '' }}
                  {{ detail?.motifAnnulation ? ` · annulé : ${detail.motifAnnulation}` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Annulation : le motif est exigé -->
    <q-dialog v-model="dialogAnnulation">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Annuler {{ paiementAnnuler?.reference }}</div>
          <div class="text-caption text-grey-7">
            {{ paiementAnnuler ? LIBELLE_STATUT_PAIEMENT[paiementAnnuler.statut] : '' }} —
            le paiement reste tracé au registre.
          </div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="motifAnnulation"
            outlined
            dense
            type="textarea"
            rows="3"
            label="Motif d’annulation *"
            autofocus
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
          <q-btn
            color="negative"
            unelevated
            no-caps
            icon="block"
            label="Annuler le paiement"
            :disable="motifAnnulation.trim().length < 3"
            :loading="annulationEnCours"
            @click="confirmerAnnulation"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import PaiementDialog from '../components/PaiementDialog.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_PAIEMENT,
  dateHeureLisible,
  montantLisible,
} from '../utils/libelles';
import type { Paiement } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const paiements = ref<Paiement[]>([]);
const chargement = ref(false);
const recherche = ref('');
const dialogPaiement = ref(false);
const dialogDetail = ref(false);
const detail = ref<Paiement | null>(null);
const dialogAnnulation = ref(false);
const paiementAnnuler = ref<Paiement | null>(null);
const motifAnnulation = ref('');
const annulationEnCours = ref(false);

const filtres = ref<{ statut: string | null; mode: string | null }>({ statut: null, mode: null });

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutSimuler = (p: Paiement) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && p.statut === 'EN_ATTENTE';
const peutAnnuler = (p: Paiement) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && !['REUSSI', 'ANNULE', 'REMBOURSE'].includes(p.statut);

const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsModes = computed(() =>
  Object.entries(LIBELLE_MODE_PAIEMENT).map(([value, label]) => ({ value, label })),
);

const colonnes: QTableColumn[] = [
  { name: 'reference', label: 'Référence', field: 'reference', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant / Dossier', field: 'etudiant', align: 'left' },
  { name: 'motif', label: 'Motif', field: 'motif', align: 'left' },
  { name: 'mode', label: 'Mode / Opérateur', field: 'mode', align: 'left' },
  { name: 'montant', label: 'Montant', field: 'montant', align: 'right', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'horodatage', label: 'Date', field: 'horodatage', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const classeStatut = (s: string) =>
  ({
    EN_ATTENTE: 'champ--attente-paiement',
    REUSSI: 'champ--payee',
    ECHOUE: 'champ--annulee',
    ANNULE: 'champ--brouillon',
    REMBOURSE: 'champ--brouillon',
  })[s] ?? 'champ--brouillon';

function ouvrirDetail(p: Paiement) {
  detail.value = p;
  dialogDetail.value = true;
}

function simuler(p: Paiement, statut: 'REUSSI' | 'ECHOUE') {
  $q.dialog({
    title: statut === 'REUSSI' ? 'Confirmer le paiement' : 'Marquer le paiement échoué',
    message: `${p.reference} pour ${montantLisible(p.montant)} ${p.devise} — répercuter la réponse de l'opérateur (${statut === 'REUSSI' ? 'paiement reçu' : 'transaction rejetée'}) ?`,
    ok: { color: statut === 'REUSSI' ? 'positive' : 'negative', label: 'Confirmer', unelevated: true },
    cancel: true,
  }).onOk(async () => {
    await api.post(`/paiements/${p.id}/simuler`, { statut });
    $q.notify({
      type: 'positive',
      message: statut === 'REUSSI' ? 'Paiement confirmé' : 'Paiement marqué échoué',
    });
    await charger();
  });
}

function ouvrirAnnulation(p: Paiement) {
  paiementAnnuler.value = p;
  motifAnnulation.value = '';
  dialogAnnulation.value = true;
}

async function confirmerAnnulation() {
  annulationEnCours.value = true;
  try {
    await api.post(`/paiements/${paiementAnnuler.value!.id}/annuler`, {
      motif: motifAnnulation.value,
    });
    $q.notify({ type: 'warning', message: 'Paiement annulé' });
    dialogAnnulation.value = false;
    await charger();
  } finally {
    annulationEnCours.value = false;
  }
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/paiements', {
      params: {
        all: '1',
        statut: filtres.value.statut || undefined,
        mode: filtres.value.mode || undefined,
        search: recherche.value || undefined,
      },
    });
    paiements.value = data.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(charger);
</script>

<style>
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
.champ--annulee { background: #c2321e; }
</style>