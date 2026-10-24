<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('structure.title')" :subtitle="$t('structure.subtitle')" />

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="annees" icon="event" :label="$t('structure.tabs.annees')" no-caps />
      <q-tab name="departements" icon="apartment" :label="$t('structure.tabs.departements')" no-caps />
      <q-tab name="filieres" icon="account_tree" :label="$t('structure.tabs.filieres')" no-caps />
      <q-tab name="promotions" icon="groups" :label="$t('structure.tabs.promotions')" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ------------------------------------------------------- Années -->
      <q-tab-panel name="annees" class="q-pa-none">
        <panneau-structure-annees
          :annees="annees"
          :chargement="chargement"
          :filtre="filtres.annees"
          :titre-vide="messageVide('annees', t('structure.emptyState.annees'))"
          :peut-gerer="peutGerer"
          :peut-supprimer="peutSupprimer"
          @update:filtre="filtres.annees = $event"
          @nouvelle="ouvrirAnnee(null)"
          @modifier="ouvrirAnnee"
          @supprimer="supprimer('annees', $event.libelle, $event.id)"
          @voir-promotions="voirPromotionsDeLAnnee"
        />
      </q-tab-panel>

      <!-- -------------------------------------------------- Départements -->
      <q-tab-panel name="departements" class="q-pa-none">
        <panneau-structure-departements
          :departements="departements"
          :chargement="chargement"
          :filtre="filtres.departements"
          :titre-vide="messageVide('departements', t('structure.emptyState.departements'))"
          :peut-gerer="peutGerer"
          :peut-supprimer="peutSupprimer"
          @update:filtre="filtres.departements = $event"
          @nouvelle="ouvrirDepartement(null)"
          @modifier="ouvrirDepartement"
          @supprimer="supprimer('departements', $event.nom, $event.id)"
          @voir-filieres="voirFilieresDuDepartement"
        />
      </q-tab-panel>

      <!-- ------------------------------------------------------ Filières -->
      <q-tab-panel name="filieres" class="q-pa-none">
        <panneau-structure-filieres
          :filieres="filieresFiltrees"
          :chargement="chargement"
          :filtre="filtres.filieres"
          :chips="chipsFilieres"
          :options-departements="optionsDepartements"
          :titre-vide="messageVide('filieres', t('structure.emptyState.filieres'))"
          :peut-gerer="peutGerer"
          :peut-supprimer="peutSupprimer"
          @update:filtre="filtres.filieres = $event"
          @nouvelle="ouvrirFiliere(null)"
          @modifier="ouvrirFiliere"
          @supprimer="supprimer('filieres', $event.nom, $event.id)"
          @voir-promotions="voirPromotionsDeLaFiliere"
        />
      </q-tab-panel>

      <!-- ---------------------------------------------------- Promotions -->
      <q-tab-panel name="promotions" class="q-pa-none">
        <panneau-structure-promotions
          :promotions="promotionsFiltrees"
          :chargement="chargement"
          :filtre="filtres.promotions"
          :chips="chipsPromotions"
          :options-filieres="optionsFilieres"
          :options-annees="optionsAnnees"
          :titre-vide="messageVide('promotions', t('structure.emptyState.promotions'))"
          :peut-gerer="peutGerer"
          :peut-supprimer="peutSupprimer"
          @update:filtre="filtres.promotions = $event"
          @nouvelle="ouvrirPromotion(null)"
          @modifier="ouvrirPromotion"
          @supprimer="supprimer('promotions', $event.nom, $event.id)"
          @voir-charges="voirChargesDeLaPromotion"
        />
      </q-tab-panel>
    </q-tab-panels>

    <!-- Formulaire année -->
    <dialogue-formulaire
      v-model="dialogAnnee"
      :titre="anneeEditee ? $t('structure.dialogs.annee.editTitle') : $t('structure.dialogs.annee.newTitle')"
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerAnnee"
    >
      <q-input
        v-model="formAnnee.libelle"
        outlined
        dense
        :label="$t('common.fields.labelRequired')"
        :hint="$t('structure.dialogs.annee.libelleHint')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.annee.libelleError')]"
      />
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <champ-date v-model="formAnnee.dateDebut" :label="$t('common.fields.start')" />
        </div>
        <div class="col-6">
          <champ-date v-model="formAnnee.dateFin" :label="$t('common.fields.end')" />
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
      :titre="
        departementEdite ? $t('structure.dialogs.departement.editTitle') : $t('structure.dialogs.departement.newTitle')
      "
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerDepartement"
    >
      <q-input
        v-model="formDepartement.code"
        outlined
        dense
        :label="$t('common.fields.codeRequired')"
        :hint="$t('structure.dialogs.departement.codeHint')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.departement.codeError')]"
      />
      <q-input
        v-model="formDepartement.nom"
        outlined
        dense
        :label="$t('common.fields.nameRequired')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.departement.nomError')]"
      />
      <q-input v-model="formDepartement.faculte" outlined dense :label="$t('structure.dialogs.departement.faculte')" />
    </dialogue-formulaire>

    <!-- Formulaire filière -->
    <dialogue-formulaire
      v-model="dialogFiliere"
      :titre="filiereEditee ? $t('structure.dialogs.filiere.editTitle') : $t('structure.dialogs.filiere.newTitle')"
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerFiliere"
    >
      <q-input
        v-model="formFiliere.code"
        outlined
        dense
        :label="$t('common.fields.codeRequired')"
        :rules="[(v: string) => !!(v ?? '').trim() || $t('structure.dialogs.filiere.codeError')]"
      />
      <q-input
        v-model="formFiliere.nom"
        outlined
        dense
        :label="$t('common.fields.nameRequired')"
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
      :titre="
        promotionEditee ? $t('structure.dialogs.promotion.editTitle') : $t('structure.dialogs.promotion.newTitle')
      "
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrerPromotion"
    >
      <q-input
        v-model="formPromotion.nom"
        outlined
        dense
        :label="$t('common.fields.nameRequired')"
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
            :label="$t('common.fields.headcount')"
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
        :label="$t('common.fields.academicYearRequired')"
        :rules="[(v: string) => !!v || $t('structure.dialogs.promotion.anneeError')]"
      />
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import ChampDate from '@/shared/components/ChampDate.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import { NIVEAUX } from '@/shared/utils/libelles';
import PanneauStructureAnnees from '@/features/administration/components/PanneauStructureAnnees.vue';
import PanneauStructureDepartements from '@/features/administration/components/PanneauStructureDepartements.vue';
import PanneauStructureFilieres from '@/features/administration/components/PanneauStructureFilieres.vue';
import PanneauStructurePromotions from '@/features/administration/components/PanneauStructurePromotions.vue';
import { structureService, type PromotionListee } from '@/features/administration/services/structure';
import type { AnneeAcademique, Departement, Filiere, Niveau, ChipFiltre } from '@/types';

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
const peutGerer = computed(() => auth.peut('structure.gerer'));
const peutSupprimer = computed(() => auth.peut('structure.supprimer'));

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
const formPromotion = ref({ nom: '', niveau: 'L1' as Niveau, effectif: 0, filiereId: '', anneeId: '' });

