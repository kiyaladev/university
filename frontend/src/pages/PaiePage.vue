<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Feuilles de paie</div>
        <div class="page-sous-titre">
          Garantir le paiement rapide des heures effectuées : les feuilles
          mensuelles figent les heures contrôlées, la direction valide, la
          comptabilité paie.
        </div>
      </div>
      <div class="col-auto">
        <bascule-vue v-model="modeVue" />
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle feuille"
          @click="dialogCreation = true"
        />
      </div>
    </div>

    <!-- Filtres : statut et année -->
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
            v-model="filtres.annee"
            :options="optionsAnnees"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Année"
            @update:model-value="charger"
          />
        </div>
        <div class="col-auto">
          <q-btn round color="primary" icon="refresh" :loading="chargement" @click="charger" />
        </div>
        <div class="col-12 col-md-auto text-right text-caption text-grey-7">
          {{ feuilles.length }} feuille(s) ·
          total {{ montantLisible(totalMontant) }} GNF
        </div>
      </q-card-section>
    </q-card>

    <!-- Vue tableau -->
    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="feuilles"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="ouvrirDetail"
    >
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_PAIE[p.row.statut] }}
          </span>
        </q-td>
      </template>
      <template #body-cell-montantTotal="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montantTotal) }}
        </q-td>
      </template>
      <template #body-cell-lignes="p">
        <q-td :props="p" class="text-right">
          {{ p.row.lignes?.length ?? 0 }}
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="visibility" color="primary" @click="ouvrirDetail(null, p.row)">
            <q-tooltip>Détail des lignes</q-tooltip>
          </q-btn>
          <template v-if="peutCalculer(p.row)">
            <q-btn flat dense round icon="refresh" @click="recalculer(p.row)">
              <q-tooltip>Recalculer les heures contrôlées</q-tooltip>
            </q-btn>
          </template>
          <template v-if="peutValider(p.row)">
            <q-btn flat dense round color="positive" icon="verified" @click="valider(p.row)">
              <q-tooltip>Valider et figer les montants</q-tooltip>
            </q-btn>
          </template>
          <template v-if="peutPayer(p.row)">
            <q-btn flat dense round color="primary" icon="payments" @click="payer(p.row)">
              <q-tooltip>Marquer payée</q-tooltip>
            </q-btn>
          </template>
          <q-btn flat dense round icon="print" @click="imprimer(p.row)">
            <q-tooltip>Imprimer en A4</q-tooltip>
          </q-btn>
          <template v-if="peutSupprimer(p.row)">
            <q-btn flat dense round color="negative" icon="delete" @click="supprimer(p.row)">
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div
        v-for="f in feuilles"
        :key="f.id"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card flat bordered class="carte carte-feuille full-height" @click="ouvrirDetail(null, f)">
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-h6">{{ f.libelle }}</div>
                <div class="text-caption text-grey-7">
                  {{ dateLisible(f.dateDebut) }} — {{ dateLisible(f.dateFin) }}
                </div>
              </div>
              <span class="champ badge-statut" :class="classeStatut(f.statut)">
                {{ LIBELLE_STATUT_PAIE[f.statut] }}
              </span>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="row items-end justify-between">
              <div>
                <div class="text-caption text-grey-7">Montant total</div>
                <div class="text-h6">{{ montantLisible(f.montantTotal) }} GNF</div>
              </div>
              <div class="text-caption text-grey-7 text-right">
                {{ f.lignes?.length ?? 0 }} ligne(s)<br />
                {{ f.creePar ? `${f.creePar.prenom} ${f.creePar.nom}` : '' }}
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <template v-if="peutCalculer(f)">
              <q-btn flat dense no-caps icon="refresh" label="Recalc." @click.stop="recalculer(f)" />
            </template>
            <template v-if="peutValider(f)">
              <q-btn flat dense no-caps color="positive" icon="verified" label="Valider" @click.stop="valider(f)" />
            </template>
            <template v-if="peutPayer(f)">
              <q-btn flat dense no-caps icon="payments" label="Payer" @click.stop="payer(f)" />
            </template>
            <q-btn flat dense no-caps icon="print" label="Imprimer" @click.stop="imprimer(f)" />
            <template v-if="peutSupprimer(f)">
              <q-btn flat dense round color="negative" icon="delete" @click.stop="supprimer(f)" />
            </template>
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <!-- Détail : lignes de la feuille -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 900px; max-width: 95vw">
        <q-card-section>
          <div class="row items-start no-wrap q-col-gutter-md">
            <div class="col">
              <div class="text-h6">{{ detail?.libelle }}</div>
              <div class="text-caption text-grey-7">
                {{ detail ? `${dateLisible(detail.dateDebut)} — ${dateLisible(detail.dateFin)}` : '' }}
              </div>
            </div>
            <span v-if="detail" class="champ badge-statut" :class="classeStatut(detail.statut)">
              {{ LIBELLE_STATUT_PAIE[detail.statut] }}
            </span>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-table
            flat
            dense
            :rows="detail?.lignes ?? []"
            :columns="colonnesLignes"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-enseignant="p">
              <q-td :props="p">
                <div>{{ p.row.enseignant?.nom }} {{ p.row.enseignant?.prenom }}</div>
                <div class="q-gutter-xs q-mt-xs">
                  <q-chip dense size="xs" outline color="primary">{{ p.row.enseignant?.matricule }}</q-chip>
                  <q-chip dense size="xs" :color="p.row.enseignant?.statut === 'VACATAIRE' ? 'accent' : 'secondary'">
                    {{ p.row.enseignant?.statut }}
                  </q-chip>
                </div>
              </q-td>
            </template>
            <template #bottom>
              <div class="detail-total">
                <div class="text-weight-medium">
                  Total — {{ detail?.lignes?.length ?? 0 }} enseignant(s)
                </div>
                <div class="text-weight-medium">{{ heuresTotal }} h réalisées</div>
                <div class="text-weight-medium">{{ montantLisible(detail?.montantTotal) }} GNF</div>
              </div>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps icon="print" label="Imprimer" @click="detail && imprimer(detail)" />
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <feuille-paie-dialog
      v-model="dialogCreation"
      :annees-existantes="anneesExistantes"
      @cree="charger"
      @calculer="avecNouvelleFeuille"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import BasculeVue from '../components/BasculeVue.vue';
