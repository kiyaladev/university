<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('formationsAdmin.title') }}</h1>
        <div class="page-sous-titre">{{ $t('formationsAdmin.subtitle') }}</div>
      </div>
      <div class="col-auto row q-gutter-xs">
        <q-btn flat no-caps icon="public" :label="$t('formationsAdmin.actions.seeShowcase')" to="/formations">
          <q-tooltip>{{ $t('formationsAdmin.actions.seeShowcaseTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn unelevated color="primary" no-caps icon="add" :label="$t('formationsAdmin.actions.newFormation')" @click="ouvrirNouvelle" />
      </div>
    </div>

    <!-- La recherche du serveur balaie titre, catégorie et lieu : un seul champ
         suffit, le filtre avancé ne porte que le statut réellement supporté. -->
    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('formationsAdmin.filters.searchPlaceholder')"
      @reinitialiser="reinitialiserFiltres"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('formationsAdmin.filters.status')"
        />
      </template>
    </filter-bar>

    <!-- Statistiques -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats.nbFormes }}</div>
            <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.trained') }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ montantLisible(stats.recette) }} <span class="text-h6">{{ $t('statistiquesMesrs.chart.axis.gnf') }}</span></div>
            <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.revenue') }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats.tauxRemplissage }} %</div>
            <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.fillRate') }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-3">
        <q-card flat bordered class="carte">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ stats.total }}</div>
            <div class="pochoir text-grey-7">{{ $t('formationsAdmin.stats.total') }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-table
      v-if="mode === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="formations"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || formations.length > 0"
    >
      <template #no-data>
        <div class="full-width text-center text-grey-7 q-pa-lg">
          <q-icon name="workspace_premium" size="38px" color="grey-5" />
          <div class="q-mt-sm">{{ $t('formationsAdmin.emptyState.title') }}</div>
          <div class="text-caption q-mt-xs">
            {{ $t('formationsAdmin.emptyState.description') }}
          </div>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="add"
            :label="$t('formationsAdmin.actions.newFormation')"
            class="q-mt-sm"
            @click="ouvrirNouvelle"
          />
        </div>
      </template>

      <template #body="p">
        <q-tr :props="p" :class="{ 'ligne-detail': p.expand }">
          <q-td key="titre" :props="p">
            <div class="text-weight-bold">{{ p.row.titre }}</div>
            <div class="text-caption text-grey-7">{{ p.row.categorie ?? '—' }}</div>
          </q-td>
          <q-td key="statut" :props="p" class="text-center">
            <q-chip :color="couleurStatut(p.row.statut)" text-color="white" dense>
              {{ LIBELLE_STATUT_FORMATION[p.row.statut] ?? p.row.statut }}
            </q-chip>
          </q-td>
          <q-td key="prix" :props="p" class="text-right chiffres">
            <span v-if="p.row.prix > 0">{{ montantLisible(p.row.prix) }} {{ p.row.devise }}</span>
            <span v-else class="text-grey-6">{{ $t('formationsAdmin.table.free') }}</span>
          </q-td>
          <q-td key="duree" :props="p" class="text-center chiffres">
            {{ p.row.dureeHeures ? `${p.row.dureeHeures} h` : '—' }}
            <div class="text-caption text-grey-7">{{ datesLisible(p.row) }}</div>
          </q-td>
          <q-td key="capacite" :props="p" class="text-center chiffres">
            {{ p.row.capacite ?? $t('formationsAdmin.table.unlimited') }}
            <span v-if="p.row.capacite" class="text-caption text-grey-7">
              · {{ $t('formationsAdmin.table.requestsCount', { count: p.row._count?.inscriptions ?? 0 }) }}
            </span>
          </q-td>
          <q-td key="inscrits" :props="p" class="text-center chiffres">
            <template v-if="ligneDashboard(p.row.id)">
              <div>{{ ligneDashboard(p.row.id)?.nbInscrits }}</div>
              <div class="text-caption text-grey-7">
                {{ $t('formationsAdmin.table.paidCount', { count: ligneDashboard(p.row.id)?.nbPayes }) }}
              </div>
            </template>
            <span v-else class="text-grey-6">{{ $t('rectoratPage.subtitleFallback') }}</span>
          </q-td>
          <q-td key="recette" :props="p" class="text-right chiffres">
            <template v-if="ligneDashboard(p.row.id)">
              {{ montantLisible(ligneDashboard(p.row.id)?.recette ?? 0) }}
              <span class="text-caption text-grey-7">{{ p.row.devise }}</span>
            </template>
            <span v-else class="text-grey-6">{{ $t('rectoratPage.subtitleFallback') }}</span>
          </q-td>
          <q-td key="actions" :props="p" class="text-right">
            <q-btn
              v-if="p.row.statut === 'BROUILLON'"
              flat dense round color="secondary" icon="publish"
              :aria-label="$t('formationsAdmin.table.aria.publish')"
              @click="publier(p.row)"
            >
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.publish') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'PUBLIEE'"
              flat dense round color="warning" icon="lock"
              :aria-label="$t('formationsAdmin.table.aria.close')"
              @click="cloturer(p.row)"
            >
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.close') }}</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="edit" :aria-label="$t('formationsAdmin.table.aria.edit')" @click="ouvrirModification(p.row)">
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.edit') }}</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="group" :aria-label="$t('formationsAdmin.table.aria.registrations')" @click="basculerRegistre(p)">
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.registrations') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'BROUILLON'"
              flat dense round color="negative" icon="delete_outline"
              :aria-label="$t('formationsAdmin.table.aria.delete')"
              @click="supprimer(p.row)"
            >
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>

        <tr v-if="p.expand" :key="`${p.row.id}-registre`" class="ligne-detail">
          <td colspan="8" class="q-pa-md">
            <div class="row items-center q-mb-sm">
              <div class="pochoir">{{ $t('formationsAdmin.registry.title', { title: p.row.titre }) }}</div>
              <q-space />
              <q-btn flat dense no-caps color="primary" :label="$t('formationsAdmin.actions.reload')" icon="refresh" @click="chargerRegistre(p.row, true)" />
            </div>
            <q-table
              flat
              bordered
              class="carte"
              :rows="registres[p.row.id] ?? []"
              :columns="colonnesRegistre"
              row-key="id"
              :loading="!!registreCharge[p.row.id]"
              hide-bottom
            >
              <template #body-cell-inscrit="r">
                <q-td :props="r">
                  <div>{{ nomInscrit(r.row) }}</div>
                  <div class="text-caption text-grey-7">
                    {{ r.row.telephone ?? '—' }}<span v-if="r.row.email"> · {{ r.row.email }}</span>
                  </div>
                </q-td>
              </template>

              <template #body-cell-statut="r">
                <q-td :props="r">
                  <q-chip :color="couleurInscription(r.row.statut)" text-color="white" dense>
                    {{ LIBELLE_STATUT_INSCRIPTION_FORMATION[r.row.statut] ?? r.row.statut }}
                  </q-chip>
                </q-td>
              </template>

              <template #body-cell-paiement="r">
                <q-td :props="r">
                  <div class="chiffres">
                    {{ montantLisible(r.row.paiement?.montant) }} {{ r.row.paiement?.devise ?? 'GNF' }}
                  </div>
                  <div class="text-caption text-grey-7">{{ r.row.paiement?.reference ?? '—' }}</div>
                </q-td>
              </template>

              <template #body-cell-paiementStatut="r">
                <q-td :props="r">
                  <q-chip :color="couleurPaiement(r.row.paiement?.statut)" text-color="white" dense>
                    {{ LIBELLE_STATUT_PAIEMENT[r.row.paiement?.statut ?? ''] ?? '—' }}
                  </q-chip>
                </q-td>
              </template>

              <template #body-cell-actionsRegistre="r">
                <q-td :props="r" class="text-right">
                  <q-btn
                    v-if="r.row.statut === 'EN_ATTENTE'"
                    flat dense round color="secondary" icon="check_circle"
                    :aria-label="$t('formationsAdmin.registry.aria.confirmPayment')"
                    @click="confirmer(r.row)"
                  >
                    <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.confirmPayment') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="r.row.statut !== 'ANNULEE'"
                    flat dense round color="negative" icon="block"
                    :aria-label="$t('formationsAdmin.registry.aria.cancelRequest')"
                    @click="annuler(r.row)"
                  >
                    <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.cancelRequest') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="r.row.statut === 'CONFIRMEE'"
                    flat dense round icon="print"
                    :aria-label="$t('formationsAdmin.registry.aria.printCertificate')"
                    @click="imprimerCertificat(r.row)"
                  >
                    <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.printCertificate') }}</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </td>
        </tr>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div v-if="chargement" class="col-12 q-pa-md text-center">
        <q-spinner color="primary" />
      </div>
      <div v-for="f in formations" :key="f.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ f.categorie ?? '—' }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ f.titre }}</div>
            </div>
            <q-chip :color="couleurStatut(f.statut)" text-color="white" dense>
              {{ LIBELLE_STATUT_FORMATION[f.statut] ?? f.statut }}
            </q-chip>
          </q-card-section>
          <q-card-section class="text-center">
            <div class="text-h3 chiffres">{{ montantLisible(f.prix) }} <span class="text-h6">{{ f.devise }}</span></div>
            <div class="text-caption text-grey-7 q-mt-sm">
              <span v-if="f.dureeHeures">{{ f.dureeHeures }} h</span>
              <span v-if="f.dateDebut"> · {{ datesLisible(f) }}</span>
            </div>
            <div class="q-mt-md">
              <q-badge
                :color="placesRestantes(f) > 0 ? 'positive' : 'negative'"
                :label="placesRestantesStr(f)"
              />
            </div>
          </q-card-section>
          <q-card-actions class="q-px-md">
            <q-btn flat dense no-caps icon="group" :label="$t('formationsAdmin.actions.registrations')" @click="basculerRegistreCarte(f)" />
            <q-space />
            <q-btn flat dense round icon="edit" :aria-label="$t('formationsAdmin.table.aria.edit')" @click="ouvrirModification(f)">
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="f.statut === 'BROUILLON'"
              flat dense round color="secondary" icon="publish"
              :aria-label="$t('formationsAdmin.table.aria.publish')"
              @click="publier(f)"
            >
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.publishShort') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="f.statut === 'PUBLIEE'"
              flat dense round color="warning" icon="lock"
              :aria-label="$t('formationsAdmin.table.aria.close')"
              @click="cloturer(f)"
            >
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.close') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="f.statut === 'BROUILLON'"
              flat dense round color="negative" icon="delete_outline"
              :aria-label="$t('formationsAdmin.table.aria.delete')"
              @click="supprimer(f)"
            >
              <q-tooltip>{{ $t('formationsAdmin.table.tooltips.deleteShort') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
          <q-slide-transition>
            <div v-if="registreOuvert[f.id]" class="q-px-md q-pb-md">
              <q-separator class="q-mb-sm" />
              <div class="row items-center q-mb-sm">
                <div class="pochoir">{{ $t('formationsAdmin.registry.title', { title: f.titre }) }}</div>
                <q-space />
                <q-btn flat dense no-caps color="primary" :label="$t('formationsAdmin.actions.reload')" icon="refresh" @click="chargerRegistre(f, true)" />
              </div>
              <q-table
                flat
                bordered
                class="carte"
                :rows="registres[f.id] ?? []"
                :columns="colonnesRegistre"
                row-key="id"
                :loading="!!registreCharge[f.id]"
                hide-bottom
                :rows-per-page-options="[0]"
              >
                <template #body-cell-inscrit="r">
                  <q-td :props="r">
                    <div>{{ nomInscrit(r.row) }}</div>
                    <div class="text-caption text-grey-7">
                      {{ r.row.telephone ?? '—' }}
                    </div>
                  </q-td>
                </template>
                <!-- Sans ce gabarit, la colonne « Montant » afficherait l'objet paiement. -->
                <template #body-cell-paiement="r">
                  <q-td :props="r">
                    <div class="chiffres">
                      {{ montantLisible(r.row.paiement?.montant) }} {{ r.row.paiement?.devise ?? 'GNF' }}
                    </div>
                    <div class="text-caption text-grey-7">{{ r.row.paiement?.reference ?? '—' }}</div>
                  </q-td>
                </template>
                <template #body-cell-statut="r">
                  <q-td :props="r">
                    <q-chip :color="couleurInscription(r.row.statut)" text-color="white" dense>
                      {{ LIBELLE_STATUT_INSCRIPTION_FORMATION[r.row.statut] ?? r.row.statut }}
                    </q-chip>
                  </q-td>
                </template>
                <template #body-cell-paiementStatut="r">
                  <q-td :props="r">
                    <q-chip :color="couleurPaiement(r.row.paiement?.statut)" text-color="white" dense>
                      {{ LIBELLE_STATUT_PAIEMENT[r.row.paiement?.statut ?? ''] ?? '—' }}
                    </q-chip>
                  </q-td>
                </template>
                <template #body-cell-actionsRegistre="r">
                  <q-td :props="r" class="text-right">
                    <q-btn
                      v-if="r.row.statut === 'EN_ATTENTE'"
                      flat dense round color="secondary" icon="check_circle"
                      :aria-label="$t('formationsAdmin.registry.aria.confirmPayment')"
                      @click="confirmer(r.row)"
                    >
                      <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.confirmPayment') }}</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="r.row.statut !== 'ANNULEE'"
                      flat dense round color="negative" icon="block"
                      :aria-label="$t('formationsAdmin.registry.aria.cancelRequest')"
                      @click="annuler(r.row)"
                    >
                      <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.cancelRequest') }}</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="r.row.statut === 'CONFIRMEE'"
                      flat dense round icon="print"
                      :aria-label="$t('formationsAdmin.registry.aria.printCertificate')"
                      @click="imprimerCertificat(r.row)"
                    >
                      <q-tooltip>{{ $t('formationsAdmin.registry.tooltips.printCertificate') }}</q-tooltip>
                    </q-btn>
                  </q-td>
                </template>
              </q-table>
            </div>
          </q-slide-transition>
        </q-card>
      </div>
      <div v-if="!chargement && !formations.length" class="col-12 text-center text-grey-7 q-pa-lg">
        <q-icon name="workspace_premium" size="42px" color="grey-5" />
        <div class="q-mt-sm">{{ $t('formationsAdmin.emptyState.title') }}</div>
        <div class="text-caption q-mt-xs">
          {{ $t('formationsAdmin.emptyState.description') }}
        </div>
        <q-btn
          flat
          no-caps
          color="primary"
          icon="add"
          :label="$t('formationsAdmin.actions.newFormation')"
          class="q-mt-sm"
          @click="ouvrirNouvelle"
        />
      </div>
    </div>

    <pagination-bar
      v-if="formations.length"
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      @update:page="(v) => { pagination.page = v; requeter(); }"
      @update:page-size="(v) => { pagination.pageSize = v; pagination.page = 1; requeter(); }"
      @tous="chargerTout"
    />

    <formation-dialog v-model="dialogFormation" :formation="formationEnCours" @enregistre="requeter" />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';

import { formationsService, type FormationDashboard } from '../services/formations';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import FormationDialog from '../components/FormationDialog.vue';
import {
  LIBELLE_STATUT_FORMATION,
  LIBELLE_STATUT_INSCRIPTION_FORMATION,
  LIBELLE_STATUT_PAIEMENT,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Formation, InscriptionFormation, Paiement, StatutFormation, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

interface InscriptionFormationDetail extends InscriptionFormation {
  formation?: Formation | null;
  etudiant?: Etudiant | null;
  paiement?: Pick<Paiement, 'id' | 'reference' | 'montant' | 'devise' | 'statut'> | null;
}

const auth = useAuthStore();
const $q = useQuasar();
const { t } = useI18n();

const formations = ref<Formation[]>([]);
const dashboard = ref<FormationDashboard | null>(null);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });

const filtres = ref<Record<string, any>>({ recherche: '' });
const mode = usePresentationListe();

const optionsStatuts = Object.entries(LIBELLE_STATUT_FORMATION).map(([value, label]) => ({
  value: value as StatutFormation,
  label,
}));

/** Chips des filtres actifs : sans elles, FilterBar masque « Réinitialiser ». */
const chips = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: t('formationsAdmin.filters.searchChip', { query: f.recherche }), value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_FORMATION[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'flag', cle: 'statut'});
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'titre', label: t('formationsAdmin.table.columns.formation'), field: 'titre', align: 'left' },
  { name: 'statut', label: t('formationsAdmin.table.columns.status'), field: 'statut', align: 'center' },
  { name: 'prix', label: t('formationsAdmin.table.columns.price'), field: 'prix', align: 'right' },
  { name: 'duree', label: t('formationsAdmin.table.columns.duration'), field: 'dureeHeures', align: 'center' },
  { name: 'capacite', label: t('formationsAdmin.table.columns.capacity'), field: 'capacite', align: 'center' },
  { name: 'inscrits', label: t('formationsAdmin.table.columns.registered'), field: 'inscrits', align: 'center' },
  { name: 'recette', label: t('formationsAdmin.table.columns.revenue'), field: 'recette', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ligneDashboard(formationId: string) {
  return dashboard.value?.parFormation.find((p) => p.id === formationId);
}

const colonnesRegistre = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('formationsAdmin.registry.columns.fileNumber'), field: 'numero', align: 'left' },
  { name: 'inscrit', label: t('formationsAdmin.registry.columns.registrant'), field: 'inscrit', align: 'left' },
  { name: 'statut', label: t('formationsAdmin.registry.columns.request'), field: 'statut', align: 'center' },
  { name: 'paiement', label: t('formationsAdmin.registry.columns.amount'), field: 'paiement', align: 'right' },
  { name: 'paiementStatut', label: t('formationsAdmin.registry.columns.payment'), field: 'paiementStatut', align: 'center' },
  { name: 'actionsRegistre', label: '', field: 'id', align: 'right' },
]);