const optionsDepartements = computed(() => departements.value.map((d) => ({ label: d.nom, value: d.id })));
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
    anneeId: p?.anneeId ?? filtres.value.promotions.anneeId ?? referentiels.anneeCourante?.id ?? '',
  };
  dialogPromotion.value = true;
}

/**
 * Enregistrement commun : validation faite, appel, notification, rechargement.
 * L'appel est délégué au service ; en cas d'échec, le formulaire reste ouvert.
 */
async function envoyer(appelle: () => Promise<unknown>, messageOk: string) {
  enregistrement.value = true;
  try {
    await appelle();
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
  const edition = anneeEditee.value;
  const ok = await envoyer(
    () =>
      edition
        ? structureService.modifierAnnee(edition.id, formAnnee.value)
        : structureService.creerAnnee(formAnnee.value),
    t('structure.messages.anneeSaved'),
  );
  if (ok) {
    dialogAnnee.value = false;
  }
}

async function enregistrerDepartement() {
  const edition = departementEdite.value;
  const payload = { ...formDepartement.value, faculte: formDepartement.value.faculte || undefined };
  const ok = await envoyer(
    () =>
      edition ? structureService.modifierDepartement(edition.id, payload) : structureService.creerDepartement(payload),
    t('structure.messages.departementSaved'),
  );
  if (ok) {
    dialogDepartement.value = false;
  }
}

async function enregistrerFiliere() {
  const edition = filiereEditee.value;
  const ok = await envoyer(
    () =>
      edition
        ? structureService.modifierFiliere(edition.id, formFiliere.value)
        : structureService.creerFiliere(formFiliere.value),
    t('structure.messages.filiereSaved'),
  );
  if (ok) {
    dialogFiliere.value = false;
  }
}

async function enregistrerPromotion() {
  const edition = promotionEditee.value;
  const ok = await envoyer(
    () =>
      edition
        ? structureService.modifierPromotion(edition.id, formPromotion.value)
        : structureService.creerPromotion(formPromotion.value),
    t('structure.messages.promotionSaved'),
  );
  if (ok) {
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
      titre: t('common.actions.delete'),
      message: t('structure.deleteDialog.message', { label: libelle }),
      ok: t('common.actions.delete'),
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
      structureService.filieres(),
      referentiels.promotions(),
    ]);
    annees.value = a;
    departements.value = d;
    filieres.value = f.data;
    promotions.value = p as PromotionListee[];
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

onMounted(charger);
</script>

<style scoped lang="scss"></style>