import FeuillePaieDialog from '../components/FeuillePaieDialog.vue';
import { useVuePreferee } from '../composables/vuePreferee';
import { LIBELLE_STATUT_PAIE, dateLisible, montantLisible } from '../utils/libelles';
import type { FeuillePaie } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const modeVue = useVuePreferee('feuilles_paie');
const feuilles = ref<FeuillePaie[]>([]);
const chargement = ref(false);
const dialogCreation = ref(false);
const dialogDetail = ref(false);
const detail = ref<FeuillePaie | null>(null);

const filtres = ref<{ statut: string | null; annee: number | null }>({ statut: null, annee: null });

const peutCreer = () => auth.aRole(['ADMIN', 'DIRECTION']);

const optionsStatuts = ['BROUILLON', 'VALIDEE', 'PAYEE'].map((v) => ({
  label: LIBELLE_STATUT_PAIE[v],
  value: v,
}));

const anneesExistantes = computed(() => feuilles.value.map((f) => f.annee));

const optionsAnnees = computed(() => {
  const courante = new Date().getFullYear();
  const annees = new Set<number>([
    courante,
    courante - 1,
    courante - 2,
    ...anneesExistantes.value,
    ...(filtres.value.annee ? [filtres.value.annee] : []),
  ]);
  return [...annees]
    .sort((a, b) => b - a)
    .map((a) => ({ label: String(a), value: a }));
});

const totalMontant = computed(() => feuilles.value.reduce((t, f) => t + (f.montantTotal ?? 0), 0));

const heuresTotal = computed(() =>
  (detail.value?.lignes ?? []).reduce((t, l) => t + (l.heuresReelles ?? 0), 0),
);

const classeStatut = (s: string) =>
  s === 'BROUILLON' ? 'champ--brouillon' : s === 'VALIDEE' ? 'champ--validee' : 'champ--payee';

const colonnes: QTableColumn[] = [
  { name: 'libelle', label: 'Feuille', field: 'libelle', align: 'left', sortable: true },
  {
    name: 'periode',
    label: 'Période',
    field: (r: FeuillePaie) => `${dateLisible(r.dateDebut)} — ${dateLisible(r.dateFin)}`,
    align: 'left',
  },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'lignes', label: 'Lignes', field: 'lignes', align: 'right' },
  {
    name: 'montantTotal',
    label: 'Montant total (GNF)',
    field: 'montantTotal',
    align: 'right',
    sortable: true,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesLignes: QTableColumn[] = [
  { name: 'enseignant', label: 'Enseignant', field: 'enseignant', align: 'left' },
  { name: 'taux', label: 'Taux', field: 'tauxHoraire', align: 'right' },
  { name: 'heures', label: 'Heures réalisées', field: 'heuresReelles', align: 'right' },
  { name: 'volume', label: 'Volume prévu', field: 'volumePrevu', align: 'right' },
  {
    name: 'brut',
    label: 'Brut',
    field: (r: any) => montantLisible(r.montantBrut),
    align: 'right',
  },
  { name: 'retenue', label: 'Retenue', field: 'retenue', align: 'right' },
  { name: 'montant', label: 'Net', field: 'montantNet', align: 'right' },
  { name: 'commentaire', label: 'Commentaire', field: 'commentaire', align: 'left' },
];

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/feuilles-paie', {
      params: {
        all: '1',
        statut: filtres.value.statut || undefined,
        annee: filtres.value.annee || undefined,
      },
    });
    feuilles.value = data.data;
  } finally {
    chargement.value = false;
  }
}

