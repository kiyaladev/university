<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('paiePage.title')" :subtitle="$t('paiePage.subtitle')">
      <template #actions>
<div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('paiePage.actions.newSheet')"
          @click="dialogCreation = true"
        />
      </div>
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :recherche="false"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #actions>
        <q-btn
          flat
          dense
          round
          color="primary"
          icon="refresh"
          :aria-label="$t('paiePage.ariaLabels.reload')"
          :loading="chargement"
          @click="charger"
        >
          <q-tooltip>{{ $t('paiePage.tooltips.reload') }}</q-tooltip>
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
          :label="$t('paiePage.filters.statut')"
        />
        <q-select
          v-model="filtres.annee"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('paiePage.filters.annee')"
        />
      </template>
    </filter-bar>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ $t('paiePage.summary.sheetsCount', { count: pagination.total }) }} {{ $t('rectoratPage.subtitleFallback') }}
      {{ filtres.statut ? LIBELLE_STATUT_PAIE[filtres.statut].toLowerCase() : $t('paiePage.summary.allStatuses') }},
      {{ filtres.annee ?? $t('paiePage.summary.allYears') }} · {{ $t('paiePage.summary.totalShown') }}
      {{ montantLisible(totalMontant) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}
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
            :aria-label="$t('paiePage.ariaLabels.detail', { libelle: p.row.libelle })"
            @click.stop="ouvrirDetail(null, p.row)"
          >
            <q-tooltip>{{ $t('paiePage.tooltips.detail') }}</q-tooltip>
          </q-btn>
          <template v-if="peutCalculer(p.row)">
            <q-btn
              flat
              dense
              round
              icon="refresh"
              :aria-label="$t('paiePage.ariaLabels.recalculate', { libelle: p.row.libelle })"
              @click.stop="recalculer(p.row)"
            >
              <q-tooltip>{{ $t('paiePage.tooltips.recalculate') }}</q-tooltip>
            </q-btn>
          </template>
          <template v-if="peutValider(p.row)">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="verified"
              :aria-label="$t('paiePage.ariaLabels.validate', { libelle: p.row.libelle })"
              @click.stop="valider(p.row)"
            >
              <q-tooltip>{{ $t('paiePage.tooltips.validate') }}</q-tooltip>
            </q-btn>
          </template>
          <template v-if="peutPayer(p.row)">
            <q-btn
              flat
              dense
              round
              color="primary"
              icon="payments"
              :aria-label="$t('paiePage.ariaLabels.markPaid', { libelle: p.row.libelle })"
              @click.stop="payer(p.row)"
            >
              <q-tooltip>{{ $t('paiePage.tooltips.markPaid') }}</q-tooltip>
            </q-btn>
          </template>
          <q-btn
            v-if="peutImprimer"
            flat
            dense
            round
            icon="print"
            :aria-label="$t('paiePage.ariaLabels.print', { libelle: p.row.libelle })"
            @click.stop="imprimer(p.row)"
          >
            <q-tooltip>{{ $t('paiePage.tooltips.print') }}</q-tooltip>
          </q-btn>
          <template v-if="peutSupprimer(p.row)">
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="$t('paiePage.ariaLabels.delete', { libelle: p.row.libelle })"
              @click.stop="supprimer(p.row)"
            >
              <q-tooltip>{{ $t('paiePage.tooltips.delete') }}</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="payments" size="36px" />
          <div class="text-subtitle2 q-mt-sm">{{ $t('paiePage.emptyState.title') }}</div>
          <div class="text-caption">
            {{ $t('paiePage.emptyState.description') }}
            {{ aDesFiltres ? $t('paiePage.emptyState.filtered') : '' }}
          </div>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            :label="$t('paiePage.actions.clearFilters')"
            @click="reinitialiser"
          />
          <q-btn
            v-else-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('paiePage.actions.createFirst')"
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
                  {{ dateLisible(f.dateDebut) }} {{ $t('rectoratPage.subtitleFallback') }} {{ dateLisible(f.dateFin) }}
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
                <div class="text-caption text-grey-7">{{ $t('paiePage.card.totalAmount') }}</div>
                <div class="text-h6">{{ montantLisible(f.montantTotal) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</div>
              </div>
              <div class="text-caption text-grey-7 text-right">
                {{ $t('paiePage.card.lignesCount', { count: f.lignes?.length ?? 0 }) }}<br />
                {{ f.creePar ? `${f.creePar.prenom} ${f.creePar.nom}` : '' }}
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <template v-if="peutCalculer(f)">
              <q-btn flat dense no-caps icon="refresh" :label="$t('paiePage.actions.recalculate')" @click.stop="recalculer(f)" />
            </template>
            <template v-if="peutValider(f)">
              <q-btn flat dense no-caps color="positive" icon="verified" :label="$t('paiePage.actions.validate')" @click.stop="valider(f)" />
            </template>
            <template v-if="peutPayer(f)">
              <q-btn flat dense no-caps icon="payments" :label="$t('paiePage.actions.markPaid')" @click.stop="payer(f)" />
            </template>
            <q-btn
              v-if="peutImprimer"
              flat
              dense
              no-caps
              icon="print"
              :label="$t('paiePage.actions.print')"
              @click.stop="imprimer(f)"
            />
            <template v-if="peutSupprimer(f)">
              <q-btn
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="$t('paiePage.ariaLabels.delete', { libelle: f.libelle })"
                @click.stop="supprimer(f)"
              />
            </template>
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!feuilles.length && !chargement" class="col-12">
        <div class="etat-vide">
          <q-icon name="payments" size="36px" />
          <div class="text-subtitle2 q-mt-sm">{{ $t('paiePage.emptyState.title') }}</div>
          <div class="text-caption">
            {{ $t('paiePage.emptyState.description') }}
            {{ aDesFiltres ? $t('paiePage.emptyState.filtered') : '' }}
          </div>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            :label="$t('paiePage.actions.clearFilters')"
            @click="reinitialiser"
          />
          <q-btn
            v-else-if="peutCreer"
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="$t('paiePage.actions.createFirst')"
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
                <div class="text-subtitle2">{{ $t('paiePage.detail.lineEmptyTitle') }}</div>
                <div class="text-caption">
                  {{ $t('paiePage.detail.lineEmptyMessage') }}
                </div>
              </div>
            </template>
            <template #bottom>
              <div class="detail-total">
                <div class="text-weight-medium">
                  {{ $t('paiePage.detail.total', { count: detail?.lignes?.length ?? 0 }) }}
                </div>
                <div class="text-weight-medium chiffres">{{ heuresLisibles(heuresTotal) }} {{ $t('paiePage.detail.completed') }}</div>
                <div class="text-weight-medium chiffres">{{ montantLisible(detail?.montantTotal) }} {{ $t('statistiquesMesrs.chart.axis.gnf') }}</div>
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
            :label="$t('paiePage.actions.printSheet')"
            @click="detail && imprimer(detail)"
          />
          <q-btn flat no-caps :label="$t('paiePage.actions.close')" v-close-popup />
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
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';

import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import FeuillePaieDialog from '../components/FeuillePaieDialog.vue';
import {
  LIBELLE_STATUT_PAIE,
  dateLisible,
  heuresLisibles,
  montantLisible,
} from '../utils/libelles';
import type { FeuillePaie } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

const modeVue = usePresentationListe();
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
    chips.push({
      label: t('paiePage.filters.statutChip', { value: LIBELLE_STATUT_PAIE[filtres.value.statut] }),
      value: filtres.value.statut,
    });
  }
  if (filtres.value.annee) {
    chips.push({
      label: t('paiePage.filters.anneeChip', { value: filtres.value.annee }),
      value: filtres.value.annee,
    });
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

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('paiePage.table.columns.libelle'), field: 'libelle', align: 'left', sortable: true },
  {
    name: 'periode',
    label: t('paiePage.table.columns.periode'),
    field: (r: FeuillePaie) => `${dateLisible(r.dateDebut)} — ${dateLisible(r.dateFin)}`,
    align: 'left',
  },
  { name: 'statut', label: t('paiePage.table.columns.statut'), field: 'statut', align: 'left', sortable: true },
  { name: 'lignes', label: t('paiePage.table.columns.lignes'), field: 'lignes', align: 'right' },
  {
    name: 'montantTotal',
    label: t('paiePage.table.columns.montantTotal'),
    field: 'montantTotal',
    align: 'right',
    sortable: true,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

// Toutes les grandeurs monétaires passent par le même formateur, et les heures
// par le même : sans quoi une colonne dit « 12000 » quand la voisine dit
// « 12 000 ».
const colonnesLignes = computed<QTableColumn[]>(() => [
  { name: 'enseignant', label: t('paiePage.table.lignesColumns.enseignant'), field: 'enseignant', align: 'left' },
  {
    name: 'taux',
    label: t('paiePage.table.lignesColumns.taux'),
    field: (r: any) => montantLisible(r.tauxHoraire),
    align: 'right',
  },
  {
    name: 'heures',
    label: t('paiePage.table.lignesColumns.heures'),
    field: (r: any) => heuresLisibles(r.heuresReelles),
    align: 'right',
  },
  {
    name: 'volume',
    label: t('paiePage.table.lignesColumns.volume'),
    field: (r: any) => heuresLisibles(r.volumePrevu),
    align: 'right',
  },
  {
    name: 'brut',
    label: t('paiePage.table.lignesColumns.brut'),
    field: (r: any) => montantLisible(r.montantBrut),
    align: 'right',
  },
  {
    name: 'retenue',
    label: t('paiePage.table.lignesColumns.retenue'),
    field: (r: any) => montantLisible(r.retenue),
    align: 'right',
  },
  {
    name: 'montant',
    label: t('paiePage.table.lignesColumns.montant'),
    field: (r: any) => montantLisible(r.montantNet),
    align: 'right',
  },
  { name: 'commentaire', label: t('paiePage.table.lignesColumns.commentaire'), field: 'commentaire', align: 'left' },
]);

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
  } catch {
    /* notifié par l'intercepteur */
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
    title: t('paiePage.dialogs.recalculate.title'),
    message: t('paiePage.dialogs.recalculate.message', { libelle: f.libelle }),
    cancel: true,
    ok: { label: t('paiePage.dialogs.recalculate.ok'), color: 'primary', unelevated: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(`/feuilles-paie/${f.id}/calculer`);
      $q.notify({ type: 'positive', message: t('paiePage.messages.recalculated') });
      detail.value = data;
      await charger();
    } catch {
      /* notifié par l'intercepteur */
    }
  });
}