const registres = ref<Record<string, InscriptionFormationDetail[]>>({});
const registreCharge = ref<Record<string, boolean>>({});
const registreOuvert = reactive<Record<string, boolean>>({});

function basculerRegistre(p: { row: Formation; expand: boolean }) {
  p.expand = !p.expand;
  if (p.expand) void chargerRegistre(p.row);
}

function basculerRegistreCarte(f: Formation) {
  registreOuvert[f.id] = !registreOuvert[f.id];
  if (registreOuvert[f.id]) void chargerRegistre(f);
}

async function chargerRegistre(f: Formation, force = false) {
  if (!registres.value[f.id] || force) {
    registreCharge.value[f.id] = true;
    try {
      const { data } = await formationsService.inscriptions(f.id);
      registres.value[f.id] = Array.isArray(data) ? data : [];
    } catch {
      registres.value[f.id] = [];
    } finally {
      registreCharge.value[f.id] = false;
    }
  }
}

function couleurStatut(s: StatutFormation): string {
  return s === 'PUBLIEE' ? 'secondary' : s === 'COMPLETE' ? 'warning' : 'grey-7';
}

function couleurInscription(s: string): string {
  return s === 'CONFIRMEE' ? 'secondary' : s === 'ANNULEE' ? 'negative' : 'warning';
}

