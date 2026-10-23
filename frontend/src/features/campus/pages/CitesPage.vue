<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="t('cites.title')" :subtitle="t('cites.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          :icon="onglet === 'attributions' ? 'how_to_reg' : 'add'"
          :label="boutonOnglet"
          @click="ouvrirCourant"
        />
      </template>
    </en-tete-page>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="residences" icon="apartment" :label="$t('cites.tabs.residences')" no-caps />
      <q-tab name="chambres" icon="meeting_room" :label="$t('cites.tabs.chambres')" no-caps />
      <q-tab name="attributions" icon="how_to_reg" :label="$t('cites.tabs.attributions')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- RÉSIDENCES                                                       -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'residences'" name="residences" class="q-pa-none q-mt-md">
      <cites-residences-panneau
        v-model:filtres="filtresResidences"
        :residences="res.lignes"
        :chargement="res.chargement"
        :peut-gerer="peutGererResidences"
        :est-admin="auth.estAdmin"
        @creer="ouvrirResidence(null)"
        @modifier="ouvrirResidence"
        @supprimer="supprimerResidence"
        @voir-chambres="voirChambresDe"
        @reinitialiser="res.reinitialiser()"
      />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- CHAMBRES                                                         -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'chambres'" name="chambres" class="q-pa-none q-mt-md">
      <cites-chambres-panneau
        v-model:filtres="filtresChambres"
        v-model:page="ch.page"
        v-model:page-size="ch.pageSize"
        :lignes="ch.lignes"
        :chargement="ch.chargement"
        :total="ch.total"
        :residences="res.lignes"
        :peut-gerer="peutGererChambres"
        :est-admin="auth.estAdmin"
        @creer="ouvrirChambre(null)"
        @modifier="ouvrirChambre"
        @supprimer="supprimerChambre"
        @voir-attributions="voirAttributionsDe"
        @reinitialiser="ch.reinitialiser()"
      />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- ATTRIBUTIONS                                                     -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'attributions'" name="attributions" class="q-pa-none q-mt-md">
      <cites-attributions-panneau
        v-model:filtres="filtresAttributions"
        v-model:page="att.page"
        v-model:page-size="att.pageSize"
        :lignes="att.lignes"
        :chargement="att.chargement"
        :total="att.total"
        :residences="res.lignes"
        :annees="annees"
        :peut-decider="peutDecider"
        :peut-creer="peutCreerAttribution"
        :est-admin="auth.estAdmin"
        @creer="ouvrirCourant"
        @decider="ouvrirDecision"
        @retirer="retirerAttribution"
        @voir-etudiant="voirEtudiant"
        @reinitialiser="att.reinitialiser([])"
        @rechercher="att.recharger()"
      />
    </q-tab-panel>

    <!-- Dialogues -->
    <dialogue-residence v-model="residenceDialog" :residence="residenceEditee" @enregistre="res.recharger()" />
    <dialogue-chambre
      v-model="chambreDialog"
      :chambre="chambreEditee"
      :residences="res.lignes"
      @enregistre="ch.recharger()"
    />
    <!-- `ouvrirCourant` charge tout le parc avant d'ouvrir ce dialogue :
         l'attribution doit pouvoir viser une chambre hors de la page affichée. -->
    <dialogue-attribution
      v-model="attributionDialog"
      :chambres="chambresDialogue"
      :annees="annees"
      :annee-defaut-id="anneeDefaut"
      @enregistre="att.recharger()"
    />

    <!-- Dialog de décision du jury -->
    <cites-decision-attribution
      v-model="decisionDialog"
      :attribution="decision"
      :en-cours="decisionEnCours"
      @confirme="decider"
    />
  </q-page>
</template>

<script setup lang="ts">
/**
 * Cité universitaire : le parc de résidences, les chambres et les attributions
 * de logement.
 *
 * La page garde l'état partagé (les trois listes, les filtres, les dialogues)
 * ; chaque onglet est un composant qui présente ses lignes et rend les
 * actions, que la page traite.
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { citesService } from '../services/cites';
import DialogueResidence from '../components/DialogueResidence.vue';
import DialogueChambre from '../components/DialogueChambre.vue';
import DialogueAttribution from '../components/DialogueAttribution.vue';
import CitesResidencesPanneau from '../components/CitesResidencesPanneau.vue';
import CitesChambresPanneau from '../components/CitesChambresPanneau.vue';
import CitesAttributionsPanneau from '../components/CitesAttributionsPanneau.vue';
import CitesDecisionAttribution from '../components/CitesDecisionAttribution.vue';
import type { AnneeAcademique, AttributionLogement, Chambre, Residence } from '@/types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer, confirmerAvecSaisie } = useConfirmation();

const onglet = ref<'residences' | 'chambres' | 'attributions'>('residences');
const annees = ref<AnneeAcademique[]>([]);
const anneeDefaut = ref<string | null>(null);

const residenceDialog = ref(false);
const residenceEditee = ref<Residence | null>(null);
const chambreDialog = ref(false);
const chambreEditee = ref<Chambre | null>(null);
const attributionDialog = ref(false);
/** Tout le parc, pas seulement la page affichée : voir `ouvrirCourant`. */
const chambresDialogue = ref<Chambre[]>([]);

