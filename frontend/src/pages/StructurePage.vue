<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('structure.title')" :subtitle="$t('structure.subtitle')" />

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="annees" icon="event" :label="$t('structure.tabs.annees')" no-caps />
      <q-tab name="departements" icon="apartment" :label="$t('structure.tabs.departements')" no-caps />
      <q-tab name="filieres" icon="account_tree" :label="$t('structure.tabs.filieres')" no-caps />
      <q-tab name="promotions" icon="groups" :label="$t('structure.tabs.promotions')" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------- Années -->
      <q-tab-panel name="annees" class="q-pa-none">
        <filter-bar v-model="filtres.annees" :placeholder="$t('structure.search.annees')">
          <template #actions>
            <q-btn
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('structure.actions.newAnnee')"
              @click="ouvrirAnnee(null)"
            />
          </template>
        </filter-bar>

        <q-table
          flat
          bordered
          class="carte"
          :rows="annees"
          :columns="colonnesAnnees"
          row-key="id"
          :loading="chargement"
          :filter="filtres.annees.recherche"
          :pagination="{ rowsPerPage: 10 }"
        >
          <template #no-data>
            <etat-vide icone="event" :titre="messageVide('annees', t('structure.emptyState.annees'))">
              <template v-if="peutGerer" #action>
                <q-btn
                  unelevated
                  color="primary"
                  no-caps
                  icon="add"
                  :label="$t('structure.actions.createAnnee')"
                  @click="ouvrirAnnee(null)"
                />
              </template>
            </etat-vide>
          </template>
          <template #body-cell-active="p">
            <q-td :props="p">
              <q-chip v-if="p.row.active" dense color="positive" text-color="white">{{
                $t('structure.table.active')
              }}</q-chip>
              <span v-else class="text-grey-6">{{ $t('rectoratPage.subtitleFallback') }}</span>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="groups"
                :aria-label="$t('structure.ariaLabels.seePromotionsOfAnnee')"
                @click="voirPromotionsDeLAnnee(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.seesPromotions') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutGerer"
                flat
                dense
                round
                icon="edit"
                :aria-label="$t('structure.ariaLabels.editAnnee')"
                @click="ouvrirAnnee(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.edit') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutSupprimer"
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="$t('structure.ariaLabels.deleteAnnee')"
                @click="supprimer('annees', p.row.libelle, p.row.id)"
              >
                <q-tooltip>{{ $t('structure.tooltips.delete') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- -------------------------------------------------- Départements -->
      <q-tab-panel name="departements" class="q-pa-none">
        <filter-bar v-model="filtres.departements" :placeholder="$t('structure.search.departements')">
          <template #actions>
            <q-btn
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('structure.actions.newDepartement')"
              @click="ouvrirDepartement(null)"
            />
          </template>
        </filter-bar>

        <q-table
          flat
          bordered
          class="carte"
          :rows="departements"
          :columns="colonnesDepartements"
          row-key="id"
          :loading="chargement"
          :filter="filtres.departements.recherche"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #no-data>
            <etat-vide icone="apartment" :titre="messageVide('departements', t('structure.emptyState.departements'))">
              <template v-if="peutGerer" #action>
                <q-btn
                  unelevated
                  color="primary"
                  no-caps
                  icon="add"
                  :label="$t('structure.actions.createDepartement')"
                  @click="ouvrirDepartement(null)"
                />
              </template>
            </etat-vide>
          </template>
          <template #body-cell-filieres="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                no-caps
                :label="String(p.row._count?.filieres ?? 0)"
                :disable="!(p.row._count?.filieres ?? 0)"
                :aria-label="$t('structure.ariaLabels.seeFilieresOfDepartement')"
                @click="voirFilieresDuDepartement(p.row)"
              >
                <q-tooltip v-if="p.row._count?.filieres">{{
                  $t('structure.tooltips.seeFilieres')
                }}</q-tooltip>
              </q-btn>
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
                :aria-label="$t('structure.ariaLabels.editDepartement')"
                @click="ouvrirDepartement(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.edit') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutSupprimer"
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="$t('structure.ariaLabels.deleteDepartement')"
                @click="supprimer('departements', p.row.nom, p.row.id)"
              >
                <q-tooltip>{{ $t('structure.tooltips.delete') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ------------------------------------------------------ Filières -->
      <q-tab-panel name="filieres" class="q-pa-none">
        <filter-bar
          v-model="filtres.filieres"
          :chips="chipsFilieres"
          :placeholder="$t('structure.search.filieres')"
          @reinitialiser="filtres.filieres = {}"
        >
          <template #avances>
            <q-select
              v-model="filtres.filieres.departementId"
              :options="optionsDepartements"
              outlined
              dense
              clearable
              emit-value
              map-options
              :label="$t('structure.filters.departement')"
            />
          </template>
          <template #actions>
            <q-btn
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('structure.actions.newFiliere')"
              @click="ouvrirFiliere(null)"
            />
          </template>
        </filter-bar>

        <q-table
          flat
          bordered
          class="carte"
          :rows="filieresFiltrees"
          :columns="colonnesFilieres"
          row-key="id"
          :loading="chargement"
          :filter="filtres.filieres.recherche"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #no-data>
            <etat-vide icone="account_tree" :titre="messageVide('filieres', t('structure.emptyState.filieres'))">
              <template v-if="peutGerer" #action>
                <q-btn
                  unelevated
                  color="primary"
                  no-caps
                  icon="add"
                  :label="$t('structure.actions.createFiliere')"
                  @click="ouvrirFiliere(null)"
                />
              </template>
            </etat-vide>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="groups"
                :aria-label="$t('structure.ariaLabels.seePromotionsOfFiliere')"
                @click="voirPromotionsDeLaFiliere(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.seesPromotions') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutGerer"
                flat
                dense
                round
                icon="edit"
                :aria-label="$t('structure.ariaLabels.editFiliere')"
                @click="ouvrirFiliere(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.edit') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutSupprimer"
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="$t('structure.ariaLabels.deleteFiliere')"
                @click="supprimer('filieres', p.row.nom, p.row.id)"
              >
                <q-tooltip>{{ $t('structure.tooltips.delete') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ---------------------------------------------------- Promotions -->
      <q-tab-panel name="promotions" class="q-pa-none">
        <filter-bar
          v-model="filtres.promotions"
          :chips="chipsPromotions"
          :placeholder="$t('structure.search.promotions')"
          @reinitialiser="filtres.promotions = {}"
        >
          <template #avances>
            <q-select
              v-model="filtres.promotions.filiereId"
              :options="optionsFilieres"
              outlined
              dense
              clearable
              emit-value
              map-options
              :label="$t('structure.filters.filiere')"
            />
            <q-select
              v-model="filtres.promotions.anneeId"
              :options="optionsAnnees"
              outlined
              dense
              clearable
              emit-value
              map-options
              :label="$t('structure.filters.annee')"
            />
            <q-select
              v-model="filtres.promotions.niveau"
              :options="NIVEAUX"
              outlined
              dense
              clearable
              :label="$t('structure.filters.niveau')"
            />
          </template>
          <template #actions>
            <q-btn
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('structure.actions.newPromotion')"
              @click="ouvrirPromotion(null)"
            />
          </template>
        </filter-bar>

        <q-table
          flat
          bordered
          class="carte"
          :rows="promotionsFiltrees"
          :columns="colonnesPromotions"
          row-key="id"
          :loading="chargement"
          :filter="filtres.promotions.recherche"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #no-data>
            <etat-vide icone="groups" :titre="messageVide('promotions', t('structure.emptyState.promotions'))">
              <template v-if="peutGerer" #action>
                <q-btn
                  unelevated
                  color="primary"
                  no-caps
                  icon="add"
                  :label="$t('structure.actions.createPromotion')"
                  @click="ouvrirPromotion(null)"
                />
              </template>
            </etat-vide>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="assignment_ind"
                :aria-label="$t('structure.ariaLabels.seeChargesOfPromotion')"
                @click="voirChargesDeLaPromotion(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.seesCharges') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutGerer"
                flat
                dense
                round
                icon="edit"
                :aria-label="$t('structure.ariaLabels.editPromotion')"
                @click="ouvrirPromotion(p.row)"
              >
                <q-tooltip>{{ $t('structure.tooltips.edit') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="peutSupprimer"
                flat
                dense
                round
                color="negative"
                icon="delete"
                :aria-label="$t('structure.ariaLabels.deletePromotion')"
                @click="supprimer('promotions', p.row.nom, p.row.id)"
              >
                <q-tooltip>{{ $t('structure.tooltips.delete') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Formulaire année -->
    <dialogue-formulaire
      v-model="dialogAnnee"
      :titre="anneeEditee ? $t('structure.dialogs.annee.editTitle') : $t('structure.dialogs.annee.newTitle')"
      taille="s"
      :libelle-valider="$t('structure.dialogs.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerAnnee"
    >
      <q-input
        v-model="formAnnee.libelle"
        outlined
        dense
        :label="$t('structure.dialogs.annee.libelle')"
        :hint="$t('structure.dialogs.annee.libelleHint')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.annee.libelleError')]"
      />
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <champ-date v-model="formAnnee.dateDebut" :label="$t('structure.dialogs.annee.debut')" />
        </div>
        <div class="col-6">
          <champ-date v-model="formAnnee.dateFin" :label="$t('structure.dialogs.annee.fin')" />
        </div>
      </div>
      <q-toggle v-model="formAnnee.active" :label="$t('structure.dialogs.annee.active')" />
      <div class="text-caption text-grey-7">
        {{ $t('structure.dialogs.annee.activeHint') }}
      </div>
    </dialogue-formulaire>

    <!-- Formulaire département -->
    <dialogue-formulaire
      v-model="dialogDepartement"
      :titre="departementEdite ? $t('structure.dialogs.departement.editTitle') : $t('structure.dialogs.departement.newTitle')"
      taille="s"
      :libelle-valider="$t('structure.dialogs.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerDepartement"
    >
      <q-input
        v-model="formDepartement.code"
        outlined
        dense
        :label="$t('structure.dialogs.departement.code')"
        :hint="$t('structure.dialogs.departement.codeHint')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.departement.codeError')]"
      />
      <q-input
        v-model="formDepartement.nom"
        outlined
        dense
        :label="$t('structure.dialogs.departement.nom')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.departement.nomError')]"
      />
      <q-input
        v-model="formDepartement.faculte"
        outlined
        dense
        :label="$t('structure.dialogs.departement.faculte')"
      />
    </dialogue-formulaire>

    <!-- Formulaire filière -->
    <dialogue-formulaire
      v-model="dialogFiliere"
      :titre="filiereEditee ? $t('structure.dialogs.filiere.editTitle') : $t('structure.dialogs.filiere.newTitle')"
      taille="s"
      :libelle-valider="$t('structure.dialogs.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerFiliere"
    >
      <q-input
        v-model="formFiliere.code"
        outlined
        dense
        :label="$t('structure.dialogs.filiere.code')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.filiere.codeError')]"
      />
      <q-input
        v-model="formFiliere.nom"
        outlined
        dense
        :label="$t('structure.dialogs.filiere.nom')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.filiere.nomError')]"
      />
      <q-select
        v-model="formFiliere.departementId"
        :options="optionsDepartements"
        outlined
        dense
        emit-value
        map-options
        :label="$t('structure.dialogs.filiere.departement')"
        :rules="[(v: string) => !!v || $t('structure.dialogs.filiere.departementError')]"
      />
    </dialogue-formulaire>

    <!-- Formulaire promotion -->
    <dialogue-formulaire
      v-model="dialogPromotion"
      :titre="promotionEditee ? $t('structure.dialogs.promotion.editTitle') : $t('structure.dialogs.promotion.newTitle')"
      taille="s"
      :libelle-valider="$t('structure.dialogs.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerPromotion"
    >
      <q-input
        v-model="formPromotion.nom"
        outlined
        dense
        :label="$t('structure.dialogs.promotion.nom')"
        :hint="$t('structure.dialogs.promotion.nomHint')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.promotion.nomError')]"
      />
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-select
            v-model="formPromotion.niveau"
            :options="NIVEAUX"
            outlined
            dense
            :label="$t('structure.dialogs.promotion.niveau')"
          />
        </div>
        <div class="col-6">
          <q-input
            v-model.number="formPromotion.effectif"
            type="number"
            min="0"
            outlined
            dense
            :label="$t('structure.dialogs.promotion.effectif')"
          />
        </div>
      </div>
      <q-select
        v-model="formPromotion.filiereId"
        :options="optionsFilieres"
        outlined
        dense
        emit-value
        map-options
        :label="$t('structure.dialogs.promotion.filiere')"
        :rules="[(v: string) => !!v || $t('structure.dialogs.promotion.filiereError')]"
      />
      <q-select
        v-model="formPromotion.anneeId"
        :options="optionsAnnees"
        outlined
        dense
        emit-value
        map-options
        :label="$t('structure.dialogs.promotion.annee')"
        :rules="[(v: string) => !!v || $t('structure.dialogs.promotion.anneeError')]"
      />
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import ChampDate from '../components/ChampDate.vue';
import FilterBar from '../components/FilterBar.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import { useConfirmation } from '../composables/useConfirmation';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import { NIVEAUX, dateLisible } from '../utils/libelles';
import type { AnneeAcademique, Departement, Filiere, Promotion, ChipFiltre } from '../types';

/** Le backend joint l'année académique aux promotions. */
interface PromotionListee extends Promotion {
  annee?: AnneeAcademique | null;
}

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();
const { supprimerAvecConfirmation } = useConfirmation();

const onglet = ref('annees');
const chargement = ref(false);
const enregistrement = ref(false);
const annees = ref<AnneeAcademique[]>([]);
const departements = ref<Departement[]>([]);
const filieres = ref<Filiere[]>([]);
const promotions = ref<PromotionListee[]>([]);

/** Créer/modifier : ADMIN et SCOLARITE. Supprimer : ADMIN seul (cf. backend). */
const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutSupprimer = computed(() => auth.estAdmin);

const filtres = ref<Record<string, Record<string, any>>>({
  annees: {},
  departements: {},
  filieres: {},
  promotions: {},
});

const dialogAnnee = ref(false);
const dialogDepartement = ref(false);
const dialogFiliere = ref(false);
const dialogPromotion = ref(false);

const anneeEditee = ref<AnneeAcademique | null>(null);
const departementEdite = ref<Departement | null>(null);
const filiereEditee = ref<Filiere | null>(null);
const promotionEditee = ref<PromotionListee | null>(null);

const formAnnee = ref({ libelle: '', dateDebut: '', dateFin: '', active: false });
const formDepartement = ref({ code: '', nom: '', faculte: '' });
const formFiliere = ref({ code: '', nom: '', departementId: '' });
const formPromotion = ref({ nom: '', niveau: 'L1', effectif: 0, filiereId: '', anneeId: '' });

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);
const optionsFilieres = computed(() =>
  filieres.value.map((f) => ({ label: `${f.nom} (${f.departement?.code ?? ''})`, value: f.id })),
);
const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

const filieresFiltrees = computed(() => {
  const d = filtres.value.filieres.departementId;
  return d ? filieres.value.filter((f) => f.departementId === d) : filieres.value;
});
const promotionsFiltrees = computed(() =>
  promotions.value.filter((p) => {
    const f = filtres.value.promotions;
    if (f.filiereId && p.filiereId !== f.filiereId) return false;
    if (f.anneeId && p.anneeId !== f.anneeId) return false;
    if (f.niveau && p.niveau !== f.niveau) return false;
    return true;
  }),
);

const chipsFilieres = computed(() => {
  const cs: ChipFiltre[] = [];
  const f = filtres.value.filieres;
  if (f.recherche) {
    cs.push({
      label: t('structure.chips.search', { value: f.recherche }),
      value: f.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (f.departementId) {
    const d = departements.value.find((x) => x.id === f.departementId);
    cs.push({
      label: t('structure.chips.departement', { value: d?.nom ?? '?' }),
      value: f.departementId,
      icone: 'apartment',
    });
  }
  return cs;
});

const chipsPromotions = computed(() => {
  const cs: ChipFiltre[] = [];
  const f = filtres.value.promotions;
  if (f.recherche) {
    cs.push({
      label: t('structure.chips.search', { value: f.recherche }),
      value: f.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (f.filiereId) {
    const x = filieres.value.find((y) => y.id === f.filiereId);
    cs.push({
      label: t('structure.chips.filiere', { value: x?.nom ?? '?' }),
      value: f.filiereId,
      icone: 'account_tree',
    });
  }
  if (f.anneeId) {
    const x = annees.value.find((y) => y.id === f.anneeId);
    cs.push({
      label: t('structure.chips.annee', { value: x?.libelle ?? '?' }),
      value: f.anneeId,
      icone: 'event',
    });
  }
  if (f.niveau) {
    cs.push({ label: t('structure.chips.niveau', { value: f.niveau }), value: f.niveau, icone: 'school' });
  }
  return cs;
});

function messageVide(cle: string, parDefaut: string) {
  const f = filtres.value[cle] ?? {};
  const actif = Object.values(f).some((v) => v !== undefined && v !== null && v !== '');
  return actif ? t('structure.emptyState.noResults') : parDefaut;
}

const colonnesAnnees = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('structure.table.columns.annee'), field: 'libelle', align: 'left', sortable: true },
  {
    name: 'debut',
    label: t('structure.table.columns.debut'),
    field: (r: AnneeAcademique) => dateLisible(r.dateDebut),
    align: 'left',
  },
  {
    name: 'fin',
    label: t('structure.table.columns.fin'),
    field: (r: AnneeAcademique) => dateLisible(r.dateFin),
    align: 'left',
  },
  { name: 'active', label: t('structure.table.columns.statut'), field: 'active', align: 'left' },
  { name: 'actions', label: t('structure.table.columns.actions'), field: 'id', align: 'right' },
]);

const colonnesDepartements = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('structure.table.columns.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('structure.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'faculte',
    label: t('structure.table.columns.faculte'),
    field: (r: Departement) => r.faculte || '—',
    align: 'left',
  },
  {
    name: 'enseignants',
    label: t('structure.table.columns.enseignants'),
    field: (r: Departement) => r._count?.enseignants ?? 0,
    align: 'right',
    sortable: true,
  },
  {
    name: 'filieres',
    label: t('structure.table.columns.filieres'),
    field: (r: Departement) => r._count?.filieres ?? 0,
    align: 'right',
    sortable: true,
  },
  { name: 'actions', label: t('structure.table.columns.actions'), field: 'id', align: 'right' },
]);

const colonnesFilieres = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('structure.table.columns.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('structure.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('structure.table.columns.departement'),
    field: (r: Filiere) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'actions', label: t('structure.table.columns.actions'), field: 'id', align: 'right' },
]);

const colonnesPromotions = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('structure.table.columns.promotion'), field: 'nom', align: 'left', sortable: true },
  { name: 'niveau', label: t('structure.table.columns.niveau'), field: 'niveau', align: 'left', sortable: true },
  {
    name: 'filiere',
    label: t('structure.table.columns.filiere'),
    field: (r: PromotionListee) => r.filiere?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'annee',
    label: t('structure.table.columns.annee'),
    field: (r: PromotionListee) => r.annee?.libelle ?? '—',
    align: 'left',
  },
  { name: 'effectif', label: t('structure.table.columns.effectif'), field: 'effectif', align: 'right', sortable: true },
  { name: 'actions', label: t('structure.table.columns.actions'), field: 'id', align: 'right' },
]);

// ------------------------------------------------------------ liaisons

/** Le département se lit par ses filières : on bascule d'onglet en filtrant. */
function voirFilieresDuDepartement(d: Departement) {
  filtres.value.filieres = { departementId: d.id };
  onglet.value = 'filieres';
}

function voirPromotionsDeLaFiliere(f: Filiere) {
  filtres.value.promotions = { filiereId: f.id };
  onglet.value = 'promotions';
}

function voirPromotionsDeLAnnee(a: AnneeAcademique) {
  filtres.value.promotions = { anneeId: a.id };
  onglet.value = 'promotions';
}

/** Une promotion prend son sens dans les charges qui la desservent. */
function voirChargesDeLaPromotion(p: PromotionListee) {
  void router.push({ path: '/affectations', query: { promotionId: p.id, anneeId: p.anneeId } });
}

// ------------------------------------------------------------ formulaires

function ouvrirAnnee(a: AnneeAcademique | null) {
  anneeEditee.value = a;
  formAnnee.value = {
    libelle: a?.libelle ?? '',
    dateDebut: a?.dateDebut?.slice(0, 10) ?? '',
    dateFin: a?.dateFin?.slice(0, 10) ?? '',
    active: a?.active ?? false,
  };
  dialogAnnee.value = true;
}

function ouvrirDepartement(d: Departement | null) {
  departementEdite.value = d;
  formDepartement.value = { code: d?.code ?? '', nom: d?.nom ?? '', faculte: d?.faculte ?? '' };
  dialogDepartement.value = true;
}

function ouvrirFiliere(f: Filiere | null) {
  filiereEditee.value = f;
  formFiliere.value = {
    code: f?.code ?? '',
    nom: f?.nom ?? '',
    departementId: f?.departementId ?? filtres.value.filieres.departementId ?? '',
  };
  dialogFiliere.value = true;
}

function ouvrirPromotion(p: PromotionListee | null) {
  promotionEditee.value = p;
  formPromotion.value = {
    nom: p?.nom ?? '',
    niveau: p?.niveau ?? 'L1',
    effectif: p?.effectif ?? 0,
    filiereId: p?.filiereId ?? filtres.value.promotions.filiereId ?? '',
    anneeId:
      p?.anneeId ?? filtres.value.promotions.anneeId ?? referentiels.anneeCourante?.id ?? '',
  };
  dialogPromotion.value = true;
}

/** Enregistrement commun : validation faite, appel, notification, rechargement. */
async function envoyer(url: string, edition: boolean, payload: unknown, messageOk: string) {
  enregistrement.value = true;
  try {
    await (edition ? api.put(url, payload) : api.post(url, payload));
    $q.notify({ type: 'positive', message: messageOk });
    await referentiels.rafraichir();
    await charger();
    return true;
  } catch {
    return false;
  } finally {
    enregistrement.value = false;
  }
}

async function enregistrerAnnee() {
  const url = anneeEditee.value ? `/annees/${anneeEditee.value.id}` : '/annees';
  if (await envoyer(url, !!anneeEditee.value, formAnnee.value, t('structure.messages.anneeSaved'))) {
    dialogAnnee.value = false;
  }
}

async function enregistrerDepartement() {
  const payload = { ...formDepartement.value, faculte: formDepartement.value.faculte || undefined };
  const url = departementEdite.value
    ? `/departements/${departementEdite.value.id}`
    : '/departements';
  if (await envoyer(url, !!departementEdite.value, payload, t('structure.messages.departementSaved'))) {
    dialogDepartement.value = false;
  }
}

async function enregistrerFiliere() {
  const url = filiereEditee.value ? `/filieres/${filiereEditee.value.id}` : '/filieres';
  if (await envoyer(url, !!filiereEditee.value, formFiliere.value, t('structure.messages.filiereSaved'))) {
    dialogFiliere.value = false;
  }
}

async function enregistrerPromotion() {
  const url = promotionEditee.value ? `/promotions/${promotionEditee.value.id}` : '/promotions';
  if (await envoyer(url, !!promotionEditee.value, formPromotion.value, t('structure.messages.promotionSaved'))) {
    dialogPromotion.value = false;
  }
}

function supprimer(ressource: string, libelle: string, id: string) {
  // Années, départements et promotions sont partagés avec les autres
  // écrans ; une filière renommée change aussi les promotions affichées.
  void supprimerAvecConfirmation(
    `/${ressource}/${id}`,
    libelle,
    async () => {
      await referentiels.rafraichir();
      await charger();
    },
    {
      titre: t('structure.deleteDialog.title'),
      message: t('structure.deleteDialog.message', { label: libelle }),
      ok: t('structure.deleteDialog.confirm'),
      succes: t('structure.messages.deleted', { label: libelle }),
    },
  );
}

async function charger() {
  chargement.value = true;
  try {
    const [a, d, f, p] = await Promise.all([
      referentiels.annees(),
      referentiels.departements(),
      api.get('/filieres', { params: { all: '1' } }),
      referentiels.promotions(),
    ]);
    annees.value = a;
    departements.value = d;
    filieres.value = f.data.data;
    promotions.value = p as PromotionListee[];
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

onMounted(charger);
</script>

<style scoped lang="scss">
</style>