function couleurPaiement(s?: string): string {
  if (!s) return 'grey-6';
  return s === 'REUSSI' ? 'secondary' : s === 'ECHOUE' || s === 'ANNULE' ? 'negative' : 'warning';
}

function nomInscrit(i: InscriptionFormationDetail): string {
  if (i.nomComplet) return i.nomComplet;
  return i.etudiant ? `${i.etudiant.prenom} ${i.etudiant.nom}` : '—';
}

function datesLisible(f: Formation): string {
  if (!f.dateDebut) return '';
  if (!f.dateFin) return dateLisible(f.dateDebut);
  return `${dateLisible(f.dateDebut)} → ${dateLisible(f.dateFin)}`;
}

function placesRestantes(f: Formation): number {
  if (!f.capacite) return Number.POSITIVE_INFINITY;
  const occupe = (f._count?.inscriptions ?? 0) - (registres.value[f.id]?.filter((r) => r.statut === 'ANNULEE').length ?? 0);
  return Math.max(0, f.capacite - occupe);
}

function placesRestantesStr(f: Formation): string {
  if (!f.capacite) return t('formationsAdmin.card.unlimitedSeats');
  return t('formationsAdmin.card.remainingSeats', { count: placesRestantes(f), capacity: f.capacite });
}

const dialogFormation = ref(false);
const formationEnCours = ref<Formation | null>(null);