// ------------------------------------------------------------------ listes
// Trois listes sur une page : chacune garde ses filtres dans l'URL sous son
// préfixe (res_, ch_, at_).

/** Résidences : peu nombreuses, chargées en entier et filtrées par l'onglet. */
const filtresResidences = ref<Record<string, any>>({ recherche: '', capaciteMin: null, actif: null, ville: '' });
const res = reactive(
  useListePaginee<Residence>({
    filtres: filtresResidences,
    pageSize: 0,
    clesLocales: true,
    syncUrl: true,
    prefixeUrl: 'res_',
    charger: () => citesService.listeResidences({ all: '1' }),
  }),
);

const filtresChambres = ref<Record<string, any>>({ recherche: '', residenceId: null, categorie: null, statut: null });
const ch = reactive(
  useListePaginee<Chambre>({
    filtres: filtresChambres,
    syncUrl: true,
    prefixeUrl: 'ch_',
    charger: ({ filtres: f, ...p }) =>
      citesService.listeChambres({
        ...pageApi(p),
        search: texteApi(f.recherche),
        residenceId: f.residenceId || undefined,
        categorie: f.categorie || undefined,
        statut: f.statut || undefined,
      }),
  }),
);

const filtresAttributions = ref<Record<string, any>>({ anneeId: null, statut: null, residenceId: null, etudiant: '' });
const att = reactive(
  useListePaginee<AttributionLogement>({
    filtres: filtresAttributions,
    syncUrl: true,
    prefixeUrl: 'at_',
    clesTexte: ['etudiant'],
    charger: ({ filtres: f, ...p }) =>
      citesService.listeAttributions({
        ...pageApi(p),
        anneeId: f.anneeId || undefined,
        statut: f.statut || undefined,
        residenceId: f.residenceId || undefined,
        search: texteApi(f.etudiant),
      }),
  }),
);

// ---------------------------------------------------------------- droits
const peutGererResidences = computed(() => auth.peut('cites.gererResidences'));
const peutGererChambres = computed(() => auth.peut('cites.gererChambres'));
const peutDecider = computed(() => auth.peut('cites.decider'));
const peutCreerAttribution = computed(() => auth.peut('cites.creerAttribution'));

const peutGerer = computed(() =>
  onglet.value === 'residences'
    ? peutGererResidences.value
    : onglet.value === 'chambres'
      ? peutGererChambres.value
      : peutCreerAttribution.value,
);

const boutonOnglet = computed(() =>
  onglet.value === 'residences'
    ? t('cites.actions.newResidence')
    : onglet.value === 'chambres'
      ? t('cites.actions.newChambre')
      : t('cites.actions.newAttribution'),
);

function ouvrirCourant() {
  if (onglet.value === 'residences') ouvrirResidence(null);
  else if (onglet.value === 'chambres') ouvrirChambre(null);
  else {
    // La page courante d'abord, puis tout le parc dès qu'il arrive : le
    // dialogue d'attribution doit pouvoir viser n'importe quelle chambre.
    chambresDialogue.value = ch.lignes;
    void ch
      .chargerTout()
      .then((toutes) => (chambresDialogue.value = toutes))
      .catch(() => undefined);
    attributionDialog.value = true;
  }
}

/** Une décision ou un retrait change l'état des chambres et des résidences. */
const rechargerParc = () => Promise.all([att.recharger(), ch.recharger(), res.recharger()]);

// ----------------------------------------------------------- résidences
function ouvrirResidence(r: Residence | null) {
  residenceEditee.value = r;
  residenceDialog.value = true;
}

