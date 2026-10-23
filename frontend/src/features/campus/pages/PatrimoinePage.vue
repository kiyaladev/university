<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('patrimoine.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('patrimoine.subtitle') }}
        </div>
      </div>
      <div class="col-auto" v-if="onglet === 'equipements' && auth.peutPlanifier">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('patrimoine.actions.newEquipment')"
          @click="ouvrirEquipement(null)"
        />
      </div>
      <div class="col-auto" v-if="onglet === 'categories' && auth.peutPlanifier">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('patrimoine.actions.newCategory')"
          @click="ouvrirCategorie(null)"
        />
      </div>
    </div>

    <!-- Les mêmes trois chiffres que le Tableau de bord Rectorat, à la source. -->
    <div v-if="synthese" class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ nombreLisible(synthese.total, 0) }}</div>
            <div class="pochoir text-grey-7">{{ $t('patrimoine.summary.inService') }}</div>
            <div class="text-caption text-grey-6">
              {{ $t('patrimoine.summary.acquisitionValue', { value: montantLisible(synthese.valeur) }) }}
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ nombreLisible(synthese.enReparation, 0) }}</div>
            <div class="pochoir text-grey-7">{{ $t('patrimoine.summary.inRepair') }}</div>
            <div class="text-caption text-grey-6">{{ $t('patrimoine.summary.inRepairCaption') }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ nombreLisible(synthese.obsoletes, 0) }}</div>
            <div class="pochoir text-grey-7">{{ $t('patrimoine.summary.obsolete') }}</div>
            <div class="text-caption text-grey-6">
              {{ $t('patrimoine.summary.obsoleteCaption') }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-tabs
      v-model="onglet"
      dense
      align="left"
      narrow-indicator
      class="onglets-panneau q-mb-md"
    >
      <q-tab name="equipements" icon="inventory_2" :label="$t('patrimoine.tabs.equipments')" no-caps />
      <q-tab name="categories" icon="category" :label="$t('patrimoine.tabs.categories')" no-caps />
      <q-tab name="reparations" icon="build" :label="$t('patrimoine.tabs.repairs')" no-caps />
    </q-tabs>

    <!-- ============================== Équipements -->
    <template v-if="onglet === 'equipements'">
      <filter-bar
        v-model="filtres"
        :placeholder="$t('patrimoine.equipments.searchPlaceholder')"
        :recherche="true"
        @reinitialiser="eq.reinitialiser()"
      >
        <template #avances>
          <autocomplete-async
            v-model="filtres.categorieId"
            :label="$t('common.fields.category')"
            endpoint="/patrimoine/categories"
            :label-fn="(c) => `${c.libelle} (${c.code})`"
            preload
          />
          <autocomplete-async
            v-model="filtres.departementId"
            :label="$t('common.fields.department')"
            endpoint="/departements"
            :label-fn="(d) => d.nom"
            preload
          />
          <q-select
            v-model="filtres.actif"
            :options="[
              { label: $t('patrimoine.equipments.filters.statusInService'), value: 'true' },
              { label: $t('patrimoine.equipments.filters.statusOutOfService'), value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            clearable
            :label="$t('common.fields.status')"
          />
          <q-select
            v-model="filtres.enReparation"
            :options="[
              { label: $t('patrimoine.equipments.filters.repairStateInRepair'), value: 'true' },
              { label: $t('patrimoine.equipments.filters.repairStateAvailable'), value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            clearable
            :label="$t('common.fields.state')"
          />
        </template>
      </filter-bar>

      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="eq.lignes"
        :columns="colonnesEquipements"
        row-key="id"
        :loading="eq.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="eq.chargement || eq.lignes.length > 0"
      >
        <template #body-cell-libelle="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.libelle }}</div>
            <div class="text-caption text-grey-7">{{ p.row.numeroInventaire }}</div>
          </q-td>
        </template>
        <template #body-cell-categorie="p">
          <q-td :props="p">
            <q-chip dense color="primary" text-color="white">
              {{ p.row.categorie?.libelle ?? '—' }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-valeur="p">
          <q-td :props="p" class="text-right chiffres">
            <span v-if="p.row.valeurAcquisition != null">
              {{ montantLisible(p.row.valeurAcquisition) }} <span class="text-caption">{{ $t('common.units.gnf') }}</span>
            </span>
            <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
          </q-td>
        </template>
        <template #body-cell-etat="p">
          <q-td :props="p">
            <q-chip
              dense
              :color="p.row.enReparation ? 'warning' : p.row.actif ? 'positive' : 'grey-7'"
              text-color="white"
            >
              {{
                p.row.enReparation
                  ? $t('patrimoine.equipments.state.inRepair')
                  : p.row.actif
                  ? $t('patrimoine.equipments.state.inService')
                  : $t('patrimoine.equipments.state.outOfService')
              }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              flat
              dense
              round
              icon="visibility"
              :aria-label="$t('patrimoine.equipments.table.actions.detailsAria', { name: p.row.libelle })"
              @click="voirDetails(p.row)"
            >
              <q-tooltip>{{ $t('patrimoine.equipments.table.actions.detailsTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="print"
              :aria-label="$t('patrimoine.equipments.table.actions.printAria', { name: p.row.libelle })"
              @click="imprimerEtiquette(p.row)"
            >
              <q-tooltip>{{ $t('patrimoine.equipments.table.actions.printTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier && !p.row.enReparation"
              flat
              dense
              round
              icon="build"
              :aria-label="$t('patrimoine.equipments.table.actions.declareRepairAria', { name: p.row.libelle })"
              @click="ouvrirReparation(p.row, 'declarer')"
            >
              <q-tooltip>{{ $t('patrimoine.equipments.table.actions.declareRepairTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="edit"
              :aria-label="$t('patrimoine.equipments.table.actions.editAria', { name: p.row.libelle })"
              @click="ouvrirEquipement(p.row)"
            >
              <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.estAdmin"
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="$t('patrimoine.equipments.table.actions.deleteAria', { name: p.row.libelle })"
              @click="supprimerEquipement(p.row)"
            >
              <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="inventory_2" :titre="$t('patrimoine.equipments.emptyState.title')" :aide="aideVideEquipements">
            <template #action>
              <q-btn
                v-if="aDesFiltres"
                flat
                dense
                no-caps
                color="primary"
                icon="filter_alt_off"
                :label="$t('patrimoine.equipments.emptyState.removeFilters')"
                @click="eq.reinitialiser()"
              />
              <q-btn
                v-else-if="auth.peutPlanifier"
                unelevated
                no-caps
                color="primary"
                icon="add"
                :label="$t('patrimoine.equipments.emptyState.createFirst')"
                @click="ouvrirEquipement(null)"
              />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div
          v-for="e in eq.lignes"
          :key="e.id"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
        >
          <q-card flat bordered class="carte full-height">
            <q-card-section>
              <div class="text-h6 ellipsis">{{ e.libelle }}</div>
              <div class="text-caption text-grey-7">{{ e.numeroInventaire }}</div>
            </q-card-section>
            <q-card-section class="row items-center">
              <div class="col-4 text-center">
                <canvas :ref="(el) => enregistrerCanvas(el, e)" />
              </div>
              <div class="col-8">
                <q-chip dense color="primary" text-color="white">
                  {{ e.categorie?.libelle ?? '—' }}
                </q-chip>
                <div class="text-caption text-grey-7 q-mt-xs">
                  {{ e.departement?.nom ?? $t('patrimoine.equipments.filters.noDepartment') }}
                </div>
                <div class="text-caption text-grey-7" v-if="e.valeurAcquisition != null">
                  {{ montantLisible(e.valeurAcquisition) }} {{ $t('common.units.gnf') }}
                </div>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <q-chip
                dense
                :color="e.enReparation ? 'warning' : e.actif ? 'positive' : 'grey-7'"
                text-color="white"
              >
                {{
                  e.enReparation
                    ? $t('patrimoine.equipments.state.inRepair')
                    : e.actif
                    ? $t('patrimoine.equipments.state.inService')
                    : $t('patrimoine.equipments.state.outOfService')
                }}
              </q-chip>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right">
              <q-btn flat dense round icon="visibility" :aria-label="$t('common.actions.details')" @click="voirDetails(e)">
                <q-tooltip>{{ $t('common.actions.details') }}</q-tooltip>
              </q-btn>
              <q-btn flat dense round icon="print" :aria-label="$t('patrimoine.equipments.cards.labelTooltip')" @click="imprimerEtiquette(e)">
                <q-tooltip>{{ $t('patrimoine.equipments.cards.labelTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="auth.peutPlanifier && !e.enReparation"
                flat
                dense
                round
                icon="build"
                :aria-label="$t('patrimoine.equipments.table.actions.declareRepairAria', { name: e.libelle })"
                @click="ouvrirReparation(e, 'declarer')"
              >
                <q-tooltip>{{ $t('patrimoine.equipments.table.actions.declareRepairTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="auth.peutPlanifier"
                flat
                dense
                round
                icon="edit"
                :aria-label="$t('patrimoine.equipments.table.actions.editAria', { name: e.libelle })"
                @click="ouvrirEquipement(e)"
              >
                <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide
          v-if="!eq.lignes.length && !eq.chargement"
          class="col-12"
          icone="inventory_2"
          :titre="$t('patrimoine.equipments.emptyState.title')"
          :aide="aideVideEquipements"
        >
          <template #action>
            <q-btn
              v-if="aDesFiltres"
              flat
              dense
              no-caps
              color="primary"
              icon="filter_alt_off"
              :label="$t('patrimoine.equipments.emptyState.removeFilters')"
              @click="eq.reinitialiser()"
            />
            <q-btn
              v-else-if="auth.peutPlanifier"
              unelevated
              no-caps
              color="primary"
              icon="add"
              :label="$t('patrimoine.equipments.emptyState.createFirst')"
              @click="ouvrirEquipement(null)"
            />
          </template>
        </etat-vide>
      </div>

      <pagination-bar v-model:page="eq.page" v-model:page-size="eq.pageSize" :total="eq.total" :show-all="false" />
    </template>

    <!-- ============================== Catégories -->
    <template v-if="onglet === 'categories'">
      <q-table
        flat
        bordered
        class="carte"
        :rows="cat.lignes"
        :columns="colonnesCategories"
        row-key="id"
        :loading="cat.chargement"
        :pagination="{ rowsPerPage: 20 }"
      >
        <template #body-cell-equipements="p">
          <q-td :props="p" class="text-right chiffres">
            {{ p.row._count?.equipements ?? 0 }}
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="edit"
              :aria-label="$t('patrimoine.categories.table.actions.editAria', { name: p.row.libelle })"
              @click="ouvrirCategorie(p.row)"
            >
              <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.estAdmin"
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="$t('patrimoine.categories.table.actions.deleteAria', { name: p.row.libelle })"
              @click="supprimerCategorie(p.row)"
            >
              <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="category" :titre="$t('patrimoine.categories.emptyState.title')" :aide="$t('patrimoine.categories.emptyState.description')">
            <template v-if="auth.peutPlanifier" #action>
              <q-btn unelevated no-caps color="primary" icon="add" :label="$t('patrimoine.categories.emptyState.createFirst')" @click="ouvrirCategorie(null)" />
            </template>
          </etat-vide>
        </template>
      </q-table>
    </template>

    <!-- ============================== Réparations -->
    <template v-if="onglet === 'reparations'">
      <q-card flat bordered class="carte">
        <q-card-section>
          <div class="text-subtitle2">{{ $t('patrimoine.repairs.inProgressTitle') }}</div>
          <div class="text-caption text-grey-7">
            {{ $t('patrimoine.repairs.delayCaption') }}
          </div>
        </q-card-section>
        <q-table
          flat
          bordered
          :rows="rep.lignes"
          :columns="colonnesReparations"
          row-key="id"
          :loading="rep.chargement"
          :pagination="{ rowsPerPage: 20 }"
          :hide-bottom="rep.chargement || rep.lignes.length > 0"
        >
          <template #body-cell-equipement="p">
            <q-td :props="p">
              <div class="text-weight-medium">{{ p.row.equipement?.libelle ?? '—' }}</div>
              <div class="text-caption text-grey-7">
                {{ p.row.equipement?.numeroInventaire ?? '—' }}
              </div>
            </q-td>
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <q-chip
                dense
                :color="p.row.statut === 'EN_COURS' ? 'warning' : 'grey-7'"
                :text-color="p.row.statut === 'EN_COURS' ? 'dark' : 'white'"
              >
                {{ libelleStatutReparation(p.row.statut) }}
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-declarLe="p">
            <q-td :props="p">
              {{ dateLisible(p.row.dateDeclaration) }}
            </q-td>
          </template>
          <template #body-cell-delai="p">
            <q-td :props="p">
              <q-chip
                dense
                :color="couleurDelai(joursEcarts(p.row.dateDeclaration))"
                :text-color="couleurDelai(joursEcarts(p.row.dateDeclaration)) === 'warning' ? 'dark' : 'white'"
              >
                {{ $t('patrimoine.repairs.table.delayDays', { count: joursEcarts(p.row.dateDeclaration) }) }}
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="auth.peutPlanifier"
                flat
                dense
                round
                color="positive"
                icon="check_circle"
                :aria-label="$t('patrimoine.repairs.table.resolveAria', { name: p.row.equipement?.libelle ?? $t('patrimoine.repairs.table.fallbackEquipmentName') })"
                @click="resoudreReparation(p.row)"
              >
                <q-tooltip>{{ $t('patrimoine.repairs.table.resolveTooltip') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <etat-vide icone="build" :titre="$t('patrimoine.repairs.emptyState.title')" :aide="$t('patrimoine.repairs.emptyState.description')">
              <template #action>
                <q-btn flat dense no-caps color="primary" icon="inventory_2" :label="$t('patrimoine.repairs.emptyState.goToEquipments')" @click="onglet = 'equipements'" />
              </template>
            </etat-vide>
          </template>
        </q-table>
      </q-card>
    </template>

    <patrimoine-dialog
      v-model="dialogEquipement"
      :equipement="equipementEdite"
      @enregistre="apresEquipement"
    />

    <dialogue-formulaire
      v-model="dialogCategorie"
      taille="s"
      :titre="categorieEditee ? $t('patrimoine.categories.dialog.editTitle') : $t('patrimoine.categories.dialog.newTitle')"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrementCategorie"
      @valider="enregistrerCategorie"
    >
      <q-input
        v-model="formCategorie.code"
        outlined
        dense
        :label="$t('common.fields.codeRequired')"
        :hint="$t('patrimoine.categories.dialog.codeHint')"
        :rules="[auMoinsDeux]"
        class="q-mb-md"
      />
      <q-input
        v-model="formCategorie.libelle"
        outlined
        dense
        :label="$t('common.fields.labelRequired')"
        :hint="$t('patrimoine.categories.dialog.labelHint')"
        :rules="[auMoinsDeux]"
        class="q-mb-md"
      />
      <q-input
        v-model.number="formCategorie.dureeAmortissement"
        type="number"
        min="1"
        outlined
        dense
        :label="$t('patrimoine.categories.dialog.amortizationLabel')"
        :hint="$t('patrimoine.categories.dialog.amortizationHint')"
      />
    </dialogue-formulaire>

    <reparation-dialog
      v-model="dialogReparation"
      :mode="modeReparation"
      :equipement="equipementReparation"
      :reparation-ouverte="reparationOuverte"
      @enregistre="apresReparation"
    />

    <q-dialog v-model="dialogDetails">
      <q-card style="width: 720px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ equipementDetail?.libelle }}</div>
            <div class="text-caption text-grey-7">{{ equipementDetail?.numeroInventaire }}</div>
          </div>
          <q-btn flat dense round icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
        </q-card-section>
        <q-card-section v-if="equipementDetail">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-4 text-center">
              <canvas :ref="(el) => enregistrerCanvasDetail(el)" />
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ equipementDetail.qrCode }}
              </div>
            </div>
            <div class="col-12 col-sm-8">
              <q-list dense>
                <q-item><q-item-section avatar><q-icon name="category" /></q-item-section><q-item-section>{{ equipementDetail.categorie?.libelle }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="tag" /></q-item-section><q-item-section>{{ equipementDetail.numeroSerie }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="apartment" /></q-item-section><q-item-section>{{ equipementDetail.departement?.nom ?? '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="meeting_room" /></q-item-section><q-item-section>{{ equipementDetail.salle ? `${equipementDetail.salle.code} — ${equipementDetail.salle.nom}` : '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="shopping_cart" /></q-item-section><q-item-section>{{ equipementDetail.dateAcquisition ? dateLisible(equipementDetail.dateAcquisition) : '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="payments" /></q-item-section><q-item-section>{{ equipementDetail.valeurAcquisition != null ? `${montantLisible(equipementDetail.valeurAcquisition)} GNF` : '—' }}</q-item-section></q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
        <q-card-section v-if="reparationsDetail.length">
          <div class="text-subtitle2 q-mb-sm">{{ $t('patrimoine.detailsDialog.repairsTitle') }}</div>
          <q-list separator>
            <q-item v-for="r in reparationsDetail" :key="r.id">
              <q-item-section>
                <q-item-label>{{ r.description }}</q-item-label>
                <q-item-label caption>
                  {{ dateLisible(r.dateDeclaration) }}
                  <template v-if="r.prestataire"> · {{ r.prestataire }}</template>
                  <template v-if="r.cout"> · {{ montantLisible(r.cout) }} {{ $t('common.units.gnf') }}</template>
                </q-item-label>
                <q-item-label caption v-if="r.notes">
                  <em>{{ r.notes }}</em>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip
                  dense
                  :color="r.statut === 'TERMINE' ? 'positive' : r.statut === 'ANNULE' ? 'grey-7' : 'warning'"
                  text-color="white"
                >
                  {{ libelleStatutReparation(r.statut) }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/presentationListe';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';

import { patrimoineService } from '../services/patrimoine';
import { useAuthStore } from '@/stores/auth';
import FilterBar from '@/shared/components/FilterBar.vue';
import PaginationBar from '@/shared/components/PaginationBar.vue';
import AutocompleteAsync from '@/shared/components/AutocompleteAsync.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PatrimoineDialog from '../components/PatrimoineDialog.vue';
import ReparationDialog from '../components/ReparationDialog.vue';
import { dateLisible, montantLisible, nombreLisible } from '@/shared/utils/libelles';
import { ouvrirImpression } from '@/shared/services/impression';
import type {
  CategoriePatrimoine,
  EquipementPatrimoine,
  ReparationMateriel,
  StatutReparation,
  TableauBordPatrimoine,
} from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { supprimerAvecConfirmation } = useConfirmation();
const presentation = usePresentationListe();

const onglet = ref<'equipements' | 'categories' | 'reparations'>('equipements');

// ------------------------------------------------------------------ listes
const filtres = ref<Record<string, any>>({
  recherche: '',
  categorieId: null,
  departementId: null,
  actif: null,
  enReparation: null,
});
/** Inventaire : paginé côté serveur, filtres gardés dans l'URL. */
const eq = reactive(
  useListePaginee<EquipementPatrimoine>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      patrimoineService
        .listeEquipements({
          ...pageApi(p),
          search: texteApi(f.recherche),
          categorieId: f.categorieId || undefined,
          departementId: f.departementId || undefined,
          actif: f.actif || undefined,
          enReparation: f.enReparation || undefined,
        })
        .then((r) => r.data),
  }),
);

const cat = reactive(
  useListePaginee<CategoriePatrimoine>({
    filtres: ref({}),
    pageSize: 0,
    charger: () =>
      patrimoineService.listeCategories().then(({ data }) => ({ data: Array.isArray(data) ? data : data.data ?? [] })),
  }),
);

/** Réparations ouvertes, les plus anciennes d'abord ; chargées à l'ouverture de l'onglet. */
const rep = reactive(
  useListePaginee<ReparationMateriel>({
    filtres: ref({}),
    pageSize: 0,
    immediat: false,
    charger: () =>
      patrimoineService.listeReparations({}).then(({ data }) => ({
        data: (data ?? [])
          .filter((r) => r.statut === 'EN_COURS' || r.statut === 'DECLARE')
          .sort((a, b) => new Date(a.dateDeclaration).getTime() - new Date(b.dateDeclaration).getTime()),
      })),
  }),
);

const reparationsDetail = ref<ReparationMateriel[]>([]);

const dialogEquipement = ref(false);
const equipementEdite = ref<EquipementPatrimoine | null>(null);

const dialogCategorie = ref(false);
const categorieEditee = ref<CategoriePatrimoine | null>(null);
const formCategorie = ref({ code: '', libelle: '', dureeAmortissement: 60 as number | null });
const enregistrementCategorie = ref(false);
const auMoinsDeux = (v: string) => (v ?? '').trim().length >= 2 || t('common.messages.errors.tooShort');

const dialogReparation = ref(false);
const modeReparation = ref<'declarer' | 'resoudre'>('declarer');
const equipementReparation = ref<EquipementPatrimoine | null>(null);
const reparationOuverte = ref<ReparationMateriel | null>(null);

const dialogDetails = ref(false);
const equipementDetail = ref<EquipementPatrimoine | null>(null);

const synthese = ref<TableauBordPatrimoine | null>(null);

/** Un filtre autre que la recherche vide est posé sur la liste. */
const aDesFiltres = computed(() => Object.values(filtres.value).some(Boolean));

const aideVideEquipements = computed(() =>
  `${t('patrimoine.equipments.emptyState.description')} ${aDesFiltres.value ? t('patrimoine.equipments.emptyState.noneMatchFilters') : ''}`.trim(),
);

// ---------------------------------------------------------------- colonnes
const colonnesEquipements = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('patrimoine.equipments.table.columns.equipment'), field: 'libelle', align: 'left' },
  { name: 'categorie', label: t('common.fields.category'), field: 'categorie', align: 'left' },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: EquipementPatrimoine) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'valeur', label: t('patrimoine.equipments.table.columns.value'), field: 'valeur', align: 'right' },
  { name: 'serie', label: t('patrimoine.equipments.table.columns.serial'), field: 'numeroSerie', align: 'left' },
  { name: 'etat', label: t('common.fields.state'), field: 'etat', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesCategories = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left' },
  { name: 'libelle', label: t('common.fields.label'), field: 'libelle', align: 'left' },
  {
    name: 'dureeAmortissement',
    label: t('patrimoine.categories.table.columns.amortization'),
    field: (r: CategoriePatrimoine) => r.dureeAmortissement ?? '—',
    align: 'right',
  },
  { name: 'equipements', label: t('patrimoine.categories.table.columns.equipments'), field: 'equipements', align: 'right' },
  { name: 'actif', label: t('common.fields.state'), field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesReparations = computed<QTableColumn[]>(() => [
  { name: 'equipement', label: t('patrimoine.repairs.table.columns.equipment'), field: 'equipement', align: 'left' },
  { name: 'description', label: t('common.fields.description'), field: 'description', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  { name: 'declarLe', label: t('patrimoine.repairs.table.columns.declaredOn'), field: 'dateDeclaration', align: 'left' },
  { name: 'delai', label: t('patrimoine.repairs.table.columns.delay'), field: 'delai', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

// --- Helpers

function enregistrerCanvas(el: any, e: EquipementPatrimoine) {
  if (!el) return;
  QRCode.toCanvas(el, e.qrCode, { width: 96, margin: 1 }).catch(() => {});
}

function enregistrerCanvasDetail(el: any) {
  if (!el || !equipementDetail.value) return;
  QRCode.toCanvas(el, equipementDetail.value.qrCode, { width: 180, margin: 1 }).catch(() => {});
}

function joursEcarts(date: string): number {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function couleurDelai(j: number): string {
  if (j < 7) return 'positive';
  if (j < 30) return 'warning';
  return 'negative';
}

function libelleStatutReparation(s: StatutReparation): string {
  const cles: Record<string, string> = { DECLARE: 'declared', EN_COURS: 'inProgress', TERMINE: 'done' };
  return t(`patrimoine.repairs.status.${cles[s] ?? 'cancelled'}`);
}

/** Les trois chiffres d'en-tête, ceux-là mêmes que reprend le Rectorat. */
async function chargerSynthese() {
  try {
    const { data } = await patrimoineService.tableauDeBord();
    synthese.value = data;
  } catch {
    synthese.value = null;
  }
}

function apresEquipement() {
  void eq.recharger();
  void chargerSynthese();
}

function apresReparation() {
  void rep.recharger();
  apresEquipement();
}

// --- Actions

function ouvrirEquipement(e: EquipementPatrimoine | null) {
  equipementEdite.value = e;
  dialogEquipement.value = true;
}

function ouvrirCategorie(c: CategoriePatrimoine | null) {
  categorieEditee.value = c;
  formCategorie.value = c
    ? { code: c.code, libelle: c.libelle, dureeAmortissement: c.dureeAmortissement ?? null }
    : { code: '', libelle: '', dureeAmortissement: 60 };
  dialogCategorie.value = true;
}

async function enregistrerCategorie() {
  enregistrementCategorie.value = true;
  try {
    const payload = {
      code: formCategorie.value.code.trim(),
      libelle: formCategorie.value.libelle.trim(),
      dureeAmortissement: formCategorie.value.dureeAmortissement ?? undefined,
    };
    if (categorieEditee.value) {
      await patrimoineService.modifierCategorie(categorieEditee.value.id, payload);
      $q.notify({ type: 'positive', message: t('patrimoine.messages.categoryUpdated') });
    } else {
      await patrimoineService.creerCategorie(payload);
      $q.notify({ type: 'positive', message: t('patrimoine.messages.categorySaved') });
    }
    dialogCategorie.value = false;
    await cat.recharger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrementCategorie.value = false;
  }
}

function supprimerCategorie(c: CategoriePatrimoine) {
  void supprimerAvecConfirmation(`/patrimoine/categories/${c.id}`, c.libelle, cat.recharger, {
    titre: t('patrimoine.categories.confirmDelete.title'),
    message: t('patrimoine.categories.confirmDelete.message', { name: c.libelle }),
    ok: t('common.actions.delete'),
    succes: t('patrimoine.messages.categoryDeleted'),
  });
}

function supprimerEquipement(e: EquipementPatrimoine) {
  void supprimerAvecConfirmation(`/patrimoine/equipements/${e.id}`, e.numeroInventaire, apresEquipement, {
    titre: t('patrimoine.deleteEquipment.title'),
    message: t('patrimoine.deleteEquipment.message', { code: e.numeroInventaire }),
    ok: t('common.actions.delete'),
    succes: t('patrimoine.messages.equipmentDeleted'),
  });
}

function ouvrirReparation(
  e: EquipementPatrimoine,
  mode: 'declarer' | 'resoudre',
  reparation?: ReparationMateriel | null,
) {
  equipementReparation.value = e;
  modeReparation.value = mode;
  reparationOuverte.value = reparation ?? null;
  dialogReparation.value = true;
}

/**
 * La réparation porte son équipement : le chercher dans la page d'inventaire
 * courante échouait dès que la pièce n'était pas sur la page affichée — cas le
 * plus fréquent, l'onglet Réparations ne suivant pas la pagination.
 */
function resoudreReparation(r: ReparationMateriel) {
  const equipement =
    (r.equipement as EquipementPatrimoine | undefined) ??
    eq.lignes.find((e) => e.id === r.equipementId);
  if (!equipement) {
    $q.notify({ type: 'warning', message: t('patrimoine.messages.equipmentNotFound') });
    return;
  }
  ouvrirReparation(equipement, 'resoudre', r);
}

function imprimerEtiquette(e: EquipementPatrimoine) {
  void ouvrirImpression(`/patrimoine/equipements/${e.id}/imprimer`);
}

async function voirDetails(e: EquipementPatrimoine) {
  equipementDetail.value = e;
  dialogDetails.value = true;
  reparationsDetail.value = [];
  try {
    const { data } = await patrimoineService.reparationsEquipement(e.id);
    reparationsDetail.value = data;
  } catch {
    /* l'intercepteur axios affiche le motif ; la fiche reste lisible */
  }
}

// --- Wiring

watch(onglet, (v) => {
  if (v === 'reparations') void rep.recharger();
  if (v === 'categories' && !cat.lignes.length) void cat.recharger();
});

onMounted(() => {
  void chargerSynthese();
});
</script>

<style scoped lang="scss">
/* Même définition que les autres tableaux de bord de l'application. */
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}

</style>