function ouvrirNouvelle() {
  formationEnCours.value = null;
  dialogFormation.value = true;
}

function ouvrirModification(f: Formation) {
  formationEnCours.value = f;
  dialogFormation.value = true;
}

function reinitialiserFiltres() {
  filtres.value = { recherche: filtres.value.recherche ?? '' };
}

function publier(f: Formation) {
  $q.dialog({
    title: t('formationsAdmin.dialogs.publish.title'),
    message: t('formationsAdmin.dialogs.publish.message', { title: f.titre }),
    cancel: true,
    ok: { color: 'secondary', label: t('formationsAdmin.dialogs.publish.confirm') },
  }).onOk(async () => {
    await formationsService.publier(f.id);
    $q.notify({ type: 'positive', message: t('formationsAdmin.messages.published') });
    await Promise.all([chargerDashboard(), requeter()]);
  });
}

function cloturer(f: Formation) {
  $q.dialog({
    title: t('formationsAdmin.dialogs.close.title'),
    message: t('formationsAdmin.dialogs.close.message', { title: f.titre }),
    cancel: true,
    ok: { color: 'warning', label: t('formationsAdmin.dialogs.close.confirm') },
  }).onOk(async () => {
    await formationsService.cloturer(f.id);
    $q.notify({ type: 'warning', message: t('formationsAdmin.messages.closed') });
    await Promise.all([chargerDashboard(), requeter()]);
  });
}