async function supprimerResidence(r: Residence) {
  const ok = await confirmer({
    titre: t('cites.residences.dialogs.delete.title'),
    message: t('cites.residences.dialogs.delete.message', { nom: r.nom, code: r.code }),
    ok: t('common.actions.delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await citesService.supprimerResidence(r.id);
  } catch {
    /* l'intercepteur axios affiche le motif */
    return;
  }
  $q.notify({ type: 'positive', message: t('cites.residences.dialogs.deleted') });
  await res.recharger();
}

// ---------------------------------------------------------------- chambres
function ouvrirChambre(c: Chambre | null) {
  chambreEditee.value = c;
  chambreDialog.value = true;
}

async function supprimerChambre(c: Chambre) {
  const ok = await confirmer({
    titre: t('cites.chambres.dialogs.delete.title'),
    message: t('cites.chambres.dialogs.delete.message', { code: c.code }),
    ok: t('common.actions.delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await citesService.supprimerChambre(c.id);
  } catch {
    /* l'intercepteur axios affiche le motif */
    return;
  }
  $q.notify({ type: 'positive', message: t('cites.chambres.dialogs.deleted') });
  await ch.recharger();
}

// ------------------------------------------------------- décision du jury
const decisionDialog = ref(false);
const decision = ref<AttributionLogement | null>(null);
const decisionEnCours = ref(false);

function ouvrirDecision(a: AttributionLogement) {
  decision.value = a;
  decisionDialog.value = true;
}

async function decider(statut: 'ACCORDE' | 'REFUSE', commentaire?: string) {
  if (!decision.value) return;
  decisionEnCours.value = true;
  try {
    // Le backend attend `commentaire` : envoyé sous « motif », il était
    // silencieusement écarté et le motif de la décision se perdait.
    await citesService.deciderAttribution(decision.value.id, { statut, commentaire });
    $q.notify({
      type: statut === 'ACCORDE' ? 'positive' : 'info',
      message: statut === 'ACCORDE' ? t('cites.attributions.dialogs.accorded') : t('cites.attributions.dialogs.refused'),
    });
    decisionDialog.value = false;
    await rechargerParc();
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    decisionEnCours.value = false;
  }
}

async function retirerAttribution(a: AttributionLogement) {
  const motif = await confirmerAvecSaisie({
    titre: t('cites.attributions.dialogs.retirer.title'),
    message: t('cites.attributions.dialogs.retirer.message', {
      etudiant: `${a.etudiant?.nom} ${a.etudiant?.prenom}`,
      code: a.chambre?.code,
      residence: a.chambre?.residence?.nom,
    }),
    libelleSaisie: t('cites.attributions.dialogs.retirer.motifLabel'),
    ok: t('common.actions.withdraw'),
    danger: true,
  });
  if (motif === null) return;
  try {
    await citesService.retirerAttribution(a.id, { motif: motif || undefined });
    $q.notify({ type: 'positive', message: t('cites.attributions.dialogs.withdrawn') });
    await rechargerParc();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

function voirEtudiant(a: AttributionLogement) {
  const e = a.etudiant;
  if (!e) return;
  const chambre = a.chambre
    ? t('cites.attributions.dialogs.etudiantDetail.chambreLine', {
        code: a.chambre.code,
        residence: a.chambre.residence?.nom ?? '—',
      })
    : '';
  $q.dialog({
    title: `${e.prenom} ${e.nom}`,
    message: t('cites.attributions.dialogs.etudiantDetail.message', {
      matricule: e.matricule,
      telephone: e.telephone ?? '—',
      email: e.email ?? '—',
      chambre,
    }),
    ok: { label: t('common.actions.close'), flat: true },
  });
}

/** Résidence → ses chambres : on bascule d'onglet en portant le filtre. */
function voirChambresDe(r: Residence) {
  filtresChambres.value = { recherche: '', residenceId: r.id };
  onglet.value = 'chambres';
}

/**
 * Chambre → qui l'occupe. Le service ne filtre pas par chambre : on cadre sur
 * sa résidence et on rappelle le code recherché.
 */
function voirAttributionsDe(c: Chambre) {
  filtresAttributions.value = c.residenceId ? { residenceId: c.residenceId } : {};
  onglet.value = 'attributions';
  $q.notify({
    type: 'info',
    message: t('cites.attributions.notify.attributionsOfResidence', { code: c.code }),
  });
}

// ------------------------------------------------------------------ chargement
onMounted(async () => {
  const reponse = await citesService.listeAnnees();
  annees.value = reponse.data;
  const active = annees.value.find((a) => a.active);
  if (active) {
    anneeDefaut.value = active.id;
    // L'année venue de l'URL (retour arrière) prime sur l'année active.
    if (!filtresAttributions.value.anneeId) filtresAttributions.value.anneeId = active.id;
  }
});
</script>