function valider(f: FeuillePaie) {
  $q.dialog({
    title: t('paiePage.dialogs.validate.title'),
    message: t('paiePage.dialogs.validate.message', { libelle: f.libelle, montant: montantLisible(f.montantTotal) }),
    cancel: true,
    ok: { label: t('paiePage.dialogs.validate.ok'), color: 'positive', unelevated: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(`/feuilles-paie/${f.id}/valider`);
      $q.notify({ type: 'positive', message: t('paiePage.messages.validated') });
      detail.value = data;
      await charger();
    } catch {
      /* notifié par l'intercepteur */
    }
  });
}

function payer(f: FeuillePaie) {
  $q.dialog({
    title: t('paiePage.dialogs.markPaid.title'),
    message: t('paiePage.dialogs.markPaid.message', { libelle: f.libelle, montant: montantLisible(f.montantTotal) }),
    cancel: true,
    ok: { label: t('paiePage.dialogs.markPaid.ok'), color: 'primary', unelevated: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(`/feuilles-paie/${f.id}/payer`);
      $q.notify({ type: 'positive', message: t('paiePage.messages.paid') });
      detail.value = data;
      await charger();
    } catch {
      /* notifié par l'intercepteur */
    }
  });
}

function imprimer(f: FeuillePaie) {
  void ouvrirImpression(`/feuilles-paie/${f.id}/imprimer`);
}

function supprimer(f: FeuillePaie) {
  $q.dialog({
    title: t('paiePage.dialogs.delete.title'),
    message: t('paiePage.dialogs.delete.message', { libelle: f.libelle }),
    cancel: true,
    ok: { color: 'negative', label: t('paiePage.dialogs.delete.ok') },
  }).onOk(async () => {
    try {
      await api.delete(`/feuilles-paie/${f.id}`);
      $q.notify({ type: 'positive', message: t('paiePage.messages.deleted') });
      if (detail.value?.id === f.id) dialogDetail.value = false;
      await charger();
    } catch {
      /* notifié par l'intercepteur */
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
