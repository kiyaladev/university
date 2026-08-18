<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Paie des vacataires</div>
        <div class="page-sous-titre">
          Le chemin d'une feuille mensuelle : elle agrège les heures constatées
          lors des contrôles, la direction la valide — les montants sont alors
          figés —, puis l'administration la marque payée.
        </div>
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

    <liens-croises
      :liens="[
        { to: '/rapports', libelle: 'Rapports & états', icone: 'insights', aide: 'L’état de paiement détaillé, enseignant par enseignant' },
        { to: '/affectations', libelle: 'Charges d’enseignement', icone: 'assignment_ind', aide: 'Les taux horaires et volumes contractuels utilisés au calcul' },
        { to: '/rectorat', libelle: 'Tableau de bord Rectorat', icone: 'dashboard', aide: 'La masse salariale consolidée sur 12 mois' },
      ]"
    />

    <filter-bar
      v-model="filtres"
      :recherche="false"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <view-toggle
          cle="feuilles_paie"
          :modes="['tableau', 'cartes']"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
        <q-btn
          flat
          dense
          round
          color="primary"
          icon="refresh"
          aria-label="Recharger les feuilles de paie"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>Recharger</q-tooltip>
        </q-btn>
      </template>
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.annee"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Année"
        />
      </template>
    </filter-bar>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ pagination.total }} feuille(s) —
      {{ filtres.statut ? LIBELLE_STATUT_PAIE[filtres.statut].toLowerCase() : 'tous statuts' }},
      {{ filtres.annee ?? 'toutes années' }} · total affiché
      {{ montantLisible(totalMontant) }} GNF
    </div>

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
          <q-btn
            flat
            dense
            round
            icon="visibility"
            color="primary"
            :aria-label="`Détail des lignes de ${p.row.libelle}`"
            @click.stop="ouvrirDetail(null, p.row)"
          >
            <q-tooltip>Détail des lignes</q-tooltip>
          </q-btn>
          <template v-if="peutCalculer(p.row)">
            <q-btn
              flat
              dense
              round
              icon="refresh"
              :aria-label="`Recalculer ${p.row.libelle}`"
              @click.stop="recalculer(p.row)"
            >
              <q-tooltip>Recalculer les heures contrôlées</q-tooltip>
            </q-btn>
          </template>
          <template v-if="peutValider(p.row)">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="verified"
              :aria-label="`Valider ${p.row.libelle}`"
              @click.stop="valider(p.row)"
            >
              <q-tooltip>Valider et figer les montants</q-tooltip>
            </q-btn>
          </template>
          <template v-if="peutPayer(p.row)">
            <q-btn
              flat
              dense
              round
              color="primary"
              icon="payments"
              :aria-label="`Marquer ${p.row.libelle} payée`"
              @click.stop="payer(p.row)"
            >
              <q-tooltip>Marquer payée</q-tooltip>
            </q-btn>
          </template>
          <q-btn
            v-if="peutImprimer"
            flat
            dense
            round
            icon="print"
            :aria-label="`Imprimer ${p.row.libelle}`"
            @click.stop="imprimer(p.row)"
          >
            <q-tooltip>Imprimer la feuille (A4)</q-tooltip>
          </q-btn>
          <template v-if="peutSupprimer(p.row)">
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="`Supprimer ${p.row.libelle}`"
              @click.stop="supprimer(p.row)"
            >
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="payments" size="36px" />
          <div class="text-subtitle2 q-mt-sm">Aucune feuille de paie</div>
          <div class="text-caption">
            Une feuille couvre un mois : elle rassemble les heures contrôlées de
            la période et les convertit en montants au taux de chaque enseignant.
            {{ aDesFiltres ? 'Aucune ne correspond aux filtres en cours.' : '' }}
          </div>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            label="Retirer les filtres"
            @click="reinitialiser"
          />
          <q-btn
            v-else-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Créer la première feuille"
            @click="dialogCreation = true"
          />
        </div>
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
              <q-btn flat dense no-caps icon="refresh" label="Recalculer" @click.stop="recalculer(f)" />
            </template>
            <template v-if="peutValider(f)">
              <q-btn flat dense no-caps color="positive" icon="verified" label="Valider" @click.stop="valider(f)" />
            </template>
            <template v-if="peutPayer(f)">
              <q-btn flat dense no-caps icon="payments" label="Marquer payée" @click.stop="payer(f)" />
            </template>
            <q-btn
              v-if="peutImprimer"
              flat
              dense
              no-caps
              icon="print"
              label="Imprimer"
              @click.stop="imprimer(f)"
            />
            <template v-if="peutSupprimer(f)">
              <q-btn
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="`Supprimer ${f.libelle}`"
                @click.stop="supprimer(f)"
              />
            </template>
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!feuilles.length && !chargement" class="col-12">
        <div class="etat-vide">
          <q-icon name="payments" size="36px" />
          <div class="text-subtitle2 q-mt-sm">Aucune feuille de paie</div>
          <div class="text-caption">
            Une feuille couvre un mois : elle rassemble les heures contrôlées de
            la période et les convertit en montants au taux de chaque enseignant.
            {{ aDesFiltres ? 'Aucune ne correspond aux filtres en cours.' : '' }}
          </div>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            label="Retirer les filtres"
            @click="reinitialiser"
          />
          <q-btn
            v-else-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            label="Créer la première feuille"
            @click="dialogCreation = true"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; charger()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; charger()"
    />

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
            <template #no-data>
              <div class="etat-vide">
                <div class="text-subtitle2">Feuille sans ligne</div>
                <div class="text-caption">
                  Aucune heure contrôlée n'a été trouvée sur la période. Lancez un
                  recalcul, ou vérifiez que les séances du mois ont bien été pointées.
                </div>
              </div>
            </template>
            <template #bottom>
              <div class="detail-total">
                <div class="text-weight-medium">
                  Total — {{ detail?.lignes?.length ?? 0 }} enseignant(s)
                </div>
                <div class="text-weight-medium chiffres">{{ heuresLisibles(heuresTotal) }} réalisées</div>
                <div class="text-weight-medium chiffres">{{ montantLisible(detail?.montantTotal) }} GNF</div>
              </div>
            </template>
          </q-table>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            v-if="peutImprimer"
            flat
            no-caps
            icon="print"
            label="Imprimer la feuille (A4)"
            @click="detail && imprimer(detail)"
          />
          <q-btn flat no-caps label="Fermer" v-close-popup />
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
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import LiensCroises from '../components/LiensCroises.vue';
import FeuillePaieDialog from '../components/FeuillePaieDialog.vue';
import {
  LIBELLE_STATUT_PAIE,
  dateLisible,
  heuresLisibles,
  montantLisible,
} from '../utils/libelles';
import type { FeuillePaie } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const modeVue = ref<'tableau' | 'cartes'>('tableau');
const feuilles = ref<FeuillePaie[]>([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const chargement = ref(false);
const dialogCreation = ref(false);
const dialogDetail = ref(false);
const detail = ref<FeuillePaie | null>(null);

// La barre de filtres travaille sur un Record : la recherche plein texte est
// désactivée parce que l'API des feuilles n'indexe rien d'autre que le couple
// statut / année — un champ de recherche inerte serait un mensonge.
const filtres = ref<Record<string, any>>({ statut: null, annee: null });

const peutCreer = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));
const peutImprimer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const aDesFiltres = computed(() => !!filtres.value.statut || !!filtres.value.annee);