function supprimer(f: Formation) {
  $q.dialog({
    title: t('formationsAdmin.dialogs.delete.title'),
    message: t('formationsAdmin.dialogs.delete.message', { title: f.titre }),
    cancel: true,
    ok: { color: 'negative', label: t('formationsAdmin.dialogs.delete.confirm') },
  }).onOk(async () => {
    await formationsService.supprimer(f.id);
    $q.notify({ type: 'warning', message: t('formationsAdmin.messages.draftDeleted') });
    await Promise.all([chargerDashboard(), requeter()]);
  });
}

function confirmer(i: InscriptionFormationDetail) {
  $q.dialog({
    title: t('formationsAdmin.dialogs.confirmPayment.title'),
    message: t('formationsAdmin.dialogs.confirmPayment.message', {
      reference: i.paiement?.reference ?? t('formationsAdmin.dialogs.confirmPayment.paymentFallback'),
      numero: i.numero,
    }),
    cancel: true,
    ok: { color: 'secondary', label: t('formationsAdmin.dialogs.confirmPayment.confirm') },
  }).onOk(async () => {
    await formationsService.confirmerInscription(i.id);
    $q.notify({ type: 'positive', message: t('formationsAdmin.messages.registrationConfirmed', { numero: i.numero }) });
    await Promise.all([chargerDashboard(), requeter()]);
  });
}

