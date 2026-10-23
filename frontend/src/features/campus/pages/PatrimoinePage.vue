<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="t('patrimoine.title')" :subtitle="t('patrimoine.subtitle')">
      <template v-if="onglet === 'equipements' && auth.peutPlanifier" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('patrimoine.actions.newEquipment')"
          @click="ouvrirEquipement(null)"
        />
      </template>
      <template v-else-if="onglet === 'categories' && auth.peutPlanifier" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('patrimoine.actions.newCategory')"
          @click="ouvrirCategorie(null)"
        />
      </template>
    </en-tete-page>

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

    <q-tabs v-model="onglet" dense align="left" narrow-indicator class="onglets-panneau q-mb-md">
      <q-tab name="equipements" icon="inventory_2" :label="$t('patrimoine.tabs.equipments')" no-caps />
      <q-tab name="categories" icon="category" :label="$t('patrimoine.tabs.categories')" no-caps />
      <q-tab name="reparations" icon="build" :label="$t('patrimoine.tabs.repairs')" no-caps />
    </q-tabs>

    <!-- ============================== Équipements -->
    <template v-if="onglet === 'equipements'">
      <patrimoine-equipements-panneau
        v-model:filtres="filtres"
        v-model:page="eq.page"
        v-model:page-size="eq.pageSize"
        :lignes="eq.lignes"
        :chargement="eq.chargement"
        :total="eq.total"
        :peut-planifier="auth.peutPlanifier"
        :est-admin="auth.estAdmin"
        @creer="ouvrirEquipement(null)"
        @modifier="ouvrirEquipement"
        @supprimer="supprimerEquipement"
        @voir-details="voirDetails"
        @imprimer="imprimerEtiquette"
        @declarer-reparation="(e) => ouvrirReparation(e, 'declarer')"
        @reinitialiser="eq.reinitialiser()"
      />
    </template>

    <!-- ============================== Catégories -->
    <template v-if="onglet === 'categories'">
      <patrimoine-categories-panneau
        :lignes="cat.lignes"
        :chargement="cat.chargement"
        :peut-planifier="auth.peutPlanifier"
        :est-admin="auth.estAdmin"
        @creer="ouvrirCategorie(null)"
        @modifier="ouvrirCategorie"
        @supprimer="supprimerCategorie"
      />
    </template>

    <!-- ============================== Réparations -->
    <template v-if="onglet === 'reparations'">
      <patrimoine-reparations-panneau
        :lignes="rep.lignes"
        :chargement="rep.chargement"
        :peut-planifier="auth.peutPlanifier"
        @resoudre="resoudreReparation"
        @voir-equipements="onglet = 'equipements'"
      />
    </template>

    <dialogue-patrimoine v-model="dialogEquipement" :equipement="equipementEdite" @enregistre="apresEquipement" />

    <dialogue-formulaire
      v-model="dialogCategorie"
      taille="s"
      :titre="
        categorieEditee ? $t('patrimoine.categories.dialog.editTitle') : $t('patrimoine.categories.dialog.newTitle')
      "
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

    <dialogue-reparation
      v-model="dialogReparation"
      :mode="modeReparation"
      :equipement="equipementReparation"
      :reparation-ouverte="reparationOuverte"
      @enregistre="apresReparation"
    />

    <patrimoine-details-dialogue v-model="dialogDetails" :equipement="equipementDetail" />
  </q-page>
</template>

<script setup lang="ts">
/**
 * Patrimoine matériel : l'inventaire, les catégories d'amortissement et les
 * réparations en cours.
 *
 * La page garde l'état partagé (les trois listes, les dialogues, la synthèse) ;
 * chaque onglet est un composant qui présente ses lignes et rend les actions.
 */