const optionsStatuts = ['BROUILLON', 'VALIDEE', 'PAYEE'].map((v) => ({
  label: LIBELLE_STATUT_PAIE[v],
  value: v,
}));

const chipsFiltres = computed(() => {
  const chips: Array<{ label: string; value: any }> = [];
  if (filtres.value.statut) {
    chips.push({ label: `Statut : ${LIBELLE_STATUT_PAIE[filtres.value.statut]}`, value: filtres.value.statut });
  }
  if (filtres.value.annee) {
    chips.push({ label: `Année : ${filtres.value.annee}`, value: filtres.value.annee });
  }
  return chips;
});

const anneesExistantes = computed(() => feuilles.value.map((f) => f.annee));

/** Cycle de vie d'une feuille, peint aux couleurs partagées avec le courrier. */
const classeStatut = (s: string) =>
  s === 'BROUILLON' ? 'champ--brouillon' : s === 'VALIDEE' ? 'champ--validee' : 'champ--close';

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

// Toutes les grandeurs monétaires passent par le même formateur, et les heures
// par le même : sans quoi une colonne dit « 12000 » quand la voisine dit
// « 12 000 ».
const colonnesLignes: QTableColumn[] = [
  { name: 'enseignant', label: 'Enseignant', field: 'enseignant', align: 'left' },
  {
    name: 'taux',
    label: 'Taux horaire (GNF)',
    field: (r: any) => montantLisible(r.tauxHoraire),
    align: 'right',
  },
  {
    name: 'heures',
    label: 'Heures réalisées',
    field: (r: any) => heuresLisibles(r.heuresReelles),
    align: 'right',
  },
  {
    name: 'volume',
    label: 'Volume prévu',
    field: (r: any) => heuresLisibles(r.volumePrevu),
    align: 'right',
  },
  {
    name: 'brut',
    label: 'Brut (GNF)',
    field: (r: any) => montantLisible(r.montantBrut),
    align: 'right',
  },
  {
    name: 'retenue',
    label: 'Retenue (GNF)',
    field: (r: any) => montantLisible(r.retenue),
    align: 'right',
  },
  {
    name: 'montant',
    label: 'Net (GNF)',
    field: (r: any) => montantLisible(r.montantNet),
    align: 'right',
  },
  { name: 'commentaire', label: 'Commentaire', field: 'commentaire', align: 'left' },
];

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/feuilles-paie', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        statut: filtres.value.statut || undefined,
        annee: filtres.value.annee || undefined,
      },
    });
    feuilles.value = data.data;
    pagination.value.total = data.total;
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des feuilles de paie impossible.',
    });
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = { statut: null, annee: null };
  pagination.value.page = 1;
  charger();
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

// Un changement de filtre repart de la première page : rester en page 4 d'une
// liste qui n'en compte plus qu'une donne un écran vide sans raison visible.
watch(
  () => [filtres.value.statut, filtres.value.annee],
  () => {
    pagination.value.page = 1;
    charger();
  },
);

onMounted(charger);
</script>

<style scoped lang="scss">
@use '../css/champs-admin' as *;

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
  border-top: var(--up-filet);
  background: var(--up-craie);
}

</style>