function annuler(i: InscriptionFormationDetail) {
  $q.dialog({
    title: t('formationsAdmin.dialogs.cancelRequest.title'),
    message: t('formationsAdmin.dialogs.cancelRequest.message', { numero: i.numero }),
    cancel: t('formationsAdmin.dialogs.cancelRequest.cancel'),
    ok: { color: 'negative', label: t('formationsAdmin.dialogs.cancelRequest.confirm') },
  }).onOk(async () => {
    await formationsService.annulerInscription(i.id);
    $q.notify({ type: 'warning', message: t('formationsAdmin.messages.registrationCancelled', { numero: i.numero }) });
    await Promise.all([chargerDashboard(), requeter()]);
  });
}

function imprimerCertificat(i: InscriptionFormationDetail) {
  void ouvrirImpression(`/formations/${i.id}/certificat`);
}

// Stats — alimentées par /formations/dashboard, plus de N+1.
const stats = computed(() => {
  const d = dashboard.value;
  if (!d) {
    return { nbFormes: 0, recette: 0, tauxRemplissage: 0, total: formations.value.length };
  }
  const totalPlaces = formations.value.reduce((acc, f) => acc + (f.capacite ?? 0), 0);
  const placesOccupees = formations.value.reduce((acc, f) => {
    if (!f.capacite) return acc;
    const occupe = d.parFormation.find((p) => p.id === f.id)?.nbInscrits ?? 0;
    return acc + Math.min(occupe, f.capacite);
  }, 0);
  const tauxRemplissage = totalPlaces > 0 ? Math.round((placesOccupees / totalPlaces) * 100) : 0;
  return {
    nbFormes: d.totaux.payes,
    recette: d.totaux.recette,
    tauxRemplissage,
    total: d.total,
  };
});

async function chargerDashboard() {
  try {
    const { data } = await formationsService.dashboard();
    dashboard.value = data;
  } catch {
    dashboard.value = null;
  }
}

async function requeter() {
  chargement.value = true;
  try {
    const f = filtres.value;
    // Le backend n'accepte que `search` (titre, catégorie, lieu) et `statut` :
    // tout autre paramètre serait silencieusement ignoré.
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      search: (f.recherche ?? '').toString().trim() || undefined,
      statut: f.statut || undefined,
    };
    const { data } = await formationsService.liste(params);
    formations.value = data.data;
    pagination.value.total = data.total;
    for (const formation of formations.value) {
      registres.value[formation.id] ??= [];
    }
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await requeter();
}

watch(filtres, () => {
  pagination.value.page = 1;
  void requeter();
}, { deep: true });

onMounted(async () => {
  await Promise.all([chargerDashboard(), requeter()]);
});
</script>

<style scoped lang="scss">
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}
</style>