function ouvrirDetail(_event: unknown, f: FeuillePaie) {
  detail.value = f;
  dialogDetail.value = true;
}

async function avecNouvelleFeuille(f: FeuillePaie) {
  dialogDetail.value = false;
  await recalculer(f);
}

/** Recalcul idempotent des heures contrôlées de la période. */
function recalculer(f: FeuillePaie) {
  $q.dialog({
    title: 'Recalculer',
    message: `Agréger les heures contrôlées d'UniPrésence sur la feuille « ${f.libelle} » ? Les lignes seront recréées (les commentaires sont conservés).`,
    cancel: true,
    ok: { label: 'Recalculer', color: 'primary', unelevated: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(`/feuilles-paie/${f.id}/calculer`);
      $q.notify({ type: 'positive', message: 'Feuille recalculée' });
      detail.value = data;
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Recalcul impossible' });
    }
  });
}

function valider(f: FeuillePaie) {
  $q.dialog({
    title: 'Valider la feuille',
    message: `Valider « ${f.libelle} » pour ${montantLisible(f.montantTotal)} GNF ? Les montants seront figés : plus aucun recalcul possible.`,
    cancel: true,
    ok: { label: 'Valider', color: 'positive', unelevated: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(`/feuilles-paie/${f.id}/valider`);
      $q.notify({ type: 'positive', message: 'Feuille validée' });
      detail.value = data;
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Validation impossible' });
    }
  });
}

function payer(f: FeuillePaie) {
  $q.dialog({
    title: 'Marquer payée',
    message: `Marquer « ${f.libelle} » comme payée (${montantLisible(f.montantTotal)} GNF) ?`,
    cancel: true,
    ok: { label: 'Marquer payée', color: 'primary', unelevated: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(`/feuilles-paie/${f.id}/payer`);
      $q.notify({ type: 'positive', message: 'Feuille payée' });
      detail.value = data;
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Opération impossible' });
    }
  });
}

function imprimer(f: FeuillePaie) {
  window.open(`${API_URL}/feuilles-paie/${f.id}/imprimer?token=${auth.token}`, '_blank');
}

function supprimer(f: FeuillePaie) {
  $q.dialog({
    title: 'Supprimer',
    message: `Supprimer définitivement la feuille « ${f.libelle} » ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    try {
      await api.delete(`/feuilles-paie/${f.id}`);
      $q.notify({ type: 'positive', message: 'Feuille supprimée' });
      if (detail.value?.id === f.id) dialogDetail.value = false;
      await charger();
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Suppression impossible' });
    }
  });
}

// Droits d'action, par rôle et par statut du cycle de vie.
const peutCalculer = (f: FeuillePaie) =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) && f.statut === 'BROUILLON';
const peutValider = (f: FeuillePaie) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && f.statut === 'BROUILLON';
const peutPayer = (f: FeuillePaie) => auth.role === 'ADMIN' && f.statut === 'VALIDEE';
const peutSupprimer = (f: FeuillePaie) => auth.role === 'ADMIN' && f.statut === 'BROUILLON';

onMounted(charger);
</script>

<!-- Badges de statut de la paie (couleurs maison, partagées avec les dialogs) :
     gris clair pour le brouillon, vert secondaire pour la validation, bleu
     pour la paye — repris dans l'impression A4. -->
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

.champ--brouillon {
  background: #cfd4d9;
  color: #33463f;
}

.champ--validee {
  background: #0f7a45;
}

.champ--payee {
  background: #1565c0;
}
</style>

<style scoped lang="scss">
.carte-feuille {
  cursor: pointer;
  transition: background var(--up-transition);

  &:hover {
    background: var(--up-craie);
  }
}

.detail-total {
  display: flex;
  justify-content: space-between;
  gap: var(--up-2);
  padding: 10px var(--up-3);
  border-top: 2px solid var(--up-encre);
  background: var(--up-craie);
}
</style>