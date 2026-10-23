<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('paiePage.title')" :subtitle="$t('paiePage.subtitle')">
      <template v-if="peutCreer" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('paiePage.actions.newSheet')"
          @click="dialogCreation = true"
        />
      </template>
    </page-header>

    <filter-bar
      v-model="filtres"
      :recherche="false"
      :chips="chipsFiltres"
      @reinitialiser="liste.reinitialiser([])"
    >
      <template #actions>
        <q-btn
          flat
          dense
          round
          color="primary"
          icon="refresh"
          :aria-label="$t('paiePage.ariaLabels.reload')"
          :loading="liste.chargement"
          @click="liste.recharger()"
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
      {{ $t('paiePage.summary.sheetsCount', { count: liste.total }) }} {{ $t('rectoratPage.subtitleFallback') }}
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
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
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
        <etat-vide
          icone="payments"
          :titre="$t('paiePage.emptyState.title')"
          :aide="`${$t('paiePage.emptyState.description')} ${aDesFiltres ? $t('paiePage.emptyState.filtered') : ''}`.trim()"
        >
          <template #action>
            <q-btn
              v-if="aDesFiltres"
              flat
              dense
              no-caps
              color="primary"
              icon="filter_alt_off"
              :label="$t('paiePage.actions.clearFilters')"
              @click="liste.reinitialiser([])"
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
          </template>
        </etat-vide>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div
        v-for="f in liste.lignes"
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
      <etat-vide
        v-if="!liste.lignes.length && !liste.chargement"
        class="col-12"
        icone="payments"
        :titre="$t('paiePage.emptyState.title')"
        :aide="`${$t('paiePage.emptyState.description')} ${aDesFiltres ? $t('paiePage.emptyState.filtered') : ''}`.trim()"
      >
        <template #action>
          <q-btn
            v-if="aDesFiltres"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            :label="$t('paiePage.actions.clearFilters')"
            @click="liste.reinitialiser([])"
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
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
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
              <etat-vide icone="receipt_long" :titre="$t('paiePage.detail.lineEmptyTitle')" :aide="$t('paiePage.detail.lineEmptyMessage')" />
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
      @enregistre="liste.recharger()"
      @calculer="avecNouvelleFeuille"
    />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { computed, reactive, ref } from 'vue';
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
const { confirmer, supprimerAvecConfirmation } = useConfirmation();

const modeVue = usePresentationListe();
const dialogCreation = ref(false);
const dialogDetail = ref(false);
const detail = ref<FeuillePaie | null>(null);

// La barre de filtres travaille sur un Record : la recherche plein texte est
// désactivée parce que l'API des feuilles n'indexe rien d'autre que le couple
// statut / année — un champ de recherche inerte serait un mensonge.
const filtres = ref<Record<string, any>>({ statut: null, annee: null });

/** Feuilles de paie : paginées côté serveur, filtres gardés dans l'URL. Un
 *  changement de filtre repart de la première page. */
const liste = reactive(
  useListePaginee<FeuillePaie>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/feuilles-paie', {
          params: { ...pageApi(p), statut: f.statut || undefined, annee: f.annee || undefined },
        })
        .then((r) => r.data),
  }),
);

const peutCreer = computed(() => auth.peut('paie.creer'));
const peutImprimer = computed(() => auth.peut('paie.imprimer'));
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

const anneesExistantes = computed(() => liste.lignes.map((f) => f.annee));

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
    ...(filtres.value.annee ? [Number(filtres.value.annee)] : []),
  ]);
  return [...annees]
    .sort((a, b) => b - a)
    .map((a) => ({ label: String(a), value: a }));
});

const totalMontant = computed(() => liste.lignes.reduce((t, f) => t + (f.montantTotal ?? 0), 0));

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

function ouvrirDetail(_event: unknown, f: FeuillePaie) {
  detail.value = f;
  dialogDetail.value = true;
}

async function avecNouvelleFeuille(f: FeuillePaie) {
  dialogDetail.value = false;
  await recalculer(f);
}

/** Action du cycle de vie après confirmation : la feuille rendue devient le détail. */
async function agir(
  f: FeuillePaie,
  action: 'calculer' | 'valider' | 'payer',
  dialogue: 'recalculate' | 'validate' | 'markPaid',
  succes: string,
) {
  const ok = await confirmer({
    titre: t(`paiePage.dialogs.${dialogue}.title`),
    message: t(`paiePage.dialogs.${dialogue}.message`, { libelle: f.libelle, montant: montantLisible(f.montantTotal) }),
    ok: t(`paiePage.dialogs.${dialogue}.ok`),
  });
  if (!ok) return;
  try {
    const { data } = await api.post(`/feuilles-paie/${f.id}/${action}`);
    $q.notify({ type: 'positive', message: t(succes) });
    detail.value = data;
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

/** Recalcul idempotent des heures contrôlées de la période. */
const recalculer = (f: FeuillePaie) => agir(f, 'calculer', 'recalculate', 'paiePage.messages.recalculated');
const valider = (f: FeuillePaie) => agir(f, 'valider', 'validate', 'paiePage.messages.validated');
const payer = (f: FeuillePaie) => agir(f, 'payer', 'markPaid', 'paiePage.messages.paid');

function imprimer(f: FeuillePaie) {
  void ouvrirImpression(`/feuilles-paie/${f.id}/imprimer`);
}

function supprimer(f: FeuillePaie) {
  void supprimerAvecConfirmation(
    `/feuilles-paie/${f.id}`,
    f.libelle,
    () => {
      if (detail.value?.id === f.id) dialogDetail.value = false;
      return liste.recharger();
    },
    {
      titre: t('paiePage.dialogs.delete.title'),
      message: t('paiePage.dialogs.delete.message', { libelle: f.libelle }),
      ok: t('paiePage.dialogs.delete.ok'),
      succes: t('paiePage.messages.deleted'),
    },
  );
}

// Droits d'action, par rôle et par statut du cycle de vie.
const peutCalculer = (f: FeuillePaie) =>
  auth.peut('paie.calculer') && f.statut === 'BROUILLON';
const peutValider = (f: FeuillePaie) =>
  auth.peut('paie.valider') && f.statut === 'BROUILLON';
const peutPayer = (f: FeuillePaie) => auth.peut('paie.payer') && f.statut === 'VALIDEE';
const peutSupprimer = (f: FeuillePaie) => auth.peut('paie.supprimer') && f.statut === 'BROUILLON';

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