import { onMounted, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { montantLisible, nombreLisible } from '@/shared/utils/format';
import { ouvrirImpression } from '@/shared/services/impression';
import { patrimoineService } from '../services/patrimoine';
import DialoguePatrimoine from '../components/DialoguePatrimoine.vue';
import DialogueReparation from '../components/DialogueReparation.vue';
import PatrimoineEquipementsPanneau from '../components/PatrimoineEquipementsPanneau.vue';
import PatrimoineCategoriesPanneau from '../components/PatrimoineCategoriesPanneau.vue';
import PatrimoineReparationsPanneau from '../components/PatrimoineReparationsPanneau.vue';
import PatrimoineDetailsDialogue from '../components/PatrimoineDetailsDialogue.vue';
import type {
  CategoriePatrimoine,
  EquipementPatrimoine,
  ReparationMateriel,
  TableauBordPatrimoine,
} from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

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
      patrimoineService.listeEquipements({
        ...pageApi(p),
        search: texteApi(f.recherche),
        categorieId: f.categorieId || undefined,
        departementId: f.departementId || undefined,
        actif: f.actif || undefined,
        enReparation: f.enReparation || undefined,
      }),
  }),
);

const cat = reactive(
  useListePaginee<CategoriePatrimoine>({
    filtres: ref({}),
    pageSize: 0,
    charger: () =>
      patrimoineService
        .listeCategories()
        .then((reponse) => ({ data: Array.isArray(reponse) ? reponse : (reponse.data ?? []) })),
  }),
);

/** Réparations ouvertes, les plus anciennes d'abord ; chargées à l'ouverture de l'onglet. */
const rep = reactive(
  useListePaginee<ReparationMateriel>({
    filtres: ref({}),
    pageSize: 0,
    immediat: false,
    charger: () =>
      patrimoineService.listeReparations({}).then((reparations) => ({
        data: (reparations ?? [])
          .filter((r) => r.statut === 'EN_COURS' || r.statut === 'DECLARE')
          .sort((a, b) => new Date(a.dateDeclaration).getTime() - new Date(b.dateDeclaration).getTime()),
      })),
  }),
);

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

/** Les trois chiffres d'en-tête, ceux-là mêmes que reprend le Rectorat. */
async function chargerSynthese() {
  try {
    const data = await patrimoineService.tableauDeBord();
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

async function supprimerCategorie(c: CategoriePatrimoine) {
  const ok = await confirmer({
    titre: t('patrimoine.categories.confirmDelete.title'),
    message: t('patrimoine.categories.confirmDelete.message', { name: c.libelle }),
    ok: t('common.actions.delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await patrimoineService.supprimerCategorie(c.id);
  } catch {
    /* l'intercepteur axios affiche le motif */
    return;
  }
  $q.notify({ type: 'positive', message: t('patrimoine.messages.categoryDeleted') });
  await cat.recharger();
}

async function supprimerEquipement(e: EquipementPatrimoine) {
  const ok = await confirmer({
    titre: t('patrimoine.deleteEquipment.title'),
    message: t('patrimoine.deleteEquipment.message', { code: e.numeroInventaire }),
    ok: t('common.actions.delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await patrimoineService.supprimerEquipement(e.id);
  } catch {
    /* l'intercepteur axios affiche le motif */
    return;
  }
  $q.notify({ type: 'positive', message: t('patrimoine.messages.equipmentDeleted') });
  apresEquipement();
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
    (r.equipement as EquipementPatrimoine | undefined) ?? eq.lignes.find((e) => e.id === r.equipementId);
  if (!equipement) {
    $q.notify({ type: 'warning', message: t('patrimoine.messages.equipmentNotFound') });
    return;
  }
  ouvrirReparation(equipement, 'resoudre', r);
}

function imprimerEtiquette(e: EquipementPatrimoine) {
  void ouvrirImpression(`/patrimoine/equipements/${e.id}/imprimer`);
}

function voirDetails(e: EquipementPatrimoine) {
  equipementDetail.value = e;
  dialogDetails.value = true;
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
